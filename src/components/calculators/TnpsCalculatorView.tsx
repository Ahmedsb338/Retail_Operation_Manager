import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, buildQueryParams } from '../../services/apiClient';
import {
  TnpsAgentRow,
  ComputedTnpsRow,
  DailyTnpsRecord,
  DEFAULT_TNPS_BENCHMARK,
  computeSingleAgentTnps,
  aggregateDailyTotalTnps,
  aggregateMonthlyRecords,
} from '../../services/tnpsCalculatorEngine';
import {
  HeartHandshake,
  Save,
  Calendar,
  Clock,
  CheckCircle2,
  History,
  Trash2,
  Users,
  Target,
  Lock,
  AlertTriangle,
  X,
} from 'lucide-react';
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

function mapDbRecord(raw: any): DailyTnpsRecord {
  const detractors = Number(raw.detractors ?? 0);
  const passive = Number(raw.passive ?? 0);
  const promoters = Number(raw.promoters ?? 0);
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    businessDate: String(raw.businessDate || ''),
    agentRows: Array.isArray(raw.agentRowsJson) ? raw.agentRowsJson : [],
    totalDetractors: detractors,
    totalPassive: passive,
    totalPromoters: promoters,
    totalResponses: detractors + passive + promoters,
    dailyTnpsPercent: Number(raw.score ?? 0),
    requiredPromoters: Number(raw.requiredPromoters ?? 0),
    dailyRequired: Number(raw.dailyRequired ?? 0),
    targetBenchmark: Number(raw.benchmark ?? DEFAULT_TNPS_BENCHMARK),
    updatedAt: String(raw.updatedAt || ''),
    updatedBy: String(raw.updatedBy || ''),
    revisionNumber: Number(raw.revisionNumber || 1),
  };
}

const TNPS_TABLE_COLUMNS: ColumnControlItem[] = [
  { key: 'detractors', label: 'Det (0-6)', labelAr: 'غير راضٍ (0-6)' },
  { key: 'passive', label: 'Pass (7-8)', labelAr: 'محايد (7-8)' },
  { key: 'promoters', label: 'Prom (9-10)', labelAr: 'داعم (9-10)' },
  { key: 'total', label: 'Total', labelAr: 'الإجمالي' },
  { key: 'tnpsPercent', label: 'TNPS %', labelAr: 'نسبة TNPS' },
  { key: 'requiredPromoters', label: 'Req Prom', labelAr: 'المطلوب' },
  { key: 'daily', label: 'Daily', labelAr: 'اليومي' },
];

export const TnpsCalculatorView: React.FC = () => {
  const { t, language, canEdit, currentBranch, employees, refreshWorkspaceData, dateRange } = useApp();
  const branchCode = currentBranch?.code || '';

  const [benchmarkPercent, setBenchmarkPercent] = useState<number>(DEFAULT_TNPS_BENCHMARK);
  const [remainingShifts, setRemainingShifts] = useState<string>(
    String(currentBranch?.remainingShifts ?? 10)
  );
  const [businessDate, setBusinessDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [agentRows, setAgentRows] = useState<TnpsAgentRow[]>([
    { id: '1', agentName: '', detractors: '0', passive: '0', promoters: '0' },
  ]);
  const [historicalRecords, setHistoricalRecords] = useState<DailyTnpsRecord[]>([]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Row & Column Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(TNPS_TABLE_COLUMNS.map((c) => c.key));

  // Add Record Single-Column Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({
    agentName: '',
    detractors: '0',
    passive: '0',
    promoters: '0',
  });

  const loadRecords = useCallback(async () => {
    if (!branchCode) return;
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ records: any[] }>(
        `/api/v1/tnps-store/daily-calc${buildQueryParams({ branchCode })}`
      );
      const mapped = (res.records || []).map(mapDbRecord);
      setHistoricalRecords(mapped);
      if (mapped.length > 0 && mapped[0].agentRows.length > 0) {
        setAgentRows(mapped[0].agentRows);
        setBenchmarkPercent(mapped[0].targetBenchmark || DEFAULT_TNPS_BENCHMARK);
      } else {
        setAgentRows([
          { id: '1', agentName: '', detractors: '0', passive: '0', promoters: '0' },
        ]);
      }
      setBusinessDate(currentBranch?.businessDate || new Date().toISOString().slice(0, 10));
      setRemainingShifts(String(currentBranch?.remainingShifts ?? 10));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load TNPS calculator records.');
    }
  }, [branchCode, currentBranch?.businessDate, currentBranch?.remainingShifts]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const parsedRemaining = Math.max(1, parseFloat(remainingShifts) || 1);
  const computedRows: ComputedTnpsRow[] = useMemo(
    () => agentRows.map((row) => computeSingleAgentTnps(row, parsedRemaining, benchmarkPercent)),
    [agentRows, parsedRemaining, benchmarkPercent]
  );

  const visibleRowsWithIndex = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return computedRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !q || row.agentName.toLowerCase().includes(q));
  }, [computedRows, searchQuery]);

  const displayedRowsWithIndex = useMemo(
    () => applyRowControls(visibleRowsWithIndex, rowLimit, sortOrder),
    [visibleRowsWithIndex, rowLimit, sortOrder]
  );

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(TNPS_TABLE_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const filteredHistoricalRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return historicalRecords.filter((rec) => {
      if ((dateRange.fromDate || dateRange.toDate) && !matchesDateRange(rec.businessDate, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      if (!q) return true;
      return (
        rec.businessDate.toLowerCase().includes(q) ||
        rec.agentRows.some((ar) => ar.agentName.toLowerCase().includes(q))
      );
    });
  }, [historicalRecords, searchQuery, dateRange.fromDate, dateRange.toDate]);

  const displayedHistoricalRecords = useMemo(
    () => applyRowControls(filteredHistoricalRecords, rowLimit, sortOrder, (r) => r.businessDate),
    [filteredHistoricalRecords, rowLimit, sortOrder]
  );

  const dailyTotal = useMemo(
    () => aggregateDailyTotalTnps(computedRows, parsedRemaining, benchmarkPercent),
    [computedRows, parsedRemaining, benchmarkPercent]
  );

  const monthlySummary = useMemo(
    () => aggregateMonthlyRecords(filteredHistoricalRecords, 25, benchmarkPercent),
    [filteredHistoricalRecords, benchmarkPercent]
  );

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
    setColOrder(TNPS_TABLE_COLUMNS.map((c) => c.key));
  };

  const handleRowChange = (index: number, field: keyof TnpsAgentRow, val: string) => {
    if (!canEdit) return;
    const updated = [...agentRows];
    updated[index] = { ...updated[index], [field]: val };
    setAgentRows(updated);
  };

  const openAddModal = () => {
    setNewAgentForm({
      agentName: '',
      detractors: '0',
      passive: '0',
      promoters: '0',
    });
    setShowAddModal(true);
  };

  const handleCreateAgentRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newAgentForm.agentName.trim()) return;
    const newRow: TnpsAgentRow = {
      id: `agent-${Date.now()}`,
      agentName: newAgentForm.agentName.trim(),
      detractors: newAgentForm.detractors || '0',
      passive: newAgentForm.passive || '0',
      promoters: newAgentForm.promoters || '0',
    };
    const isSingleBlankRow =
      agentRows.length === 1 &&
      !agentRows[0].agentName.trim() &&
      agentRows[0].detractors === '0' &&
      agentRows[0].passive === '0' &&
      agentRows[0].promoters === '0';
    setAgentRows(isSingleBlankRow ? [newRow] : [...agentRows, newRow]);
    setShowAddModal(false);
    setToastMsg(language === 'ar' ? 'تمت إضافة الموظف للجدول' : 'Agent row added');
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleImportFromStaffRoster = () => {
    if (!canEdit || !employees || employees.length === 0) return;
    const imported: TnpsAgentRow[] = employees.map((emp, idx) => ({
      id: `agent-roster-${emp.id}`,
      agentName: language === 'ar' ? emp.nameAr || emp.name : emp.name,
      detractors: String(agentRows[idx]?.detractors || '0'),
      passive: String(agentRows[idx]?.passive || '0'),
      promoters: String(agentRows[idx]?.promoters || '0'),
    }));
    setAgentRows(imported);
    setToastMsg(
      language === 'ar' ? 'تم جلب أسماء الموظفين من السجل' : 'Loaded staff names from roster'
    );
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleRemoveRow = (id: string) => {
    if (!canEdit || agentRows.length <= 1) return;
    setAgentRows(agentRows.filter((r) => r.id !== id));
  };

  const handleSaveDailyRecord = async () => {
    if (!canEdit || !branchCode) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      setErrorMsg('Select a valid date (YYYY-MM-DD).');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest('/api/v1/tnps-store/daily-calc', {
        method: 'PUT',
        body: {
          businessDate,
          detractors: Math.round(dailyTotal.detractors),
          passive: Math.round(dailyTotal.passive),
          promoters: Math.round(dailyTotal.promoters),
          score: Math.round(dailyTotal.tnpsPercent * 10) / 10,
          benchmark: benchmarkPercent,
          requiredPromoters: dailyTotal.requiredPromoters,
          dailyRequired: dailyTotal.dailyRequired,
          agentRows: agentRows.map((r) => ({ ...r })),
          notes: '',
        },
      });
      await Promise.all([loadRecords(), refreshWorkspaceData()]);
      setToastMsg(
        language === 'ar'
          ? `تم حفظ قياس TNPS ليوم ${businessDate}`
          : `Saved TNPS measurement for ${businessDate}`
      );
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save daily TNPS record.');
    } finally {
      setSaving(false);
    }
  };

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    if (!branchCode) return;
    const baseRows = opts.rowScope === 'all' ? computedRows : displayedRowsWithIndex.map((x) => x.row);
    const q = opts.searchText.trim().toLowerCase();
    const list = baseRows.filter((r) => !q || r.agentName.toLowerCase().includes(q));
    const cols = opts.colScope === 'visible' ? visibleColumns : TNPS_TABLE_COLUMNS;

    const sheetRows = list.map((r) => {
      const out: Record<string, unknown> = {
        'Branch Code': branchCode,
        Date: opts.fromDate || opts.toDate ? `${opts.fromDate || '...'} -> ${opts.toDate || '...'}` : businessDate,
        'Agent Name': r.agentName || 'Unnamed',
      };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr || col.label : col.label;
        if (col.key === 'detractors') out[header] = r.detractors;
        else if (col.key === 'passive') out[header] = r.passive;
        else if (col.key === 'promoters') out[header] = r.promoters;
        else if (col.key === 'total') out[header] = r.total;
        else if (col.key === 'tnpsPercent') out[header] = `${Math.round(r.tnpsPercent)}%`;
        else if (col.key === 'requiredPromoters') out[header] = r.requiredPromoters;
        else if (col.key === 'daily') out[header] = r.daily;
      }
      return out;
    });
    await downloadXlsxSheet(
      `tnps_calculator_${branchCode}_${businessDate}.xlsx`,
      'TNPS_Scorecard',
      sheetRows
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
    <div className="space-y-5 content-container">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
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
          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 tabular-nums">
            {currentBranch.code}
          </span>
          <span aria-hidden="true">·</span>
          <span>{language === 'ar' ? currentBranch.nameAr : currentBranch.name}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-rose-500 shrink-0" />
          <span>
            {language === 'ar'
              ? 'حاسبة الـ TNPS وذكاء رضا العملاء'
              : 'TNPS Calculator & CX Intelligence'}
          </span>
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
        search={searchQuery}
        onSearchChange={setSearchQuery}
        showDateFilters
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={searchQuery}
          />
        }
        onAddNew={canEdit ? openAddModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <ColumnControlMenu
              columns={TNPS_TABLE_COLUMNS}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={handleToggleColumn}
              onMoveColumn={handleMoveColumn}
              onResetColumns={handleResetColumns}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddModal : undefined}
              totalRowsCount={visibleRowsWithIndex.length}
            />

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleImportFromStaffRoster}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'جلب أسماء الموظفين' : 'Load from Roster'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDailyRecord}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] h-[36px] text-xs font-bold rounded-xl bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? '...' : language === 'ar' ? 'حفظ سجل اليوم' : 'Save Record'}</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Parameters Controls — Single Row */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto custom-scrollbar text-xs">
        <div className="flex flex-nowrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'التاريخ:' : 'Date:'}
            </span>
            <input
              type="date"
              disabled={!canEdit}
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="px-2.5 min-h-[36px] h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'الشفتات المتبقية:' : 'Remaining Shifts:'}
            </span>
            <input
              type="number"
              min="1"
              disabled={!canEdit}
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-16 px-2 min-h-[36px] h-[36px] text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 min-h-[36px] h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
          <Target className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'مستهدف Benchmark:' : 'TNPS Target Benchmark:'}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="99"
              disabled={!canEdit}
              value={benchmarkPercent}
              onChange={(e) =>
                setBenchmarkPercent(
                  Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 70))
                )
              }
              className="w-14 text-center font-mono tabular-nums font-black text-rose-600 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg px-1 py-0.5 text-xs"
            />
            <span className="font-bold font-mono text-rose-600">%</span>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'نتيجة اليوم (Daily TNPS)' : 'Today TNPS Result'}
          </span>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono tabular-nums my-0.5 ${
              dailyTotal.tnpsPercent >= benchmarkPercent ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {Math.round(dailyTotal.tnpsPercent)}%
          </div>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            {dailyTotal.promoters} Prom · {dailyTotal.passive} Pass · {dailyTotal.detractors} Det (
            {dailyTotal.total} total)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? `المطلوب للوصول لـ ${benchmarkPercent}%`
              : `Required Promoters for ${benchmarkPercent}%`}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums my-0.5 text-teal-600">
            +{dailyTotal.requiredPromoters}
          </div>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            Daily Run: <strong>{dailyTotal.dailyRequired}</strong> / shift ({parsedRemaining} left)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'التراكمي المسجل (MTD TNPS)' : 'Logged Cumulative (MTD)'}
          </span>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono tabular-nums my-0.5 ${
              historicalRecords.length === 0
                ? 'text-slate-400'
                : monthlySummary.cumulativeTnpsPercent >= benchmarkPercent
                ? 'text-emerald-600'
                : 'text-amber-600'
            }`}
          >
            {historicalRecords.length === 0
              ? t('unconfigured')
              : `${monthlySummary.cumulativeTnpsPercent}%`}
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {monthlySummary.totalDaysLogged} days logged ({monthlySummary.completenessPercent}% completeness)
          </span>
        </div>
      </div>

      {/* Daily Entry Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 bg-[#092d52] text-white flex items-center justify-between text-xs font-bold">
          <span>
            {language === 'ar'
              ? `إدخال tNPS اليومي وبطاقة أداء الموظفين (المستهدف: ${benchmarkPercent}%)`
              : `tNPS Daily Entry & Agent Scorecard (Target: ${benchmarkPercent}%)`}
          </span>
          <span className="font-mono text-[11px] text-teal-200 tabular-nums">
            {displayedRowsWithIndex.length} {t('rowsLabel')}
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-center min-w-[550px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3 text-start">
                  {language === 'ar' ? 'اسم الموظف' : 'Agent Name'}
                </th>
                {visibleColumns.map((col) => (
                  <th key={col.key} className="py-2.5 px-2 whitespace-nowrap">
                    {language === 'ar' ? col.labelAr || col.label : col.label}
                  </th>
                ))}
                <th className="py-2.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono tabular-nums">
              {displayedRowsWithIndex.map(({ row, index }) => {
                const isMet = row.tnpsPercent >= benchmarkPercent;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-sans font-bold text-start text-slate-800 dark:text-slate-200">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.agentName}
                        onChange={(e) => handleRowChange(index, 'agentName', e.target.value)}
                        className="w-full font-bold bg-transparent outline-none border-b border-slate-200 dark:border-slate-700 text-xs"
                        placeholder={language === 'ar' ? 'اسم الموظف' : 'Agent Name'}
                      />
                    </td>
                    {visibleColumns.map((col) => {
                      switch (col.key) {
                        case 'detractors':
                          return (
                            <td key={col.key} className="py-1.5 px-1">
                              <input
                                type="number"
                                min="0"
                                disabled={!canEdit}
                                value={agentRows[index].detractors}
                                onChange={(e) => handleRowChange(index, 'detractors', e.target.value)}
                                className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                              />
                            </td>
                          );
                        case 'passive':
                          return (
                            <td key={col.key} className="py-1.5 px-1">
                              <input
                                type="number"
                                min="0"
                                disabled={!canEdit}
                                value={agentRows[index].passive}
                                onChange={(e) => handleRowChange(index, 'passive', e.target.value)}
                                className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                              />
                            </td>
                          );
                        case 'promoters':
                          return (
                            <td key={col.key} className="py-1.5 px-1">
                              <input
                                type="number"
                                min="0"
                                disabled={!canEdit}
                                value={agentRows[index].promoters}
                                onChange={(e) => handleRowChange(index, 'promoters', e.target.value)}
                                className="w-12 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                              />
                            </td>
                          );
                        case 'total':
                          return (
                            <td key={col.key} className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">
                              {row.total}
                            </td>
                          );
                        case 'tnpsPercent':
                          return (
                            <td key={col.key} className="py-1.5 px-1">
                              <span
                                className={`inline-block rounded-lg font-mono font-bold py-0.5 px-2 text-white text-[11px] ${
                                  row.total === 0
                                    ? 'bg-slate-400'
                                    : isMet
                                    ? 'bg-emerald-700'
                                    : 'bg-rose-600'
                                }`}
                              >
                                {Math.round(row.tnpsPercent)}%
                              </span>
                            </td>
                          );
                        case 'requiredPromoters':
                          return (
                            <td key={col.key} className="py-1.5 px-1">
                              <span className="inline-block rounded-lg font-mono font-bold py-0.5 px-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[11px]">
                                +{row.requiredPromoters}
                              </span>
                            </td>
                          );
                        case 'daily':
                          return (
                            <td key={col.key} className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">
                              {row.daily}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                    <td className="py-1 px-1">
                      {canEdit && agentRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          aria-label={t('delete')}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800 font-mono tabular-nums font-bold text-xs border-t border-slate-200 dark:border-slate-700">
                <td className="py-2.5 px-3 font-sans font-bold text-start">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </td>
                {visibleColumns.map((col) => {
                  switch (col.key) {
                    case 'detractors':
                      return <td key={col.key} className="py-2 px-1 text-amber-600">{dailyTotal.detractors}</td>;
                    case 'passive':
                      return <td key={col.key} className="py-2 px-1 text-amber-600">{dailyTotal.passive}</td>;
                    case 'promoters':
                      return <td key={col.key} className="py-2 px-1 text-teal-600">{dailyTotal.promoters}</td>;
                    case 'total':
                      return <td key={col.key} className="py-2 px-1">{dailyTotal.total}</td>;
                    case 'tnpsPercent':
                      return (
                        <td key={col.key} className="py-1.5 px-1">
                          <span
                            className={`inline-block rounded-lg font-mono font-bold py-0.5 px-2 text-white text-[11px] ${
                              dailyTotal.tnpsPercent >= benchmarkPercent ? 'bg-emerald-700' : 'bg-rose-600'
                            }`}
                          >
                            {Math.round(dailyTotal.tnpsPercent)}%
                          </span>
                        </td>
                      );
                    case 'requiredPromoters':
                      return (
                        <td key={col.key} className="py-1.5 px-1">
                          <span className="inline-block rounded-lg font-mono font-bold py-0.5 px-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[11px]">
                            +{dailyTotal.requiredPromoters}
                          </span>
                        </td>
                      );
                    case 'daily':
                      return <td key={col.key} className="py-2 px-1">{dailyTotal.dailyRequired}</td>;
                    default:
                      return null;
                  }
                })}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Audit History Log */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {language === 'ar'
                ? 'سجل قياسات الـ TNPS اليومية في قاعدة البيانات'
                : 'Database Daily TNPS Audit History'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            {displayedHistoricalRecords.length} {t('rowsLabel')}
          </span>
        </div>

        {displayedHistoricalRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">{t('noRecords')}</p>
        ) : (
          <div className="space-y-2">
            {displayedHistoricalRecords.map((rec) => {
              const isMet = rec.dailyTnpsPercent >= (rec.targetBenchmark || benchmarkPercent);
              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {rec.businessDate}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Rev #{rec.revisionNumber})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {rec.totalPromoters} Prom · {rec.totalPassive} Pass · {rec.totalDetractors} Det
                      ({rec.totalResponses} total)
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-end font-mono tabular-nums">
                      <span className="text-[10px] text-slate-400 block">
                        Gap to {rec.targetBenchmark || benchmarkPercent}%
                      </span>
                      <span className="font-bold text-teal-600 text-xs">
                        +{rec.requiredPromoters}
                      </span>
                    </div>
                    <div
                      className={`py-1 px-2.5 rounded-lg font-mono tabular-nums font-bold text-white text-xs ${
                        isMet ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      {Math.round(rec.dailyTnpsPercent)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single-Column Add Agent TNPS Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateAgentRow}
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
                  {t('empName')} *
                </label>
                <input
                  type="text"
                  required
                  list="tnps-employee-suggestions"
                  value={newAgentForm.agentName}
                  onChange={(e) =>
                    setNewAgentForm((prev) => ({ ...prev, agentName: e.target.value }))
                  }
                  placeholder={language === 'ar' ? 'اسم الموظف' : 'Agent name'}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <datalist id="tnps-employee-suggestions">
                  {employees.map((emp) => (
                    <option
                      key={emp.id}
                      value={language === 'ar' ? emp.nameAr || emp.name : emp.name}
                    />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Detractors (0-6)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newAgentForm.detractors}
                  onChange={(e) =>
                    setNewAgentForm((prev) => ({ ...prev, detractors: e.target.value }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Passive (7-8)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newAgentForm.passive}
                  onChange={(e) =>
                    setNewAgentForm((prev) => ({ ...prev, passive: e.target.value }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Promoters (9-10)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newAgentForm.promoters}
                  onChange={(e) =>
                    setNewAgentForm((prev) => ({ ...prev, promoters: e.target.value }))
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
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer"
              >
                {t('saveRecord')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

