import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ItemData,
  BoxWeights,
  DailyTrendPoint,
  DEFAULT_BOX_WEIGHTS,
  DEFAULT_TARGET_ITEMS,
  SAMPLE_TEST_ITEMS,
  computeItemMetrics,
  calculateRE,
  formatNumber,
  formatPercent,
  parseNumericWeight,
  generateWhatsAppMessage,
} from '../../services/targetCalculatorEngine';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  X,
  ChevronRight,
  MessageSquare,
  Send,
  TrendingUp,
  TrendingDown,
  Plus,
  Store,
  Sparkles,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const TargetCalculatorView: React.FC = () => {
  const {
    t,
    language,
    theme,
    currentBranch,
  } = useApp();

  const darkMode = theme === 'dark';

  // 1. Box Weights
  const [boxWeights, setBoxWeights] = useState<BoxWeights>(() => {
    const saved = localStorage.getItem(`opm_target_weights_${currentBranch?.code || 'default'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_BOX_WEIGHTS;
  });

  // 2. Items state
  const [items, setItems] = useState<Record<string, ItemData>>(() => {
    const saved = localStorage.getItem(`opm_target_items_${currentBranch?.code || 'default'}`);
    if (saved) {
      try {
        return { ...DEFAULT_TARGET_ITEMS, ...JSON.parse(saved) };
      } catch {}
    }
    return SAMPLE_TEST_ITEMS; // default with initial values for immediate usability
  });

  // 3. Shifts & Store info
  const [totalShifts, setTotalShifts] = useState<string>('25');
  const [remainingShifts, setRemainingShifts] = useState<string>('10');
  const [storeName, setStoreName] = useState<string>(currentBranch?.name || 'Abo ElMatamer Mahkama St. Express Store');
  const [redSalesToday, setRedSalesToday] = useState<string>('2');
  const [redSalesTarget, setRedSalesTarget] = useState<string>('15');

  // UI States
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Daily tracking for Today's additions
  const [lastSavedToday, setLastSavedToday] = useState<Record<string, number>>({});
  const [isTodaySaved, setIsTodaySaved] = useState<boolean>(false);

  // 7-Day Trend History
  const [dailyHistory, setDailyHistory] = useState<DailyTrendPoint[]>([
    { id: '1', date: '28/10', dayLabel: 'الأربعاء 28/10', acq: 18, terminal: 3, enterprise: 4, fixed: 6, total: 31 },
    { id: '2', date: '29/10', dayLabel: 'الخميس 29/10', acq: 22, terminal: 4, enterprise: 3, fixed: 7, total: 36 },
    { id: '3', date: '30/10', dayLabel: 'الجمعة 30/10', acq: 14, terminal: 2, enterprise: 2, fixed: 5, total: 23 },
    { id: '4', date: '31/10', dayLabel: 'السبت 31/10', acq: 26, terminal: 5, enterprise: 5, fixed: 8, total: 44 },
    { id: '5', date: '1/11', dayLabel: 'الأحد 1/11', acq: 20, terminal: 3, enterprise: 4, fixed: 6, total: 33 },
    { id: '6', date: '2/11', dayLabel: 'الإثنين 2/11', acq: 24, terminal: 4, enterprise: 3, fixed: 7, total: 38 },
    { id: 'today', date: '3/11', dayLabel: 'اليوم (الثلاثاء)', acq: 15, terminal: 3, enterprise: 3, fixed: 5, total: 26 },
  ]);
  const [chartMode, setChartMode] = useState<'total' | 'breakdown'>('total');

  // Shifts calculations
  const parsedTotalShifts = Math.max(0, parseFloat(totalShifts) || 0);
  const parsedRemainingShifts = Math.max(0, parseFloat(remainingShifts) || 0);
  const elapsedShifts = parsedTotalShifts - parsedRemainingShifts;

  // Active weights
  const activeWeights = useMemo(() => {
    const acq = parseNumericWeight(boxWeights.acq);
    const terminal = parseNumericWeight(boxWeights.terminal);
    const enterprise = parseNumericWeight(boxWeights.enterprise);
    const adsl = parseNumericWeight(boxWeights.adsl);
    const home = parseNumericWeight(boxWeights.home);
    const total = acq + terminal + enterprise + adsl + home;
    const divisor = total > 0 ? total : 100;
    return { acq, terminal, enterprise, adsl, home, total, divisor };
  }, [boxWeights]);

  const totalBoxWeight = activeWeights.total;
  const isWeightValid = Math.abs(totalBoxWeight - 100) < 0.01;

  // Computed Items
  const computedItems = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeItemMetrics>> = {};
    Object.keys(DEFAULT_TARGET_ITEMS).forEach((k) => {
      const raw = items[k] || DEFAULT_TARGET_ITEMS[k];
      result[k] = computeItemMetrics(raw, parsedTotalShifts, parsedRemainingShifts);
    });
    return result;
  }, [items, parsedTotalShifts, parsedRemainingShifts]);

  // Box Calculations
  // 1. Acquisition Box (60%)
  const acqBox = useMemo(() => {
    const low = computedItems.acq_low;
    const high = computedItems.acq_high;
    const cash = computedItems.vf_cash;

    const monthlyTarget = low.parsedTarget + high.parsedTarget + cash.parsedTarget;
    const mtdAchievement = low.parsedMtd + high.parsedMtd + cash.parsedMtd;
    const todayAch = low.parsedToday + high.parsedToday + cash.parsedToday;
    const remainingTarget = Math.max(0, monthlyTarget - mtdAchievement);
    const dailyTarget = parsedRemainingShifts > 0 ? remainingTarget / parsedRemainingShifts : 'N/A';
    const mtdPercent = monthlyTarget > 0 ? (mtdAchievement / monthlyTarget) * 100 : 0;
    const weight = activeWeights.acq;

    return {
      name: 'Acquisition Box',
      weight,
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
    };
  }, [computedItems, activeWeights.acq, parsedRemainingShifts]);

  // 2. Terminal Box (10%)
  const terminalBox = useMemo(() => {
    const ter = computedItems.terminal;
    const weight = activeWeights.terminal;
    return {
      name: 'Terminal',
      weight,
      monthlyTarget: ter.parsedTarget,
      mtdAchievement: ter.parsedMtd,
      todayAch: ter.parsedToday,
      remainingTarget: ter.remainingTarget,
      dailyTarget: ter.dailyTarget,
      mtdPercent: ter.mtdPercent,
    };
  }, [computedItems.terminal, activeWeights.terminal]);

  // 3. Enterprise Box (10%)
  const enterpriseBox = useMemo(() => {
    const acc = computedItems.ent_acc;
    const gas = computedItems.ent_gas;
    const monthlyTarget = acc.parsedTarget + gas.parsedTarget;
    const mtdAchievement = acc.parsedMtd + gas.parsedMtd;
    const todayAch = acc.parsedToday + gas.parsedToday;
    const remainingTarget = Math.max(0, monthlyTarget - mtdAchievement);
    const dailyTarget = parsedRemainingShifts > 0 ? remainingTarget / parsedRemainingShifts : 'N/A';
    const mtdPercent = monthlyTarget > 0 ? (mtdAchievement / monthlyTarget) * 100 : 0;
    const weight = activeWeights.enterprise;

    return {
      name: 'Enterprise Box',
      weight,
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
    };
  }, [computedItems, activeWeights.enterprise, parsedRemainingShifts]);

  // 4. Fixed Box (ADSL 16% + @Home 4%)
  const fixedBox = useMemo(() => {
    const adsl = computedItems.adsl;
    const home = computedItems.home;
    const monthlyTarget = adsl.parsedTarget + home.parsedTarget;
    const mtdAchievement = adsl.parsedMtd + home.parsedMtd;
    const todayAch = adsl.parsedToday + home.parsedToday;
    const remainingTarget = (adsl.remainingTarget || 0) + (home.remainingTarget || 0);
    const dailyTarget =
      (typeof adsl.dailyTarget === 'number' ? adsl.dailyTarget : 0) +
      (typeof home.dailyTarget === 'number' ? home.dailyTarget : 0);
    const mtdPercent = monthlyTarget > 0 ? (mtdAchievement / monthlyTarget) * 100 : 0;

    const adslProj = calculateRE(adsl.parsedMtd, adsl.parsedTarget, elapsedShifts, parsedTotalShifts);
    const homeProj = calculateRE(home.parsedMtd, home.parsedTarget, elapsedShifts, parsedTotalShifts);
    const adslProjVal = typeof adslProj === 'number' ? adslProj : 0;
    const homeProjVal = typeof homeProj === 'number' ? homeProj : 0;

    const wAdsl = activeWeights.adsl;
    const wHome = activeWeights.home;
    const sumFixed = wAdsl + wHome;
    const projectionPercent = sumFixed > 0 ? ((adslProjVal * wAdsl) + (homeProjVal * wHome)) / sumFixed : 0;

    return {
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
      adslProjVal,
      homeProjVal,
      projectionPercent,
    };
  }, [computedItems, activeWeights.adsl, activeWeights.home, elapsedShifts, parsedTotalShifts]);

  // OVERALL MTD %
  const overallMtdPercent = useMemo(() => {
    const list = [
      { weight: activeWeights.acq, mtdPercent: acqBox.mtdPercent, target: acqBox.monthlyTarget },
      { weight: activeWeights.terminal, mtdPercent: terminalBox.mtdPercent, target: terminalBox.monthlyTarget },
      { weight: activeWeights.enterprise, mtdPercent: enterpriseBox.mtdPercent, target: enterpriseBox.monthlyTarget },
      { weight: activeWeights.adsl, mtdPercent: computedItems.adsl.mtdPercent, target: computedItems.adsl.parsedTarget },
      { weight: activeWeights.home, mtdPercent: computedItems.home.mtdPercent, target: computedItems.home.parsedTarget },
    ];
    const active = list.filter((b) => b.target > 0);
    if (active.length === 0) return 0;
    const totalW = active.reduce((s, b) => s + b.weight, 0);
    if (totalW <= 0) return 0;
    return active.reduce((s, b) => s + (b.mtdPercent * b.weight), 0) / totalW;
  }, [acqBox, terminalBox, enterpriseBox, computedItems, activeWeights]);

  // OVERALL PROJECTION %
  const overallProjectionPercent = useMemo(() => {
    const list = [
      { weight: activeWeights.acq, mtd: acqBox.mtdAchievement, target: acqBox.monthlyTarget },
      { weight: activeWeights.terminal, mtd: terminalBox.mtdAchievement, target: terminalBox.monthlyTarget },
      { weight: activeWeights.enterprise, mtd: enterpriseBox.mtdAchievement, target: enterpriseBox.monthlyTarget },
      { weight: activeWeights.adsl, mtd: computedItems.adsl.parsedMtd, target: computedItems.adsl.parsedTarget },
      { weight: activeWeights.home, mtd: computedItems.home.parsedMtd, target: computedItems.home.parsedTarget },
    ];
    const active = list.filter((b) => b.target > 0);
    if (active.length === 0) return 0;
    const totalW = active.reduce((s, b) => s + b.weight, 0);
    if (totalW <= 0) return 0;
    return (
      active.reduce((s, b) => {
        const proj = calculateRE(b.mtd, b.target, elapsedShifts, parsedTotalShifts);
        const pVal = typeof proj === 'number' ? proj : 0;
        return s + (pVal * b.weight);
      }, 0) / totalW
    );
  }, [acqBox, terminalBox, enterpriseBox, computedItems, activeWeights, elapsedShifts, parsedTotalShifts]);

  // Handlers
  const handleItemFieldChange = (itemKey: string, field: 'monthlyTarget' | 'mtdAchievement' | 'todayAch', value: string) => {
    setItems((prev) => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        [field]: value,
      },
    }));
  };

  const handleBoxWeightChange = (boxKey: keyof BoxWeights, rawValue: string) => {
    const normalized = rawValue
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[^0-9.]/g, '');
    setBoxWeights((prev) => ({
      ...prev,
      [boxKey]: normalized,
    }));
  };

  const handleAddTodayToMtd = () => {
    const nextLastSaved: Record<string, number> = { ...lastSavedToday };
    const updated: Record<string, ItemData> = {};
    let hasNetChange = false;

    Object.keys(items).forEach((k) => {
      const cur = items[k];
      const curMtd = parseFloat(cur.mtdAchievement) || 0;
      const curToday = parseFloat(cur.todayAch) || 0;
      const prevSaved = lastSavedToday[k] || 0;
      const delta = curToday - prevSaved;
      if (delta !== 0) hasNetChange = true;
      updated[k] = {
        ...cur,
        mtdAchievement: String(Math.max(0, Math.round(curMtd + delta))),
        todayAch: cur.todayAch,
      };
      nextLastSaved[k] = curToday;
    });

    setItems(updated);
    setLastSavedToday(nextLastSaved);

    if (!isTodaySaved && parsedRemainingShifts > 1) {
      setRemainingShifts(String(parsedRemainingShifts - 1));
    }
    setIsTodaySaved(true);

    setSaveToast(language === 'ar' ? 'تم ترحيل مبيعات اليوم إلى الـ MTD بنجاح' : 'Today sales added to MTD successfully');
    setTimeout(() => setSaveToast(null), 3000);
    setShowWhatsAppModal(true);
  };

  const handleResetTodayOnly = () => {
    const updated: Record<string, ItemData> = {};
    Object.keys(items).forEach((k) => {
      updated[k] = { ...items[k], todayAch: '0' };
    });
    setItems(updated);
    setRedSalesToday('0');
    setLastSavedToday({});
    setIsTodaySaved(false);
    setShowResetModal(false);
    setSaveToast(language === 'ar' ? 'تم تصفير مبيعات اليوم لبدء شفت جديد' : 'Today values reset for new shift');
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Reusable Goal Visualizer
  const GoalVisualizer = ({
    label,
    todayAch,
    dailyTarget,
    color = 'teal',
  }: {
    label: string;
    todayAch: number;
    dailyTarget: number | 'N/A' | string | undefined | null;
    color?: string;
  }) => {
    const targetNum = typeof dailyTarget === 'number' ? dailyTarget : parseFloat(String(dailyTarget)) || 0;
    const progress = targetNum > 0 ? (todayAch / targetNum) * 100 : todayAch > 0 ? 100 : 0;
    const isMet = targetNum > 0 && todayAch >= targetNum;

    return (
      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{label}:</span>
          <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">
            {formatNumber(todayAch)} / {formatNumber(dailyTarget)}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
            isMet ? 'bg-emerald-500/20 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
          }`}>
            {formatPercent(progress)}
          </span>
        </div>
        <div className="w-32 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isMet ? 'bg-emerald-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 select-text">
      {/* Toast */}
      {saveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{currentBranch?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {language === 'ar' ? 'حاسبة التارجت ومعدلات التشغيل اليومية' : 'Target Calculator & Sales Intelligence'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'ar'
              ? 'المحرك الحسابي المعتمد للأداء البيعي والتوقعات الشهرية'
              : 'Authoritative retail sales target engine with daily run rates and shift projections'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer transition-all active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Send WhatsApp</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {viewMode === 'cards' ? <TableIcon className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            <span>{viewMode === 'cards' ? 'Table View' : 'Cards View'}</span>
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Shifts & Add to MTD Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Shifts</span>
          <input
            type="number"
            min="1"
            value={totalShifts}
            onChange={(e) => setTotalShifts(e.target.value)}
            className="w-16 text-center font-mono font-bold text-sm outline-none bg-slate-50 dark:bg-slate-800 rounded-lg py-1 border border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-teal-600 uppercase">Remaining Shifts</span>
          <input
            type="number"
            min="0"
            value={remainingShifts}
            onChange={(e) => setRemainingShifts(e.target.value)}
            className="w-16 text-center font-mono font-bold text-sm text-teal-600 outline-none bg-slate-50 dark:bg-slate-800 rounded-lg py-1 border border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddTodayToMtd}
            className="flex-1 py-3 px-3 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-900/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'ترحيل اليومية إلى MTD' : 'Add Today to MTD'}</span>
          </button>

          {isTodaySaved && (
            <button
              onClick={handleResetTodayOnly}
              className="p-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Reset Today Only"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editable Box Weights Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'ar' ? 'أوزان الصناديق البيعية' : 'Configurable Box Weights'}
            </h2>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              isWeightValid ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600 font-bold animate-pulse'
            }`}
          >
            Total: {Math.round(totalBoxWeight)}% {isWeightValid ? '✓ Valid' : '⚠ Must Equal 100%'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold mb-1">Acq (60%)</span>
            <input
              type="text"
              value={boxWeights.acq}
              onChange={(e) => handleBoxWeightChange('acq', e.target.value)}
              className="w-12 text-center font-mono font-bold bg-transparent outline-none border-b border-teal-500"
            />
            <span className="text-[10px] ml-0.5">%</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold mb-1">Terminal (10%)</span>
            <input
              type="text"
              value={boxWeights.terminal}
              onChange={(e) => handleBoxWeightChange('terminal', e.target.value)}
              className="w-12 text-center font-mono font-bold bg-transparent outline-none border-b border-sky-500"
            />
            <span className="text-[10px] ml-0.5">%</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold mb-1">Enterprise (10%)</span>
            <input
              type="text"
              value={boxWeights.enterprise}
              onChange={(e) => handleBoxWeightChange('enterprise', e.target.value)}
              className="w-12 text-center font-mono font-bold bg-transparent outline-none border-b border-blue-500"
            />
            <span className="text-[10px] ml-0.5">%</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold mb-1">ADSL (16%)</span>
            <input
              type="text"
              value={boxWeights.adsl}
              onChange={(e) => handleBoxWeightChange('adsl', e.target.value)}
              className="w-12 text-center font-mono font-bold bg-transparent outline-none border-b border-indigo-500"
            />
            <span className="text-[10px] ml-0.5">%</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold mb-1">@Home (4%)</span>
            <input
              type="text"
              value={boxWeights.home}
              onChange={(e) => handleBoxWeightChange('home', e.target.value)}
              className="w-12 text-center font-mono font-bold bg-transparent outline-none border-b border-purple-500"
            />
            <span className="text-[10px] ml-0.5">%</span>
          </div>
        </div>
      </div>

      {/* Overall Score Cards */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 text-white shadow-md">
          <span className="text-xs font-extrabold uppercase tracking-wider text-teal-200">
            OVERALL MTD ACHIEVEMENT
          </span>
          <div className="text-3xl font-black font-mono my-1">
            {formatPercent(overallMtdPercent)}
          </div>
          <span className="text-[11px] text-teal-200/80">Weighted by verified category targets</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-black text-white border border-emerald-500/30 shadow-md">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            OVERALL PROJECTION RATE (RE %)
          </span>
          <div className="text-3xl font-black font-mono my-1 text-emerald-400">
            {formatPercent(overallProjectionPercent)}
          </div>
          <span className="text-[11px] text-slate-400">End-of-month shift realization forecast</span>
        </div>
      </div>

      {/* Cards View of the 4 Category Boxes */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {/* Box 1: Acquisition Box (60%) */}
          <div className="rounded-2xl border-2 border-teal-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-teal-600 text-white flex items-center justify-between font-bold text-xs sm:text-sm">
              <span>Acquisition Box ({boxWeights.acq}%)</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span>Target: {formatNumber(acqBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(acqBox.mtdAchievement)}</span>
                <span className="px-2 py-0.5 rounded bg-black/40 text-teal-200 font-bold">
                  MTD: {formatPercent(acqBox.mtdPercent)}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-black">
                  RE: {formatPercent(calculateRE(acqBox.mtdAchievement, acqBox.monthlyTarget, elapsedShifts, parsedTotalShifts))}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Acquisition Shift Goal"
              todayAch={acqBox.todayAch}
              dailyTarget={acqBox.dailyTarget}
            />

            {/* Sub-items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'acq_low', name: 'Low Acq' },
                { key: 'acq_high', name: 'High Acq' },
                { key: 'vf_cash', name: 'Cash New' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-2 p-3 items-center text-xs text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200">
                      {name}
                      <span className="ml-1 text-[10px] font-mono text-teal-600">({formatPercent(itm.mtdPercent)})</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Target</span>
                      <input
                        type="number"
                        value={itm.monthlyTarget}
                        onChange={(e) => handleItemFieldChange(key, 'monthlyTarget', e.target.value)}
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">MTD</span>
                      <input
                        type="number"
                        value={itm.mtdAchievement}
                        onChange={(e) => handleItemFieldChange(key, 'mtdAchievement', e.target.value)}
                        className="w-full text-center font-mono font-bold text-teal-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Daily Goal</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[9px] text-slate-400 uppercase">Today Ach</span>
                      <input
                        type="number"
                        value={itm.todayAch}
                        onChange={(e) => handleItemFieldChange(key, 'todayAch', e.target.value)}
                        className="w-full text-center font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded py-0.5 border border-blue-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Box 2: Terminal Box (10%) */}
          <div className="rounded-2xl border-2 border-sky-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-sky-600 text-white flex items-center justify-between font-bold text-xs sm:text-sm">
              <span>Terminal Box ({boxWeights.terminal}%)</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span>Target: {formatNumber(terminalBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(terminalBox.mtdAchievement)}</span>
                <span className="px-2 py-0.5 rounded bg-black/40 text-sky-200 font-bold">
                  MTD: {formatPercent(terminalBox.mtdPercent)}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-black">
                  RE: {formatPercent(calculateRE(terminalBox.mtdAchievement, terminalBox.monthlyTarget, elapsedShifts, parsedTotalShifts))}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Terminal Shift Goal"
              todayAch={terminalBox.todayAch}
              dailyTarget={terminalBox.dailyTarget}
            />

            <div className="grid grid-cols-12 gap-2 p-3 items-center text-xs text-center">
              <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200">
                Terminal
                <span className="ml-1 text-[10px] font-mono text-sky-600">({formatPercent(terminalBox.mtdPercent)})</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[9px] text-slate-400 uppercase">Target</span>
                <input
                  type="number"
                  value={items.terminal.monthlyTarget}
                  onChange={(e) => handleItemFieldChange('terminal', 'monthlyTarget', e.target.value)}
                  className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                />
              </div>
              <div className="col-span-2">
                <span className="block text-[9px] text-slate-400 uppercase">MTD</span>
                <input
                  type="number"
                  value={items.terminal.mtdAchievement}
                  onChange={(e) => handleItemFieldChange('terminal', 'mtdAchievement', e.target.value)}
                  className="w-full text-center font-mono font-bold text-sky-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                />
              </div>
              <div className="col-span-2">
                <span className="block text-[9px] text-slate-400 uppercase">Daily Goal</span>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                  {formatNumber(terminalBox.dailyTarget)}
                </div>
              </div>
              <div className="col-span-3">
                <span className="block text-[9px] text-slate-400 uppercase">Today Ach</span>
                <input
                  type="number"
                  value={items.terminal.todayAch}
                  onChange={(e) => handleItemFieldChange('terminal', 'todayAch', e.target.value)}
                  className="w-full text-center font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded py-0.5 border border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Box 3: Enterprise Box (10%) */}
          <div className="rounded-2xl border-2 border-blue-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-blue-600 text-white flex items-center justify-between font-bold text-xs sm:text-sm">
              <span>Enterprise Box ({boxWeights.enterprise}%)</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span>Target: {formatNumber(enterpriseBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(enterpriseBox.mtdAchievement)}</span>
                <span className="px-2 py-0.5 rounded bg-black/40 text-blue-200 font-bold">
                  MTD: {formatPercent(enterpriseBox.mtdPercent)}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-black">
                  RE: {formatPercent(calculateRE(enterpriseBox.mtdAchievement, enterpriseBox.monthlyTarget, elapsedShifts, parsedTotalShifts))}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Enterprise Shift Goal"
              todayAch={enterpriseBox.todayAch}
              dailyTarget={enterpriseBox.dailyTarget}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'ent_acc', name: 'Enterprise Accounts' },
                { key: 'ent_gas', name: 'Enterprise GAs' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-2 p-3 items-center text-xs text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200">
                      {name}
                      <span className="ml-1 text-[10px] font-mono text-blue-600">({formatPercent(itm.mtdPercent)})</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Target</span>
                      <input
                        type="number"
                        value={itm.monthlyTarget}
                        onChange={(e) => handleItemFieldChange(key, 'monthlyTarget', e.target.value)}
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">MTD</span>
                      <input
                        type="number"
                        value={itm.mtdAchievement}
                        onChange={(e) => handleItemFieldChange(key, 'mtdAchievement', e.target.value)}
                        className="w-full text-center font-mono font-bold text-blue-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Daily Goal</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[9px] text-slate-400 uppercase">Today Ach</span>
                      <input
                        type="number"
                        value={itm.todayAch}
                        onChange={(e) => handleItemFieldChange(key, 'todayAch', e.target.value)}
                        className="w-full text-center font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded py-0.5 border border-blue-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Box 4: Fixed Box (ADSL 16% + @Home 4%) */}
          <div className="rounded-2xl border-2 border-indigo-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-indigo-600 text-white flex items-center justify-between font-bold text-xs sm:text-sm">
              <span>Fixed Box (ADSL {boxWeights.adsl}% + @Home {boxWeights.home}%)</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span>Target: {formatNumber(fixedBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(fixedBox.mtdAchievement)}</span>
                <span className="px-2 py-0.5 rounded bg-black/40 text-indigo-200 font-bold">
                  MTD: {formatPercent(fixedBox.mtdPercent)}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-black">
                  RE: {formatPercent(fixedBox.projectionPercent)}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Fixed Shift Goal"
              todayAch={fixedBox.todayAch}
              dailyTarget={fixedBox.dailyTarget}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'adsl', name: 'ADSL' },
                { key: 'home', name: '@Home' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-2 p-3 items-center text-xs text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200">
                      {name}
                      <span className="ml-1 text-[10px] font-mono text-indigo-600">({formatPercent(itm.mtdPercent)})</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Target</span>
                      <input
                        type="number"
                        value={itm.monthlyTarget}
                        onChange={(e) => handleItemFieldChange(key, 'monthlyTarget', e.target.value)}
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">MTD</span>
                      <input
                        type="number"
                        value={itm.mtdAchievement}
                        onChange={(e) => handleItemFieldChange(key, 'mtdAchievement', e.target.value)}
                        className="w-full text-center font-mono font-bold text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 uppercase">Daily Goal</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[9px] text-slate-400 uppercase">Today Ach</span>
                      <input
                        type="number"
                        value={itm.todayAch}
                        onChange={(e) => handleItemFieldChange(key, 'todayAch', e.target.value)}
                        className="w-full text-center font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded py-0.5 border border-blue-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Compact Table View */
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-xs">
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="bg-teal-700 text-white font-bold text-[11px]">
                <th className="py-2.5 px-3 text-start">Category / Box</th>
                <th className="py-2.5 px-2">Target</th>
                <th className="py-2.5 px-2">MTD</th>
                <th className="py-2.5 px-2">Remaining</th>
                <th className="py-2.5 px-2">Daily Target</th>
                <th className="py-2.5 px-2">Today Ach</th>
                <th className="py-2.5 px-2">MTD %</th>
                <th className="py-2.5 px-2">Projection %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {Object.entries(DEFAULT_TARGET_ITEMS).map(([key, meta]) => {
                const itm = computedItems[key];
                return (
                  <tr key={key} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-sans font-bold text-start text-slate-800 dark:text-slate-200">
                      {meta.name}
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        value={itm.monthlyTarget}
                        onChange={(e) => handleItemFieldChange(key, 'monthlyTarget', e.target.value)}
                        className="w-16 text-center font-mono font-bold bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        value={itm.mtdAchievement}
                        onChange={(e) => handleItemFieldChange(key, 'mtdAchievement', e.target.value)}
                        className="w-16 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-bold text-amber-600">
                      {formatNumber(itm.remainingTarget)}
                    </td>
                    <td className="py-2.5 px-2 text-teal-600 font-bold">
                      {formatNumber(itm.dailyTarget)}
                    </td>
                    <td className="py-1 px-1 bg-blue-50/40 dark:bg-blue-950/20">
                      <input
                        type="number"
                        value={itm.todayAch}
                        onChange={(e) => handleItemFieldChange(key, 'todayAch', e.target.value)}
                        className="w-16 text-center font-mono font-bold text-blue-600 bg-transparent outline-none border-b border-blue-400"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-bold">
                      {formatPercent(itm.mtdPercent)}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-emerald-600">
                      {formatPercent(calculateRE(itm.parsedMtd, itm.parsedTarget, elapsedShifts, parsedTotalShifts))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 7-Day Trend Chart (Recharts) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              7-Day Daily Achievement Trend
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setChartMode('total')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                chartMode === 'total' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Daily Total
            </button>
            <button
              onClick={() => setChartMode('breakdown')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                chartMode === 'breakdown' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Category Breakdown
            </button>
          </div>
        </div>

        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'total' ? (
              <AreaChart data={dailyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="total" name="Total Achieved" stroke="#0d9488" fill="url(#totalGrad)" strokeWidth={2.5} />
              </AreaChart>
            ) : (
              <AreaChart data={dailyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="acq" name="Acq" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} strokeWidth={2} />
                <Area type="monotone" dataKey="terminal" name="Terminal" stroke="#0284c7" fill="#0284c7" fillOpacity={0.2} strokeWidth={2} />
                <Area type="monotone" dataKey="enterprise" name="Enterprise" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} />
                <Area type="monotone" dataKey="fixed" name="Fixed" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* WhatsApp Modal with Preview & Send */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold">WhatsApp Daily Performance Report</h3>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Red Sales configuration inside modal */}
            <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Red Sales (Today)</label>
                <input
                  type="number"
                  value={redSalesToday}
                  onChange={(e) => setRedSalesToday(e.target.value)}
                  className="w-full p-1.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Red Sales (Target)</label>
                <input
                  type="number"
                  value={redSalesTarget}
                  onChange={(e) => setRedSalesTarget(e.target.value)}
                  className="w-full p-1.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Message Preview */}
            <div className="flex-1 overflow-y-auto my-2 border rounded-xl p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all bg-slate-950 text-emerald-300 border-slate-800">
              {generateWhatsAppMessage({
                storeName,
                dateStr: new Date().toLocaleDateString('en-GB'),
                computedItems,
                acqBox,
                terminalBox,
                enterpriseBox,
                fixedBox,
                redSalesToday,
                redSalesTarget,
                overallProjectionPercent,
                tnpsPercent: 62,
                elapsedShifts,
                totalShifts: parsedTotalShifts,
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                onClick={() => {
                  const msg = generateWhatsAppMessage({
                    storeName,
                    dateStr: new Date().toLocaleDateString('en-GB'),
                    computedItems,
                    acqBox,
                    terminalBox,
                    enterpriseBox,
                    fixedBox,
                    redSalesToday,
                    redSalesTarget,
                    overallProjectionPercent,
                    tnpsPercent: 62,
                    elapsedShifts,
                    totalShifts: parsedTotalShifts,
                  });
                  navigator.clipboard.writeText(msg);
                  setCopiedWhatsApp(true);
                  setTimeout(() => setCopiedWhatsApp(false), 2000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWhatsApp ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  generateWhatsAppMessage({
                    storeName,
                    dateStr: new Date().toLocaleDateString('en-GB'),
                    computedItems,
                    acqBox,
                    terminalBox,
                    enterpriseBox,
                    fixedBox,
                    redSalesToday,
                    redSalesTarget,
                    overallProjectionPercent,
                    tnpsPercent: 62,
                    elapsedShifts,
                    totalShifts: parsedTotalShifts,
                  })
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-bold">Reset Options</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4 text-xs">
              <button
                onClick={handleResetTodayOnly}
                className="w-full p-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 font-semibold text-start flex items-center justify-between"
              >
                <span>Clear Today Sales Only (Start New Shift)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setItems(DEFAULT_TARGET_ITEMS);
                  setBoxWeights(DEFAULT_BOX_WEIGHTS);
                  setShowResetModal(false);
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-start flex items-center justify-between"
              >
                <span>Reset to Standard Store Demo (0 Targets)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setItems(SAMPLE_TEST_ITEMS);
                  setBoxWeights(DEFAULT_BOX_WEIGHTS);
                  setShowResetModal(false);
                }}
                className="w-full p-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200 font-semibold text-start flex items-center justify-between"
              >
                <span>Load Store Test Sample (Realistic Values)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
