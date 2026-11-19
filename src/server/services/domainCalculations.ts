export const PILLARS = ['Acquisition', 'Enterprise', 'Terminal', 'ADSL', 'AT Home'] as const;

export const ALLOWED_SHIFTS = ['', 'AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF'] as const;

export interface DateFilterRange {
  fromDate?: string;
  toDate?: string;
}

export interface FiscalYearBounds {
  startDate: string; // e.g. '2026-04-01'
  endDate: string;   // e.g. '2027-03-31'
}

export const DEFAULT_FISCAL_YEAR: FiscalYearBounds = {
  startDate: '2026-04-01',
  endDate: '2027-03-31',
};

export function roundTo(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(Number(value) * factor) / factor;
}

/**
 * Achievement % is NEVER calculated when target is missing, null, or <= 0.
 * Returns null so UI/exports display "Unconfigured" rather than 0%.
 */
export function computeAchievementPercent(
  actual: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (actual === null || actual === undefined || target === null || target === undefined) {
    return null;
  }
  const a = Number(actual);
  const t = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) {
    return null;
  }
  return roundTo((a / t) * 100, 1);
}

export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isIsoMonthString(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isMonthInFiscalYear(
  monthValue: string,
  bounds: FiscalYearBounds = DEFAULT_FISCAL_YEAR
): boolean {
  const clean = String(monthValue || '').trim();
  const normalizedDate = isIsoMonthString(clean)
    ? `${clean}-01`
    : isIsoDateString(clean)
      ? clean
      : '';
  if (!normalizedDate) return false;
  return normalizedDate >= bounds.startDate && normalizedDate <= bounds.endDate;
}

export function validateDateRange(filters: DateFilterRange): { fromDate: string; toDate: string } {
  const fromDate = String(filters.fromDate || '').trim();
  const toDate = String(filters.toDate || '').trim();
  if ((fromDate && !isIsoDateString(fromDate)) || (toDate && !isIsoDateString(toDate))) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error('Invalid date range: fromDate cannot be after toDate.');
  }
  return { fromDate, toDate };
}

function getMonthEndDate(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Preserves the exact date overlap filtering rules from the recovered Apps Script:
 * 1) Records with Start Date / Due Date pass when [recordStart, recordEnd] overlaps [fromDate, toDate].
 * 2) Records with Month (YYYY-MM) pass when [monthStart, monthEnd] overlaps [fromDate, toDate].
 * 3) Records with Date or Created At pass when date lies inside [fromDate, toDate].
 */
export function matchesDateOverlapFilter(
  row: {
    startDate?: string | null;
    dueDate?: string | null;
    month?: string | null;
    date?: string | null;
    businessDate?: string | null;
    createdAt?: Date | string | null;
  },
  filters: DateFilterRange
): boolean {
  const { fromDate, toDate } = validateDateRange(filters);
  if (!fromDate && !toDate) return true;

  const start = row.startDate && isIsoDateString(row.startDate.slice(0, 10))
    ? row.startDate.slice(0, 10)
    : '';
  const end = row.dueDate && isIsoDateString(row.dueDate.slice(0, 10))
    ? row.dueDate.slice(0, 10)
    : '';

  if (start || end) {
    const recordStart = start || end;
    const recordEnd = end || start;
    return (!toDate || recordStart <= toDate) && (!fromDate || recordEnd >= fromDate);
  }

  const monthRaw = String(row.month || '').trim();
  const monthMatch = monthRaw.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
  if (monthMatch) {
    const monthStart = `${monthMatch[1]}-${monthMatch[2]}-01`;
    const monthEnd = getMonthEndDate(Number(monthMatch[1]), Number(monthMatch[2]));
    return (!toDate || monthStart <= toDate) && (!fromDate || monthEnd >= fromDate);
  }

  const singleDates: string[] = [];
  if (row.date && isIsoDateString(row.date.slice(0, 10))) {
    singleDates.push(row.date.slice(0, 10));
  }
  if (row.businessDate && isIsoDateString(row.businessDate.slice(0, 10))) {
    singleDates.push(row.businessDate.slice(0, 10));
  }
  if (row.createdAt) {
    const iso = row.createdAt instanceof Date
      ? row.createdAt.toISOString().slice(0, 10)
      : String(row.createdAt).slice(0, 10);
    if (isIsoDateString(iso)) {
      singleDates.push(iso);
    }
  }

  if (singleDates.length === 0) return false;
  return singleDates.some(
    (d) => (!fromDate || d >= fromDate) && (!toDate || d <= toDate)
  );
}

export interface RpmMetricInput {
  month: string;
  pillar: string;
  actual: number | null;
  target: number | null;
  agentName?: string;
  sid?: string;
}

/**
 * YTD Store RPM uses the arithmetic average of monthly results within the
 * configured financial year. Returns null ("Unconfigured") when no valid target (> 0)
 * monthly records exist.
 */
export function monthlyAverageAchievement(rows: RpmMetricInput[]): number | null {
  const byMonth = new Map<string, number[]>();
  for (const row of rows) {
    if (row.actual === null || row.target === null) continue;
    if (!(row.target > 0)) continue;
    const monthKey = String(row.month || '').slice(0, 7);
    if (!isIsoMonthString(monthKey)) continue;
    const ach = (row.actual / row.target) * 100;
    if (!Number.isFinite(ach)) continue;
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(ach);
  }

  if (byMonth.size === 0) return null;

  const monthlyMeans = Array.from(byMonth.values()).map(
    (vals) => vals.reduce((acc, v) => acc + v, 0) / vals.length
  );
  if (monthlyMeans.length === 0) return null;

  return roundTo(monthlyMeans.reduce((acc, v) => acc + v, 0) / monthlyMeans.length, 1);
}

export interface TopAgentSummaryItem {
  name: string;
  sid: string;
  passed: number;
  pillarCount: number;
  overall: number | null;
}

export function buildTopAgentSummary(rows: RpmMetricInput[]): TopAgentSummaryItem[] {
  const names = Array.from(new Set(rows.map((r) => r.agentName?.trim() || '').filter(Boolean)));
  const summaries = names.map((name) => {
    const agentRows = rows.filter((r) => (r.agentName?.trim() || '') === name);
    const pillarScores = PILLARS.map((pillar) => {
      const pRows = agentRows.filter((r) => r.pillar === pillar);
      const valid = pRows
        .map((r) => (r.target && r.target > 0 && r.actual !== null ? (r.actual / r.target) * 100 : null))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      if (valid.length === 0) return null;
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    });

    const configuredScores = pillarScores.filter((v): v is number => v !== null);
    const overall =
      configuredScores.length > 0
        ? roundTo(configuredScores.reduce((a, b) => a + b, 0) / configuredScores.length, 1)
        : null;

    return {
      name,
      sid: agentRows.find((r) => r.sid)?.sid || '',
      passed: configuredScores.filter((v) => v >= 100).length,
      pillarCount: PILLARS.length,
      overall,
    };
  });

  return summaries
    .sort((a, b) => {
      if (b.passed !== a.passed) return b.passed - a.passed;
      return (b.overall ?? -1) - (a.overall ?? -1);
    })
    .slice(0, 10);
}
