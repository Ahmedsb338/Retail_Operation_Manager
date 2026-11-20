import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  agentRpmRecords,
  staffMembers,
  storeSchedules,
  systemConfigs,
} from '../../db/schema.ts';
import {
  ALLOWED_SHIFTS,
  DEFAULT_FISCAL_YEAR,
  isIsoDateString,
  isIsoMonthString,
  isMonthInFiscalYear,
} from '../services/domainCalculations.ts';
import {
  parseSpreadsheetBuffer,
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

const cellUpdateSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    agentName: z.string().trim().min(1).max(160),
    sid: z.string().trim().max(80).default(''),
    shift: z.enum(ALLOWED_SHIFTS),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

const gridImportSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    entries: z
      .array(
        z
          .object({
            date: z.string(),
            agentName: z.string(),
            sid: z.string().optional().default(''),
            shift: z.string(),
          })
          .strict()
      )
      .max(1500)
      .optional(),
    fileBase64: z.string().optional(),
    fileType: z.string().max(80).optional(),
    fileName: z.string().max(260).optional(),
  })
  .strict();

function normalizeScheduleDateInput(rawVal: string): string {
  const raw = String(rawVal || '').trim();
  if (isIsoDateString(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

export function createScheduleRouter(): Router {
  const router = Router();

  async function buildScheduleMonthPayload(
    req: AppRequest,
    monthKey: string,
    requestedBranchCode?: string
  ) {
    const db = req.db!;
    const principal = req.principal!;

    if (!isIsoMonthString(monthKey)) {
      return { status: 400 as const, error: 'Invalid schedule month. Expected YYYY-MM.' };
    }

    const cfgRows = await db.select().from(systemConfigs);
    const cfgMap = new Map(cfgRows.map((c) => [c.key, c.value]));
    const fiscalYear = {
      startDate: cfgMap.get('financial_year_start') || DEFAULT_FISCAL_YEAR.startDate,
      endDate: cfgMap.get('financial_year_end') || DEFAULT_FISCAL_YEAR.endDate,
    };

    if (!isMonthInFiscalYear(monthKey, fiscalYear)) {
      return {
        status: 400 as const,
        error: `Month must fall within configured Fiscal Year (${fiscalYear.startDate.slice(0, 7)} to ${fiscalYear.endDate.slice(0, 7)}).`,
      };
    }

    const defaultCode =
      principal.role === 'STORE_MANAGER'
        ? principal.branchCode
        : requestedBranchCode || principal.authorizedBranches[0]?.code || '';

    const scope = resolveScopedBranches(principal, defaultCode);
    if (scope.error) {
      return { status: 403 as const, error: scope.error };
    }
    const targetBranch = scope.branches[0];
    if (!targetBranch) {
      return {
        status: 200 as const,
        data: {
          month: monthKey,
          days: [],
          agents: [],
          canEdit: false,
          store: null,
          selectedBranchCode: '',
          authorizedBranches: [],
          fiscalYear,
        },
      };
    }

    const [staffRows, rpmRows, allBranchSchedules] = await Promise.all([
      db.select().from(staffMembers).where(eq(staffMembers.branchCode, targetBranch.code)),
      db.select().from(agentRpmRecords).where(eq(agentRpmRecords.branchCode, targetBranch.code)),
      db.select().from(storeSchedules).where(eq(storeSchedules.branchCode, targetBranch.code)),
    ]);

    const agentMap = new Map<string, { agentKey: string; sid: string; name: string; staffMemberId?: string }>();
    for (const s of staffRows.filter((item) => item.isActive)) {
      const key = (s.sid || s.name).trim();
      if (key) {
        agentMap.set(key, {
          agentKey: key,
          sid: s.sid.trim(),
          name: s.name.trim(),
          staffMemberId: s.id,
        });
      }
    }
    for (const r of rpmRows) {
      const key = (r.sid || r.agentName).trim();
      if (key && !agentMap.has(key)) {
        agentMap.set(key, { agentKey: key, sid: r.sid.trim(), name: r.agentName.trim() });
      }
    }
    for (const sc of allBranchSchedules) {
      const key = sc.agentKey.trim();
      if (key && !agentMap.has(key)) {
        agentMap.set(key, { agentKey: key, sid: sc.sid.trim(), name: sc.agentName.trim() });
      }
    }

    const monthSchedules = allBranchSchedules.filter((s) => s.scheduleMonth === monthKey);
    const [yearNum, monthNum] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
      const shifts: Record<string, string> = {};
      for (const row of monthSchedules) {
        if (row.scheduleDate === date) {
          shifts[row.agentKey] = row.shift;
        }
      }
      return { date, shifts };
    });

    const agents = Array.from(agentMap.values()).sort((a, b) =>
      a.agentKey.localeCompare(b.agentKey)
    );

    return {
      status: 200 as const,
      data: {
        month: monthKey,
        days,
        agents,
        canEdit: principal.role === 'STORE_MANAGER',
        store: targetBranch,
        selectedBranchCode: targetBranch.code,
        authorizedBranches: principal.authorizedBranches,
        fiscalYear,
      },
    };
  }

  router.get('/month', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const month = String(req.query.month || new Date().toISOString().slice(0, 7)).trim();
      const branchCode = String(req.query.branchCode || '').trim();
      const result = await buildScheduleMonthPayload(req, month, branchCode);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      next(err);
    }
  });

  router.put('/cell', requireAuth, requireStoreManager, async (req: AppRequest, res, next) => {
    try {
      const parsed = cellUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid schedule cell payload.' });
        return;
      }

      const db = req.db!;
      const principal = req.principal!;
      const branchCode = principal.branchCode!;
      const { month, date, agentName, sid, shift, notes } = parsed.data;

      if (date.slice(0, 7) !== month) {
        res.status(400).json({ error: 'Schedule date must belong to the selected month.' });
        return;
      }

      const cfgRows = await db.select().from(systemConfigs);
      const cfgMap = new Map(cfgRows.map((c) => [c.key, c.value]));
      const fiscalYear = {
        startDate: cfgMap.get('financial_year_start') || DEFAULT_FISCAL_YEAR.startDate,
        endDate: cfgMap.get('financial_year_end') || DEFAULT_FISCAL_YEAR.endDate,
      };
      if (!isMonthInFiscalYear(month, fiscalYear)) {
        res.status(400).json({ error: 'Selected month is outside configured Fiscal Year.' });
        return;
      }

      const agentKey = (sid || agentName).trim();
      if (!shift) {
        await db
          .delete(storeSchedules)
          .where(
            and(
              eq(storeSchedules.branchCode, branchCode),
              eq(storeSchedules.scheduleDate, date),
              eq(storeSchedules.agentKey, agentKey)
            )
          );

        await writeAuditLog(db, {
          actorType: 'STORE_MANAGER',
          actorRole: 'STORE_MANAGER',
          actorIdentifier: principal.username,
          branchCode,
          action: 'CLEAR_SHIFT',
          domain: 'store_schedules',
          recordId: `${date}:${agentKey}`,
          ipAddress: getClientIp(req),
        });
        res.json({ ok: true, cleared: true });
        return;
      }

      const staffList = await db
        .select()
        .from(staffMembers)
        .where(eq(staffMembers.branchCode, branchCode));
      const matchedStaff = staffList.find(
        (s) => (sid && s.sid === sid) || s.name.toLowerCase() === agentName.toLowerCase()
      );

      await db
        .insert(storeSchedules)
        .values({
          branchCode,
          staffMemberId: matchedStaff?.id ?? null,
          scheduleDate: date,
          scheduleMonth: month,
          agentKey,
          agentName,
          sid,
          shift,
          notes: notes ?? '',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            storeSchedules.branchCode,
            storeSchedules.scheduleDate,
            storeSchedules.agentKey,
          ],
          set: {
            staffMemberId: matchedStaff?.id ?? null,
            agentName,
            sid,
            shift,
            notes: notes ?? '',
            updatedAt: new Date(),
          },
        });

      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: principal.username,
        branchCode,
        action: 'UPSERT_SHIFT',
        domain: 'store_schedules',
        recordId: `${date}:${agentKey}`,
        details: { shift },
        ipAddress: getClientIp(req),
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/import-grid',
    requireAuth,
    requireStoreManager,
    async (req: AppRequest, res, next) => {
      try {
        const parsed = gridImportSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid schedule import payload.' });
          return;
        }

        const db = req.db!;
        const principal = req.principal!;
        const branchCode = principal.branchCode!;
        const { month } = parsed.data;

        const cfgRows = await db.select().from(systemConfigs);
        const cfgMap = new Map(cfgRows.map((c) => [c.key, c.value]));
        const fiscalYear = {
          startDate: cfgMap.get('financial_year_start') || DEFAULT_FISCAL_YEAR.startDate,
          endDate: cfgMap.get('financial_year_end') || DEFAULT_FISCAL_YEAR.endDate,
        };
        if (!isMonthInFiscalYear(month, fiscalYear)) {
          res.status(400).json({ error: 'Selected month is outside configured Fiscal Year.' });
          return;
        }

        const staffRows = await db
          .select()
          .from(staffMembers)
          .where(eq(staffMembers.branchCode, branchCode));
        const rpmRows = await db
          .select()
          .from(agentRpmRecords)
          .where(eq(agentRpmRecords.branchCode, branchCode));

        const knownAgents: Array<{ key: string; name: string; sid: string; staffId?: string }> = [];
        const seenKeys = new Set<string>();
        for (const s of staffRows) {
          const key = (s.sid || s.name).trim();
          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            knownAgents.push({ key, name: s.name, sid: s.sid, staffId: s.id });
          }
        }
        for (const r of rpmRows) {
          const key = (r.sid || r.agentName).trim();
          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            knownAgents.push({ key, name: r.agentName, sid: r.sid });
          }
        }

        let entries = parsed.data.entries ?? [];
        if (parsed.data.fileBase64) {
          const buf = Buffer.from(parsed.data.fileBase64, 'base64');
          const matrix = await parseSpreadsheetBuffer(
            buf,
            parsed.data.fileType,
            parsed.data.fileName
          );
          if (matrix.length < 2) {
            res.status(400).json({ error: 'Uploaded schedule file has no data rows.' });
            return;
          }
          const headers = matrix[0].map((h) => h.trim());
          const dateIdx = headers.findIndex((h) => /^date$/i.test(h));
          if (dateIdx < 0) {
            res.status(400).json({ error: 'Schedule file must include a Date column.' });
            return;
          }
          const colAgents = headers
            .map((h, i) => ({
              index: i,
              agent: knownAgents.find(
                (a) => a.key === h || a.sid === h || a.name.toLowerCase() === h.toLowerCase()
              ),
            }))
            .filter((x) => Boolean(x.agent));

          if (colAgents.length === 0) {
            res.status(400).json({
              error: 'No columns matched existing staff SIDs or Agent Names.',
            });
            return;
          }

          entries = [];
          for (const row of matrix.slice(1)) {
            const normalizedDate = normalizeScheduleDateInput(row[dateIdx] || '');
            for (const col of colAgents) {
              entries.push({
                date: normalizedDate,
                agentName: col.agent!.name,
                sid: col.agent!.sid,
                shift: String(row[col.index] || '').trim().toUpperCase(),
              });
            }
          }
        }

        if (entries.length > 1500) {
          res.status(400).json({ error: 'Schedule upload must not exceed 1,500 cells.' });
          return;
        }

        const existingCells = await db
          .select()
          .from(storeSchedules)
          .where(
            and(
              eq(storeSchedules.branchCode, branchCode),
              eq(storeSchedules.scheduleMonth, month)
            )
          );
        const existingMap = new Map(
          existingCells.map((c) => [`${c.scheduleDate}|${c.agentKey}`, c.shift])
        );

        const validEntries: Array<{
          date: string;
          agentKey: string;
          agentName: string;
          sid: string;
          shift: string;
          staffMemberId: string | null;
        }> = [];
        const reasons: ImportReason[] = [];
        let invalid = 0;
        let duplicate = 0;
        const batchSeen = new Set<string>();

        entries.forEach((e, idx) => {
          const rowNum = idx + 1;
          const date = normalizeScheduleDateInput(e.date);
          const shift = String(e.shift || '').trim().toUpperCase();
          const agentKey = (e.sid || e.agentName || '').trim();

          if (!date || date.slice(0, 7) !== month) {
            invalid += 1;
            reasons.push({ row: rowNum, reason: `Date "${e.date}" is outside month ${month}.` });
            return;
          }
          if (!agentKey) {
            invalid += 1;
            reasons.push({ row: rowNum, reason: 'Missing agent identifier.' });
            return;
          }
          if (!ALLOWED_SHIFTS.includes(shift as (typeof ALLOWED_SHIFTS)[number])) {
            invalid += 1;
            reasons.push({ row: rowNum, reason: `Invalid shift "${shift}".` });
            return;
          }

          const cellKey = `${date}|${agentKey}`;
          if (batchSeen.has(cellKey) || (shift && existingMap.get(cellKey) === shift)) {
            duplicate += 1;
            reasons.push({ row: rowNum, reason: `Duplicate shift entry for ${cellKey}.` });
            return;
          }
          batchSeen.add(cellKey);
          const matched = knownAgents.find((a) => a.key === agentKey);
          validEntries.push({
            date,
            agentKey,
            agentName: e.agentName.trim() || agentKey,
            sid: e.sid.trim(),
            shift,
            staffMemberId: matched?.staffId ?? null,
          });
        });

        await db.transaction(async (tx) => {
          for (const item of validEntries) {
            if (!item.shift) {
              await tx
                .delete(storeSchedules)
                .where(
                  and(
                    eq(storeSchedules.branchCode, branchCode),
                    eq(storeSchedules.scheduleDate, item.date),
                    eq(storeSchedules.agentKey, item.agentKey)
                  )
                );
            } else {
              await tx
                .insert(storeSchedules)
                .values({
                  branchCode,
                  staffMemberId: item.staffMemberId,
                  scheduleDate: item.date,
                  scheduleMonth: month,
                  agentKey: item.agentKey,
                  agentName: item.agentName,
                  sid: item.sid,
                  shift: item.shift,
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    storeSchedules.branchCode,
                    storeSchedules.scheduleDate,
                    storeSchedules.agentKey,
                  ],
                  set: {
                    shift: item.shift,
                    agentName: item.agentName,
                    sid: item.sid,
                    updatedAt: new Date(),
                  },
                });
            }
          }
        });

        await writeAuditLog(db, {
          actorType: 'STORE_MANAGER',
          actorRole: 'STORE_MANAGER',
          actorIdentifier: principal.username,
          branchCode,
          action: 'IMPORT_SCHEDULE_GRID',
          domain: 'store_schedules',
          details: { month, imported: validEntries.length, invalid, duplicate },
          ipAddress: getClientIp(req),
        });

        res.json({
          total: entries.length,
          valid: validEntries.length,
          invalid,
          duplicate,
          imported: validEntries.length,
          rejected: invalid + duplicate,
          reasons: reasons.slice(0, 50),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/export', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const month = String(req.query.month || new Date().toISOString().slice(0, 7)).trim();
      const branchCode = String(req.query.branchCode || '').trim();
      const format = String(req.query.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';

      const result = await buildScheduleMonthPayload(req, month, branchCode);
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const headers = ['Date', ...result.data.agents.map((a) => a.sid || a.name)];
      const rows = result.data.days.map((day) => {
        const obj: Record<string, unknown> = { Date: day.date };
        for (const a of result.data.agents) {
          const colName = a.sid || a.name;
          obj[colName] = day.shifts[a.agentKey] || '';
        }
        return obj;
      });

      const codePrefix = result.data.selectedBranchCode || 'branch';
      if (format === 'xlsx') {
        const buffer = await serializeToXlsxBuffer(`Schedule_${month}`, headers, rows);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="store-schedule-${codePrefix}-${month}.xlsx"`
        );
        res.send(buffer);
        return;
      }

      const csv = serializeToUtf8Csv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="store-schedule-${codePrefix}-${month}.csv"`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
