import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  actionPlans,
  agentKpiRecords,
  agentRpmRecords,
  complaints,
  hrActions,
  lateOpenings,
  pillarTargets,
  scheduleExceptions,
  shortOverCases,
  staffMembers,
  storeKpiRecords,
  storeRpmRecords,
  storeTasks,
  tnpsAgentRecords,
  tnpsStoreRecords,
} from '../../db/schema.ts';
import {
  computeAchievementPercent,
  isIsoDateString,
  isIsoMonthString,
  matchesDateOverlapFilter,
  PILLARS,
  roundTo,
  validateDateRange,
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

function parseOptionalNullableNumber(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const s = String(val).trim();
  if (!s || /^unconfigured$/i.test(s) || /^n\/a$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseOptionalNullableInt(val: unknown): number | null | undefined {
  const n = parseOptionalNullableNumber(val);
  if (n === undefined || n === null) return n;
  return Number.isInteger(n) ? n : Math.round(n);
}

const nullableNumberSchema = z.preprocess(
  parseOptionalNullableNumber,
  z.number().finite().nullable()
);

const nullableNonNegIntSchema = z.preprocess(
  parseOptionalNullableInt,
  z.number().int().min(0).nullable()
);

const importPayloadSchema = z
  .object({
    fileBase64: z.string().optional(),
    fileType: z.enum(['csv', 'xlsx']).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).max(1500).optional(),
  })
  .strict();

function normalizeRowKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const clean = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    out[k] = v;
    if (clean) out[clean] = v;
  }
  return out;
}

function pickField(row: Record<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
    const clean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (row[clean] !== undefined && row[clean] !== '') return row[clean];
  }
  return undefined;
}

async function parseImportRows(body: unknown): Promise<Array<Record<string, unknown>> | null> {
  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) return null;

  if (parsed.data.rows) {
    return parsed.data.rows.map(normalizeRowKeys);
  }

  if (parsed.data.fileBase64 && parsed.data.fileType) {
    const buf = Buffer.from(parsed.data.fileBase64, 'base64');
    const matrix =
      parsed.data.fileType === 'xlsx'
        ? await parseXlsxBuffer(buf)
        : parseCsvText(buf.toString('utf8'));
    if (matrix.length < 2) return [];
    const headers = matrix[0].map((h) => h.trim());
    return matrix.slice(1).map((cells) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = cells[i] ?? '';
      });
      return normalizeRowKeys(obj);
    });
  }

  return null;
}

function filterSearchMatch(row: Record<string, unknown>, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q));
}

async function sendExportResponse(
  res: any,
  format: string,
  filenameBase: string,
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, unknown>>
): Promise<void> {
  if (format === 'xlsx') {
    const buf = await serializeToXlsxBuffer(sheetName, headers, rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buf);
    return;
  }
  const csv = serializeToUtf8Csv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
  res.send(csv);
}

// ============================================================================
// SCHEMAS PER OPERATIONAL DOMAIN (STRICT MASS-ASSIGNMENT PROTECTION)
// ============================================================================
const storeRpmCreateSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    pillar: z.enum(PILLARS),
    actual: nullableNumberSchema.optional().default(null),
    target: nullableNumberSchema.optional().default(null),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const storeRpmUpdateSchema = storeRpmCreateSchema.partial().strict();

const agentRpmCreateSchema = z
  .object({
    agentName: z.string().trim().min(1).max(160),
    sid: z.string().trim().max(80).optional().default(''),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    pillar: z.enum(PILLARS),
    actual: nullableNumberSchema.optional().default(null),
    target: nullableNumberSchema.optional().default(null),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const agentRpmUpdateSchema = agentRpmCreateSchema.partial().strict();

const storeKpiCreateSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    kpiName: z.string().trim().min(1).max(160),
    actual: nullableNumberSchema.optional().default(null),
    target: nullableNumberSchema.optional().default(null),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const storeKpiUpdateSchema = storeKpiCreateSchema.partial().strict();

const agentKpiCreateSchema = z
  .object({
    agentName: z.string().trim().min(1).max(160),
    sid: z.string().trim().max(80).optional().default(''),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    kpiName: z.string().trim().min(1).max(160),
    actual: nullableNumberSchema.optional().default(null),
    target: nullableNumberSchema.optional().default(null),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const agentKpiUpdateSchema = agentKpiCreateSchema.partial().strict();

const tnpsStoreCreateSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    businessDate: z.string().max(20).optional().default(''),
    agentName: z.string().max(160).optional().default(''),
    detractors: nullableNonNegIntSchema.optional().default(null),
    passive: nullableNonNegIntSchema.optional().default(null),
    promoters: nullableNonNegIntSchema.optional().default(null),
    score: nullableNumberSchema.optional().default(null),
    benchmark: nullableNumberSchema.optional().default(70),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const tnpsStoreUpdateSchema = tnpsStoreCreateSchema.partial().strict();

const dailyTnpsSnapshotSchema = z
  .object({
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    detractors: z.number().int().min(0),
    passive: z.number().int().min(0),
    promoters: z.number().int().min(0),
    score: z.number().finite(),
    benchmark: z.number().min(1).max(100),
    requiredPromoters: z.number().int().min(0),
    dailyRequired: z.number().int().min(0),
    agentRows: z.array(z.record(z.string(), z.unknown())).max(100).optional().default([]),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const tnpsAgentCreateSchema = z
  .object({
    agentName: z.string().trim().min(1).max(160),
    sid: z.string().trim().max(80).optional().default(''),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    score: nullableNumberSchema.optional().default(null),
    benchmark: nullableNumberSchema.optional().default(70),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const tnpsAgentUpdateSchema = tnpsAgentCreateSchema.partial().strict();

const complaintCreateSchema = z
  .object({
    caseNumber: z.string().trim().min(1).max(80),
    customerIdentifier: z.string().max(160).optional().default(''),
    agentName: z.string().max(160).optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().trim().min(1).max(160),
    categoryAr: z.string().max(160).optional().default(''),
    description: z.string().max(2000).optional().default(''),
    isRepeated: z.boolean().optional().default(false),
    repeatedMatchCriteria: z.string().max(300).optional().default(''),
    rootCause: z.string().max(300).optional().default(''),
    rootCauseAr: z.string().max(300).optional().default(''),
    assignedOwner: z.string().max(160).optional().default(''),
    resolutionDeadline: z.string().max(60).optional().default(''),
    status: z.enum(['pending', 'under_review', 'resolved', 'escalated']).optional().default('pending'),
    correctiveAction: z.string().max(2000).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const complaintUpdateSchema = complaintCreateSchema.partial().strict();

const scheduleExceptionCreateSchema = z
  .object({
    agentName: z.string().trim().min(1).max(160),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    exceptionType: z.string().trim().min(1).max(120),
    reason: z.string().max(2000).optional().default(''),
    approvedBy: z.string().max(160).optional().default(''),
  })
  .strict();

const scheduleExceptionUpdateSchema = scheduleExceptionCreateSchema.partial().strict();

const storeTaskCreateSchema = z
  .object({
    agentName: z.string().max(160).optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().trim().min(1).max(300),
    titleAr: z.string().max(300).optional().default(''),
    description: z.string().max(2000).optional().default(''),
    descriptionAr: z.string().max(2000).optional().default(''),
    category: z.enum(['financial', 'contracts', 'store', 'customer']).optional().default('store'),
    subcategory: z.string().max(80).optional().default(''),
    owner: z.string().max(160).optional().default(''),
    ownerRole: z.string().max(120).optional().default(''),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']).optional().default('not_started'),
    dueDate: z.string().max(60).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
    evidenceText: z.string().max(1000).optional().default(''),
    history: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

const storeTaskUpdateSchema = storeTaskCreateSchema.partial().strict();

const hrActionCreateSchema = z
  .object({
    agentName: z.string().trim().min(1).max(160),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    action: z.string().trim().min(1).max(300),
    status: z.string().trim().min(1).max(80),
    owner: z.string().max(160).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
  })
  .strict();

const hrActionUpdateSchema = hrActionCreateSchema.partial().strict();

const lateOpeningCreateSchema = z
  .object({
    agentName: z.string().max(160).optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    plannedOpening: z.string().max(40).optional().default(''),
    actualOpening: z.string().max(40).optional().default(''),
    delayMinutes: nullableNonNegIntSchema.optional().default(null),
    reason: z.string().max(1000).optional().default(''),
    responsible: z.string().max(160).optional().default(''),
  })
  .strict();

const lateOpeningUpdateSchema = lateOpeningCreateSchema.partial().strict();

const shortOverCreateSchema = z
  .object({
    agentName: z.string().max(160).optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shortAmount: nullableNumberSchema.optional().default(null),
    overAmount: nullableNumberSchema.optional().default(null),
    netAmount: nullableNumberSchema.optional().default(null),
    remarks: z.string().max(2000).optional().default(''),
  })
  .strict();

const shortOverUpdateSchema = shortOverCreateSchema.partial().strict();

const actionPlanCreateSchema = z
  .object({
    agentName: z.string().max(160).optional().default(''),
    pillars: z.string().trim().min(1).max(200),
    reason: z.string().max(1000).optional().default(''),
    suggestedActions: z.string().trim().min(1).max(2000),
    owner: z.string().max(160).optional().default(''),
    startDate: z.string().max(20).optional().default(''),
    dueDate: z.string().max(20).optional().default(''),
    status: z.enum(['open', 'in_progress', 'completed', 'overdue', 'blocked']).optional().default('open'),
    beforeTracking: z.string().max(1000).optional().default(''),
    afterTracking: z.string().max(1000).optional().default(''),
  })
  .strict();

const actionPlanUpdateSchema = actionPlanCreateSchema.partial().strict();

// Helper to resolve matching staffMemberId by SID or name within branch
async function resolveStaffId(
  db: NonNullable<AppRequest['db']>,
  branchCode: string,
  agentName?: string | null,
  sid?: string | null
): Promise<string | null> {
  const cleanName = String(agentName || '').trim().toLowerCase();
  const cleanSid = String(sid || '').trim();
  if (!cleanName && !cleanSid) return null;
  const rows = await db
    .select({ id: staffMembers.id, sid: staffMembers.sid, name: staffMembers.name })
    .from(staffMembers)
    .where(eq(staffMembers.branchCode, branchCode));
  const hit = rows.find(
    (r) =>
      (cleanSid && r.sid === cleanSid) ||
      (cleanName && r.name.trim().toLowerCase() === cleanName)
  );
  return hit?.id ?? null;
}

export function createOperationalDomainsRouter(): Router {
  const root = Router();

  function parseFilters(req: AppRequest, res: any) {
    const requestedBranch = String(req.query.branchCode || '').trim();
    const fromDate = String(req.query.fromDate || '').trim();
    const toDate = String(req.query.toDate || '').trim();
    const search = String(req.query.search || '').trim();
    const format = String(req.query.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';

    try {
      validateDateRange({ fromDate, toDate });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid date range.' });
      return null;
    }

    const scope = resolveScopedBranches(req.principal!, requestedBranch);
    if (scope.error) {
      res.status(403).json({ error: scope.error });
      return null;
    }

    return {
      scopedCodes: scope.branches.map((b) => b.code),
      dateRange: { fromDate, toDate },
      search,
      format,
    };
  }

  // --------------------------------------------------------------------------
  // 1. STORE RPM (/api/v1/store-rpm)
  // --------------------------------------------------------------------------
  const storeRpmRouter = Router();

  async function listStoreRpm(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(storeRpmRecords)
      .where(inArray(storeRpmRecords.branchCode, f.scopedCodes))
      .orderBy(desc(storeRpmRecords.month));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  storeRpmRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listStoreRpm(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  storeRpmRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listStoreRpm(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Month', 'Pillar', 'Actual', 'Target', 'Achievement %', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        Month: r.month,
        Pillar: r.pillar,
        Actual: r.actual ?? '',
        Target: r.target ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'store-rpm', 'Store_RPM', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  storeRpmRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeRpmCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store RPM record payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      let target = parsed.data.target;
      if (target === null || target === undefined) {
        const [pt] = await db
          .select()
          .from(pillarTargets)
          .where(eq(pillarTargets.pillar, parsed.data.pillar));
        target = pt?.monthlyTarget ?? null;
      }
      const achievementPercent = computeAchievementPercent(parsed.data.actual, target);

      const [existing] = await db
        .select()
        .from(storeRpmRecords)
        .where(
          and(
            eq(storeRpmRecords.branchCode, branchCode),
            eq(storeRpmRecords.month, parsed.data.month),
            eq(storeRpmRecords.pillar, parsed.data.pillar)
          )
        );
      if (existing) {
        res.status(409).json({
          error: `Store RPM record already exists for ${parsed.data.month} / ${parsed.data.pillar}. Edit the existing entry instead.`,
        });
        return;
      }

      const [inserted] = await db
        .insert(storeRpmRecords)
        .values({
          branchCode,
          month: parsed.data.month,
          pillar: parsed.data.pillar,
          actual: parsed.data.actual,
          target,
          achievementPercent,
          notes: parsed.data.notes,
        })
        .returning();

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'store_rpm',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  storeRpmRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeRpmUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store RPM update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(storeRpmRecords)
        .where(and(eq(storeRpmRecords.id, req.params.id), eq(storeRpmRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const actual = parsed.data.actual !== undefined ? parsed.data.actual : existing.actual;
      const target = parsed.data.target !== undefined ? parsed.data.target : existing.target;
      const achievementPercent = computeAchievementPercent(actual, target);

      const [updated] = await db
        .update(storeRpmRecords)
        .set({
          ...parsed.data,
          achievementPercent,
          updatedAt: new Date(),
        })
        .where(and(eq(storeRpmRecords.id, req.params.id), eq(storeRpmRecords.branchCode, branchCode)))
        .returning();

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'store_rpm',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });

      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  storeRpmRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(storeRpmRecords)
        .where(and(eq(storeRpmRecords.id, req.params.id), eq(storeRpmRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'store_rpm',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  storeRpmRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing, ptRows] = await Promise.all([
        db.select().from(storeRpmRecords).where(eq(storeRpmRecords.branchCode, branchCode)),
        db.select().from(pillarTargets),
      ]);
      const seenKeys = new Set(existing.map((e) => `${e.month}|${e.pillar}`));
      const ptMap = new Map(ptRows.map((p) => [p.pillar, p.monthlyTarget]));

      const validRows: Array<typeof storeRpmRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          pillar: String(pickField(row, 'Pillar', 'pillar') ?? '').trim(),
          actual: pickField(row, 'Actual', 'actual'),
          target: pickField(row, 'Target', 'target'),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = storeRpmCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid month (YYYY-MM), pillar, or numeric fields.' });
          return;
        }
        const key = `${parsed.data.month}|${parsed.data.pillar}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate Store RPM entry for ${key}.` });
          return;
        }
        seenKeys.add(key);
        const resolvedTarget = parsed.data.target ?? ptMap.get(parsed.data.pillar) ?? null;
        validRows.push({
          branchCode,
          month: parsed.data.month,
          pillar: parsed.data.pillar,
          actual: parsed.data.actual,
          target: resolvedTarget,
          achievementPercent: computeAchievementPercent(parsed.data.actual, resolvedTarget),
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) {
        await db.insert(storeRpmRecords).values(validRows);
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'store_rpm',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });

      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 2. AGENT RPM (/api/v1/agent-rpm)
  // --------------------------------------------------------------------------
  const agentRpmRouter = Router();

  async function listAgentRpm(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(agentRpmRecords)
      .where(inArray(agentRpmRecords.branchCode, f.scopedCodes))
      .orderBy(desc(agentRpmRecords.month), agentRpmRecords.agentName);
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  agentRpmRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listAgentRpm(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  agentRpmRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listAgentRpm(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'SID', 'Month', 'Pillar', 'Actual', 'Target', 'Achievement %', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        SID: r.sid,
        Month: r.month,
        Pillar: r.pillar,
        Actual: r.actual ?? '',
        Target: r.target ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'agent-rpm', 'Agent_RPM', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  agentRpmRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = agentRpmCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Agent RPM record payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, parsed.data.sid);
      const achievementPercent = computeAchievementPercent(parsed.data.actual, parsed.data.target);

      const [inserted] = await db
        .insert(agentRpmRecords)
        .values({
          branchCode,
          staffMemberId,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          pillar: parsed.data.pillar,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent,
          notes: parsed.data.notes,
        })
        .returning();

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'agent_rpm',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  agentRpmRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = agentRpmUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Agent RPM update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(agentRpmRecords)
        .where(and(eq(agentRpmRecords.id, req.params.id), eq(agentRpmRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const actual = parsed.data.actual !== undefined ? parsed.data.actual : existing.actual;
      const target = parsed.data.target !== undefined ? parsed.data.target : existing.target;
      const achievementPercent = computeAchievementPercent(actual, target);

      const [updated] = await db
        .update(agentRpmRecords)
        .set({ ...parsed.data, achievementPercent, updatedAt: new Date() })
        .where(and(eq(agentRpmRecords.id, req.params.id), eq(agentRpmRecords.branchCode, branchCode)))
        .returning();

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'agent_rpm',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  agentRpmRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(agentRpmRecords)
        .where(and(eq(agentRpmRecords.id, req.params.id), eq(agentRpmRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'agent_rpm',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  agentRpmRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing, staff] = await Promise.all([
        db.select().from(agentRpmRecords).where(eq(agentRpmRecords.branchCode, branchCode)),
        db.select().from(staffMembers).where(eq(staffMembers.branchCode, branchCode)),
      ]);
      const seenKeys = new Set(existing.map((e) => `${e.agentName.toLowerCase()}|${e.month}|${e.pillar}`));

      const validRows: Array<typeof agentRpmRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName', 'Agent') ?? '').trim(),
          sid: String(pickField(row, 'SID', 'sid') ?? '').trim(),
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          pillar: String(pickField(row, 'Pillar', 'pillar') ?? '').trim(),
          actual: pickField(row, 'Actual', 'actual'),
          target: pickField(row, 'Target', 'target'),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = agentRpmCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid agentName, month (YYYY-MM), pillar, or numbers.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.month}|${parsed.data.pillar}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate Agent RPM entry for ${key}.` });
          return;
        }
        seenKeys.add(key);
        const hit = staff.find(
          (s) =>
            (parsed.data.sid && s.sid === parsed.data.sid) ||
            s.name.toLowerCase() === parsed.data.agentName.toLowerCase()
        );
        validRows.push({
          branchCode,
          staffMemberId: hit?.id ?? null,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          pillar: parsed.data.pillar,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent: computeAchievementPercent(parsed.data.actual, parsed.data.target),
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) {
        await db.insert(agentRpmRecords).values(validRows);
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'agent_rpm',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });

      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 3. STORE KPIs (/api/v1/store-kpis)
  // --------------------------------------------------------------------------
  const storeKpisRouter = Router();

  async function listStoreKpis(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(storeKpiRecords)
      .where(inArray(storeKpiRecords.branchCode, f.scopedCodes))
      .orderBy(desc(storeKpiRecords.month));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  storeKpisRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listStoreKpis(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  storeKpisRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listStoreKpis(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Month', 'KPI Name', 'Actual', 'Target', 'Achievement %', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        Month: r.month,
        'KPI Name': r.kpiName,
        Actual: r.actual ?? '',
        Target: r.target ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'store-kpis', 'Store_KPIs', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  storeKpisRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeKpiCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store KPI payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(storeKpiRecords)
        .where(
          and(
            eq(storeKpiRecords.branchCode, branchCode),
            eq(storeKpiRecords.month, parsed.data.month),
            eq(storeKpiRecords.kpiName, parsed.data.kpiName)
          )
        );
      if (existing) {
        res.status(409).json({ error: 'Store KPI entry for this month and KPI name already exists.' });
        return;
      }
      const [inserted] = await db
        .insert(storeKpiRecords)
        .values({
          branchCode,
          month: parsed.data.month,
          kpiName: parsed.data.kpiName,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent: computeAchievementPercent(parsed.data.actual, parsed.data.target),
          notes: parsed.data.notes,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'store_kpis',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  storeKpisRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeKpiUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store KPI update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(storeKpiRecords)
        .where(and(eq(storeKpiRecords.id, req.params.id), eq(storeKpiRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const actual = parsed.data.actual !== undefined ? parsed.data.actual : existing.actual;
      const target = parsed.data.target !== undefined ? parsed.data.target : existing.target;
      const [updated] = await db
        .update(storeKpiRecords)
        .set({
          ...parsed.data,
          achievementPercent: computeAchievementPercent(actual, target),
          updatedAt: new Date(),
        })
        .where(and(eq(storeKpiRecords.id, req.params.id), eq(storeKpiRecords.branchCode, branchCode)))
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'store_kpis',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  storeKpisRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(storeKpiRecords)
        .where(and(eq(storeKpiRecords.id, req.params.id), eq(storeKpiRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'store_kpis',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  storeKpisRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db
        .select()
        .from(storeKpiRecords)
        .where(eq(storeKpiRecords.branchCode, branchCode));
      const seenKeys = new Set(existing.map((e) => `${e.month}|${e.kpiName.toLowerCase()}`));
      const validRows: Array<typeof storeKpiRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          kpiName: String(pickField(row, 'KPI Name', 'kpiName', 'KPI') ?? '').trim(),
          actual: pickField(row, 'Actual', 'actual'),
          target: pickField(row, 'Target', 'target'),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = storeKpiCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid month (YYYY-MM), KPI Name, or numbers.' });
          return;
        }
        const key = `${parsed.data.month}|${parsed.data.kpiName.toLowerCase()}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate Store KPI for ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({
          branchCode,
          month: parsed.data.month,
          kpiName: parsed.data.kpiName,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent: computeAchievementPercent(parsed.data.actual, parsed.data.target),
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) await db.insert(storeKpiRecords).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'store_kpis',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 4. AGENT KPIs (/api/v1/agent-kpis)
  // --------------------------------------------------------------------------
  const agentKpisRouter = Router();

  async function listAgentKpis(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(agentKpiRecords)
      .where(inArray(agentKpiRecords.branchCode, f.scopedCodes))
      .orderBy(desc(agentKpiRecords.month), agentKpiRecords.agentName);
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  agentKpisRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listAgentKpis(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  agentKpisRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listAgentKpis(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'SID', 'Month', 'KPI Name', 'Actual', 'Target', 'Achievement %', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        SID: r.sid,
        Month: r.month,
        'KPI Name': r.kpiName,
        Actual: r.actual ?? '',
        Target: r.target ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'agent-kpis', 'Agent_KPIs', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  agentKpisRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = agentKpiCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Agent KPI payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, parsed.data.sid);
      const [inserted] = await db
        .insert(agentKpiRecords)
        .values({
          branchCode,
          staffMemberId,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          kpiName: parsed.data.kpiName,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent: computeAchievementPercent(parsed.data.actual, parsed.data.target),
          notes: parsed.data.notes,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'agent_kpis',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  agentKpisRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = agentKpiUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Agent KPI update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(agentKpiRecords)
        .where(and(eq(agentKpiRecords.id, req.params.id), eq(agentKpiRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const actual = parsed.data.actual !== undefined ? parsed.data.actual : existing.actual;
      const target = parsed.data.target !== undefined ? parsed.data.target : existing.target;
      const [updated] = await db
        .update(agentKpiRecords)
        .set({
          ...parsed.data,
          achievementPercent: computeAchievementPercent(actual, target),
          updatedAt: new Date(),
        })
        .where(and(eq(agentKpiRecords.id, req.params.id), eq(agentKpiRecords.branchCode, branchCode)))
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'agent_kpis',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  agentKpisRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(agentKpiRecords)
        .where(and(eq(agentKpiRecords.id, req.params.id), eq(agentKpiRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'agent_kpis',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  agentKpisRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing, staff] = await Promise.all([
        db.select().from(agentKpiRecords).where(eq(agentKpiRecords.branchCode, branchCode)),
        db.select().from(staffMembers).where(eq(staffMembers.branchCode, branchCode)),
      ]);
      const seenKeys = new Set(
        existing.map((e) => `${e.agentName.toLowerCase()}|${e.month}|${e.kpiName.toLowerCase()}`)
      );
      const validRows: Array<typeof agentKpiRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName', 'Agent') ?? '').trim(),
          sid: String(pickField(row, 'SID', 'sid') ?? '').trim(),
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          kpiName: String(pickField(row, 'KPI Name', 'kpiName', 'KPI') ?? '').trim(),
          actual: pickField(row, 'Actual', 'actual'),
          target: pickField(row, 'Target', 'target'),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = agentKpiCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid agentName, month (YYYY-MM), KPI Name, or numbers.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.month}|${parsed.data.kpiName.toLowerCase()}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate Agent KPI for ${key}.` });
          return;
        }
        seenKeys.add(key);
        const hit = staff.find(
          (s) =>
            (parsed.data.sid && s.sid === parsed.data.sid) ||
            s.name.toLowerCase() === parsed.data.agentName.toLowerCase()
        );
        validRows.push({
          branchCode,
          staffMemberId: hit?.id ?? null,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          kpiName: parsed.data.kpiName,
          actual: parsed.data.actual,
          target: parsed.data.target,
          achievementPercent: computeAchievementPercent(parsed.data.actual, parsed.data.target),
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) await db.insert(agentKpiRecords).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'agent_kpis',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 5. TNPS STORE (/api/v1/tnps-store)
  // --------------------------------------------------------------------------
  const tnpsStoreRouter = Router();

  async function listTnpsStore(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(tnpsStoreRecords)
      .where(inArray(tnpsStoreRecords.branchCode, f.scopedCodes))
      .orderBy(desc(tnpsStoreRecords.businessDate), desc(tnpsStoreRecords.month));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter(
          { businessDate: r.businessDate, month: r.month, createdAt: r.createdAt },
          f.dateRange
        ) && filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  tnpsStoreRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTnpsStore(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.get('/daily-calc', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const f = parseFilters(req, res);
      if (!f) return;
      if (f.scopedCodes.length === 0) {
        res.json({ records: [] });
        return;
      }
      const rows = await req.db!
        .select()
        .from(tnpsStoreRecords)
        .where(
          and(
            inArray(tnpsStoreRecords.branchCode, f.scopedCodes),
            eq(tnpsStoreRecords.recordType, 'daily_calc')
          )
        )
        .orderBy(desc(tnpsStoreRecords.businessDate));
      res.json({ records: rows });
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.put(
    '/daily-calc',
    requireAuth,
    requireStoreManager,
    async (req: AppRequest, res, next) => {
      try {
        const parsed = dailyTnpsSnapshotSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid daily TNPS calculation payload.' });
          return;
        }
        const db = req.db!;
        const branchCode = req.principal!.branchCode!;
        const d = parsed.data;
        const month = d.businessDate.slice(0, 7);
        const achievementPercent = computeAchievementPercent(d.score, d.benchmark);

        const [existing] = await db
          .select()
          .from(tnpsStoreRecords)
          .where(
            and(
              eq(tnpsStoreRecords.branchCode, branchCode),
              eq(tnpsStoreRecords.recordType, 'daily_calc'),
              eq(tnpsStoreRecords.businessDate, d.businessDate)
            )
          );

        let saved;
        if (existing) {
          const [updated] = await db
            .update(tnpsStoreRecords)
            .set({
              month,
              detractors: d.detractors,
              passive: d.passive,
              promoters: d.promoters,
              score: d.score,
              benchmark: d.benchmark,
              achievementPercent,
              requiredPromoters: d.requiredPromoters,
              dailyRequired: d.dailyRequired,
              agentRowsJson: d.agentRows,
              revisionNumber: existing.revisionNumber + 1,
              updatedBy: req.principal!.username,
              notes: d.notes,
              updatedAt: new Date(),
            })
            .where(eq(tnpsStoreRecords.id, existing.id))
            .returning();
          saved = updated;
        } else {
          const [inserted] = await db
            .insert(tnpsStoreRecords)
            .values({
              branchCode,
              recordType: 'daily_calc',
              month,
              businessDate: d.businessDate,
              detractors: d.detractors,
              passive: d.passive,
              promoters: d.promoters,
              score: d.score,
              benchmark: d.benchmark,
              achievementPercent,
              requiredPromoters: d.requiredPromoters,
              dailyRequired: d.dailyRequired,
              agentRowsJson: d.agentRows,
              revisionNumber: 1,
              updatedBy: req.principal!.username,
              notes: d.notes,
            })
            .returning();
          saved = inserted;
        }

        await writeAuditLog(db, {
          actorType: 'STORE_MANAGER',
          actorRole: 'STORE_MANAGER',
          actorIdentifier: req.principal!.username,
          branchCode,
          action: 'UPSERT_DAILY_TNPS',
          domain: 'tnps_store',
          recordId: saved.id,
          ipAddress: getClientIp(req),
        });
        res.json({ record: saved });
      } catch (err) {
        next(err);
      }
    }
  );

  tnpsStoreRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTnpsStore(req, res);
      if (!result) return;
      const headers = [
        'Store ID',
        'Type',
        'Month',
        'Business Date',
        'Detractors',
        'Passive',
        'Promoters',
        'Score %',
        'Benchmark %',
        'Achievement %',
        'Notes',
      ];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        Type: r.recordType,
        Month: r.month,
        'Business Date': r.businessDate,
        Detractors: r.detractors ?? '',
        Passive: r.passive ?? '',
        Promoters: r.promoters ?? '',
        'Score %': r.score ?? '',
        'Benchmark %': r.benchmark ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'tnps-store', 'TNPS_Store', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = tnpsStoreCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid TNPS Store record payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const achievementPercent = computeAchievementPercent(parsed.data.score, parsed.data.benchmark);
      const [inserted] = await db
        .insert(tnpsStoreRecords)
        .values({
          branchCode,
          recordType: 'monthly_log',
          month: parsed.data.month,
          businessDate: parsed.data.businessDate,
          agentName: parsed.data.agentName,
          detractors: parsed.data.detractors,
          passive: parsed.data.passive,
          promoters: parsed.data.promoters,
          score: parsed.data.score,
          benchmark: parsed.data.benchmark,
          achievementPercent,
          updatedBy: req.principal!.username,
          notes: parsed.data.notes,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'tnps_store',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = tnpsStoreUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid TNPS Store update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(tnpsStoreRecords)
        .where(and(eq(tnpsStoreRecords.id, req.params.id), eq(tnpsStoreRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const score = parsed.data.score !== undefined ? parsed.data.score : existing.score;
      const benchmark = parsed.data.benchmark !== undefined ? parsed.data.benchmark : existing.benchmark;
      const [updated] = await db
        .update(tnpsStoreRecords)
        .set({
          ...parsed.data,
          achievementPercent: computeAchievementPercent(score, benchmark),
          updatedBy: req.principal!.username,
          updatedAt: new Date(),
        })
        .where(and(eq(tnpsStoreRecords.id, req.params.id), eq(tnpsStoreRecords.branchCode, branchCode)))
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'tnps_store',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(tnpsStoreRecords)
        .where(and(eq(tnpsStoreRecords.id, req.params.id), eq(tnpsStoreRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'tnps_store',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  tnpsStoreRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db
        .select()
        .from(tnpsStoreRecords)
        .where(eq(tnpsStoreRecords.branchCode, branchCode));
      const seenKeys = new Set(existing.map((e) => `${e.month}|${e.businessDate}`));
      const validRows: Array<typeof tnpsStoreRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          businessDate: String(pickField(row, 'Business Date', 'businessDate', 'Date') ?? '').trim(),
          detractors: pickField(row, 'Detractors', 'detractors'),
          passive: pickField(row, 'Passive', 'passive'),
          promoters: pickField(row, 'Promoters', 'promoters'),
          score: pickField(row, 'Score', 'Score %', 'score'),
          benchmark: pickField(row, 'Benchmark', 'Benchmark %', 'benchmark') ?? 70,
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = tnpsStoreCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid month (YYYY-MM) or TNPS numeric values.' });
          return;
        }
        const key = `${parsed.data.month}|${parsed.data.businessDate}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate TNPS Store record for ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({
          branchCode,
          recordType: 'monthly_log',
          month: parsed.data.month,
          businessDate: parsed.data.businessDate,
          detractors: parsed.data.detractors,
          passive: parsed.data.passive,
          promoters: parsed.data.promoters,
          score: parsed.data.score,
          benchmark: parsed.data.benchmark,
          achievementPercent: computeAchievementPercent(parsed.data.score, parsed.data.benchmark),
          updatedBy: req.principal!.username,
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) await db.insert(tnpsStoreRecords).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'tnps_store',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 6. TNPS AGENTS (/api/v1/tnps-agents)
  // --------------------------------------------------------------------------
  const tnpsAgentsRouter = Router();

  async function listTnpsAgents(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(tnpsAgentRecords)
      .where(inArray(tnpsAgentRecords.branchCode, f.scopedCodes))
      .orderBy(desc(tnpsAgentRecords.month), tnpsAgentRecords.agentName);
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  tnpsAgentsRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTnpsAgents(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  tnpsAgentsRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTnpsAgents(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'SID', 'Month', 'Score %', 'Benchmark %', 'Achievement %', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        SID: r.sid,
        Month: r.month,
        'Score %': r.score ?? '',
        'Benchmark %': r.benchmark ?? 'Unconfigured',
        'Achievement %': r.achievementPercent !== null ? `${r.achievementPercent}%` : 'Unconfigured',
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'tnps-agents', 'TNPS_Agents', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  tnpsAgentsRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = tnpsAgentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid TNPS Agent payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, parsed.data.sid);
      const [inserted] = await db
        .insert(tnpsAgentRecords)
        .values({
          branchCode,
          staffMemberId,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          score: parsed.data.score,
          benchmark: parsed.data.benchmark,
          achievementPercent: computeAchievementPercent(parsed.data.score, parsed.data.benchmark),
          notes: parsed.data.notes,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'tnps_agents',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  tnpsAgentsRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = tnpsAgentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid TNPS Agent update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(tnpsAgentRecords)
        .where(and(eq(tnpsAgentRecords.id, req.params.id), eq(tnpsAgentRecords.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      const score = parsed.data.score !== undefined ? parsed.data.score : existing.score;
      const benchmark = parsed.data.benchmark !== undefined ? parsed.data.benchmark : existing.benchmark;
      const [updated] = await db
        .update(tnpsAgentRecords)
        .set({
          ...parsed.data,
          achievementPercent: computeAchievementPercent(score, benchmark),
          updatedAt: new Date(),
        })
        .where(and(eq(tnpsAgentRecords.id, req.params.id), eq(tnpsAgentRecords.branchCode, branchCode)))
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'tnps_agents',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  tnpsAgentsRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(tnpsAgentRecords)
        .where(and(eq(tnpsAgentRecords.id, req.params.id), eq(tnpsAgentRecords.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'tnps_agents',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  tnpsAgentsRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing, staff] = await Promise.all([
        db.select().from(tnpsAgentRecords).where(eq(tnpsAgentRecords.branchCode, branchCode)),
        db.select().from(staffMembers).where(eq(staffMembers.branchCode, branchCode)),
      ]);
      const seenKeys = new Set(existing.map((e) => `${e.agentName.toLowerCase()}|${e.month}`));
      const validRows: Array<typeof tnpsAgentRecords.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName', 'Agent') ?? '').trim(),
          sid: String(pickField(row, 'SID', 'sid') ?? '').trim(),
          month: String(pickField(row, 'Month', 'month') ?? '').trim().slice(0, 7),
          score: pickField(row, 'Score', 'Score %', 'score'),
          benchmark: pickField(row, 'Benchmark', 'Benchmark %', 'benchmark') ?? 70,
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = tnpsAgentCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid agentName, month (YYYY-MM), or numbers.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.month}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate TNPS Agent entry for ${key}.` });
          return;
        }
        seenKeys.add(key);
        const hit = staff.find(
          (s) =>
            (parsed.data.sid && s.sid === parsed.data.sid) ||
            s.name.toLowerCase() === parsed.data.agentName.toLowerCase()
        );
        validRows.push({
          branchCode,
          staffMemberId: hit?.id ?? null,
          agentName: parsed.data.agentName,
          sid: parsed.data.sid,
          month: parsed.data.month,
          score: parsed.data.score,
          benchmark: parsed.data.benchmark,
          achievementPercent: computeAchievementPercent(parsed.data.score, parsed.data.benchmark),
          notes: parsed.data.notes,
        });
      });

      if (validRows.length > 0) await db.insert(tnpsAgentRecords).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'tnps_agents',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 7. COMPLAINTS (/api/v1/complaints)
  // --------------------------------------------------------------------------
  const complaintsRouter = Router();

  async function listComplaints(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(complaints)
      .where(inArray(complaints.branchCode, f.scopedCodes))
      .orderBy(desc(complaints.date));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ date: r.date, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  complaintsRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listComplaints(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  complaintsRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listComplaints(req, res);
      if (!result) return;
      const headers = [
        'Store ID',
        'Case #',
        'Customer ID',
        'Agent Name',
        'Date',
        'Category',
        'Root Cause',
        'Repeated',
        'Owner',
        'Status',
        'Corrective Action',
        'Notes',
      ];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Case #': r.caseNumber,
        'Customer ID': r.customerIdentifier,
        'Agent Name': r.agentName,
        Date: r.date,
        Category: r.category,
        'Root Cause': r.rootCause,
        Repeated: r.isRepeated ? 'Yes' : 'No',
        Owner: r.assignedOwner,
        Status: r.status,
        'Corrective Action': r.correctiveAction,
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'complaints', 'Complaints', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  complaintsRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = complaintCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid complaint payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(complaints)
        .where(
          and(
            eq(complaints.branchCode, branchCode),
            eq(complaints.caseNumber, parsed.data.caseNumber)
          )
        );
      if (existing) {
        res.status(409).json({ error: `Complaint ${parsed.data.caseNumber} already exists in this branch.` });
        return;
      }
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, null);
      const [inserted] = await db
        .insert(complaints)
        .values({
          branchCode,
          staffMemberId,
          ...parsed.data,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'complaints',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  complaintsRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = complaintUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid complaint update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(complaints)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(complaints.id, req.params.id), eq(complaints.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Complaint not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'complaints',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  complaintsRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(complaints)
        .where(and(eq(complaints.id, req.params.id), eq(complaints.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Complaint not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'complaints',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  complaintsRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(complaints).where(eq(complaints.branchCode, branchCode));
      const seenCases = new Set(existing.map((c) => c.caseNumber.toLowerCase()));
      const validRows: Array<typeof complaints.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const rawStatus = String(pickField(row, 'Status', 'status') ?? 'pending')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
        const normalizedStatus = ['pending', 'under_review', 'resolved', 'escalated'].includes(rawStatus)
          ? rawStatus
          : 'pending';
        const candidate = {
          caseNumber: String(pickField(row, 'Case #', 'Case Number', 'caseNumber') ?? '').trim(),
          customerIdentifier: String(pickField(row, 'Customer ID', 'customerIdentifier') ?? '').trim(),
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          date: String(pickField(row, 'Date', 'date') ?? '').trim().slice(0, 10),
          category: String(pickField(row, 'Category', 'category') ?? '').trim(),
          rootCause: String(pickField(row, 'Root Cause', 'rootCause') ?? '').trim(),
          assignedOwner: String(pickField(row, 'Owner', 'assignedOwner') ?? '').trim(),
          status: normalizedStatus,
          correctiveAction: String(pickField(row, 'Corrective Action', 'correctiveAction') ?? '').trim(),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = complaintCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Case #, Date (YYYY-MM-DD), or Category.' });
          return;
        }
        const key = parsed.data.caseNumber.toLowerCase();
        if (seenCases.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate complaint Case # ${parsed.data.caseNumber}.` });
          return;
        }
        seenCases.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(complaints).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'complaints',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 8. SCHEDULE EXCEPTIONS (/api/v1/schedule-exceptions)
  // --------------------------------------------------------------------------
  const scheduleExceptionsRouter = Router();

  async function listExceptions(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(scheduleExceptions)
      .where(inArray(scheduleExceptions.branchCode, f.scopedCodes))
      .orderBy(desc(scheduleExceptions.date));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ date: r.date, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  scheduleExceptionsRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listExceptions(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  scheduleExceptionsRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listExceptions(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'Date', 'Exception Type', 'Reason', 'Approved By'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        Date: r.date,
        'Exception Type': r.exceptionType,
        Reason: r.reason,
        'Approved By': r.approvedBy,
      }));
      await sendExportResponse(
        res,
        result.f.format,
        'schedule-exceptions',
        'Schedule_Exceptions',
        headers,
        exportRows
      );
    } catch (err) {
      next(err);
    }
  });

  scheduleExceptionsRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = scheduleExceptionCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid schedule exception payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, null);
      const [inserted] = await db
        .insert(scheduleExceptions)
        .values({ branchCode, staffMemberId, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'schedule_exceptions',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  scheduleExceptionsRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = scheduleExceptionUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid schedule exception update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(scheduleExceptions)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(scheduleExceptions.id, req.params.id),
            eq(scheduleExceptions.branchCode, branchCode)
          )
        )
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'schedule_exceptions',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  scheduleExceptionsRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.id, req.params.id),
            eq(scheduleExceptions.branchCode, branchCode)
          )
        )
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'schedule_exceptions',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  scheduleExceptionsRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db
        .select()
        .from(scheduleExceptions)
        .where(eq(scheduleExceptions.branchCode, branchCode));
      const seenKeys = new Set(
        existing.map((e) => `${e.agentName.toLowerCase()}|${e.date}|${e.exceptionType.toLowerCase()}`)
      );
      const validRows: Array<typeof scheduleExceptions.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          date: String(pickField(row, 'Date', 'date') ?? '').trim().slice(0, 10),
          exceptionType: String(pickField(row, 'Exception Type', 'exceptionType', 'Type') ?? '').trim(),
          reason: String(pickField(row, 'Reason', 'reason') ?? '').trim(),
          approvedBy: String(pickField(row, 'Approved By', 'approvedBy') ?? '').trim(),
        };
        const parsed = scheduleExceptionCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Agent Name, Date (YYYY-MM-DD), or Exception Type.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.date}|${parsed.data.exceptionType.toLowerCase()}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate exception ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(scheduleExceptions).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'schedule_exceptions',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 9. STORE TASKS (/api/v1/store-tasks)
  // --------------------------------------------------------------------------
  const storeTasksRouter = Router();

  async function listTasks(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(storeTasks)
      .where(inArray(storeTasks.branchCode, f.scopedCodes))
      .orderBy(desc(storeTasks.date), desc(storeTasks.createdAt));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter(
          { date: r.date, dueDate: r.dueDate, createdAt: r.createdAt },
          f.dateRange
        ) && filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  storeTasksRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTasks(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  storeTasksRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listTasks(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Date', 'Due Date', 'Title', 'Category', 'Owner', 'Priority', 'Status', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        Date: r.date,
        'Due Date': r.dueDate,
        Title: r.title,
        Category: r.category,
        Owner: r.owner,
        Priority: r.priority,
        Status: r.status,
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'store-tasks', 'Store_Tasks', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  storeTasksRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeTaskCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store Task payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const { history, ...rest } = parsed.data;
      const staffMemberId = await resolveStaffId(db, branchCode, rest.agentName || rest.owner, null);
      const initialHistory = history ?? [
        {
          id: `h_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Task Created',
          user: req.principal!.username,
        },
      ];
      const [inserted] = await db
        .insert(storeTasks)
        .values({
          branchCode,
          staffMemberId,
          ...rest,
          historyJson: initialHistory,
          completedAt: rest.status === 'completed' ? new Date() : null,
        })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'store_tasks',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  storeTasksRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = storeTaskUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Store Task update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [existing] = await db
        .select()
        .from(storeTasks)
        .where(and(eq(storeTasks.id, req.params.id), eq(storeTasks.branchCode, branchCode)));
      if (!existing) {
        res.status(404).json({ error: 'Task not found in your branch.' });
        return;
      }
      const { history, ...rest } = parsed.data;
      const nextHistory = history ?? [
        ...(existing.historyJson || []),
        {
          id: `h_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: rest.status ? `Status updated to ${rest.status}` : 'Task updated',
          user: req.principal!.username,
          details: rest.notes,
        },
      ];
      const completedAt =
        rest.status === 'completed'
          ? existing.completedAt ?? new Date()
          : rest.status
            ? null
            : existing.completedAt;

      const [updated] = await db
        .update(storeTasks)
        .set({
          ...rest,
          historyJson: nextHistory,
          completedAt,
          updatedAt: new Date(),
        })
        .where(and(eq(storeTasks.id, req.params.id), eq(storeTasks.branchCode, branchCode)))
        .returning();

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'store_tasks',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  storeTasksRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(storeTasks)
        .where(and(eq(storeTasks.id, req.params.id), eq(storeTasks.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Task not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'store_tasks',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  storeTasksRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(storeTasks).where(eq(storeTasks.branchCode, branchCode));
      const seenKeys = new Set(existing.map((t) => `${t.title.toLowerCase()}|${t.date}`));
      const validRows: Array<typeof storeTasks.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          date: String(pickField(row, 'Date', 'date') ?? new Date().toISOString().slice(0, 10)).trim().slice(0, 10),
          dueDate: String(pickField(row, 'Due Date', 'dueDate', 'Deadline') ?? '').trim().slice(0, 10),
          title: String(pickField(row, 'Title', 'title') ?? '').trim(),
          category: String(pickField(row, 'Category', 'category') ?? 'store').trim().toLowerCase(),
          owner: String(pickField(row, 'Owner', 'owner') ?? '').trim(),
          priority: String(pickField(row, 'Priority', 'priority') ?? 'medium').trim().toLowerCase(),
          status: String(pickField(row, 'Status', 'status') ?? 'not_started').trim().toLowerCase().replace(/\s+/g, '_'),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = storeTaskCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Task title, date, category, priority, or status.' });
          return;
        }
        const key = `${parsed.data.title.toLowerCase()}|${parsed.data.date}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate task "${parsed.data.title}" on ${parsed.data.date}.` });
          return;
        }
        seenKeys.add(key);
        const { history: _h, ...clean } = parsed.data;
        validRows.push({
          branchCode,
          ...clean,
          historyJson: [
            {
              id: `imp_${Date.now()}_${idx}`,
              timestamp: new Date().toISOString(),
              action: 'Imported',
              user: req.principal!.username,
            },
          ],
        });
      });

      if (validRows.length > 0) await db.insert(storeTasks).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'store_tasks',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 10. HR ACTIONS (/api/v1/hr-actions)
  // --------------------------------------------------------------------------
  const hrActionsRouter = Router();

  async function listHrActions(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(hrActions)
      .where(inArray(hrActions.branchCode, f.scopedCodes))
      .orderBy(desc(hrActions.date));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ date: r.date, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  hrActionsRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listHrActions(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  hrActionsRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listHrActions(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'Date', 'Action', 'Status', 'Owner', 'Notes'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        Date: r.date,
        Action: r.action,
        Status: r.status,
        Owner: r.owner,
        Notes: r.notes,
      }));
      await sendExportResponse(res, result.f.format, 'hr-actions', 'HR_Actions', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  hrActionsRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = hrActionCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid HR Action payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, null);
      const [inserted] = await db
        .insert(hrActions)
        .values({ branchCode, staffMemberId, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'hr_actions',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  hrActionsRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = hrActionUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid HR Action update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(hrActions)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(hrActions.id, req.params.id), eq(hrActions.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'hr_actions',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  hrActionsRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(hrActions)
        .where(and(eq(hrActions.id, req.params.id), eq(hrActions.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'hr_actions',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  hrActionsRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(hrActions).where(eq(hrActions.branchCode, branchCode));
      const seenKeys = new Set(existing.map((e) => `${e.agentName.toLowerCase()}|${e.date}|${e.action.toLowerCase()}`));
      const validRows: Array<typeof hrActions.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          date: String(pickField(row, 'Date', 'date') ?? '').trim().slice(0, 10),
          action: String(pickField(row, 'Action', 'action') ?? '').trim(),
          status: String(pickField(row, 'Status', 'status') ?? 'Open').trim(),
          owner: String(pickField(row, 'Owner', 'owner') ?? '').trim(),
          notes: String(pickField(row, 'Notes', 'notes') ?? '').trim(),
        };
        const parsed = hrActionCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Agent Name, Date (YYYY-MM-DD), Action, or Status.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.date}|${parsed.data.action.toLowerCase()}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate HR Action for ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(hrActions).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'hr_actions',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 11. LATE OPENING (/api/v1/late-opening) — preserves null vs 0 delayMinutes!
  // --------------------------------------------------------------------------
  const lateOpeningRouter = Router();

  async function listLateOpenings(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(lateOpenings)
      .where(inArray(lateOpenings.branchCode, f.scopedCodes))
      .orderBy(desc(lateOpenings.date));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ date: r.date, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  lateOpeningRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listLateOpenings(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  lateOpeningRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listLateOpenings(req, res);
      if (!result) return;
      const headers = [
        'Store ID',
        'Date',
        'Planned Opening',
        'Actual Opening',
        'Delay (Minutes)',
        'Agent Name',
        'Reason',
        'Responsible',
      ];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        Date: r.date,
        'Planned Opening': r.plannedOpening,
        'Actual Opening': r.actualOpening,
        'Delay (Minutes)': r.delayMinutes === null ? 'Unconfigured' : r.delayMinutes,
        'Agent Name': r.agentName,
        Reason: r.reason,
        Responsible: r.responsible,
      }));
      await sendExportResponse(res, result.f.format, 'late-opening', 'Late_Opening', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  lateOpeningRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = lateOpeningCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Late Opening payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName || parsed.data.responsible, null);
      const [inserted] = await db
        .insert(lateOpenings)
        .values({ branchCode, staffMemberId, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'late_opening',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  lateOpeningRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = lateOpeningUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Late Opening update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(lateOpenings)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(lateOpenings.id, req.params.id), eq(lateOpenings.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'late_opening',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  lateOpeningRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(lateOpenings)
        .where(and(eq(lateOpenings.id, req.params.id), eq(lateOpenings.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'late_opening',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  lateOpeningRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(lateOpenings).where(eq(lateOpenings.branchCode, branchCode));
      const seenKeys = new Set(existing.map((e) => `${e.date}|${e.plannedOpening}|${e.actualOpening}`));
      const validRows: Array<typeof lateOpenings.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          date: String(pickField(row, 'Date', 'date') ?? '').trim().slice(0, 10),
          plannedOpening: String(pickField(row, 'Planned Opening', 'plannedOpening') ?? '').trim(),
          actualOpening: String(pickField(row, 'Actual Opening', 'actualOpening') ?? '').trim(),
          delayMinutes: pickField(row, 'Delay (Minutes)', 'Delay', 'delayMinutes'),
          reason: String(pickField(row, 'Reason', 'reason') ?? '').trim(),
          responsible: String(pickField(row, 'Responsible', 'responsible') ?? '').trim(),
        };
        const parsed = lateOpeningCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Date (YYYY-MM-DD) or negative Delay Minutes.' });
          return;
        }
        const key = `${parsed.data.date}|${parsed.data.plannedOpening}|${parsed.data.actualOpening}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate late opening entry for ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(lateOpenings).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'late_opening',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 12. SHORT & OVER CASES (/api/v1/short-over)
  // --------------------------------------------------------------------------
  const shortOverRouter = Router();

  async function listShortOver(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(shortOverCases)
      .where(inArray(shortOverCases.branchCode, f.scopedCodes))
      .orderBy(desc(shortOverCases.date));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter({ date: r.date, createdAt: r.createdAt }, f.dateRange) &&
        filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  shortOverRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listShortOver(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  shortOverRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listShortOver(req, res);
      if (!result) return;
      const headers = ['Store ID', 'Agent Name', 'Date', 'Short', 'Over', 'Net Amount', 'Remarks'];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        Date: r.date,
        Short: r.shortAmount ?? '',
        Over: r.overAmount ?? '',
        'Net Amount': r.netAmount === null ? 'Unconfigured' : r.netAmount,
        Remarks: r.remarks,
      }));
      await sendExportResponse(res, result.f.format, 'short-over', 'Short_Over', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  shortOverRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = shortOverCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Short & Over payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, null);
      const [inserted] = await db
        .insert(shortOverCases)
        .values({ branchCode, staffMemberId, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'short_over',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  shortOverRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = shortOverUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Short & Over update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(shortOverCases)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(shortOverCases.id, req.params.id), eq(shortOverCases.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'short_over',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  shortOverRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(shortOverCases)
        .where(and(eq(shortOverCases.id, req.params.id), eq(shortOverCases.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Record not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'short_over',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  shortOverRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(shortOverCases).where(eq(shortOverCases.branchCode, branchCode));
      const seenKeys = new Set(existing.map((e) => `${e.agentName.toLowerCase()}|${e.date}|${e.netAmount}`));
      const validRows: Array<typeof shortOverCases.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          date: String(pickField(row, 'Date', 'date') ?? '').trim().slice(0, 10),
          shortAmount: pickField(row, 'Short', 'shortAmount'),
          overAmount: pickField(row, 'Over', 'overAmount'),
          netAmount: pickField(row, 'Net Amount', 'netAmount'),
          remarks: String(pickField(row, 'Remarks', 'remarks') ?? '').trim(),
        };
        const parsed = shortOverCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Date (YYYY-MM-DD) or numeric amounts.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.date}|${parsed.data.netAmount}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate Short & Over case for ${key}.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(shortOverCases).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'short_over',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // --------------------------------------------------------------------------
  // 13. ACTION PLANS (/api/v1/action-plans)
  // --------------------------------------------------------------------------
  const actionPlansRouter = Router();

  async function listActionPlans(req: AppRequest, res: any) {
    const f = parseFilters(req, res);
    if (!f) return null;
    if (f.scopedCodes.length === 0) return { f, records: [] };
    const rows = await req.db!
      .select()
      .from(actionPlans)
      .where(inArray(actionPlans.branchCode, f.scopedCodes))
      .orderBy(desc(actionPlans.startDate), desc(actionPlans.createdAt));
    const filtered = rows.filter(
      (r) =>
        matchesDateOverlapFilter(
          { startDate: r.startDate, dueDate: r.dueDate, createdAt: r.createdAt },
          f.dateRange
        ) && filterSearchMatch(r as unknown as Record<string, unknown>, f.search)
    );
    return { f, records: filtered };
  }

  actionPlansRouter.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listActionPlans(req, res);
      if (!result) return;
      res.json({ records: result.records });
    } catch (err) {
      next(err);
    }
  });

  actionPlansRouter.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const result = await listActionPlans(req, res);
      if (!result) return;
      const headers = [
        'Store ID',
        'Agent Name',
        'Pillars',
        'Reason',
        'Suggested Actions',
        'Owner',
        'Start Date',
        'Due Date',
        'Status',
        'Before Tracking',
        'After Tracking',
      ];
      const exportRows = result.records.map((r) => ({
        'Store ID': r.branchCode,
        'Agent Name': r.agentName,
        Pillars: r.pillars,
        Reason: r.reason,
        'Suggested Actions': r.suggestedActions,
        Owner: r.owner,
        'Start Date': r.startDate,
        'Due Date': r.dueDate,
        Status: r.status,
        'Before Tracking': r.beforeTracking,
        'After Tracking': r.afterTracking,
      }));
      await sendExportResponse(res, result.f.format, 'action-plans', 'Action_Plans', headers, exportRows);
    } catch (err) {
      next(err);
    }
  });

  actionPlansRouter.post('/', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = actionPlanCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Action Plan payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const staffMemberId = await resolveStaffId(db, branchCode, parsed.data.agentName, null);
      const [inserted] = await db
        .insert(actionPlans)
        .values({ branchCode, staffMemberId, ...parsed.data })
        .returning();
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'CREATE',
        domain: 'action_plans',
        recordId: inserted.id,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ record: inserted });
    } catch (err) {
      next(err);
    }
  });

  actionPlansRouter.patch('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = actionPlanUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid Action Plan update payload.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const [updated] = await db
        .update(actionPlans)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(actionPlans.id, req.params.id), eq(actionPlans.branchCode, branchCode)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Action plan not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'UPDATE',
        domain: 'action_plans',
        recordId: updated.id,
        ipAddress: getClientIp(req),
      });
      res.json({ record: updated });
    } catch (err) {
      next(err);
    }
  });

  actionPlansRouter.delete('/:id', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const deleted = await db
        .delete(actionPlans)
        .where(and(eq(actionPlans.id, req.params.id), eq(actionPlans.branchCode, branchCode)))
        .returning();
      if (deleted.length === 0) {
        res.status(404).json({ error: 'Action plan not found in your branch.' });
        return;
      }
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'DELETE',
        domain: 'action_plans',
        recordId: req.params.id,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  actionPlansRouter.post('/import', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const rawRows = await parseImportRows(req.body);
      if (!rawRows) {
        res.status(400).json({ error: 'Provide CSV/XLSX base64 file or structured rows.' });
        return;
      }
      const db = req.db!;
      const branchCode = req.principal!.branchCode!;
      const existing = await db.select().from(actionPlans).where(eq(actionPlans.branchCode, branchCode));
      const seenKeys = new Set(
        existing.map(
          (e) =>
            `${e.agentName.toLowerCase()}|${e.pillars.toLowerCase()}|${e.startDate}|${e.suggestedActions.toLowerCase()}`
        )
      );
      const validRows: Array<typeof actionPlans.$inferInsert> = [];
      const reasons: ImportReason[] = [];
      let invalid = 0;
      let duplicate = 0;

      rawRows.forEach((row, idx) => {
        const rawStatus = String(pickField(row, 'Status', 'status') ?? 'open')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
        const normalizedStatus = ['open', 'in_progress', 'completed', 'overdue', 'blocked'].includes(rawStatus)
          ? rawStatus
          : 'open';
        const candidate = {
          agentName: String(pickField(row, 'Agent Name', 'agentName') ?? '').trim(),
          pillars: String(pickField(row, 'Pillars', 'pillars', 'Pillar') ?? '').trim(),
          reason: String(pickField(row, 'Reason', 'reason') ?? '').trim(),
          suggestedActions: String(pickField(row, 'Suggested Actions', 'suggestedActions', 'Actions') ?? '').trim(),
          owner: String(pickField(row, 'Owner', 'owner') ?? '').trim(),
          startDate: String(pickField(row, 'Start Date', 'startDate') ?? '').trim().slice(0, 10),
          dueDate: String(pickField(row, 'Due Date', 'dueDate') ?? '').trim().slice(0, 10),
          status: normalizedStatus,
          beforeTracking: String(pickField(row, 'Before Tracking', 'beforeTracking') ?? '').trim(),
          afterTracking: String(pickField(row, 'After Tracking', 'afterTracking') ?? '').trim(),
        };
        const parsed = actionPlanCreateSchema.safeParse(candidate);
        if (!parsed.success) {
          invalid += 1;
          reasons.push({ row: idx + 1, reason: 'Invalid Pillars or Suggested Actions.' });
          return;
        }
        const key = `${parsed.data.agentName.toLowerCase()}|${parsed.data.pillars.toLowerCase()}|${parsed.data.startDate}|${parsed.data.suggestedActions.toLowerCase()}`;
        if (seenKeys.has(key)) {
          duplicate += 1;
          reasons.push({ row: idx + 1, reason: `Duplicate action plan entry.` });
          return;
        }
        seenKeys.add(key);
        validRows.push({ branchCode, ...parsed.data });
      });

      if (validRows.length > 0) await db.insert(actionPlans).values(validRows);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: req.principal!.username,
        branchCode,
        action: 'IMPORT',
        domain: 'action_plans',
        details: { total: rawRows.length, imported: validRows.length, invalid, duplicate },
        ipAddress: getClientIp(req),
      });
      res.json({
        total: rawRows.length,
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

  // Mount explicit sub-routers (strictly separated, never a generic table handler)
  root.use('/store-rpm', storeRpmRouter);
  root.use('/agent-rpm', agentRpmRouter);
  root.use('/store-kpis', storeKpisRouter);
  root.use('/agent-kpis', agentKpisRouter);
  root.use('/tnps-store', tnpsStoreRouter);
  root.use('/tnps-agents', tnpsAgentsRouter);
  root.use('/complaints', complaintsRouter);
  root.use('/schedule-exceptions', scheduleExceptionsRouter);
  root.use('/store-tasks', storeTasksRouter);
  root.use('/hr-actions', hrActionsRouter);
  root.use('/late-opening', lateOpeningRouter);
  root.use('/short-over', shortOverRouter);
  root.use('/action-plans', actionPlansRouter);

  return root;
}
