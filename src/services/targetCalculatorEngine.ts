export interface ItemData {
  id: string;
  name: string;
  shortName: string;
  monthlyTarget: string;
  mtdAchievement: string;
  todayAch: string;
}

export interface BoxWeights {
  acq: string;       // 60%
  terminal: string;  // 10%
  enterprise: string;// 10%
  adsl: string;      // 16%
  home: string;      // 4%
}

export const DEFAULT_BOX_WEIGHTS: BoxWeights = {
  acq: '60',
  terminal: '10',
  enterprise: '10',
  adsl: '16',
  home: '4',
};

export const DEFAULT_TARGET_ITEMS: Record<string, ItemData> = {
  acq_low: { id: 'acq_low', name: 'Low Acq', shortName: 'Acq Low', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  acq_high: { id: 'acq_high', name: 'High Acq', shortName: 'Acq High', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  vf_cash: { id: 'vf_cash', name: 'Vf Cash', shortName: 'Cash New', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  terminal: { id: 'terminal', name: 'Terminal', shortName: 'Terminal', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  ent_acc: { id: 'ent_acc', name: 'Ent Acc', shortName: 'Acc', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  ent_gas: { id: 'ent_gas', name: 'Ent GAs', shortName: 'GAs', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  adsl: { id: 'adsl', name: 'ADSL', shortName: 'ADSL', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
  home: { id: 'home', name: '@Home', shortName: '@Home', monthlyTarget: '0', mtdAchievement: '0', todayAch: '0' },
};

export const SAMPLE_TEST_ITEMS: Record<string, ItemData> = {
  acq_low: { id: 'acq_low', name: 'Low Acq', shortName: 'Acq Low', monthlyTarget: '150', mtdAchievement: '45', todayAch: '5' },
  acq_high: { id: 'acq_high', name: 'High Acq', shortName: 'Acq High', monthlyTarget: '80', mtdAchievement: '32', todayAch: '4' },
  vf_cash: { id: 'vf_cash', name: 'Vf Cash', shortName: 'Cash New', monthlyTarget: '100', mtdAchievement: '50', todayAch: '6' },
  terminal: { id: 'terminal', name: 'Terminal', shortName: 'Terminal', monthlyTarget: '60', mtdAchievement: '28', todayAch: '3' },
  ent_acc: { id: 'ent_acc', name: 'Ent Acc', shortName: 'Acc', monthlyTarget: '20', mtdAchievement: '10', todayAch: '1' },
  ent_gas: { id: 'ent_gas', name: 'Ent GAs', shortName: 'GAs', monthlyTarget: '30', mtdAchievement: '12', todayAch: '2' },
  adsl: { id: 'adsl', name: 'ADSL', shortName: 'ADSL', monthlyTarget: '90', mtdAchievement: '42', todayAch: '4' },
  home: { id: 'home', name: '@Home', shortName: '@Home', monthlyTarget: '25', mtdAchievement: '14', todayAch: '1' },
};

export interface DailyTrendPoint {
  id: string;
  date: string;
  dayLabel: string;
  acq: number;
  terminal: number;
  enterprise: number;
  fixed: number;
  total: number;
}

export const parseNumericWeight = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  const converted = String(val)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[^0-9.]/g, '');
  const num = parseFloat(converted);
  return isNaN(num) ? 0 : Math.max(0, num);
};

export const computeItemMetrics = (
  raw: ItemData,
  totalShifts: number,
  remainingShifts: number
) => {
  const target = parseFloat(raw.monthlyTarget) || 0;
  const mtd = parseFloat(raw.mtdAchievement) || 0;
  const today = parseFloat(raw.todayAch) || 0;
  const elapsedShifts = Math.max(0, totalShifts - remainingShifts);

  const remainingTarget = Math.max(0, target - mtd);
  const dailyTarget = remainingShifts > 0 ? remainingTarget / remainingShifts : 'N/A';
  const mtdPercent = target > 0 ? (mtd / target) * 100 : 0;

  let projectedUnits: number | 'N/A' = 'N/A';
  let projectionPercent: number | 'N/A' = 'N/A';
  if (elapsedShifts > 0 && totalShifts > 0) {
    projectedUnits = (mtd / elapsedShifts) * totalShifts;
    if (target > 0) {
      projectionPercent = (projectedUnits / target) * 100;
    }
  }

  return {
    ...raw,
    parsedTarget: target,
    parsedMtd: mtd,
    parsedToday: today,
    remainingTarget,
    dailyTarget,
    mtdPercent,
    projectedUnits,
    projectionPercent,
  };
};

export const calculateRE = (
  mtd: number,
  target: number,
  elapsedShifts: number,
  totalShifts: number
): number | 'N/A' => {
  if (target <= 0) return 'N/A';
  if (elapsedShifts > 0 && totalShifts > 0) {
    return ((mtd / target) / elapsedShifts) * totalShifts * 100;
  }
  return (mtd / target) * 100;
};

export const formatNumber = (val: number | 'N/A' | string | undefined | null): string => {
  if (val === 'N/A' || val === undefined || val === null || val === '') return 'N/A';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(num));
};

export const formatPercent = (val: number | 'N/A' | string | undefined | null): string => {
  if (val === 'N/A' || val === undefined || val === null || val === '') return 'N/A';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return 'N/A';
  return `${Math.round(num)}%`;
};

export const generateInitial7DayHistory = (): DailyTrendPoint[] => {
  const result: DailyTrendPoint[] = [];
  const now = new Date();
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  for (let i = 6; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    const name = dayNames[d.getDay()];
    const acq = 12 + ((i * 3) % 8);
    const terminal = 2 + (i % 3);
    const enterprise = 2 + ((i + 1) % 3);
    const fixed = 4 + ((i * 2) % 4);
    result.push({
      id: `day-${i}`,
      date: dateStr,
      dayLabel: `${name} ${dateStr}`,
      acq,
      terminal,
      enterprise,
      fixed,
      total: acq + terminal + enterprise + fixed,
    });
  }

  const todayStr = `${now.getDate()}/${now.getMonth() + 1}`;
  const todayName = dayNames[now.getDay()];
  result.push({
    id: 'today',
    date: todayStr,
    dayLabel: `اليوم (${todayName})`,
    acq: 0,
    terminal: 0,
    enterprise: 0,
    fixed: 0,
    total: 0,
  });

  return result;
};

export const generateWhatsAppMessage = (params: {
  storeName: string;
  dateStr: string;
  computedItems: Record<string, ReturnType<typeof computeItemMetrics>>;
  acqBox: any;
  terminalBox: any;
  enterpriseBox: any;
  fixedBox: any;
  redSalesToday: string;
  redSalesTarget: string;
  overallProjectionPercent: number;
  tnpsPercent: number;
  elapsedShifts: number;
  totalShifts: number;
}): string => {
  const {
    storeName,
    dateStr,
    computedItems,
    acqBox,
    terminalBox,
    enterpriseBox,
    fixedBox,
    redSalesToday,
    redSalesTarget,
    overallProjectionPercent,
    tnpsPercent,
    elapsedShifts,
    totalShifts,
  } = params;

  const lines: string[] = [];
  lines.push('🟢 Store Daily Performance');
  lines.push(`📅 Date: ${dateStr}`);
  lines.push(`Store : ${storeName}`);
  lines.push('------------------------');

  // 1. Acquisition Box
  const low = computedItems.acq_low;
  const high = computedItems.acq_high;
  const cash = computedItems.vf_cash;
  const hasLow = low.parsedTarget > 0;
  const hasHigh = high.parsedTarget > 0;
  const hasCash = cash.parsedTarget > 0;
  if (hasLow || hasHigh || hasCash) {
    lines.push('📦 Acquisition Box');
    lines.push('------------------------');
    if (hasLow) {
      lines.push('• Acq Low');
      lines.push(`Ach:  ${formatNumber(low.parsedToday)} / ${formatNumber(low.dailyTarget)}`);
      lines.push(`Target:  ${formatNumber(low.parsedMtd)} / ${formatNumber(low.parsedTarget)}`);
      lines.push('------------------------');
    }
    if (hasHigh) {
      lines.push('• Acq High');
      lines.push(`Ach:  ${formatNumber(high.parsedToday)} / ${formatNumber(high.dailyTarget)}`);
      lines.push(`Target:  ${formatNumber(high.parsedMtd)} / ${formatNumber(high.parsedTarget)}`);
      lines.push('------------------------');
    }
    if (hasCash) {
      lines.push('• Cash New');
      lines.push(`Ach:  ${formatNumber(cash.parsedToday)} / ${formatNumber(cash.dailyTarget)}`);
      lines.push(`Target:  ${formatNumber(cash.parsedMtd)} / ${formatNumber(cash.parsedTarget)}`);
      lines.push('------------------------');
    }
    lines.push('------------------------');
    lines.push('⭐ Today Acq');
    lines.push(`Ach:  ${formatNumber(acqBox.todayAch)} / ${formatNumber(acqBox.dailyTarget)}`);
    lines.push(`Target:  ${formatNumber(acqBox.mtdAchievement)} / ${formatNumber(acqBox.monthlyTarget)}`);
    lines.push(`RE: ${formatPercent(calculateRE(acqBox.mtdAchievement, acqBox.monthlyTarget, elapsedShifts, totalShifts))}`);
    lines.push('------------------------');
  }

  // 2. Terminal
  const ter = computedItems.terminal;
  if (ter.parsedTarget > 0) {
    lines.push('📱 Terminal');
    lines.push('------------------------');
    lines.push(`Today Ach:  ${formatNumber(ter.parsedToday)} / ${formatNumber(ter.dailyTarget)}`);
    lines.push(`Target:  ${formatNumber(ter.parsedMtd)} / ${formatNumber(ter.parsedTarget)}`);
    lines.push(`RE: ${formatPercent(calculateRE(ter.parsedMtd, ter.parsedTarget, elapsedShifts, totalShifts))}`);
    lines.push('------------------------');
  }

  // 3. Enterprise
  const acc = computedItems.ent_acc;
  const gas = computedItems.ent_gas;
  const hasAcc = acc.parsedTarget > 0;
  const hasGas = gas.parsedTarget > 0;
  if (hasAcc || hasGas) {
    lines.push('💼 Enterprise');
    lines.push('------------------------');
    if (hasAcc) {
      lines.push(`Today Ach:  ${formatNumber(acc.parsedToday)} / ${formatNumber(acc.dailyTarget)}`);
      lines.push(`Acc:  ${formatNumber(acc.parsedMtd)} / ${formatNumber(acc.parsedTarget)}`);
      lines.push(`RE: ${formatPercent(calculateRE(acc.parsedMtd, acc.parsedTarget, elapsedShifts, totalShifts))}`);
    }
    if (hasAcc && hasGas) {
      lines.push('----------------');
    }
    if (hasGas) {
      lines.push(`Today Ach:  ${formatNumber(gas.parsedToday)} / ${formatNumber(gas.dailyTarget)}`);
      lines.push(`GAs:  ${formatNumber(gas.parsedMtd)} / ${formatNumber(gas.parsedTarget)}`);
      lines.push(`RE: ${formatPercent(calculateRE(gas.parsedMtd, gas.parsedTarget, elapsedShifts, totalShifts))}`);
    }
    lines.push('------------------------');
  }

  // 4. Fixed
  const adsl = computedItems.adsl;
  const home = computedItems.home;
  const hasAdsl = adsl.parsedTarget > 0;
  const hasHome = home.parsedTarget > 0;
  if (hasAdsl || hasHome) {
    lines.push('🌐 Fixed');
    lines.push('------------------------');
    if (hasAdsl) {
      lines.push('• ADSL');
      lines.push(`Today Ach:  ${formatNumber(adsl.parsedToday)} / ${formatNumber(adsl.dailyTarget)}`);
      lines.push(`Target:  ${formatNumber(adsl.parsedMtd)} / ${formatNumber(adsl.parsedTarget)}`);
      lines.push(`RE: ${formatPercent(calculateRE(adsl.parsedMtd, adsl.parsedTarget, elapsedShifts, totalShifts))}`);
    }
    if (hasAdsl && hasHome) {
      lines.push('---------------');
    }
    if (hasHome) {
      lines.push('• @Home');
      lines.push(`Today Ach:  ${formatNumber(home.parsedToday)} / ${formatNumber(home.dailyTarget)}`);
      lines.push(`Target:  ${formatNumber(home.parsedMtd)} / ${formatNumber(home.parsedTarget)}`);
      lines.push(`RE: ${formatPercent(calculateRE(home.parsedMtd, home.parsedTarget, elapsedShifts, totalShifts))}`);
    }
    lines.push('------------------------');
  }

  // 5. Red Sales
  const redTarget = parseFloat(redSalesTarget) || 0;
  const redToday = parseFloat(redSalesToday) || 0;
  if (redTarget > 0) {
    lines.push(`Red Sales:  ${formatNumber(redToday)} / ${formatNumber(redTarget)}`);
    lines.push('------------------------');
  }

  // 6. Overall & TNPS
  lines.push(`Overall: ${formatPercent(overallProjectionPercent)}`);
  lines.push(`TNPS: ${formatPercent(tnpsPercent)}`);
  lines.push('Thanks 🫡');

  return lines.join('\n');
};
