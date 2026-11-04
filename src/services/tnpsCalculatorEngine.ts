export interface TnpsAgentRow {
  id: string;
  agentName: string;
  detractors: string | number;
  passive: string | number;
  promoters: string | number;
}

export interface ComputedTnpsRow {
  id: string;
  agentName: string;
  detractors: number;
  passive: number;
  promoters: number;
  total: number;
  tnpsPercent: number;
  requiredPromoters: number;
  daily: number;
}

export interface DailyTnpsRecord {
  id: string;
  branchCode: string;
  businessDate: string;
  agentRows: TnpsAgentRow[];
  totalDetractors: number;
  totalPassive: number;
  totalPromoters: number;
  totalResponses: number;
  dailyTnpsPercent: number;
  requiredPromoters: number;
  dailyRequired: number;
  updatedAt: string;
  updatedBy: string;
  revisionNumber: number;
}

export interface MonthlyTnpsSummary {
  month: string;
  totalDaysLogged: number;
  totalExpectedDays: number;
  completenessPercent: number;
  cumulativeDetractors: number;
  cumulativePassive: number;
  cumulativePromoters: number;
  cumulativeTotal: number;
  cumulativeTnpsPercent: number;
  bestDay: { date: string; tnps: number } | null;
  weakestDay: { date: string; tnps: number } | null;
  dayOverDayVariance: number;
  isTargetMet: boolean;
  targetPercent: number;
}

export const TNPS_TARGET_PERCENT = 70;

export const computeSingleAgentTnps = (
  row: TnpsAgentRow,
  remainingShifts: number
): ComputedTnpsRow => {
  const detractors = Math.max(0, parseFloat(String(row.detractors)) || 0);
  const passive = Math.max(0, parseFloat(String(row.passive)) || 0);
  const promoters = Math.max(0, parseFloat(String(row.promoters)) || 0);
  const total = detractors + passive + promoters;

  let tnpsPercent = 0;
  if (total > 0) {
    tnpsPercent = ((promoters - detractors) / total) * 100;
  }

  let requiredPromoters = 0;
  if (detractors > 0 || passive > 0 || promoters > 0) {
    const rawReq = (((1.7 * detractors) + (0.7 * passive)) / 0.3) - promoters;
    requiredPromoters = Math.max(0, Math.round(rawReq));
  }

  let daily = 0;
  if (remainingShifts > 0 && requiredPromoters > 0) {
    daily = Math.round(requiredPromoters / remainingShifts);
  }

  return {
    id: row.id,
    agentName: row.agentName,
    detractors,
    passive,
    promoters,
    total,
    tnpsPercent,
    requiredPromoters,
    daily,
  };
};

export const aggregateDailyTotalTnps = (
  computedRows: ComputedTnpsRow[],
  remainingShifts: number
) => {
  const detractors = computedRows.reduce((sum, r) => sum + r.detractors, 0);
  const passive = computedRows.reduce((sum, r) => sum + r.passive, 0);
  const promoters = computedRows.reduce((sum, r) => sum + r.promoters, 0);
  const total = detractors + passive + promoters;

  let tnpsPercent = 0;
  if (total > 0) {
    tnpsPercent = ((promoters - detractors) / total) * 100;
  }

  let requiredPromoters = 0;
  if (detractors > 0 || passive > 0 || promoters > 0) {
    const rawReq = (((1.7 * detractors) + (0.7 * passive)) / 0.3) - promoters;
    requiredPromoters = Math.max(0, Math.round(rawReq));
  }

  let dailyRequired = 0;
  if (remainingShifts > 0 && requiredPromoters > 0) {
    dailyRequired = Math.round(requiredPromoters / remainingShifts);
  }

  return {
    detractors,
    passive,
    promoters,
    total,
    tnpsPercent,
    requiredPromoters,
    dailyRequired,
  };
};

export const aggregateMonthlyRecords = (
  records: DailyTnpsRecord[],
  expectedWorkingDays: number = 25
): MonthlyTnpsSummary => {
  if (!records || records.length === 0) {
    return {
      month: 'Current Month',
      totalDaysLogged: 0,
      totalExpectedDays: expectedWorkingDays,
      completenessPercent: 0,
      cumulativeDetractors: 0,
      cumulativePassive: 0,
      cumulativePromoters: 0,
      cumulativeTotal: 0,
      cumulativeTnpsPercent: 0,
      bestDay: null,
      weakestDay: null,
      dayOverDayVariance: 0,
      isTargetMet: false,
      targetPercent: TNPS_TARGET_PERCENT,
    };
  }

  const sorted = [...records].sort((a, b) => new Date(a.businessDate).getTime() - new Date(b.businessDate).getTime());

  let totalDetractors = 0;
  let totalPassive = 0;
  let totalPromoters = 0;
  let bestDay: { date: string; tnps: number } | null = null;
  let weakestDay: { date: string; tnps: number } | null = null;

  sorted.forEach((r) => {
    totalDetractors += r.totalDetractors;
    totalPassive += r.totalPassive;
    totalPromoters += r.totalPromoters;

    if (!bestDay || r.dailyTnpsPercent > bestDay.tnps) {
      bestDay = { date: r.businessDate, tnps: Math.round(r.dailyTnpsPercent) };
    }
    if (!weakestDay || r.dailyTnpsPercent < weakestDay.tnps) {
      weakestDay = { date: r.businessDate, tnps: Math.round(r.dailyTnpsPercent) };
    }
  });

  const cumulativeTotal = totalDetractors + totalPassive + totalPromoters;
  let cumulativeTnpsPercent = 0;
  if (cumulativeTotal > 0) {
    cumulativeTnpsPercent = ((totalPromoters - totalDetractors) / cumulativeTotal) * 100;
  }

  // Day-over-Day variance between last two recorded days
  let dayOverDayVariance = 0;
  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1].dailyTnpsPercent;
    const prev = sorted[sorted.length - 2].dailyTnpsPercent;
    dayOverDayVariance = Math.round(last - prev);
  }

  const completenessPercent = Math.min(100, Math.round((records.length / Math.max(1, expectedWorkingDays)) * 100));

  return {
    month: sorted[0]?.businessDate?.slice(0, 7) || '2026-11',
    totalDaysLogged: records.length,
    totalExpectedDays: expectedWorkingDays,
    completenessPercent,
    cumulativeDetractors: totalDetractors,
    cumulativePassive: totalPassive,
    cumulativePromoters: totalPromoters,
    cumulativeTotal,
    cumulativeTnpsPercent: Math.round(cumulativeTnpsPercent),
    bestDay,
    weakestDay,
    dayOverDayVariance,
    isTargetMet: cumulativeTnpsPercent >= TNPS_TARGET_PERCENT,
    targetPercent: TNPS_TARGET_PERCENT,
  };
};
