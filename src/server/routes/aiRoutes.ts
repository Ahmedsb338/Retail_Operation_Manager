import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Type, type GoogleGenAI } from '@google/genai';
import {
  actionPlans,
  aiDiagnosticSnapshots,
  branchHealthConfigs,
  branches,
  complaints,
  salesBoxes,
  staffMembers,
  storeRpmRecords,
  storeTasks,
  tnpsStoreRecords,
} from '../../db/schema.ts';
import { writeAuditLog } from '../security/audit.ts';
import { DatabaseRateLimitStore } from '../security/rateLimit.ts';
import {
  getClientIp,
  requireAuth,
  resolveScopedBranches,
  type AppRequest,
} from '../middleware/auth.ts';

const analyzeRequestSchema = z
  .object({
    branchCode: z.string().trim().max(60).optional(),
    language: z.enum(['en', 'ar']).optional().default('en'),
  })
  .strict();

const AI_RATE_POLICY = {
  scope: 'ai_diagnostics',
  maxHits: 10,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 5 * 60 * 1000,
};

export function createAiRouter(getAiClient: () => GoogleGenAI | null): Router {
  const router = Router();

  router.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const principal = req.principal!;
      const requestedBranch = String(
        req.query.branchCode || principal.branchCode || principal.authorizedBranches[0]?.code || ''
      ).trim();

      if (!requestedBranch) {
        res.json({ snapshot: null });
        return;
      }

      const scope = resolveScopedBranches(principal, requestedBranch);
      if (scope.error || scope.branches.length === 0) {
        res.status(403).json({ error: scope.error || 'Selected branch is outside your assigned scope.' });
        return;
      }

      const rows = await db
        .select()
        .from(aiDiagnosticSnapshots)
        .where(eq(aiDiagnosticSnapshots.branchCode, scope.branches[0].code))
        .orderBy(desc(aiDiagnosticSnapshots.generatedAt))
        .limit(1);

      res.json({ snapshot: rows[0] ?? null });
    } catch (err) {
      next(err);
    }
  });

  router.post('/analyze', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          error: 'AI analysis accepts only branchCode and language; server loads authoritative database records directly.',
        });
        return;
      }

      const db = req.db!;
      const principal = req.principal!;
      const targetBranchCode =
        principal.role === 'STORE_MANAGER'
          ? principal.branchCode!
          : parsed.data.branchCode || principal.authorizedBranches[0]?.code || '';

      if (!targetBranchCode) {
        res.status(400).json({ error: 'Select an authorized branch to analyze.' });
        return;
      }

      const scope = resolveScopedBranches(principal, targetBranchCode);
      if (scope.error || scope.branches.length === 0) {
        res.status(403).json({ error: scope.error || 'Selected branch is outside your assigned scope.' });
        return;
      }

      const branchCode = scope.branches[0].code;
      const rateLimiter = new DatabaseRateLimitStore(db);
      const principalKey =
        principal.role === 'STORE_MANAGER'
          ? `branch:${branchCode}`
          : `area:${principal.areaManagerId}`;
      const rateDecision = await rateLimiter.checkAndConsume(
        `ai:${principalKey}`,
        AI_RATE_POLICY
      );
      if (!rateDecision.allowed) {
        res.setHeader('Retry-After', String(rateDecision.retryAfterSeconds));
        res.status(429).json({
          error: `AI diagnostic rate limit exceeded. Retry in ${rateDecision.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateDecision.retryAfterSeconds,
        });
        return;
      }

      const aiClient = getAiClient();
      if (!aiClient) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
          geminiAvailable: false,
        });
        return;
      }

      // Load authoritative stored records directly from PostgreSQL
      const [
        branchRows,
        tasks,
        staff,
        boxes,
        branchComplaints,
        storeRpm,
        tnpsStore,
        plans,
        healthConfigs,
      ] = await Promise.all([
        db.select().from(branches).where(eq(branches.code, branchCode)),
        db.select().from(storeTasks).where(eq(storeTasks.branchCode, branchCode)),
        db.select().from(staffMembers).where(eq(staffMembers.branchCode, branchCode)),
        db.select().from(salesBoxes).where(eq(salesBoxes.branchCode, branchCode)),
        db.select().from(complaints).where(eq(complaints.branchCode, branchCode)),
        db.select().from(storeRpmRecords).where(eq(storeRpmRecords.branchCode, branchCode)),
        db.select().from(tnpsStoreRecords).where(eq(tnpsStoreRecords.branchCode, branchCode)),
        db.select().from(actionPlans).where(eq(actionPlans.branchCode, branchCode)),
        db.select().from(branchHealthConfigs).where(eq(branchHealthConfigs.branchCode, branchCode)),
      ]);

      const branch = branchRows[0];
      if (!branch) {
        res.status(404).json({ error: 'Branch record not found.' });
        return;
      }

      const prompt = `You are a Senior Retail Operations Management Consultant. Analyze ONLY the authoritative stored PostgreSQL records for retail branch ${branch.code} (${branch.name}, Store ID: ${branch.storeId}) as of ${branch.businessDate || 'current period'}.

CRITICAL RULES:
- Analyze ONLY the actual records provided below. Never hallucinate, extrapolate, or invent metrics, employees, or tasks.
- If a dataset is empty or a metric is null/unconfigured, explicitly state it is unavailable/unconfigured.
- Target language: ${parsed.data.language === 'ar' ? 'Both English and Arabic fields populated appropriately' : 'English with Arabic translations included'}.

AUTHORITATIVE DATABASE RECORDS:
- Branch: ${JSON.stringify({ code: branch.code, storeId: branch.storeId, name: branch.name, city: branch.city, area: branch.area, businessDate: branch.businessDate })}
- Health Weights: ${JSON.stringify(healthConfigs[0] ?? 'Default')}
- Tasks (${tasks.length}): ${JSON.stringify(tasks.slice(0, 60).map((t) => ({ id: t.id, title: t.title, category: t.category, priority: t.priority, status: t.status, dueDate: t.dueDate, owner: t.owner, notes: t.notes })))}
- Sales Boxes (${boxes.length}): ${JSON.stringify(boxes.map((b) => ({ name: b.name, target: b.target, actual: b.actual, remainingDays: b.remainingWorkingDays, unit: b.unit })))}
- Staff (${staff.length}): ${JSON.stringify(staff.slice(0, 60).map((s) => ({ name: s.name, sid: s.sid, role: s.roleTitle, knowledge: s.productKnowledgeScore, productivity: s.productivityScore, csat: s.customerExperienceScore, coachingStatus: s.coachingStatus, developmentAreas: s.developmentAreas })))}
- Complaints (${branchComplaints.length}): ${JSON.stringify(branchComplaints.slice(0, 60).map((c) => ({ caseNumber: c.caseNumber, category: c.category, repeated: c.isRepeated, rootCause: c.rootCause, status: c.status })))}
- Store RPM (${storeRpm.length}): ${JSON.stringify(storeRpm.slice(0, 60).map((r) => ({ month: r.month, pillar: r.pillar, actual: r.actual, target: r.target, achievementPercent: r.achievementPercent })))}
- TNPS Store (${tnpsStore.length}): ${JSON.stringify(tnpsStore.slice(0, 30).map((t) => ({ type: t.recordType, month: t.month, businessDate: t.businessDate, score: t.score, benchmark: t.benchmark })))}
- Action Plans (${plans.length}): ${JSON.stringify(plans.slice(0, 40).map((p) => ({ agentName: p.agentName, pillars: p.pillars, reason: p.reason, status: p.status, dueDate: p.dueDate })))}

Generate a grounded JSON analysis with concrete, prioritized action plan items.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              branchOverview: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  summaryAr: { type: Type.STRING },
                  operationalWeaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                  operationalWeaknessesAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                  immediatePriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  immediatePrioritiesAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['summary', 'summaryAr', 'operationalWeaknesses', 'operationalWeaknessesAr', 'immediatePriorities', 'immediatePrioritiesAr'],
              },
              operationsIntelligence: {
                type: Type.OBJECT,
                properties: {
                  overdueTasksCount: { type: Type.NUMBER },
                  auditStatus: { type: Type.STRING },
                  auditStatusAr: { type: Type.STRING },
                  criticalFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                  criticalFindingsAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['overdueTasksCount', 'auditStatus', 'auditStatusAr', 'criticalFindings', 'criticalFindingsAr'],
              },
              teamInsights: {
                type: Type.OBJECT,
                properties: {
                  criticalGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  criticalGapsAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                  topPerformer: { type: Type.STRING },
                  topPerformerAr: { type: Type.STRING },
                  priorityCoachees: { type: Type.ARRAY, items: { type: Type.STRING } },
                  priorityCoacheesAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['criticalGaps', 'criticalGapsAr', 'topPerformer', 'topPerformerAr', 'priorityCoachees', 'priorityCoacheesAr'],
              },
              salesIntelligence: {
                type: Type.OBJECT,
                properties: {
                  weakestBox: { type: Type.STRING },
                  weakestBoxAr: { type: Type.STRING },
                  runRateAlert: { type: Type.STRING },
                  runRateAlertAr: { type: Type.STRING },
                  strategicActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  strategicActionsAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['weakestBox', 'weakestBoxAr', 'runRateAlert', 'runRateAlertAr', 'strategicActions', 'strategicActionsAr'],
              },
              customerInsights: {
                type: Type.OBJECT,
                properties: {
                  agingSummary: { type: Type.STRING },
                  agingSummaryAr: { type: Type.STRING },
                  recurringRootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recurringRootCausesAr: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['agingSummary', 'agingSummaryAr', 'recurringRootCauses', 'recurringRootCausesAr'],
              },
              actionPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    issue: { type: Type.STRING },
                    issueAr: { type: Type.STRING },
                    evidence: { type: Type.STRING },
                    evidenceAr: { type: Type.STRING },
                    businessImpact: { type: Type.STRING },
                    businessImpactAr: { type: Type.STRING },
                    recommendedAction: { type: Type.STRING },
                    recommendedActionAr: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['Critical', 'High', 'Medium'] },
                    suggestedOwner: { type: Type.STRING },
                    suggestedDeadline: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'issue',
                    'issueAr',
                    'evidence',
                    'evidenceAr',
                    'businessImpact',
                    'businessImpactAr',
                    'recommendedAction',
                    'recommendedActionAr',
                    'priority',
                    'suggestedOwner',
                    'suggestedDeadline',
                  ],
                },
              },
            },
            required: [
              'branchOverview',
              'operationsIntelligence',
              'teamInsights',
              'salesIntelligence',
              'customerInsights',
              'actionPlan',
            ],
          },
        },
      });

      const analysisPayload = {
        ...(JSON.parse(response.text || '{}') as Record<string, unknown>),
        generatedAt: new Date().toISOString(),
        isLiveAi: true,
        modelUsed: 'gemini-4-hydrogen',
      };

      if (principal.role === 'STORE_MANAGER') {
        await db.insert(aiDiagnosticSnapshots).values({
          branchCode,
          isLiveAi: true,
          modelUsed: 'gemini-4-hydrogen',
          analysisJson: analysisPayload,
        });
      }

      await writeAuditLog(db, {
        actorType: principal.role,
        actorRole: principal.role,
        actorIdentifier: principal.username,
        branchCode,
        action: 'RUN_AI_DIAGNOSTIC',
        domain: 'ai_diagnostics',
        ipAddress: getClientIp(req),
      });

      res.json(analysisPayload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
