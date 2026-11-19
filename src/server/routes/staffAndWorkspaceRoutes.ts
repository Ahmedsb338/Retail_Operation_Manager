import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  branchHealthConfigs,
  branches,
  coachingSessions,
  pillarTargets,
  salesBoxes,
  staffMembers,
  systemConfigs,
  targetCalculatorStates,
} from '../../db/schema.ts';
import {
  DEFAULT_FISCAL_YEAR,
  isIsoDateString,
  PILLARS,
} from '../services/domainCalculations.ts';
import {
  parseCsvText,
  parseXlsxBuffer,
  serializeToUtf8Csv,
  serializeToXlsxBuffer,
  type ImportReason,
} from '../services/csvXlsx.ts';
import { writeAuditLog } from '../security/audit.ts';
import {
  getClientIp,
  requireAuth,
  requireStoreManager,
  resolveScopedBranches,
  type AppRequest,
} from '../middleware/auth.ts';

const staffCreateSchema = z
  .object({
    sid: z.string().trim().max(80).optional().default(''),
    name: z.string().trim().min(1).max(160),
    nameAr: z.string().max(160).optional().default(''),
    roleTitle: z.string().max(120).optional().default(''),
    roleTitleAr: z.string().max(120).optional().default(''),
    productKnowledgeScore: z.number().int().min(0).max(100).nullable().optional().default(null),
    productivityScore: z.number().int().min(0).max(100).nullable().optional().default(null),
    customerExperienceScore: z.number().int().min(0).max(100).nullable().optional().default(null),
    coachingStatus: z
      .enum(['needs_coaching', 'scheduled', 'in_progress', 'on_track', 'proficient'])
      .optional()
      .default('needs_coaching'),
    developmentAreas: z.array(z.string().max(160)).max(20).optional().default([]),
    coachingNotes: z.string().max(2000).optional().default(''),
    agreedActions: z.string().max(2000).optional().default(''),
    assignedCoach: z.string().max(160).optional().default(''),
    followUpDate: z.string().max(40).optional().default(''),
    progressStatus: z.enum(['pending', 'improving', 'achieved']).optional().default('pending'),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

const staffUpdateSchema = staffCreateSchema.partial().strict();

const coachingSessionCreateSchema = z
  .object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    coach: z.string().trim().min(1).max(160),
    topic: z.string().trim().min(1).max(300),
    agreedActions: z.string().max(2000).optional().default(''),
    scoreImprovement: z.string().max(120).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const salesBoxCreateSchema = z
  .object({
    boxKey: z.string().trim().max(80).optional(),
    name: z.string().trim().min(1).max(160),
    nameAr: z.string().max(160).optional().default(''),
    target: z.number().min(0),
    actual: z.number().min(0),
    unit: z.string().max(60).optional().default(''),
    unitAr: z.string().max(60).optional().default(''),
    remainingWorkingDays: z.number().int().min(0).max(366).optional().default(0),
    trend: z.enum(['up', 'down', 'stable']).optional().default('stable'),
    dailyHistory: z.array(z.record(z.string(), z.unknown())).max(100).optional().default([]),
  })
  .strict();

const salesBoxUpdateSchema = salesBoxCreateSchema.partial().strict();

const targetCalcSaveSchema = z
  .object({
    items: z.record(z.string(), z.unknown()),
    weights: z.record(z.string(), z.unknown()),
    redSalesToday: z.string().max(60).default('0'),
    redSalesTarget: z.string().max(60).default('0'),
    dailyTrend: z.array(z.record(z.string(), z.unknown())).max(62).default([]),
    totalShifts: z.number().int().min(1).max(31).default(25),
    remainingShifts: z.number().int().min(0).max(31).default(10),
  })
  .strict();

const healthWeightsSchema = z
  .object({
    dailyOperations: z.number().int().min(0).max(100),
    salesPerformance: z.number().int().min(0).max(100),
    teamPerformance: z.number().int().min(0).max(100),
    customerExperience: z.number().int().min(0).max(100),
    complianceAudits: z.number().int().min(0).max(100),
  })
  .strict();

const fiscalYearSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pillarTargets: z
      .array(
        z
          .object({
            pillar: z.enum(PILLARS),
            monthlyTarget: z.number().positive().nullable(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

const branchProfileUpdateSchema = z
  .object({
    managerName: z.string().trim().min(1).max(160).optional(),
    managerNameAr: z.string().max(160).optional(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetDailyRevenue: z.number().min(0).optional(),
    totalShifts: z.number().int().min(1).max(31).optional(),
    remainingShifts: z.number().int().min(0).max(31).optional(),
  })
  .strict();

export function createStaffAndWorkspaceRouter(): Router {
  const root = Router();

  // ==========================================================================
  // 1. UNIFIED STAFF ROSTER & COACHING (/api/v1/staff)
  // ==========================================================================
  const staffRouter = Router();

  staffRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const requestedBranch = String(req.query.branchCode || '').trim();
      const scope = resolveScopedBranches(req.principal!, requestedBranch);
      if (scope.error) {
        res.status(403).json({ error: scope.error });
        return;
      }
      const codes = scope.branches.map((b) => b.code);
      if (codes.length === 0) {
        res.json({ staff: [] });
        return;
      }

      const [members, sessionsList] = await Promise.all([
        req.db!
          .select()
          .from(staffMembers)
          .where(inArray(staffMembers.branchCode, codes))
          .orderBy(staffMembers.name),
        req.db!
          .select()
          .from(coachingSessions)
          .where(inArray(coachingSessions.branchCode, codes))
          .orderBy(desc(coachingSessions.sessionDate)),
      ]);

      const search = String(req.query.search || '').trim().toLowerCase();
      const filteredMembers = members.filter(
        (m) =>
          !search ||
          m.name.toLowerCase().includes(search) ||
          m.nameAr.toLowerCase().includes(search) ||
          m.sid.toLowerCase().includes(search) ||
          m.roleTitle.toLowerCase().includes(search)
      );

      const sessionsByStaff = new Map<string, typeof sessionsList>();
      for (const s of sessionsList) {
        if (!sessionsByStaff.has(s.staffMemberId)) sessionsByStaff.set(s.staffMemberId, []);
        sessionsByStaff.get(s.staffMemberId)!.push(s);
      }

      res.json({
        staff: filteredMembers.map((m) => ({
          ...m,
          history: (sessionsByStaff.get(m.id) || []).map((s) => ({
            id: s.id,
            date: s.sessionDate,
            coach: s.coach,
            topic: s.topic,
            agreedActions: s.agreedActions,
            scoreImprovement: s.scoreImprovement,
            notes: s.notes,
          })),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  staffRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const requestedBranch = String(req.query.branchCode || '').trim();
      const format = String(req.query.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
      const scope = resolveScopedBranches(req.principal!, requestedBranch);
      if (scope.error) {
        res.status(403).json({ error: scope.error });
        return;
      }
      const codes = scope.branches.map((b) => b.code);
      const members =
        codes.length > 0
          ? await req.db!
              .select()
              .from(staffMembers)
              .where(inArray(staffMembers.branchCode, codes))
              .orderBy(staffMembers.name)
          : [];

      const headers = [
        'Store ID',
        'SID',
        'Name',
        'Role',
        'Knowledge Score',
        'Productivity Score',
        'CSAT Score',
        'Coaching Status',
        'Follow-up Date',
        'Active',
      ];
      const rows = members.map((m) => ({
        'Store ID': m.branchCode,
        SID: m.sid,
        Name: m.name,
        Role: m.roleTitle,
        'Knowledge Score': m.productKnowledgeScore ?? '',
        'Productivity Score': m.productivityScore ?? '',
        'CSAT Score': m.customerExperienceScore ?? '',
        'Coaching Status': m.coachingStatus,
        'Follow-up Date': m.followUpDate,
        Active: m.isActive ? 'Yes' : 'No',
      }));

      if (format === 'xlsx') {
        const buf = await serializeToXlsxBuffer('Staff_Roster', headers, rows);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="staff-roster.xlsx"');
        res.send(buf);
        return;
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="staff-roster.csv"');
      res.send(serializeToUtf8Csv(headers, rows));
    } catch (err) {
      next(err);
    }
  });

  staffRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = staffCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid staff member payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      if (parsed.data.sid) {
        const [dup] = await db
          .select()
          .from(staffMembers)
          .where(and(eq(staffMembers.branchCode, branchCode), eq(staffMembers.sid, parsed.data.sid)));
        if (dup) {
          res.status(409).json({ error: `SID "${parsed.data.sid}" already exists in this branch.` });
          return;
        }
      }
      const [inserted] = await db
        .insert(staffMembers)
        .values({ branchCode, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'staff_members',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ member: { ...inserted, history: [] } });
    } catch (err) {
      next(err);
    }
  });

  staffRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = staffUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid staff update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(staffMembers)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(staffMembers.id, req.params.id), eq(staffMembers.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Staff member not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'staff_members',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ member: updated });
    } catch (err) {
      next(err);
    }
  });

  staffRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(staffMembers)
        .where(and(eq(staffMembers.id, req.params.id), eq(staffMembers.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Staff member not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'staff_members',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  staffRouter.post(
    '/:id/coaching-sessions',
    requireAuth,
    requireStoreManager,
    async (req: AppRequest, res, next) => {
      try {
        const parsed = coachingSessionCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid coaching session payload.' });
          return;
        }
        const db = req.db!;
        const branchCode = req.principal!.branchCode!;
        const [member] = await db
          .select()
          .from(staffMembers)
          .where(and(eq(staffMembers.id, req.params.id), eq(staffMembers.branchCode, branchCode)));
        if (!member) {
          res.status(404).json({ error: 'Staff member not found in your branch.' });
          return;
        }

        const [session] = await db
          .insert(coachingSessions)
          .values({
            branchCode,
            staffMemberId: member.id,
            ...parsed.data,
          })
          .returning();

        await db
          .update(staffMembers)
          .set({
            agreedActions: parsed.data.agreedActions || member.agreedActions,
            assignedCoach: parsed.data.coach,
            coachingNotes: parsed.data.notes || member.coachingNotes,
            coachingStatus:
              member.coachingStatus === 'needs_coaching' ? 'in_progress' : member.coachingStatus,
            progressStatus: 'improving',
            updatedAt: new Date(),
          })
          .where(eq(staffMembers.id, member.id));

        await writeAuditLog(db, {
          actorType: 'STORE_MANAGER',
          actorRole: 'STORE_MANAGER',
          actorIdentifier: req.principal!.username,
          branchCode,
          action: 'ADD_COACHING_SESSION',
          domain: 'coaching_sessions',
          recordId: session.id,
          ipAddress: getClientIp(req),
        });

        res.status(201).json({ session });
      } catch (err) {
        next(err);
      }
    }
  );

  staffRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const fileBase64 = String(req.body?.fileBase64 || '');
      const fileType = req.body?.fileType === 'xlsx' ? 'xlsx' : 'csv';
      const rawRowsInput = Array.isArray(req.body?.rows) ? req.body.rows : null;

      let parsedObjects: Array<Record<string, unknown>> = [];
      if (rawRowsInput) {
        parsedObjects = rawRowsInput;
      } else if (fileBase64) {
        const buf = Buffer.from(fileBase64, 'base64');
        const matrix =
          fileType === 'xlsx' ? await parseXlsxBuffer(buf) : parseCsvText(buf.toString('utf8'));
        if (matrix.length >= 2) {
          const headers = matrix[0].map((h) => h.trim());
          parsedObjects = matrix.slice(1).map((cells) => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              if (h) obj[h] = cells[i] ?? '';
            });
            return obj;
          });
        }
      } else {
        res.status(400).json({ error: 'Provide CSV/XLSX file or staff rows.' });
        return;
      }

      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db
        .select()
        .from(staffMembers)
        .where(eq(staffMembers.branchCode, branchCode));
      const seenSids = new Set(existing.map((e) => e.sid).filter(Boolean));
      const seenNames = new Set(existing.map((e) => e.name.toLowerCase()));

      const validRows: Array<typeof staffMembers.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      parsedObjects.forEach((raw, idx) => {
        const name = String(raw.Name ?? raw.name ?? raw['Agent Name'] ?? '').trim();
        const sid = String(raw.SID ?? raw.sid ?? raw.Identifier ?? '').trim();
        const roleTitle = String(raw.Role ?? raw.roleTitle ?? raw['Role Title'] ?? '').trim();
        if (!name) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Missing staff member Name.' });
          return;
        }
        if ((sid && seenSids.has(sid)) || seenNames.has(name.toLowerCase())) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate staff entry (${sid || name}).` });
          return;
        }
        if (sid) seenSids.add(sid);
        seenNames.add(name.toLowerCase());
        validRows.push({
          branchCode,
          sid,
          name,
          roleTitle,
          isActive: true,
        });
      });

      if (validRows.length > 0) await db.insert(staffMembers).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'staff_members',
        details: { total: parsedObjects.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });

      res.json({
        total: parsedObjects.length,
        valid: validRows.length,
        invalid,
        duplicate,
        imported: validRows.length,
        rejected: invalid + duplicate,
        reasons: reasons.slice(0, 50),
      });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // 2. SALES BOXES (/api/v1/sales-boxes)
  // ==========================================================================
  const salesBoxesRouter = Router();

  salesBoxesRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const scope = resolveScopedBranches(req.principal!, String(req.query.branchCode || '').trim());
      if (scope.error) {
        res.status(403).json({ error: scope.error });
        return;
      }
      const codes = scope.branches.map((b) => b.code);
      if (codes.length === 0) {
        res.json({ salesBoxes: [] });
        return;
      }
      const rows = await req.db!
        .select()
        .from(salesBoxes)
        .where(inArray(salesBoxes.branchCode, codes));
      res.json({
        salesBoxes: rows.map((r) => ({
          id: r.id,
          branchCode: r.branchCode,
          boxKey: r.boxKey,
          name: r.name,
          nameAr: r.nameAr,
          target: r.target,
          actual: r.actual,
          unit: r.unit,
          unitAr: r.unitAr,
          remainingWorkingDays: r.remainingWorkingDays,
          trend: r.trend as 'up' | 'down' | 'stable',
          dailyHistory: r.dailyHistoryJson,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  salesBoxesRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = salesBoxCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid sales box payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const boxKey =
        parsed.data.boxKey ||
        `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
      const [inserted] = await db
        .insert(salesBoxes)
        .values({
          branchCode,
          boxKey,
          name: parsed.data.name,
          nameAr: parsed.data.nameAr,
          target: parsed.data.target,
          actual: parsed.data.actual,
          unit: parsed.data.unit,
          unitAr: parsed.data.unitAr,
          remainingWorkingDays: parsed.data.remainingWorkingDays,
          trend: parsed.data.trend,
          dailyHistoryJson: parsed.data.dailyHistory,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'sales_boxes',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({
        salesBox: { ...inserted, dailyHistory: inserted.dailyHistoryJson },
      });
    } catch (err) {
      next(err);
    }
  });

  salesBoxesRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = salesBoxUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid sales box update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const { dailyHistory, ...rest } = parsed.data;
      const [updated] = await db
        .update(salesBoxes)
        .set({
          ...rest,
          ...(dailyHistory !== undefined ? { dailyHistoryJson: dailyHistory } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(salesBoxes.id, req.params.id), eq(salesBoxes.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Sales box not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'sales_boxes',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ salesBox: { ...updated, dailyHistory: updated.dailyHistoryJson } });
    } catch (err) {
      next(err);
    }
  });

  salesBoxesRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(salesBoxes)
        .where(and(eq(salesBoxes.id, req.params.id), eq(salesBoxes.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Sales box not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'sales_boxes',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // 3. TARGET CALCULATOR STATE (/api/v1/target-calculator)
  // ==========================================================================
  const targetCalcRouter = Router();

  targetCalcRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const requested = String(
        req.query.branchCode || req.principal!.branchCode || req.principal!.authorizedBranches[0]?.code || ''
      ).trim();
      if (!requested) {
        res.json({ state: null });
        return;
      }
      const scope = resolveScopedBranches(req.principal!, requested);
      if (scope.error || scope.branches.length === 0) {
        res.status(403).json({ error: scope.error || 'Selected branch is outside your assigned scope.' });
        return;
      }
      const [row] = await req.db!
        .select()
        .from(targetCalculatorStates)
        .where(eq(targetCalculatorStates.branchCode, scope.branches[0].code));
      res.json({ state: row ?? null });
    } catch (err) {
      next(err);
    }
  });

  targetCalcRouter.put('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = targetCalcSaveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Target Calculator state payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const d = parsed.data;
      const [saved] = await db
        .insert(targetCalculatorStates)
        .values({
          branchCode,
          itemsJson: d.items,
          weightsJson: d.weights,
          redSalesToday: d.redSalesToday,
          redSalesTarget: d.redSalesTarget,
          dailyTrendJson: d.dailyTrend,
          totalShifts: d.totalShifts,
          remainingShifts: d.remainingShifts,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: targetCalculatorStates.branchCode,
          set: {
            itemsJson: d.items,
            weightsJson: d.weights,
            redSalesToday: d.redSalesToday,
            redSalesTarget: d.redSalesTarget,
            dailyTrendJson: d.dailyTrend,
            totalShifts: d.totalShifts,
            remainingShifts: d.remainingShifts,
            updatedAt: new Date(),
          },
        })
        .returning();

      await db
        .update(branches)
        .set({ totalShifts: d.totalShifts, remainingShifts: d.remainingShifts, updatedAt: new Date() })
        .where(eq(branches.code, branchCode));

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'SAVE_TARGET_CALCULATOR',
        domain: 'target_calculator',
        ipAddress: getClientIp(req),
      });
      res.json({ state: saved });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // 4. BRANCH HEALTH WEIGHTS (/api/v1/branch-health/weights)
  // ==========================================================================
  const healthRouter = Router();

  healthRouter.get('/weights', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const requested = String(
        req.query.branchCode || req.principal!.branchCode || req.principal!.authorizedBranches[0]?.code || ''
      ).trim();
      const defaultWeights = {
        dailyOperations: 25,
        salesPerformance: 25,
        teamPerformance: 20,
        customerExperience: 15,
        complianceAudits: 15,
      };
      if (!requested) {
        res.json({ weights: defaultWeights, configured: false });
        return;
      }
      const scope = resolveScopedBranches(req.principal!, requested);
      if (scope.error || scope.branches.length === 0) {
        res.status(403).json({ error: scope.error || 'Selected branch is outside your assigned scope.' });
        return;
      }
      const [row] = await req.db!
        .select()
        .from(branchHealthConfigs)
        .where(eq(branchHealthConfigs.branchCode, scope.branches[0].code));
      if (!row) {
        res.json({ weights: defaultWeights, configured: false });
        return;
      }
      res.json({
        weights: {
          dailyOperations: row.dailyOperationsWeight,
          salesPerformance: row.salesPerformanceWeight,
          teamPerformance: row.teamPerformanceWeight,
          customerExperience: row.customerExperienceWeight,
          complianceAudits: row.complianceAuditsWeight,
        },
        configured: true,
      });
    } catch (err) {
      next(err);
    }
  });

  healthRouter.put('/weights', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = healthWeightsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid health weights payload.' });
        return;
      }
      const w = parsed.data;
      const sum =
        w.dailyOperations +
        w.salesPerformance +
        w.teamPerformance +
        w.customerExperience +
        w.complianceAudits;
      if (sum !== 100) {
        res.status(400).json({ error: `Health weights must sum exactly to 100% (currently ${sum}%).` });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      await db
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
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE_HEALTH_WEIGHTS',
        domain: 'branch_health',
        details: w,
        ipAddress: getClientIp(req),
      });
      res.json({ weights: w });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // 5. SETTINGS — FISCAL YEAR, PILLAR TARGETS & BRANCH OPERATIONAL PROFILE
  // ==========================================================================
  const settingsRouter = Router();

  settingsRouter.get('/fiscal-year', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const [cfgRows, ptRows] = await Promise.all([
        db.select().from(systemConfigs),
        db.select().from(pillarTargets),
      ]);
      const cfgMap = new Map(cfgRows.map((c) => [c.key, c.value]));
      res.json({
        startDate: cfgMap.get('financial_year_start') || DEFAULT_FISCAL_YEAR.startDate,
        endDate: cfgMap.get('financial_year_end') || DEFAULT_FISCAL_YEAR.endDate,
        pillarTargets: PILLARS.map((p) => {
          const found = ptRows.find((r) => r.pillar === p);
          return { pillar: p, monthlyTarget: found?.monthlyTarget ?? null, unit: found?.unit ?? '%' };
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  settingsRouter.put('/fiscal-year', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = fiscalYearSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Fiscal Year configuration.' });
        return;
      }
      const { startDate, endDate, pillarTargets: ptUpdates } = parsed.data;
      if (!isIsoDateString(startDate) || !isIsoDateString(endDate) || startDate > endDate) {
        res.status(400).json({ error: 'Fiscal Year startDate must precede endDate (YYYY-MM-DD).' });
        return;
      }

      const db = req.db!;
      await db.transaction(async (tx) => {
        for (const item of [
          { key: 'financial_year_start', value: startDate },
          { key: 'financial_year_end', value: endDate },
        ]) {
          await tx
            .insert(systemConfigs)
            .values({ key: item.key, value: item.value, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: systemConfigs.key,
              set: { value: item.value, updatedAt: new Date() },
            });
        }
        if (ptUpdates) {
          for (const pt of ptUpdates) {
            await tx
              .insert(pillarTargets)
              .values({
                pillar: pt.pillar,
                monthlyTarget: pt.monthlyTarget,
                unit: '%',
                isActive: true,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: pillarTargets.pillar,
                set: { monthlyTarget: pt.monthlyTarget, updatedAt: new Date() },
              });
          }
        }
      });

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode: req.principal!.branchCode,
        action: 'UPDATE_FISCAL_YEAR',
        domain: 'settings',
        details: { startDate, endDate },
        ipAddress: getClientIp(req),
      });
      res.json({ startDate, endDate });
    } catch (err) {
      next(err);
    }
  });

  settingsRouter.patch('/branch-profile', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = branchProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid branch profile update. Branch code, store ID, and branch identity are immutable.',
        });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(branches)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(branches.code, branchCode))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Branch not found.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE_BRANCH_PROFILE',
        domain: 'branches',
        recordId: branchCode,
        ipAddress: getClientIp(req),
      });
      res.json({ branch: updated });
    } catch (err) {
      next(err);
    }
  });

  root.use('/staff', staffRouter);
  root.use('/sales-boxes', salesBoxesRouter);
  root.use('/target-calculator', targetCalcRouter);
  root.use('/branch-health', healthRouter);
  root.use('/settings', settingsRouter);

  return root;
}
