import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, buildQueryParams } from '../../services/apiClient';
import {
  ItemData,
  BoxWeights,
  DailyTrendPoint,
  DEFAULT_BOX_WEIGHTS,
  DEFAULT_TARGET_ITEMS,
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
  Copy,
  Check,
  X,
  ChevronRight,
  MessageSquare,
  Send,
  Plus,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  BarChart3,
  Calendar,
  Save,
  Lock,
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
    canEdit,
    currentBranch,
    dashboardData,
    updateBranchProfile,
    refreshWorkspaceData,
  } = useApp();
  const darkMode = theme === 'dark';
  const branchCode = currentBranch?.code || '';

  const [businessDate, setBusinessDate] = useState<string>(
    currentBranch?.businessDate || new Date().toISOString().slice(0, 10)
  );
  const [totalShifts, setTotalShifts] = useState<string>('30');
  const [remainingShifts, setRemainingShifts] = useState<string>('10');
  const [boxWeights, setBoxWeights] = useState<BoxWeights>({ ...DEFAULT_BOX_WEIGHTS });
  const [items, setItems] = useState<Record<string, ItemData>>({ ...DEFAULT_TARGET_ITEMS });
  const [redSalesToday, setRedSalesToday] = useState<string>('0');
  const [redSalesTarget, setRedSalesTarget] = useState<string>('0');
  const [dailyHistory, setDailyHistory] = useState<DailyTrendPoint[]>([]);
  const [lastSavedToday, setLastSavedToday] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [chartMode, setChartMode] = useState<'total' | 'breakdown'>('total');

  const storeName = currentBranch
    ? language === 'ar'
      ? currentBranch.nameAr || currentBranch.name
      : currentBranch.name
    : '';

  const loadStateFromServer = useCallback(async () => {
    if (!branchCode) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ state: any | null }>(
        `/api/v1/target-calculator${buildQueryParams({ branchCode })}`
      );
      const st = res.state;
      setBusinessDate(currentBranch?.businessDate || new Date().toISOString().slice(0, 10));
      if (st) {
        setBoxWeights({ ...DEFAULT_BOX_WEIGHTS, ...(st.weightsJson || {}) });
        setItems({ ...DEFAULT_TARGET_ITEMS, ...(st.itemsJson || {}) });
        setRedSalesToday(String(st.redSalesToday ?? '0'));
        setRedSalesTarget(String(st.redSalesTarget ?? '0'));
        setDailyHistory(Array.isArray(st.dailyTrendJson) ? st.dailyTrendJson : []);
        setTotalShifts(String(st.totalShifts ?? currentBranch?.totalShifts ?? 30));
        setRemainingShifts(String(st.remainingShifts ?? currentBranch?.remainingShifts ?? 10));
      } else {
        setBoxWeights({ ...DEFAULT_BOX_WEIGHTS });
        setItems({ ...DEFAULT_TARGET_ITEMS });
        setRedSalesToday('0');
        setRedSalesTarget('0');
        setDailyHistory([]);
        const todayStr = currentBranch?.businessDate || new Date().toISOString().slice(0, 10);
        const parts = todayStr.split('-').map(Number);
        const total = parts.length === 3 ? new Date(parts[0], parts[1], 0).getDate() : 30;
        const rem = parts.length === 3 ? Math.max(0, total - parts[2]) : 10;
        setTotalShifts(String(currentBranch?.totalShifts || total));
        setRemainingShifts(String(currentBranch?.remainingShifts ?? rem));
      }
      setLastSavedToday({});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Target Calculator state.');
    } finally {
      setLoading(false);
    }
  }, [branchCode, currentBranch?.businessDate, currentBranch?.totalShifts, currentBranch?.remainingShifts]);

  useEffect(() => {
    loadStateFromServer();
  }, [loadStateFromServer]);

  const handleDateChange = (newDate: string) => {
    if (!canEdit) return;
    setBusinessDate(newDate);
    try {
      const parts = newDate.split('-').map(Number);
      if (parts.length === 3 && parts[0] > 2000) {
        const total = new Date(parts[0], parts[1], 0).getDate();
        const rem = Math.max(0, total - parts[2]);
        setTotalShifts(String(total));
        setRemainingShifts(String(rem));
      }
    } catch {
      // ignore invalid partial date input
    }
  };

  const parsedTotalShifts = Math.min(31, Math.max(1, parseInt(totalShifts, 10) || 1));
  const parsedRemainingShifts = Math.min(31, Math.max(0, parseInt(remainingShifts, 10) || 0));
  const elapsedShifts = Math.max(0, parsedTotalShifts - parsedRemainingShifts);

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

  const computedItems = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeItemMetrics>> = {};
    Object.keys(DEFAULT_TARGET_ITEMS).forEach((k) => {
      const raw = items[k] || DEFAULT_TARGET_ITEMS[k];
      result[k] = computeItemMetrics(raw, parsedTotalShifts, parsedRemainingShifts);
    });
    return result;
  }, [items, parsedTotalShifts, parsedRemainingShifts]);

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
    return {
      name: 'Acquisition Box',
      weight: activeWeights.acq,
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
    };
  }, [computedItems, activeWeights.acq, parsedRemainingShifts]);

  const terminalBox = useMemo(() => {
    const ter = computedItems.terminal;
    return {
      name: 'Terminal',
      weight: activeWeights.terminal,
      monthlyTarget: ter.parsedTarget,
      mtdAchievement: ter.parsedMtd,
      todayAch: ter.parsedToday,
      remainingTarget: ter.remainingTarget,
      dailyTarget: ter.dailyTarget,
      mtdPercent: ter.mtdPercent,
    };
  }, [computedItems.terminal, activeWeights.terminal]);

  const enterpriseBox = useMemo(() => {
    const acc = computedItems.ent_acc;
    const gas = computedItems.ent_gas;
    const monthlyTarget = acc.parsedTarget + gas.parsedTarget;
    const mtdAchievement = acc.parsedMtd + gas.parsedMtd;
    const todayAch = acc.parsedToday + gas.parsedToday;
    const remainingTarget = Math.max(0, monthlyTarget - mtdAchievement);
    const dailyTarget = parsedRemainingShifts > 0 ? remainingTarget / parsedRemainingShifts : 'N/A';
    const mtdPercent = monthlyTarget > 0 ? (mtdAchievement / monthlyTarget) * 100 : 0;
    return {
      name: 'Enterprise Box',
      weight: activeWeights.enterprise,
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
    };
  }, [computedItems, activeWeights.enterprise, parsedRemainingShifts]);

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

    const sumFixed = activeWeights.adsl + activeWeights.home;
    const projectionPercent =
      sumFixed > 0
        ? (adslProjVal * activeWeights.adsl + homeProjVal * activeWeights.home) / sumFixed
        : 0;

    return {
      monthlyTarget,
      mtdAchievement,
      todayAch,
      remainingTarget,
      dailyTarget,
      mtdPercent,
      projectionPercent,
    };
  }, [computedItems, activeWeights.adsl, activeWeights.home, elapsedShifts, parsedTotalShifts]);

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
    return active.reduce((s, b) => s + b.mtdPercent * b.weight, 0) / totalW;
  }, [acqBox, terminalBox, enterpriseBox, computedItems, activeWeights]);

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
        return s + pVal * b.weight;
      }, 0) / totalW
    );
  }, [acqBox, terminalBox, enterpriseBox, computedItems, activeWeights, elapsedShifts, parsedTotalShifts]);

  const persistState = async (
    nextItems: Record<string, ItemData>,
    nextWeights: BoxWeights,
    nextTrend: DailyTrendPoint[],
    nextRedToday = redSalesToday,
    nextRedTarget = redSalesTarget
  ) => {
    if (!canEdit) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest('/api/v1/target-calculator', {
        method: 'PUT',
        body: {
          items: nextItems,
          weights: nextWeights,
          redSalesToday: nextRedToday,
          redSalesTarget: nextRedTarget,
          dailyTrend: nextTrend.slice(-31),
          totalShifts: parsedTotalShifts,
          remainingShifts: parsedRemainingShifts,
        },
      });
      if (/^\d{4}-\d{2}-\d{2}$/.test(businessDate) && businessDate !== currentBranch?.businessDate) {
        await updateBranchProfile({ businessDate });
      } else {
        await refreshWorkspaceData();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save calculator state.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleItemFieldChange = (
    itemKey: string,
    field: 'monthlyTarget' | 'mtdAchievement' | 'todayAch',
    value: string
  ) => {
    if (!canEdit) return;
    setItems((prev) => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        [field]: value,
      },
    }));
  };

  const handleBoxWeightChange = (boxKey: keyof BoxWeights, rawValue: string) => {
    if (!canEdit) return;
    const normalized = rawValue
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[^0-9.]/g, '');
    setBoxWeights((prev) => ({ ...prev, [boxKey]: normalized }));
  };

  const handleSaveSnapshotOnly = async () => {
    if (!canEdit) return;
    try {
      await persistState(items, boxWeights, dailyHistory);
      setSaveToast(language === 'ar' ? 'تم حفظ الحاسبة في قاعدة البيانات' : 'Calculator state saved to database');
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      // handled in persistState
    }
  };

  const handleAddTodayToMtd = async () => {
    if (!canEdit) return;
    const nextLastSaved: Record<string, number> = { ...lastSavedToday };
    const updated: Record<string, ItemData> = {};

    Object.keys(items).forEach((k) => {
      const cur = items[k];
      const curMtd = parseFloat(cur.mtdAchievement) || 0;
      const curToday = parseFloat(cur.todayAch) || 0;
      const prevSaved = lastSavedToday[k] || 0;
      const delta = curToday - prevSaved;
      updated[k] = {
        ...cur,
        mtdAchievement: String(Math.max(0, Math.round(curMtd + delta))),
        todayAch: cur.todayAch,
      };
      nextLastSaved[k] = curToday;
    });

    const dateLabel = businessDate.slice(5);
    const nextPoint: DailyTrendPoint = {
      id: businessDate,
      date: dateLabel,
      dayLabel: businessDate,
      acq: acqBox.todayAch,
      terminal: terminalBox.todayAch,
      enterprise: enterpriseBox.todayAch,
      fixed: fixedBox.todayAch,
      total: acqBox.todayAch + terminalBox.todayAch + enterpriseBox.todayAch + fixedBox.todayAch,
    };
    const nextTrend = [
      ...dailyHistory.filter((d) => d.id !== businessDate),
      nextPoint,
    ].slice(-14);

    setItems(updated);
    setLastSavedToday(nextLastSaved);
    setDailyHistory(nextTrend);

    try {
      await persistState(updated, boxWeights, nextTrend);
      setSaveToast(
        language === 'ar'
          ? 'تم ترحيل مبيعات اليوم إلى MTD وحفظها'
          : 'Today sales accumulated onto MTD & saved'
      );
      setTimeout(() => setSaveToast(null), 3000);
      setShowWhatsAppModal(true);
    } catch {
      // error already shown
    }
  };

  const handleResetTodayOnly = async () => {
    if (!canEdit) return;
    const updated: Record<string, ItemData> = {};
    Object.keys(items).forEach((k) => {
      updated[k] = { ...items[k], todayAch: '0' };
    });
    setItems(updated);
    setRedSalesToday('0');
    setLastSavedToday({});
    setShowResetModal(false);
    try {
      await persistState(updated, boxWeights, dailyHistory, '0', redSalesTarget);
      setSaveToast(language === 'ar' ? 'تم تصفير خانات اليوم' : 'Today fields reset to 0');
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      // error shown
    }
  };

  const handleResetAllZero = async () => {
    if (!canEdit) return;
    setItems({ ...DEFAULT_TARGET_ITEMS });
    setBoxWeights({ ...DEFAULT_BOX_WEIGHTS });
    setRedSalesToday('0');
    setRedSalesTarget('0');
    setDailyHistory([]);
    setShowResetModal(false);
    try {
      await persistState({ ...DEFAULT_TARGET_ITEMS }, { ...DEFAULT_BOX_WEIGHTS }, [], '0', '0');
    } catch {
      // error shown
    }
  };

  const liveTnpsPercent = dashboardData?.tnps.latestScore ?? null;

  const whatsAppText = generateWhatsAppMessage({
    storeName,
    dateStr: businessDate,
    computedItems,
    acqBox,
    terminalBox,
    enterpriseBox,
    fixedBox,
    redSalesToday,
    redSalesTarget,
    overallProjectionPercent,
    tnpsPercent: liveTnpsPercent,
    elapsedShifts,
    totalShifts: parsedTotalShifts,
  });

  const GoalVisualizer = ({
    label,
    todayAch,
    dailyTarget,
  }: {
    label: string;
    todayAch: number;
    dailyTarget: number | 'N/A' | string | undefined | null;
  }) => {
    const targetNum =
      typeof dailyTarget === 'number' ? dailyTarget : parseFloat(String(dailyTarget)) || 0;
    const progress = targetNum > 0 ? (todayAch / targetNum) * 100 : todayAch > 0 ? 100 : 0;
    const isMet = targetNum > 0 && todayAch >= targetNum;

    return (
      <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
            {label}:
          </span>
          <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">
            {formatNumber(todayAch)} / {formatNumber(dailyTarget)}
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
              isMet
                ? 'bg-emerald-500/20 text-emerald-600'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {formatPercent(progress)}
          </span>
        </div>
        <div className="w-24 sm:w-32 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all ${
              isMet ? 'bg-emerald-500' : 'bg-teal-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    );
  };

  if (!currentBranch) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        {t('noBranchesInScope')}
      </div>
    );
  }

  return (
    <div className="space-y-4 content-container select-text">
      {saveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
              {currentBranch.code}
            </span>
            <span>·</span>
            <span className="truncate">{storeName}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {language === 'ar'
              ? 'حاسبة التارجت ومعدلات التشغيل اليومية'
              : 'Target Calculator & Sales Intelligence'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          {!canEdit && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>{t('readOnlyBadge')}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {viewMode === 'cards' ? (
              <TableIcon className="w-3.5 h-3.5" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5" />
            )}
            <span>{viewMode === 'cards' ? 'Table' : 'Cards'}</span>
          </button>

          {canEdit && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSnapshotOnly}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#092d52] hover:bg-[#0c3b6b] text-white cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('save')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Date & Shifts Bar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'تاريخ العمل:' : 'Business Date:'}
          </span>
          <input
            type="date"
            disabled={!canEdit}
            value={businessDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-2.5 py-1 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold disabled:opacity-70"
          />
        </div>

        <div className="flex items-center gap-4 font-mono-numbers">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">
              {language === 'ar' ? 'أيام الشهر:' : 'Month Days:'}
            </span>
            <input
              type="number"
              min="1"
              max="31"
              disabled={!canEdit}
              value={totalShifts}
              onChange={(e) => setTotalShifts(e.target.value)}
              className="w-14 text-center font-bold font-mono py-0.5 rounded border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-teal-600 font-sans font-bold">
              {language === 'ar' ? 'المتبقي:' : 'Remaining:'}
            </span>
            <input
              type="number"
              min="0"
              max="31"
              disabled={!canEdit}
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-14 text-center font-bold font-mono py-0.5 text-teal-600 rounded border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
            />
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleAddTodayToMtd}
            className="py-2 px-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'حفظ وترحيل اليوم إلى MTD' : 'Add Today to MTD'}</span>
          </button>
        )}
      </div>

      {/* Box Weights Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'ar' ? 'أوزان الصناديق (100%)' : 'Box Weights (Total 100%)'}
            </h2>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
              isWeightValid ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'
            }`}
          >
            {Math.round(totalBoxWeight)}% {isWeightValid ? '✓' : '!= 100%'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
          {[
            { key: 'acq' as const, label: 'Acq', color: 'border-teal-500' },
            { key: 'terminal' as const, label: 'Terminal', color: 'border-sky-500' },
            { key: 'enterprise' as const, label: 'Enterprise', color: 'border-blue-500' },
            { key: 'adsl' as const, label: 'ADSL', color: 'border-indigo-500' },
            { key: 'home' as const, label: '@Home', color: 'border-purple-500' },
          ].map((bw) => (
            <div
              key={bw.key}
              className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <span className="block text-[9px] text-slate-400 font-bold mb-0.5">{bw.label}</span>
              <input
                type="text"
                disabled={!canEdit}
                value={boxWeights[bw.key]}
                onChange={(e) => handleBoxWeightChange(bw.key, e.target.value)}
                className={`w-10 text-center font-mono font-bold text-xs bg-transparent outline-none border-b ${bw.color}`}
              />
              <span className="text-[9px]">%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Score Cards */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 sm:p-4 rounded-2xl bg-[#092d52] text-white shadow-md">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-teal-200">
            OVERALL MTD %
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono my-0.5">
            {formatPercent(overallMtdPercent)}
          </div>
          <span className="text-[10px] text-slate-300">Weighted by targets</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 text-white border border-emerald-500/30 shadow-md">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            OVERALL PROJECTION % (RE)
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono my-0.5 text-emerald-400">
            {formatPercent(overallProjectionPercent)}
          </div>
          <span className="text-[10px] text-slate-400">Month-End Forecast</span>
        </div>
      </div>

      {/* Cards or Table View */}
      {viewMode === 'cards' ? (
        <div className="space-y-3">
          {/* Box 1: Acquisition Box */}
          <div className="rounded-2xl border border-teal-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-teal-600 text-white flex items-center justify-between font-bold text-xs">
              <span className="truncate">Acquisition Box ({boxWeights.acq}%)</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                <span>Target: {formatNumber(acqBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(acqBox.mtdAchievement)}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-teal-200">
                  {formatPercent(acqBox.mtdPercent)}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">
                  RE:{' '}
                  {formatPercent(
                    calculateRE(
                      acqBox.mtdAchievement,
                      acqBox.monthlyTarget,
                      elapsedShifts,
                      parsedTotalShifts
                    )
                  )}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Acquisition Goal"
              todayAch={acqBox.todayAch}
              dailyTarget={acqBox.dailyTarget}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {[
                { key: 'acq_low', name: 'Low Acq' },
                { key: 'acq_high', name: 'High Acq' },
                { key: 'vf_cash', name: 'Cash New' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-1 p-2 items-center text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200 truncate">
                      {name}
                      <span className="text-[9px] text-teal-600 block">
                        {formatPercent(itm.mtdPercent)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Target</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.monthlyTarget}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'monthlyTarget', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">MTD</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.mtdAchievement}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'mtdAchievement', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold text-teal-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Daily</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] text-slate-400">Today</span>
                      <input
                        type="number"
                        disabled={!canEdit}
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

          {/* Box 2: Terminal Box */}
          <div className="rounded-2xl border border-sky-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-sky-600 text-white flex items-center justify-between font-bold text-xs">
              <span className="truncate">Terminal Box ({boxWeights.terminal}%)</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                <span>Target: {formatNumber(terminalBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(terminalBox.mtdAchievement)}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-sky-200">
                  {formatPercent(terminalBox.mtdPercent)}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">
                  RE:{' '}
                  {formatPercent(
                    calculateRE(
                      terminalBox.mtdAchievement,
                      terminalBox.monthlyTarget,
                      elapsedShifts,
                      parsedTotalShifts
                    )
                  )}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Terminal Goal"
              todayAch={terminalBox.todayAch}
              dailyTarget={terminalBox.dailyTarget}
            />

            <div className="grid grid-cols-12 gap-1 p-2 items-center text-center text-[11px]">
              <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200 truncate">
                Terminal
                <span className="text-[9px] text-sky-600 block">
                  {formatPercent(terminalBox.mtdPercent)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-[8px] text-slate-400">Target</span>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={items.terminal.monthlyTarget}
                  onChange={(e) =>
                    handleItemFieldChange('terminal', 'monthlyTarget', e.target.value)
                  }
                  className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                />
              </div>
              <div className="col-span-2">
                <span className="block text-[8px] text-slate-400">MTD</span>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={items.terminal.mtdAchievement}
                  onChange={(e) =>
                    handleItemFieldChange('terminal', 'mtdAchievement', e.target.value)
                  }
                  className="w-full text-center font-mono font-bold text-sky-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                />
              </div>
              <div className="col-span-2">
                <span className="block text-[8px] text-slate-400">Daily</span>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                  {formatNumber(terminalBox.dailyTarget)}
                </div>
              </div>
              <div className="col-span-3">
                <span className="block text-[8px] text-slate-400">Today</span>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={items.terminal.todayAch}
                  onChange={(e) => handleItemFieldChange('terminal', 'todayAch', e.target.value)}
                  className="w-full text-center font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded py-0.5 border border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Box 3: Enterprise Box */}
          <div className="rounded-2xl border border-blue-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-blue-600 text-white flex items-center justify-between font-bold text-xs">
              <span className="truncate">Enterprise Box ({boxWeights.enterprise}%)</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                <span>Target: {formatNumber(enterpriseBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(enterpriseBox.mtdAchievement)}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-blue-200">
                  {formatPercent(enterpriseBox.mtdPercent)}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">
                  RE:{' '}
                  {formatPercent(
                    calculateRE(
                      enterpriseBox.mtdAchievement,
                      enterpriseBox.monthlyTarget,
                      elapsedShifts,
                      parsedTotalShifts
                    )
                  )}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Enterprise Goal"
              todayAch={enterpriseBox.todayAch}
              dailyTarget={enterpriseBox.dailyTarget}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {[
                { key: 'ent_acc', name: 'Ent Acc' },
                { key: 'ent_gas', name: 'Ent GAs' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-1 p-2 items-center text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200 truncate">
                      {name}
                      <span className="text-[9px] text-blue-600 block">
                        {formatPercent(itm.mtdPercent)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Target</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.monthlyTarget}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'monthlyTarget', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">MTD</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.mtdAchievement}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'mtdAchievement', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold text-blue-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Daily</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] text-slate-400">Today</span>
                      <input
                        type="number"
                        disabled={!canEdit}
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

          {/* Box 4: Fixed Box */}
          <div className="rounded-2xl border border-indigo-500/50 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-indigo-600 text-white flex items-center justify-between font-bold text-xs">
              <span className="truncate">
                Fixed Box ({boxWeights.adsl}% + {boxWeights.home}%)
              </span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                <span>Target: {formatNumber(fixedBox.monthlyTarget)}</span>
                <span>MTD: {formatNumber(fixedBox.mtdAchievement)}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-indigo-200">
                  {formatPercent(fixedBox.mtdPercent)}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">
                  RE: {formatPercent(fixedBox.projectionPercent)}
                </span>
              </div>
            </div>

            <GoalVisualizer
              label="Fixed Goal"
              todayAch={fixedBox.todayAch}
              dailyTarget={fixedBox.dailyTarget}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {[
                { key: 'adsl', name: 'ADSL' },
                { key: 'home', name: '@Home' },
              ].map(({ key, name }) => {
                const itm = computedItems[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-1 p-2 items-center text-center">
                    <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200 truncate">
                      {name}
                      <span className="text-[9px] text-indigo-600 block">
                        {formatPercent(itm.mtdPercent)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Target</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.monthlyTarget}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'monthlyTarget', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">MTD</span>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.mtdAchievement}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'mtdAchievement', e.target.value)
                        }
                        className="w-full text-center font-mono font-bold text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded py-0.5 border dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400">Daily</span>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 py-0.5">
                        {formatNumber(itm.dailyTarget)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] text-slate-400">Today</span>
                      <input
                        type="number"
                        disabled={!canEdit}
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-xs custom-scrollbar">
          <table className="w-full text-[11px] text-center min-w-[600px]">
            <thead>
              <tr className="bg-[#092d52] text-white font-bold text-[10px]">
                <th className="py-2 px-2.5 text-start">Category</th>
                <th className="py-2 px-1">Target</th>
                <th className="py-2 px-1">MTD</th>
                <th className="py-2 px-1">Remaining</th>
                <th className="py-2 px-1">Daily Target</th>
                <th className="py-2 px-1">Today Ach</th>
                <th className="py-2 px-1">MTD %</th>
                <th className="py-2 px-1">Projection %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {Object.entries(DEFAULT_TARGET_ITEMS).map(([key, meta]) => {
                const itm = computedItems[key];
                return (
                  <tr key={key} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2.5 font-sans font-bold text-start text-slate-800 dark:text-slate-200 truncate">
                      {meta.name}
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.monthlyTarget}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'monthlyTarget', e.target.value)
                        }
                        className="w-14 text-center font-mono font-bold bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.mtdAchievement}
                        onChange={(e) =>
                          handleItemFieldChange(key, 'mtdAchievement', e.target.value)
                        }
                        className="w-14 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-2 px-1 font-bold text-amber-600">
                      {formatNumber(itm.remainingTarget)}
                    </td>
                    <td className="py-2 px-1 text-teal-600 font-bold">
                      {formatNumber(itm.dailyTarget)}
                    </td>
                    <td className="py-1 px-1 bg-blue-50/40 dark:bg-blue-950/20">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={itm.todayAch}
                        onChange={(e) => handleItemFieldChange(key, 'todayAch', e.target.value)}
                        className="w-14 text-center font-mono font-bold text-blue-600 bg-transparent outline-none border-b border-blue-400"
                      />
                    </td>
                    <td className="py-2 px-1 font-bold">{formatPercent(itm.mtdPercent)}</td>
                    <td className="py-2 px-1 font-bold text-emerald-600">
                      {formatPercent(
                        calculateRE(
                          itm.parsedMtd,
                          itm.parsedTarget,
                          elapsedShifts,
                          parsedTotalShifts
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Trend Velocity Chart */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Daily Achievement Velocity ({dailyHistory.length} saved days)
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartMode('total')}
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                chartMode === 'total'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Daily Total
            </button>
            <button
              type="button"
              onClick={() => setChartMode('breakdown')}
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                chartMode === 'breakdown'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Category Breakdown
            </button>
          </div>
        </div>

        {dailyHistory.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">{t('noRecords')}</p>
        ) : (
          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'total' ? (
                <AreaChart
                  data={dailyHistory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#0d9488"
                    fill="#0d9488"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : (
                <AreaChart
                  data={dailyHistory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 9, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="acq" name="Acq" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="terminal" name="Terminal" stroke="#0284c7" fill="#0284c7" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="enterprise" name="Enterprise" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="fixed" name="Fixed" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3">
          <div className="rounded-2xl shadow-2xl max-w-md w-full p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-bold">WhatsApp Store Daily Performance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 my-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">
                  Red Sales (Today)
                </label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={redSalesToday}
                  onChange={(e) => setRedSalesToday(e.target.value)}
                  className="w-full p-1 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">
                  Red Sales (Target)
                </label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={redSalesTarget}
                  onChange={(e) => setRedSalesTarget(e.target.value)}
                  className="w-full p-1 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto my-1 border rounded-xl p-2.5 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all bg-slate-950 text-emerald-300 border-slate-800 custom-scrollbar">
              {whatsAppText}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(whatsAppText);
                  setCopiedWhatsApp(true);
                  setTimeout(() => setCopiedWhatsApp(false), 2000);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                {copiedWhatsApp ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedWhatsApp ? 'Copied!' : 'Copy'}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {canEdit && showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="rounded-2xl shadow-xl max-w-sm w-full p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-bold">Reset Options</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-3 text-xs">
              <button
                type="button"
                onClick={handleResetTodayOnly}
                className="w-full p-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 font-semibold text-start flex items-center justify-between cursor-pointer"
              >
                <span>Clear Today Sales Only</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetAllZero}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-start flex items-center justify-between cursor-pointer"
              >
                <span>Reset All Calculator Fields to 0</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
