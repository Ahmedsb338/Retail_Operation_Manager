import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Operation Manager for Retail Backend',
    geminiConfigured: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// AI Diagnostic Endpoint: analyzes actual stored records only
app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
  const { branch, tasks, employees, salesBoxes, cases, healthCategories, overallHealthScore, language } = req.body;

  if (!aiClient) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Returning deterministic grounded analysis.',
      geminiAvailable: false,
    });
  }

  try {
    const prompt = `You are a Senior Retail Operations Management Consultant. Analyze the provided actual stored operations records for retail branch ${branch?.code} (${branch?.name}) as of ${branch?.businessDate}.

CRITICAL RULES:
- Analyze ONLY the actual records provided below. Never hallucinate, extrapolate, or invent metrics, employees, or tasks.
- If data is missing or incomplete, explicitly state it is unavailable.
- Clearly separate verified historical facts from recommended forward-looking management actions.
- Target language: ${language === 'ar' ? 'Both English and Arabic fields populated appropriately' : 'English with Arabic translations included'}.

STORED RECORDS SUMMARY:
- Branch: ${JSON.stringify(branch)}
- Health Score: ${overallHealthScore}/100
- Health Categories: ${JSON.stringify(healthCategories)}
- Tasks (${tasks?.length || 0} total): ${JSON.stringify(
      tasks?.map((t: any) => ({
        id: t.id,
        title: t.title,
        titleAr: t.titleAr,
        category: t.category,
        priority: t.priority,
        status: t.status,
        deadline: t.deadline,
        notes: t.notes,
        owner: t.owner,
      }))
    )}
- Sales Boxes (${salesBoxes?.length || 0} boxes): ${JSON.stringify(
      salesBoxes?.map((b: any) => ({
        name: b.name,
        nameAr: b.nameAr,
        target: b.target,
        actual: b.actual,
        remainingDays: b.remainingWorkingDays,
        unit: b.unit,
        unitAr: b.unitAr,
      }))
    )}
- Employees (${employees?.length || 0} team members): ${JSON.stringify(
      employees?.map((e: any) => ({
        name: e.name,
        nameAr: e.nameAr,
        role: e.role,
        roleAr: e.roleAr,
        knowledge: e.productKnowledgeScore,
        productivity: e.productivityScore,
        csat: e.customerExperienceScore,
        coachingStatus: e.coachingStatus,
        developmentAreas: e.developmentAreas,
      }))
    )}
- Customer Cases (${cases?.length || 0} cases): ${JSON.stringify(
      cases?.map((c: any) => ({
        number: c.caseNumber,
        category: c.issueCategory,
        categoryAr: c.issueCategoryAr,
        repeated: c.isRepeated,
        criteria: c.repeatedMatchCriteria,
        rootCause: c.rootCause,
        rootCauseAr: c.rootCauseAr,
        status: c.status,
      }))
    )}

Generate a grounded JSON analysis with concrete, prioritized action plan items.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
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

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      ...parsed,
      generatedAt: new Date().toISOString(),
      isLiveAi: true,
      modelUsed: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Gemini API execution error:', error);
    return res.status(500).json({
      error: error.message || 'Error processing AI diagnostics',
      geminiAvailable: true,
    });
  }
});

// Setup Vite middleware in dev or serve static build in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Operation Manager for Retail] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
