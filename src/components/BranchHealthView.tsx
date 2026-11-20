import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HealthWeights } from '../types';
import {
  Sliders,
  RotateCcw,
  Save,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  Table2,
  X,
} from 'lucide-react';
import { FilterBar } from './shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  type RowSortOrder,
} from './shared/ColumnControlMenu';

const HEALTH_COLUMNS = [
  { key: 'category', label: 'Category', labelAr: 'المحور' },
  { key: 'weight', label: 'Weight %', labelAr: 'الوزن %' },
  { key: 'score', label: 'Score', labelAr: 'الدرجة' },
  { key: 'details', label: 'Driver Details', labelAr: 'التفاصيل' },
];

export const BranchHealthView: React.FC = () => {
  const {
    t,
    language,
    canEdit,
    currentBranch,
    overallHealthScore,
    healthCategories,
    weakestHealthArea,
    strongestHealthArea,
    healthWeights,
    updateHealthWeights,
    resetHealthWeights,
    dateRange,
    addTask,
  } = useApp();

  const [isConfiguring, setIsConfiguring] = useState(false);
  const [weights, setWeights] = useState<HealthWeights>({ ...healthWeights });
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => HEALTH_COLUMNS.map((c) => c.key));

  // Add Health Audit Task Modal (Strict 1-column form)
  const [showAddModal, setShowAddModal] = useState(false);
  const [auditSaving, setAuditSaving] = useState(false);
  const [auditForm, setAuditForm] = useState({
    title: '',
    category: 'compliance' as 'store' | 'financial' | 'contracts' | 'customer' | 'compliance',
    priority: 'high' as 'low' | 'medium' | 'high' | 'critical',
    owner: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(HEALTH_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const filteredHealthCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return healthCategories;
    return healthCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nameAr || '').toLowerCase().includes(q) ||
        c.details.toLowerCase().includes(q) ||
        (c.detailsAr || '').toLowerCase().includes(q)
    );
  }, [healthCategories, search]);

  const displayedCategories = useMemo(
    () => applyRowControls(filteredHealthCategories, rowLimit, sortOrder),
    [filteredHealthCategories, rowLimit, sortOrder]
  );

  useEffect(() => {
    setWeights({ ...healthWeights });
  }, [healthWeights]);

  const openAddAuditModal = () => {
    setAuditForm({
      title: '',
      category: 'compliance',
      priority: 'high',
      owner: currentBranch?.manager || '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleSaveAuditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !auditForm.title.trim()) return;
    setAuditSaving(true);
    try {
      await addTask({
        title: auditForm.title.trim(),
        titleAr: auditForm.title.trim(),
        description: auditForm.notes.trim() || auditForm.title.trim(),
        descriptionAr: auditForm.notes.trim() || auditForm.title.trim(),
        category: auditForm.category === 'compliance' ? 'contracts' : auditForm.category,
        subcategory: 'health_audit',
        owner: auditForm.owner.trim() || currentBranch?.manager || 'Store Manager',
        ownerRole: 'Store Manager',
        deadline: auditForm.date,
        dueDate: auditForm.date,
        date: auditForm.date,
        priority: auditForm.priority,
        status: 'not_started',
        notes: auditForm.notes.trim(),
        evidenceText: '',
      });
      setShowAddModal(false);
      setToastMsg(language === 'ar' ? 'تم تسجيل سجل الامتثال والصحة بنجاح' : 'Compliance & Health audit record saved');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save audit record.');
    } finally {
      setAuditSaving(false);
    }
  };

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const baseList = opts.rowScope === 'all' ? healthCategories : displayedCategories;
    const q = opts.searchText.trim().toLowerCase();
    const list = baseList.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.nameAr || '').toLowerCase().includes(q) ||
        c.details.toLowerCase().includes(q)
    );
    const cols = opts.colScope === 'visible' ? visibleColumns : HEALTH_COLUMNS;
    const rows = list.map((c) => {
      const out: Record<string, unknown> = {
        Branch: currentBranch?.code || '',
        Period: opts.fromDate || opts.toDate ? `${opts.fromDate || '...'} -> ${opts.toDate || '...'}` : 'All',
      };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr : col.label;
        if (col.key === 'category') out[header] = language === 'ar' ? c.nameAr : c.name;
        else if (col.key === 'weight') out[header] = `${c.weight}%`;
        else if (col.key === 'score') out[header] = c.score ?? t('unconfigured');
        else if (col.key === 'details') out[header] = language === 'ar' ? c.detailsAr : c.details;
      }
      return out;
    });
    await downloadXlsxSheet('branch_health.xlsx', 'BranchHealth', rows);
  };

  const currentSum =
    Number(weights.dailyOperations) +
    Number(weights.salesPerformance) +
    Number(weights.teamPerformance) +
    Number(weights.customerExperience) +
    Number(weights.complianceAudits);

  const hasAnyScore = healthCategories.some((c) => c.score !== null);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (currentSum !== 100) {
      setErrorMsg(`Total weights must equal 100% (currently ${currentSum}%).`);
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await updateHealthWeights(weights);
      setIsConfiguring(false);
      setToastMsg(language === 'ar' ? 'تم حفظ أوزان صحة الفرع' : 'Health weights saved to database');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save weights.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;
    setSaving(true);
    setErrorMsg('');
    try {
      await resetHealthWeights();
      setIsConfiguring(false);
      setToastMsg(language === 'ar' ? 'تم استعادة الأوزان الافتراضية' : 'Health weights reset');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reset weights.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        {currentBranch && (
          <div className="text-xs text-slate-500 font-mono mb-0.5">
            {currentBranch.code} · {language === 'ar' ? currentBranch.nameAr : currentBranch.name}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('healthTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('healthSubtitle')}
        </p>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

      {/* Single-Row Unified Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        showDateFilters
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={search}
          />
        }
        onAddNew={canEdit ? openAddAuditModal : undefined}
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
                <Table2 className="w-3.5 h-3.5" />
                <span>{t('tableView')}</span>
              </button>
            </div>

            <ColumnControlMenu
              columns={HEALTH_COLUMNS}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={(key) =>
                setHiddenCols((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                )
              }
              onMoveColumn={(key, dir) => {
                const idx = colOrder.indexOf(key);
                const swap = dir === 'up' ? idx - 1 : idx + 1;
                if (idx < 0 || swap < 0 || swap >= colOrder.length) return;
                const next = [...colOrder];
                [next[idx], next[swap]] = [next[swap], next[idx]];
                setColOrder(next);
              }}
              onResetColumns={() => {
                setHiddenCols([]);
                setColOrder(HEALTH_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddAuditModal : undefined}
              totalRowsCount={filteredHealthCategories.length}
            />

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setWeights({ ...healthWeights });
                  setErrorMsg('');
                  setIsConfiguring(!isConfiguring);
                }}
                className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-bold rounded-xl bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isConfiguring ? t('cancel') : t('weightConfiguration')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">
            {language === 'ar' ? 'مؤشر تشغيلي داخلي' : 'Internal Operational Indicator'}
          </strong>
          {t('healthDisclaimer')}
        </div>
      </div>

      {/* Weight Configuration Panel — Strict Single-Column Inputs */}
      {canEdit && isConfiguring && (
        <form
          onSubmit={handleSaveWeights}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-w-xl"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('weightConfiguration')}
              </h3>
              <p className="text-xs text-slate-400">{t('weightTotalRule')}</p>
            </div>
            <div className="text-xs font-mono tabular-nums font-bold">
              {t('currentTotalWeight')}:{' '}
              <span className={currentSum === 100 ? 'text-teal-600' : 'text-rose-600'}>
                {currentSum}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs">
            {[
              { key: 'dailyOperations' as const, label: `${t('dailyOpsReport')} (%)` },
              { key: 'salesPerformance' as const, label: 'Sales Performance (%)' },
              { key: 'teamPerformance' as const, label: 'Team & Coaching (%)' },
              { key: 'customerExperience' as const, label: 'Customer Exp (%)' },
              { key: 'complianceAudits' as const, label: 'Compliance Audits (%)' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[field.key]}
                  onChange={(e) =>
                    setWeights({
                      ...weights,
                      [field.key]: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums"
                />
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-500 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('resetWeights')}</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('saveWeights')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Composite Score & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between items-center text-center">
          <div className="w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('overallHealthScore')}
            </span>

            <div className="my-6 relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-slate-100 dark:text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={427}
                  strokeDashoffset={
                    hasAnyScore ? 427 - (427 * overallHealthScore) / 100 : 427
                  }
                  strokeLinecap="round"
                  className={`transition-all duration-700 ${
                    !hasAnyScore
                      ? 'text-slate-300'
                      : overallHealthScore >= 80
                      ? 'text-teal-500'
                      : overallHealthScore >= 60
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {hasAnyScore ? overallHealthScore : '--'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {hasAnyScore ? '/ 100' : t('unconfigured')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              {!hasAnyScore
                ? language === 'ar'
                  ? 'أضف بيانات المهام والمبيعات والشكاوى لحساب مؤشر الصحة التشغيلي.'
                  : 'Add operational tasks, sales boxes, staff scores, or complaints to compute branch health.'
                : overallHealthScore >= 80
                ? 'Branch operations are running at peak performance with strong compliance.'
                : overallHealthScore >= 60
                ? 'Operational stability maintained with minor attention needed on gaps.'
                : 'Urgent leadership intervention required to resolve blockers and deficits.'}
            </p>
          </div>

          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-start">
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                {t('strongestArea')}
              </span>
              <strong className="text-slate-800 dark:text-slate-200 text-xs truncate block mt-0.5">
                {strongestHealthArea
                  ? language === 'ar'
                    ? strongestHealthArea.nameAr
                    : strongestHealthArea.name
                  : t('unconfigured')}
              </strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-start">
              <span className="block text-[10px] text-rose-500 uppercase tracking-wider font-semibold">
                {t('weakestArea')}
              </span>
              <strong className="text-slate-800 dark:text-slate-200 text-xs truncate block mt-0.5">
                {weakestHealthArea
                  ? language === 'ar'
                    ? weakestHealthArea.nameAr
                    : weakestHealthArea.name
                  : t('unconfigured')}
              </strong>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('categoryScores')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ar'
                  ? 'تفصيل الأوزان والمؤشرات المحسوبة'
                  : 'Weight breakdown and verified operational drivers'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {displayedCategories.length} {t('rowsLabel')}
            </span>
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#092d52] text-white">
                  <tr>
                    {visibleColumns.map((col) => (
                      <th key={col.key} className="px-3.5 py-2.5 text-start font-semibold whitespace-nowrap">
                        {language === 'ar' ? col.labelAr : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedCategories.map((cat) => (
                    <tr key={cat.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      {visibleColumns.map((col) => {
                        if (col.key === 'category') return <td key={col.key} className="px-3.5 py-2.5 font-semibold">{language === 'ar' ? cat.nameAr : cat.name}</td>;
                        if (col.key === 'weight') return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{cat.weight}%</td>;
                        if (col.key === 'score') return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums font-bold">{cat.score !== null ? `${cat.score} / 100` : t('unconfigured')}</td>;
                        return <td key={col.key} className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{language === 'ar' ? cat.detailsAr : cat.details}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCategories.map((cat) => (
                <div
                  key={cat.key}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? cat.nameAr : cat.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        ({cat.weight}%)
                      </span>
                    </div>

                    {cat.score !== null ? (
                      <span
                        className={`font-mono tabular-nums font-bold text-sm ${
                          cat.score >= 80
                            ? 'text-teal-600 dark:text-teal-400'
                            : cat.score >= 60
                              ? 'text-amber-600'
                              : 'text-rose-600'
                        }`}
                      >
                        {cat.score} / 100
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        {t('unconfigured')}
                      </span>
                    )}
                  </div>

                  {cat.score !== null ? (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat.score >= 80
                            ? 'bg-teal-500'
                            : cat.score >= 60
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-2 opacity-50" />
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                    {language === 'ar' ? cat.detailsAr : cat.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Health / Compliance Audit Modal (Strict 1-Column Inputs) */}
      {canEdit && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveAuditRecord}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
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

            <div className="p-5 grid grid-cols-1 gap-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold mb-1">{t('taskTitle')} *</label>
                <input
                  type="text"
                  required
                  value={auditForm.title}
                  onChange={(e) => setAuditForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskCategory')}</label>
                <select
                  value={auditForm.category}
                  onChange={(e) =>
                    setAuditForm((p) => ({ ...p, category: e.target.value as any }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="compliance">Compliance & Audits</option>
                  <option value="store">Store Operations</option>
                  <option value="financial">Financial Control</option>
                  <option value="customer">Customer Experience</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskPriority')}</label>
                <select
                  value={auditForm.priority}
                  onChange={(e) =>
                    setAuditForm((p) => ({ ...p, priority: e.target.value as any }))
                  }
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="low">{t('priority_low')}</option>
                  <option value="medium">{t('priority_medium')}</option>
                  <option value="high">{t('priority_high')}</option>
                  <option value="critical">{t('priority_critical')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskOwner')}</label>
                <input
                  type="text"
                  value={auditForm.owner}
                  onChange={(e) => setAuditForm((p) => ({ ...p, owner: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('businessDate')}</label>
                <input
                  type="date"
                  value={auditForm.date}
                  onChange={(e) => setAuditForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskNotes')}</label>
                <textarea
                  rows={2}
                  value={auditForm.notes}
                  onChange={(e) => setAuditForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 min-h-[38px] rounded-xl text-xs bg-slate-100 dark:bg-slate-800 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={auditSaving}
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer disabled:opacity-50"
              >
                {auditSaving ? '...' : t('saveRecord')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
