import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  branchHealthConfigs,
  complaints,
  salesBoxes,
  staffMembers,
  storeTasks,
  targetCalculatorStates,
  tnpsStoreRecords,
} from '../../db/schema.ts';
import type { ImportReason, ImportSummary } from '../services/csvXlsx.ts';
import { writeAuditLog } from '../security/audit.ts';
import {
  getClientIp,
  requireAuth,
  requireStoreManager,
  type AppRequest,
} from '../middleware/auth.ts';

const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  titleAr: z.string().max(300).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  descriptionAr: z.string().max(2000).optional().default(''),
  category: z.string().max(80).optional().default('store'),
  subcategory: z.string().max(80).optional().default(''),
  owner: z.string().max(160).optional().default(''),
  ownerRole: z.string().max(120).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']).optional().default('not_started'),
  deadline: z.string().max(60).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  evidenceText: z.string().max(1000).optional().default(''),
  createdAt: z.string().max(60).optional(),
});

const employeeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  nameAr: z.string().max(160).optional().default(''),
  identifier: z.string().trim().max(80).optional().default(''),
  role: z.string().max(120).optional().default(''),
  roleAr: z.string().max(120).optional().default(''),
  productKnowledgeScore: z.number().min(0).max(100).nullable().optional(),
  productivityScore: z.number().min(0).max(100).nullable().optional(),
  customerExperienceScore: z.number().min(0).max(100).nullable().optional(),
  coachingStatus: z.string().max(60).optional().default('needs_coaching'),
  developmentAreas: z.array(z.string()).optional().default([]),
  coachingNotes: z.string().max(2000).optional().default(''),
  agreedActions: z.string().max(2000).optional().default(''),
  assignedCoach: z.string().max(160).optional().default(''),
  followUpDate: z.string().max(60).optional().default(''),
  progressStatus: z.string().max(60).optional().default('pending'),
});

const salesBoxSchema = z.object({
  name: z.string().trim().min(1).max(160),
  nameAr: z.string().max(160).optional().default(''),
  target: z.number().min(0),
  actual: z.number().min(0),
  unit: z.string().max(60).optional().default(''),
  unitAr: z.string().max(60).optional().default(''),
  remainingWorkingDays: z.number().int().min(0).optional().default(0),
  trend: z.enum(['up', 'down', 'stable']).optional().default('stable'),
  dailyHistory: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

const caseSchema = z.object({
  caseNumber: z.string().trim().min(1).max(80),
  customerIdentifier: z.string().max(160).optional().default(''),
  issueCategory: z.string().max(160).optional().default('General'),
  issueCategoryAr: z.string().max(160).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  isRepeated: z.boolean().optional().default(false),
  repeatedMatchCriteria: z.string().max(300).optional().default(''),
  rootCause: z.string().max(300).optional().default(''),
  rootCauseAr: z.string().max(300).optional().default(''),
  assignedOwner: z.string().max(160).optional().default(''),
  createdAt: z.string().max(60).optional().default(''),
  resolutionDeadline: z.string().max(60).optional().default(''),
  status: z.enum(['pending', 'under_review', 'resolved', 'escalated']).optional().default('pending'),
  correctiveAction: z.string().max(2000).optional().default(''),
  resolutionNotes: z.string().max(2000).optional().default(''),
});

const migrationBundleSchema = z.object({
  confirmed: z.boolean().optional().default(false),
  bundle: z.object({
    tasks: z.array(z.unknown()).optional().default([]),
    employees: z.array(z.unknown()).optional().default([]),
    salesBoxes: z.array(z.unknown()).optional().default([]),
    cases: z.array(z.unknown()).optional().default([]),
    healthWeights: z
      .object({
        dailyOperations: z.number().int().min(0).max(100),
        salesPerformance: z.number().int().min(0).max(100),
        teamPerformance: z.number().int().min(0).max(100),
        customerExperience: z.number().int().min(0).max(100),
        complianceAudits: z.number().int().min(0).max(100),
      })
      .optional(),
    targetCalculator: z.record(z.string(), z.unknown()).optional(),
    tnpsDailyRecords: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }),
});

export function createLocalMigrationRouter(): Router {
  const router = Router();

  async function evaluateBundle(
    req: AppRequest,
    commitChanges: boolean
  ): Promise<{
    summary: ImportSummary;
    perDomain: Record<string, { valid: number; invalid: number; duplicate: number }>;
    verifiedInsertedIds: string[];
  }> {
    const db = req.db!;
    const branchCode = req.principal!.branchCode!;
    const parsed = migrationBundleSchema.parse(req.body);
    const { bundle } = parsed;

    const [existingTasks, existingStaff, existingBoxes, existingCases, existingTnps] =
      await Promise.all([
        db.select().from(storeTasks).where(eq(storeTasks.branchCode, branchCode)),
        db.select().from(staffMembers).where(eq(staffMembers.branchCode, branchCode)),
        db.select().from(salesBoxes).where(eq(salesBoxes.branchCode, branchCode)),
        db.select().from(complaints).where(eq(complaints.branchCode, branchCode)),
        db.select().from(tnpsStoreRecords).where(eq(tnpsStoreRecords.branchCode, branchCode)),
      ]);

    const taskKeys = new Set(existingTasks.map((t) => `${t.title.toLowerCase()}|${t.dueDate || t.date}`));
    const staffSids = new Set(existingStaff.map((s) => s.sid).filter(Boolean));
    const staffNames = new Set(existingStaff.map((s) => s.name.toLowerCase()));
    const boxKeys = new Set(existingBoxes.map((b) => b.name.toLowerCase()));
    const caseNums = new Set(existingCases.map((c) => c.caseNumber.toLowerCase()));
    const tnpsDates = new Set(existingTnps.map((t) => t.businessDate).filter(Boolean));

    const reasons: ImportReason[] = [];
    let total = 0;
    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    let imported = 0;
    const verifiedInsertedIds: string[] = [];

    const validTasks: Array<z.infer<typeof taskSchema>> = [];
    const validEmployees: Array<z.infer<typeof employeeSchema>> = [];
    const validBoxes: Array<z.infer<typeof salesBoxSchema>> = [];
    const validCases: Array<z.infer<typeof caseSchema>> = [];

    const perDomain = {
      tasks: { valid: 0, invalid: 0, duplicate: 0 },
      staff: { valid: 0, invalid: 0, duplicate: 0 },
      salesBoxes: { valid: 0, invalid: 0, duplicate: 0 },
      complaints: { valid: 0, invalid: 0, duplicate: 0 },
      tnpsDailyRecords: { valid: 0, invalid: 0, duplicate: 0 },
    };

    for (let i = 0; i < bundle.tasks.length; i += 1) {
      total += 1;
      const r = taskSchema.safeParse(bundle.tasks[i]);
      if (!r.success) {
        invalid += 1;
        perDomain.tasks.invalid += 1;
        reasons.push({ row: total, reason: `Task #${i + 1}: invalid task structure.` });
        continue;
      }
      const key = `${r.data.title.toLowerCase()}|${(r.data.deadline || '').slice(0, 10)}`;
      if (taskKeys.has(key)) {
        duplicate += 1;
        perDomain.tasks.duplicate += 1;
        reasons.push({ row: total, reason: `Task "${r.data.title}" already exists.` });
        continue;
      }
      taskKeys.add(key);
      valid += 1;
      perDomain.tasks.valid += 1;
      validTasks.push(r.data);
    }

    for (let i = 0; i < bundle.employees.length; i += 1) {
      total += 1;
      const r = employeeSchema.safeParse(bundle.employees[i]);
      if (!r.success) {
        invalid += 1;
        perDomain.staff.invalid += 1;
        reasons.push({ row: total, reason: `Employee #${i + 1}: invalid staff record.` });
        continue;
      }
      const sid = r.data.identifier.trim();
      const nameKey = r.data.name.toLowerCase();
      if ((sid && staffSids.has(sid)) || staffNames.has(nameKey)) {
        duplicate += 1;
        perDomain.staff.duplicate += 1;
        reasons.push({ row: total, reason: `Staff member "${r.data.name}" already exists.` });
        continue;
      }
      if (sid) staffSids.add(sid);
      staffNames.add(nameKey);
      valid += 1;
      perDomain.staff.valid += 1;
      validEmployees.push(r.data);
    }

    for (let i = 0; i < bundle.salesBoxes.length; i += 1) {
      total += 1;
      const r = salesBoxSchema.safeParse(bundle.salesBoxes[i]);
      if (!r.success) {
        invalid += 1;
        perDomain.salesBoxes.invalid += 1;
        reasons.push({ row: total, reason: `Sales box #${i + 1}: invalid sales box record.` });
        continue;
      }
      const key = r.data.name.toLowerCase();
      if (boxKeys.has(key)) {
        duplicate += 1;
        perDomain.salesBoxes.duplicate += 1;
        reasons.push({ row: total, reason: `Sales box "${r.data.name}" already exists.` });
        continue;
      }
      boxKeys.add(key);
      valid += 1;
      perDomain.salesBoxes.valid += 1;
      validBoxes.push(r.data);
    }

    for (let i = 0; i < bundle.cases.length; i += 1) {
      total += 1;
      const r = caseSchema.safeParse(bundle.cases[i]);
      if (!r.success) {
        invalid += 1;
        perDomain.complaints.invalid += 1;
        reasons.push({ row: total, reason: `Case #${i + 1}: invalid complaint record.` });
        continue;
      }
      const key = r.data.caseNumber.toLowerCase();
      if (caseNums.has(key)) {
        duplicate += 1;
        perDomain.complaints.duplicate += 1;
        reasons.push({ row: total, reason: `Complaint "${r.data.caseNumber}" already exists.` });
        continue;
      }
      caseNums.add(key);
      valid += 1;
      perDomain.complaints.valid += 1;
      validCases.push(r.data);
    }

    const validTnps: Array<{
      businessDate: string;
      totalDetractors: number;
      totalPassive: number;
      totalPromoters: number;
      dailyTnpsPercent: number;
      targetBenchmark: number;
      requiredPromoters: number;
      dailyRequired: number;
      agentRows: Array<Record<string, unknown>>;
    }> = [];

    for (let i = 0; i < bundle.tnpsDailyRecords.length; i += 1) {
      total += 1;
      const item = bundle.tnpsDailyRecords[i];
      const bDate = String(item.businessDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
        invalid += 1;
        perDomain.tnpsDailyRecords.invalid += 1;
        reasons.push({ row: total, reason: `TNPS daily #${i + 1}: missing valid businessDate.` });
        continue;
      }
      if (tnpsDates.has(bDate)) {
        duplicate += 1;
        perDomain.tnpsDailyRecords.duplicate += 1;
        reasons.push({ row: total, reason: `TNPS measurement for ${bDate} already exists.` });
        continue;
      }
      tnpsDates.add(bDate);
      valid += 1;
      perDomain.tnpsDailyRecords.valid += 1;
      validTnps.push({
        businessDate: bDate,
        totalDetractors: Number(item.totalDetractors) || 0,
        totalPassive: Number(item.totalPassive) || 0,
        totalPromoters: Number(item.totalPromoters) || 0,
        dailyTnpsPercent: Number(item.dailyTnpsPercent) || 0,
        targetBenchmark: Number(item.targetBenchmark) || 70,
        requiredPromoters: Number(item.requiredPromoters) || 0,
        dailyRequired: Number(item.dailyRequired) || 0,
        agentRows: Array.isArray(item.agentRows) ? item.agentRows : [],
      });
    }

    let weightsValid = false;
    if (bundle.healthWeights) {
      const w = bundle.healthWeights;
      const sum =
        w.dailyOperations +
        w.salesPerformance +
        w.teamPerformance +
        w.customerExperience +
        w.complianceAudits;
      total += 1;
      if (sum !== 100) {
        invalid += 1;
        reasons.push({ row: total, reason: `Branch Health weights sum (${sum}) must equal 100.` });
      } else {
        valid += 1;
        weightsValid = true;
      }
    }

    if (commitChanges) {
      await db.transaction(async (tx) => {
        if (validTasks.length > 0) {
          const rows = await tx
            .insert(storeTasks)
            .values(
              validTasks.map((t) => ({
                branchCode,
                date: (t.createdAt || t.deadline || new Date().toISOString()).slice(0, 10),
                title: t.title,
                titleAr: t.titleAr,
                description: t.description,
                descriptionAr: t.descriptionAr,
                category: t.category,
                subcategory: t.subcategory,
                owner: t.owner,
                ownerRole: t.ownerRole,
                priority: t.priority,
                status: t.status,
                dueDate: (t.deadline || '').slice(0, 10),
                notes: t.notes,
                evidenceText: t.evidenceText,
              }))
            )
            .returning({ id: storeTasks.id });
          imported += rows.length;
          rows.forEach((r) => verifiedInsertedIds.push(`task:${r.id}`));
        }

        if (validEmployees.length > 0) {
          const rows = await tx
            .insert(staffMembers)
            .values(
              validEmployees.map((e) => ({
                branchCode,
                sid: e.identifier,
                name: e.name,
                nameAr: e.nameAr,
                roleTitle: e.role,
                roleTitleAr: e.roleAr,
                productKnowledgeScore: e.productKnowledgeScore ?? null,
                productivityScore: e.productivityScore ?? null,
                customerExperienceScore: e.customerExperienceScore ?? null,
                coachingStatus: e.coachingStatus,
                developmentAreas: e.developmentAreas,
                coachingNotes: e.coachingNotes,
                agreedActions: e.agreedActions,
                assignedCoach: e.assignedCoach,
                followUpDate: e.followUpDate,
                progressStatus: e.progressStatus,
              }))
            )
            .returning({ id: staffMembers.id });
          imported += rows.length;
          rows.forEach((r) => verifiedInsertedIds.push(`staff:${r.id}`));
        }

        if (validBoxes.length > 0) {
          const rows = await tx
            .insert(salesBoxes)
            .values(
              validBoxes.map((b, i) => ({
                branchCode,
                boxKey: `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${i}`,
                name: b.name,
                nameAr: b.nameAr,
                target: b.target,
                actual: b.actual,
                unit: b.unit,
                unitAr: b.unitAr,
                remainingWorkingDays: b.remainingWorkingDays,
                trend: b.trend,
                dailyHistoryJson: b.dailyHistory,
              }))
            )
            .returning({ id: salesBoxes.id });
          imported += rows.length;
          rows.forEach((r) => verifiedInsertedIds.push(`salesBox:${r.id}`));
        }

        if (validCases.length > 0) {
          const rows = await tx
            .insert(complaints)
            .values(
              validCases.map((c) => ({
                branchCode,
                caseNumber: c.caseNumber,
                customerIdentifier: c.customerIdentifier,
                date: (c.createdAt || new Date().toISOString()).slice(0, 10),
                category: c.issueCategory,
                categoryAr: c.issueCategoryAr,
                description: c.description,
                isRepeated: c.isRepeated,
                repeatedMatchCriteria: c.repeatedMatchCriteria,
                rootCause: c.rootCause,
                rootCauseAr: c.rootCauseAr,
                assignedOwner: c.assignedOwner,
                resolutionDeadline: (c.resolutionDeadline || '').slice(0, 10),
                status: c.status,
                correctiveAction: c.correctiveAction,
                notes: c.resolutionNotes,
              }))
            )
            .returning({ id: complaints.id });
          imported += rows.length;
          rows.forEach((r) => verifiedInsertedIds.push(`complaint:${r.id}`));
        }

        if (validTnps.length > 0) {
          const rows = await tx
            .insert(tnpsStoreRecords)
            .values(
              validTnps.map((r) => ({
                branchCode,
                recordType: 'daily_calc',
                month: r.businessDate.slice(0, 7),
                businessDate: r.businessDate,
                detractors: r.totalDetractors,
                passive: r.totalPassive,
                promoters: r.totalPromoters,
                score: r.dailyTnpsPercent,
                benchmark: r.targetBenchmark,
                achievementPercent:
                  r.targetBenchmark > 0
                    ? Math.round((r.dailyTnpsPercent / r.targetBenchmark) * 1000) / 10
                    : null,
                requiredPromoters: r.requiredPromoters,
                dailyRequired: r.dailyRequired,
                agentRowsJson: r.agentRows,
                updatedBy: req.principal!.username,
              }))
            )
            .returning({ id: tnpsStoreRecords.id });
          imported += rows.length;
          rows.forEach((r) => verifiedInsertedIds.push(`tnps:${r.id}`));
        }

        if (weightsValid && bundle.healthWeights) {
          const w = bundle.healthWeights;
          await tx
            .insert(branchHealthConfigs)
            .values({
              branchCode,
              dailyOperationsWeight: w.dailyOperations,
              salesPerformanceWeight: w.salesPerformance,
              teamPerformanceWeight: w.teamPerformance,
              customerExperienceWeight: w.customerExperience,
              complianceAuditsWeight: w.complianceAudits,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: branchHealthConfigs.branchCode,
              set: {
                dailyOperationsWeight: w.dailyOperations,
                salesPerformanceWeight: w.salesPerformance,
                teamPerformanceWeight: w.teamPerformance,
                customerExperienceWeight: w.customerExperience,
                complianceAuditsWeight: w.complianceAudits,
                updatedAt: new Date(),
              },
            });
          imported += 1;
          verifiedInsertedIds.push(`healthWeights:${branchCode}`);
        }

        if (bundle.targetCalculator && Object.keys(bundle.targetCalculator).length > 0) {
          const tc = bundle.targetCalculator;
          await tx
            .insert(targetCalculatorStates)
            .values({
              branchCode,
              itemsJson: (tc.items as Record<string, unknown>) || {},
              weightsJson: (tc.weights as Record<string, unknown>) || {},
              redSalesToday: String(tc.redSalesToday ?? '0'),
              redSalesTarget: String(tc.redSalesTarget ?? '0'),
              dailyTrendJson: Array.isArray(tc.dailyTrend) ? (tc.dailyTrend as Array<Record<string, unknown>>) : [],
              totalShifts: Number(tc.totalShifts) || 25,
              remainingShifts: Number(tc.remainingShifts) || 10,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: targetCalculatorStates.branchCode,
              set: {
                itemsJson: (tc.items as Record<string, unknown>) || {},
                weightsJson: (tc.weights as Record<string, unknown>) || {},
                redSalesToday: String(tc.redSalesToday ?? '0'),
                redSalesTarget: String(tc.redSalesTarget ?? '0'),
                dailyTrendJson: Array.isArray(tc.dailyTrend) ? (tc.dailyTrend as Array<Record<string, unknown>>) : [],
                totalShifts: Number(tc.totalShifts) || 25,
                remainingShifts: Number(tc.remainingShifts) || 10,
                updatedAt: new Date(),
              },
            });
        }
      });

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'COMMIT_LOCAL_MIGRATION',
        domain: 'local_migration',
        details: { total, valid, invalid, duplicate, imported },
        ipAddress: getClientIp(req),
      });
    }

    return {
      summary: {
        total,
        valid,
        invalid,
        duplicate,
        imported,
        rejected: invalid + duplicate,
        reasons: reasons.slice(0, 50),
      },
      perDomain,
      verifiedInsertedIds,
    };
  }

  router.post('/preview', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const result = await evaluateBundle(req, false);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid local backup payload structure.' });
        return;
      }
      next(err);
    }
  });

  router.post('/commit', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      if (req.body?.confirmed !== true) {
        res.status(400).json({
          error: 'Explicit confirmation (confirmed: true) is required after previewing before importing local records.',
        });
        return;
      }
      const result = await evaluateBundle(req, true);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid local backup payload structure.' });
        return;
      }
      next(err);
    }
  });

  return router;
}
