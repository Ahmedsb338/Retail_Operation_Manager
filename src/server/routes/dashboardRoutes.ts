import { Router } from 'express';
import { inArray } from 'drizzle-orm';
import {
  agentRpmRecords,
  branchHealthConfigs,
  complaints,
  pillarTargets,
  salesBoxes,
  staffMembers,
  storeRpmRecords,
  storeTasks,
  systemConfigs,
  tnpsStoreRecords,
} from '../../db/schema.ts';
import {
  buildTopAgentSummary,
  DEFAULT_FISCAL_YEAR,
  isMonthInFiscalYear,
  matchesDateOverlapFilter,
  monthlyAverageAchievement,
  PILLARS,
  roundTo,
  validateDateRange,
} from '../services/domainCalculations.ts';
import { requireAuth, resolveScopedBranches, type AppRequest } from '../middleware/auth.ts';

export function createDashboardRouter(): Router {
  const router = Router();

  router.get('/', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const principal = req.principal!;
      const requestedBranch = String(req.query.branchCode || '').trim();
      const fromDate = String(req.query.fromDate || '').trim();
      const toDate = String(req.query.toDate || '').trim();

      let cleanRange: { fromDate: string; toDate: string };
      try {
        cleanRange = validateDateRange({ fromDate, toDate });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid date range.' });
        return;
      }

      const scope = resolveScopedBranches(principal, requestedBranch);
      if (scope.error) {
        res.status(403).json({ error: scope.error });
        return;
      }

      const scopedCodes = scope.branches.map((b) => b.code);
      if (scopedCodes.length === 0) {
        res.json({
          branchCount: 0,
          agentCount: 0,
          passedCount: 0,
          pillarCount: PILLARS.length,
          overallAchievement: null,
          openComplaintsCount: 0,
          weakestPillar: null,
          pillars: PILLARS.map((pillar) => ({
            pillar,
            achievement: null,
            passed: false,
            configured: false,
          })),
          agents: [],
          operations: { total: 0, completed: 0, blocked: 0, overdue: 0, completionPercent: null },
          tnps: { latestScore: null, benchmark: 70, lastDate: null },
          salesSummary: { boxCount: 0, overallAchievement: null, boxes: [] },
          fiscalYear: DEFAULT_FISCAL_YEAR,
          authorizedBranches: principal.authorizedBranches,
          canEdit: principal.role === 'STORE_MANAGER',
        });
        return;
      }

      const [
        configRows,
        targetRows,
        rawStoreRpm,
        rawAgentRpm,
        rawComplaints,
        rawTasks,
        rawStaff,
        rawSales,
        rawTnpsStore,
        rawHealthConfigs,
      ] = await Promise.all([
        db.select().from(systemConfigs),
        db.select().from(pillarTargets),
        db.select().from(storeRpmRecords).where(inArray(storeRpmRecords.branchCode, scopedCodes)),
        db.select().from(agentRpmRecords).where(inArray(agentRpmRecords.branchCode, scopedCodes)),
        db.select().from(complaints).where(inArray(complaints.branchCode, scopedCodes)),
        db.select().from(storeTasks).where(inArray(storeTasks.branchCode, scopedCodes)),
        db.select().from(staffMembers).where(inArray(staffMembers.branchCode, scopedCodes)),
        db.select().from(salesBoxes).where(inArray(salesBoxes.branchCode, scopedCodes)),
        db.select().from(tnpsStoreRecords).where(inArray(tnpsStoreRecords.branchCode, scopedCodes)),
        db.select().from(branchHealthConfigs).where(inArray(branchHealthConfigs.branchCode, scopedCodes)),
      ]);

      const cfgMap = new Map(configRows.map((c) => [c.key, c.value]));
      const fiscalYear = {
        startDate: cfgMap.get('financial_year_start') || DEFAULT_FISCAL_YEAR.startDate,
        endDate: cfgMap.get('financial_year_end') || DEFAULT_FISCAL_YEAR.endDate,
      };

      const filteredStoreRpm = rawStoreRpm.filter((r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, cleanRange)
      );
      const filteredAgentRpm = rawAgentRpm.filter((r) =>
        matchesDateOverlapFilter({ month: r.month, createdAt: r.createdAt }, cleanRange)
      );
      const filteredComplaints = rawComplaints.filter((c) =>
        matchesDateOverlapFilter({ date: c.date, createdAt: c.createdAt }, cleanRange)
      );
      const filteredTasks = rawTasks.filter((t) =>
        matchesDateOverlapFilter(
          { date: t.date, dueDate: t.dueDate, createdAt: t.createdAt },
          cleanRange
        )
      );
      const filteredTnps = rawTnpsStore.filter((t) =>
        matchesDateOverlapFilter(
          { businessDate: t.businessDate, month: t.month, createdAt: t.createdAt },
          cleanRange
        )
      );

      const targetMap = new Map(targetRows.map((t) => [t.pillar, t.monthlyTarget]));

      const pillars = PILLARS.map((pillar) => {
        const rows = filteredStoreRpm.filter(
          (r) => r.pillar === pillar && isMonthInFiscalYear(r.month, fiscalYear)
        );
        const avg = monthlyAverageAchievement(rows);
        const configuredTarget = targetMap.get(pillar) ?? null;
        return {
          pillar,
          achievement: avg,
          passed: avg !== null && avg >= 100,
          configured: avg !== null || (configuredTarget !== null && configuredTarget > 0),
        };
      });

      const configuredPillars = pillars.filter((p) => p.achievement !== null);
      const overallAchievement =
        configuredPillars.length > 0
          ? roundTo(
              configuredPillars.reduce((sum, p) => sum + (p.achievement ?? 0), 0) /
                configuredPillars.length,
              1
            )
          : null;

      const weakestPillar =
        configuredPillars.length > 0
          ? [...configuredPillars].sort((a, b) => (a.achievement ?? 0) - (b.achievement ?? 0))[0]
          : null;

      const uniqueAgentNames = new Set([
        ...rawStaff.filter((s) => s.isActive).map((s) => s.name),
        ...filteredAgentRpm.map((r) => r.agentName),
      ]);

      const openComplaintsCount = filteredComplaints.filter(
        (c) => !['resolved', 'closed'].includes(String(c.status).toLowerCase())
      ).length;

      const totalTasks = filteredTasks.length;
      const completedTasks = filteredTasks.filter((t) => t.status === 'completed').length;
      const blockedTasks = filteredTasks.filter((t) => t.status === 'blocked').length;
      const nowIso = new Date().toISOString();
      const overdueTasks = filteredTasks.filter(
        (t) =>
          t.status !== 'completed' &&
          t.dueDate &&
          t.dueDate < nowIso.slice(0, 10)
      ).length;

      const sortedTnps = [...filteredTnps].sort((a, b) => {
        const keyA = a.businessDate || a.month;
        const keyB = b.businessDate || b.month;
        return keyB.localeCompare(keyA);
      });
      const latestTnps = sortedTnps[0] ?? null;

      const salesWithAch = rawSales.map((box) => ({
        id: box.id,
        branchCode: box.branchCode,
        boxKey: box.boxKey,
        name: box.name,
        nameAr: box.nameAr,
        target: box.target,
        actual: box.actual,
        remainingWorkingDays: box.remainingWorkingDays,
        achievement: box.target > 0 ? roundTo((box.actual / box.target) * 100, 1) : null,
      }));
      const validSales = salesWithAch.filter((s) => s.achievement !== null);
      const salesOverallAchievement =
        validSales.length > 0
          ? roundTo(
              validSales.reduce((sum, b) => sum + (b.achievement ?? 0), 0) / validSales.length,
              1
            )
          : null;

      res.json({
        branchCount: scope.branches.length,
        agentCount: uniqueAgentNames.size,
        passedCount: pillars.filter((p) => p.passed).length,
        pillarCount: PILLARS.length,
        overallAchievement,
        openComplaintsCount,
        weakestPillar,
        pillars,
        agents: buildTopAgentSummary(filteredAgentRpm),
        operations: {
          total: totalTasks,
          completed: completedTasks,
          blocked: blockedTasks,
          overdue: overdueTasks,
          completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null,
        },
        tnps: {
          latestScore: latestTnps ? latestTnps.score : null,
          benchmark: latestTnps?.benchmark ?? 70,
          lastDate: latestTnps ? (latestTnps.businessDate || latestTnps.month) : null,
        },
        salesSummary: {
          boxCount: salesWithAch.length,
          overallAchievement: salesOverallAchievement,
          boxes: salesWithAch,
        },
        healthWeightsConfigured: rawHealthConfigs[0] ?? null,
        fiscalYear,
        authorizedBranches: principal.authorizedBranches,
        canEdit: principal.role === 'STORE_MANAGER',
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
