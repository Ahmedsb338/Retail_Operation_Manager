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
  Trash2,
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
import { FilterBar } from '../shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from '../shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type ColumnControlItem,
  type RowSortOrder,
} from '../shared/ColumnControlMenu';

const TARGET_TABLE_COLUMNS: ColumnControlItem[] = [
  { key: 'monthlyTarget', label: 'Target', labelAr: 'المستهدف' },
  { key: 'mtdAchievement', label: 'MTD', labelAr: 'المحقق شهرياً' },
  { key: 'remainingTarget', label: 'Remaining', labelAr: 'المتبقي' },
  { key: 'dailyTarget', label: 'Daily Target', labelAr: 'المطلوب يومياً' },
  { key: 'todayAch', label: 'Today Ach', labelAr: 'تحقيق اليوم' },
  { key: 'mtdPercent', label: 'MTD %', labelAr: 'نسبة التحقيق %' },
  { key: 'projectionPercent', label: 'Projection %', labelAr: 'التوقع %' },
];

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
    dateRange,
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

  // Row & Column Controls
  const [itemSearch, setItemSearch] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(TARGET_TABLE_COLUMNS.map((c) => c.key));

  // Add Record Single-Column Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    targetKey: 'acq_low',
    customName: '',
    monthlyTarget: '0',
    mtdAchievement: '0',
    todayAch: '0',
  });

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

  const allItemKeys = useMemo(
    () => Array.from(new Set([...Object.keys(DEFAULT_TARGET_ITEMS), ...Object.keys(items)])),
    [items]
  );

  const customItemKeys = useMemo(
    () => allItemKeys.filter((k) => !(k in DEFAULT_TARGET_ITEMS)),
    [allItemKeys]
  );

  const computedItems = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeItemMetrics>> = {};
    allItemKeys.forEach((k) => {
      const raw = items[k] || DEFAULT_TARGET_ITEMS[k];
      if (raw) {
        result[k] = computeItemMetrics(raw, parsedTotalShifts, parsedRemainingShifts);
      }
    });
    return result;
  }, [allItemKeys, items, parsedTotalShifts, parsedRemainingShifts]);

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(TARGET_TABLE_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const filteredTableKeys = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return allItemKeys;
    return allItemKeys.filter((k) => {
      const meta = items[k] || DEFAULT_TARGET_ITEMS[k];
      return (
        k.toLowerCase().includes(q) ||
        (meta?.name || '').toLowerCase().includes(q) ||
        (meta?.shortName || '').toLowerCase().includes(q)
      );
    });
  }, [allItemKeys, items, itemSearch]);

  const displayedTableKeys = useMemo(
    () => applyRowControls(filteredTableKeys, rowLimit, sortOrder),
    [filteredTableKeys, rowLimit, sortOrder]
  );

  const filteredDailyHistory = useMemo(() => {
    if (!dateRange.fromDate && !dateRange.toDate) return dailyHistory;
    return dailyHistory.filter((pt) =>
      matchesDateRange(pt.id || pt.dayLabel, dateRange.fromDate, dateRange.toDate)
    );
  }, [dailyHistory, dateRange.fromDate, dateRange.toDate]);

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

  const handleToggleColumn = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMoveColumn = (key: string, direction: 'up' | 'down') => {
    setColOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleResetColumns = () => {
    setHiddenCols([]);
    setColOrder(TARGET_TABLE_COLUMNS.map((c) => c.key));
  };

  const openAddRecordModal = () => {
    const firstKey = 'acq_low';
    const cur = items[firstKey] || DEFAULT_TARGET_ITEMS[firstKey];
    setAddForm({
      targetKey: firstKey,
      customName: '',
      monthlyTarget: String(cur?.monthlyTarget ?? '0'),
      mtdAchievement: String(cur?.mtdAchievement ?? '0'),
      todayAch: String(cur?.todayAch ?? '0'),
    });
    setShowAddModal(true);
  };

  const handleAddRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const isCustom = addForm.targetKey === '__custom__';
    const cleanName = addForm.customName.trim();
    if (isCustom && !cleanName) return;

    const targetId = isCustom
      ? `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || Date.now()}`
      : addForm.targetKey;

    const baseMeta = items[targetId] || DEFAULT_TARGET_ITEMS[targetId];
    const nextItems: Record<string, ItemData> = {
      ...items,
      [targetId]: {
        id: targetId,
        name: isCustom ? cleanName : baseMeta?.name || targetId,
        shortName: isCustom ? cleanName.slice(0, 14) : baseMeta?.shortName || targetId,
        monthlyTarget: addForm.monthlyTarget || '0',
        mtdAchievement: addForm.mtdAchievement || '0',
        todayAch: addForm.todayAch || '0',
      },
    };
    setItems(nextItems);
    setShowAddModal(false);
    try {
      await persistState(nextItems, boxWeights, dailyHistory);
      setSaveToast(language === 'ar' ? 'تم حفظ السجل في الحاسبة' : 'Metric record saved');
      setTimeout(() => setSaveToast(null), 2500);
    } catch {
      // handled in persistState
    }
  };

  const handleDeleteCustomItem = async (itemKey: string) => {
    if (!canEdit || itemKey in DEFAULT_TARGET_ITEMS) return;
    const nextItems = { ...items };
    delete nextItems[itemKey];
    setItems(nextItems);
    try {
      await persistState(nextItems, boxWeights, dailyHistory);
      setSaveToast(language === 'ar' ? 'تم حذف البند المخصص' : 'Custom metric removed');
      setTimeout(() => setSaveToast(null), 2000);
    } catch {
      // handled in persistState
    }
  };

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    if (!branchCode) return;
    const baseKeys = opts.rowScope === 'all' ? allItemKeys : displayedTableKeys;
    const q = opts.searchText.trim().toLowerCase();
    const filteredKeys = baseKeys.filter((k) => {
      if (!q) return true;
      const meta = items[k] || DEFAULT_TARGET_ITEMS[k];
      return (
        k.toLowerCase().includes(q) ||
        (meta?.name || '').toLowerCase().includes(q) ||
        (meta?.shortName || '').toLowerCase().includes(q)
      );
    });
    const cols = opts.colScope === 'visible' ? visibleColumns : TARGET_TABLE_COLUMNS;
    const sheetRows = filteredKeys.map((key) => {
      const meta = items[key] || DEFAULT_TARGET_ITEMS[key];
      const itm = computedItems[key];
      const re = calculateRE(itm.parsedMtd, itm.parsedTarget, elapsedShifts, parsedTotalShifts);
      const out: Record<string, unknown> = {
        Branch: branchCode,
        Date: opts.fromDate || opts.toDate ? `${opts.fromDate || '...'} -> ${opts.toDate || '...'}` : businessDate,
        Category: meta?.name || key,
      };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr || col.label : col.label;
        if (col.key === 'monthlyTarget') out[header] = itm.parsedTarget;
        else if (col.key === 'mtdAchievement') out[header] = itm.parsedMtd;
        else if (col.key === 'remainingTarget') out[header] = itm.remainingTarget;
        else if (col.key === 'dailyTarget')
          out[header] = typeof itm.dailyTarget === 'number' ? Math.round(itm.dailyTarget * 100) / 100 : 'N/A';
        else if (col.key === 'todayAch') out[header] = itm.parsedToday;
        else if (col.key === 'mtdPercent') out[header] = `${Math.round(itm.mtdPercent * 10) / 10}%`;
        else if (col.key === 'projectionPercent')
          out[header] = typeof re === 'number' ? `${Math.round(re * 10) / 10}%` : 'N/A';
      }
      return out;
    });
    await downloadXlsxSheet(
      `target_calculator_${branchCode}_${businessDate}.xlsx`,
      'Target_Calculator',
      sheetRows
    );
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
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
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

      {!canEdit && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

      {/* Single-Row Unified Toolbar */}
      <FilterBar
        search={itemSearch}
        onSearchChange={setItemSearch}
        showDateFilters
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={itemSearch}
          />
        }
        onAddNew={canEdit ? openAddRecordModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 px-2 min-h-[30px] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-900 text-[#092d52] dark:text-teal-300'
                    : 'text-slate-500'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t('cardsView')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2 min-h-[30px] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-[#092d52] dark:text-teal-300'
                    : 'text-slate-500'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{t('tableView')}</span>
              </button>
            </div>

            <ColumnControlMenu
              columns={TARGET_TABLE_COLUMNS}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={handleToggleColumn}
              onMoveColumn={handleMoveColumn}
              onResetColumns={handleResetColumns}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddRecordModal : undefined}
              totalRowsCount={filteredTableKeys.length}
            />

            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSnapshotOnly}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-bold rounded-xl bg-[#092d52] hover:bg-[#0c3b6b] text-white cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('save')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Date & Shifts Bar — Single Row */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto custom-scrollbar text-xs">
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'تاريخ العمل:' : 'Business Date:'}
          </span>
          <input
            type="date"
            disabled={!canEdit}
            value={businessDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-2.5 min-h-[36px] h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums font-bold disabled:opacity-70 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-nowrap items-center gap-3 tabular-nums shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
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
              className="w-16 text-center font-bold font-mono min-h-[36px] h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-70 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <span className="text-teal-600 dark:text-teal-400 font-sans font-bold">
              {language === 'ar' ? 'المتبقي:' : 'Remaining:'}
            </span>
            <input
              type="number"
              min="0"
              max="31"
              disabled={!canEdit}
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-16 text-center font-bold font-mono min-h-[36px] h-[36px] text-teal-600 dark:text-teal-400 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-70"
            />
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleAddTodayToMtd}
            className="min-h-[36px] h-[36px] px-3.5 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-500 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'حفظ وترحيل اليوم إلى MTD' : 'Add Today to MTD'}</span>
          </button>
        )}
      </div>

      {/* Box Weights Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {language === 'ar' ? 'أوزان الصناديق (100%)' : 'Box Weights (Total 100%)'}
            </h2>
          </div>
          <span
            className={`text-xs font-mono tabular-nums font-bold px-2 py-0.5 rounded-lg ${
              isWeightValid
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {Math.round(totalBoxWeight)}% {isWeightValid ? '✓' : '!= 100%'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
          {[
            { key: 'acq' as const, label: 'Acq', color: 'border-teal-500' },
            { key: 'terminal' as const, label: 'Terminal', color: 'border-sky-500' },
            { key: 'enterprise' as const, label: 'Enterprise', color: 'border-blue-500' },
            { key: 'adsl' as const, label: 'ADSL', color: 'border-indigo-500' },
            { key: 'home' as const, label: '@Home', color: 'border-purple-500' },
          ].map((bw) => (
            <div
              key={bw.key}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between sm:block"
            >
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold sm:mb-1">
                {bw.label}
              </span>
              <div className="flex items-center justify-center gap-0.5">
                <input
                  type="text"
                  disabled={!canEdit}
                  value={boxWeights[bw.key]}
                  onChange={(e) => handleBoxWeightChange(bw.key, e.target.value)}
                  className={`w-12 text-center font-mono tabular-nums font-bold text-xs bg-transparent outline-none border-b ${bw.color} text-slate-900 dark:text-white`}
                />
                <span className="text-[11px] text-slate-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
        <div className="p-4 rounded-2xl bg-[#092d52] text-white">
          <span className="text-xs font-semibold text-teal-200">
            {language === 'ar' ? 'نسبة التحقيق الكلية MTD' : 'Overall MTD %'}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums my-0.5">
            {formatPercent(overallMtdPercent)}
          </div>
          <span className="text-[11px] text-slate-300">
            {language === 'ar' ? 'موزون حسب المستهدفات' : 'Weighted by targets'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
          <span className="text-xs font-semibold text-emerald-400">
            {language === 'ar' ? 'توقع الإغلاق الشهري (RE %)' : 'Overall Projection (RE %)'}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums my-0.5 text-emerald-400">
            {formatPercent(overallProjectionPercent)}
          </div>
          <span className="text-[11px] text-slate-400">
            {language === 'ar' ? 'توقع نهاية الشهر' : 'Month-End Forecast'}
          </span>
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

          {customItemKeys.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-3 py-2 bg-[#092d52] text-white flex items-center justify-between font-bold text-xs">
                <span>{language === 'ar' ? 'بنود مخصصة' : 'Custom Metric Items'}</span>
                <span className="font-mono text-[11px] tabular-nums">{customItemKeys.length}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {customItemKeys.map((key) => {
                  const meta = items[key];
                  const itm = computedItems[key];
                  if (!meta || !itm) return null;
                  return (
                    <div key={key} className="grid grid-cols-12 gap-1 p-2 items-center text-center">
                      <div className="col-span-3 text-start font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{meta.name}</span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomItem(key)}
                            className="text-rose-500 hover:text-rose-600 shrink-0 cursor-pointer"
                            aria-label={t('delete')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
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
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-center min-w-[600px]">
            <thead>
              <tr className="bg-[#092d52] text-white font-bold text-[11px]">
                <th className="py-2.5 px-3 text-start">
                  {language === 'ar' ? 'البند' : 'Category'}
                </th>
                {visibleColumns.map((col) => (
                  <th key={col.key} className="py-2.5 px-2 whitespace-nowrap">
                    {language === 'ar' ? col.labelAr || col.label : col.label}
                  </th>
                ))}
                {customItemKeys.length > 0 && <th className="py-2.5 px-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums text-xs">
              {displayedTableKeys.map((key) => {
                  const meta = items[key] || DEFAULT_TARGET_ITEMS[key];
                  const itm = computedItems[key];
                  if (!meta || !itm) return null;
                  const isCustom = !(key in DEFAULT_TARGET_ITEMS);
                  return (
                    <tr key={key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-sans font-bold text-start text-slate-800 dark:text-slate-200 truncate">
                        {meta.name}
                      </td>
                      {visibleColumns.map((col) => {
                        switch (col.key) {
                          case 'monthlyTarget':
                            return (
                              <td key={col.key} className="py-1.5 px-1">
                                <input
                                  type="number"
                                  disabled={!canEdit}
                                  value={itm.monthlyTarget}
                                  onChange={(e) =>
                                    handleItemFieldChange(key, 'monthlyTarget', e.target.value)
                                  }
                                  className="w-16 text-center font-mono font-bold bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                                />
                              </td>
                            );
                          case 'mtdAchievement':
                            return (
                              <td key={col.key} className="py-1.5 px-1">
                                <input
                                  type="number"
                                  disabled={!canEdit}
                                  value={itm.mtdAchievement}
                                  onChange={(e) =>
                                    handleItemFieldChange(key, 'mtdAchievement', e.target.value)
                                  }
                                  className="w-16 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                                />
                              </td>
                            );
                          case 'remainingTarget':
                            return (
                              <td key={col.key} className="py-2 px-1 font-bold text-amber-600">
                                {formatNumber(itm.remainingTarget)}
                              </td>
                            );
                          case 'dailyTarget':
                            return (
                              <td key={col.key} className="py-2 px-1 text-teal-600 font-bold">
                                {formatNumber(itm.dailyTarget)}
                              </td>
                            );
                          case 'todayAch':
                            return (
                              <td key={col.key} className="py-1.5 px-1 bg-blue-50/40 dark:bg-blue-950/20">
                                <input
                                  type="number"
                                  disabled={!canEdit}
                                  value={itm.todayAch}
                                  onChange={(e) =>
                                    handleItemFieldChange(key, 'todayAch', e.target.value)
                                  }
                                  className="w-16 text-center font-mono font-bold text-blue-600 bg-transparent outline-none border-b border-blue-400"
                                />
                              </td>
                            );
                          case 'mtdPercent':
                            return (
                              <td key={col.key} className="py-2 px-1 font-bold">
                                {formatPercent(itm.mtdPercent)}
                              </td>
                            );
                          case 'projectionPercent':
                            return (
                              <td key={col.key} className="py-2 px-1 font-bold text-emerald-600">
                                {formatPercent(
                                  calculateRE(
                                    itm.parsedMtd,
                                    itm.parsedTarget,
                                    elapsedShifts,
                                    parsedTotalShifts
                                  )
                                )}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                      {customItemKeys.length > 0 && (
                        <td className="py-1 px-1">
                          {canEdit && isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomItem(key)}
                              aria-label={t('delete')}
                              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
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
              Daily Achievement Velocity ({filteredDailyHistory.length} saved days)
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

        {filteredDailyHistory.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">{t('noRecords')}</p>
        ) : (
          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'total' ? (
                <AreaChart
                  data={filteredDailyHistory}
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
                  data={filteredDailyHistory}
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

            <div className="grid grid-cols-1 gap-2.5 my-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Red Sales (Today)
                </label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={redSalesToday}
                  onChange={(e) => setRedSalesToday(e.target.value)}
                  className="w-full px-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Red Sales (Target)
                </label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={redSalesTarget}
                  onChange={(e) => setRedSalesTarget(e.target.value)}
                  className="w-full px-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
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
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Single-Column Add Metric Record Modal */}
      {canEdit && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddRecordSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('addRecord')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'الصنف / البند' : 'Metric Category'} *
                </label>
                <select
                  value={addForm.targetKey}
                  onChange={(e) => {
                    const nextKey = e.target.value;
                    if (nextKey === '__custom__') {
                      setAddForm({
                        targetKey: nextKey,
                        customName: '',
                        monthlyTarget: '0',
                        mtdAchievement: '0',
                        todayAch: '0',
                      });
                    } else {
                      const cur = items[nextKey] || DEFAULT_TARGET_ITEMS[nextKey];
                      setAddForm({
                        targetKey: nextKey,
                        customName: '',
                        monthlyTarget: String(cur?.monthlyTarget ?? '0'),
                        mtdAchievement: String(cur?.mtdAchievement ?? '0'),
                        todayAch: String(cur?.todayAch ?? '0'),
                      });
                    }
                  }}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {allItemKeys.map((k) => {
                    const meta = items[k] || DEFAULT_TARGET_ITEMS[k];
                    return (
                      <option key={k} value={k}>
                        {meta?.name || k}
                      </option>
                    );
                  })}
                  <option value="__custom__">
                    {language === 'ar' ? '+ بند مخصص جديد' : '+ New Custom Metric'}
                  </option>
                </select>
              </div>

              {addForm.targetKey === '__custom__' && (
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'اسم البند الجديد' : 'Custom Metric Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.customName}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, customName: e.target.value }))
                    }
                    className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t('boxTarget')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={addForm.monthlyTarget}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, monthlyTarget: e.target.value }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t('boxActual')} (MTD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={addForm.mtdAchievement}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, mtdAchievement: e.target.value }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'تحقيق اليوم' : 'Today Achievement'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={addForm.todayAch}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, todayAch: e.target.value }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 min-h-[38px] rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? '...' : t('saveRecord')}
              </button>
            </div>
          </form>
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
