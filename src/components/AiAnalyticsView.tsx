import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  RotateCw,
  CheckCircle2,
  Clock,
  Target,
  Users,
  Info,
  FileCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { FilterBar } from './shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type RowSortOrder,
} from './shared/ColumnControlMenu';

interface AiColDef {
  key: string;
  label: string;
  labelAr: string;
}

const AI_TABLE_COLUMNS: AiColDef[] = [
  { key: 'done', label: 'Status', labelAr: 'الحالة' },
  { key: 'priority', label: 'Priority', labelAr: 'الأولوية' },
  { key: 'issue', label: 'Operational Issue', labelAr: 'المشكلة' },
  { key: 'evidence', label: 'Empirical Evidence', labelAr: 'الدليل المسجل' },
  { key: 'impact', label: 'Business Impact', labelAr: 'الأثر' },
  { key: 'action', label: 'Recommended Action', labelAr: 'الإجراء الموصى به' },
  { key: 'owner', label: 'Suggested Owner', labelAr: 'المسؤول المقترح' },
  { key: 'deadline', label: 'Suggested SLA', labelAr: 'الموعد المقترح' },
];

export const AiAnalyticsView: React.FC = () => {
  const {
    t,
    language,
    canEdit,
    currentBranch,
    geminiConfigured,
    aiAnalysis,
    isAiLoading,
    aiError,
    runAiDiagnostic,
    toggleActionPlanItem,
    dateRange,
    addTask,
  } = useApp();

  const [planSearch, setPlanSearch] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => AI_TABLE_COLUMNS.map((c) => c.key));

  // Add Action Plan Task Modal (Strict 1-column form)
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    priority: 'high' as 'low' | 'medium' | 'high' | 'critical',
    owner: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const visibleCols = useMemo(
    () => applyColumnOrderAndVisibility(AI_TABLE_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const filteredActionPlan = useMemo(() => {
    if (!aiAnalysis?.actionPlan) return [];
    const q = planSearch.trim().toLowerCase();
    return aiAnalysis.actionPlan.filter((item) => {
      if ((dateRange.fromDate || dateRange.toDate) && !matchesDateRange(item.suggestedDeadline, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      if (!q) return true;
      return (
        item.issue.toLowerCase().includes(q) ||
        item.issueAr.toLowerCase().includes(q) ||
        item.evidence.toLowerCase().includes(q) ||
        item.recommendedAction.toLowerCase().includes(q) ||
        item.suggestedOwner.toLowerCase().includes(q)
      );
    });
  }, [aiAnalysis, planSearch, dateRange.fromDate, dateRange.toDate]);

  const displayedActionPlan = useMemo(
    () => applyRowControls(filteredActionPlan, rowLimit, sortOrder, (item) => item.suggestedDeadline || ''),
    [filteredActionPlan, rowLimit, sortOrder]
  );

  const openAddTaskModal = () => {
    setTaskForm({
      title: '',
      priority: 'high',
      owner: currentBranch?.manager || '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleSaveAiTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !taskForm.title.trim()) return;
    setTaskSaving(true);
    try {
      await addTask({
        title: taskForm.title.trim(),
        titleAr: taskForm.title.trim(),
        description: taskForm.notes.trim() || taskForm.title.trim(),
        descriptionAr: taskForm.notes.trim() || taskForm.title.trim(),
        category: 'store',
        subcategory: 'ai_diagnostic',
        owner: taskForm.owner.trim() || currentBranch?.manager || 'Store Manager',
        ownerRole: 'Store Manager',
        deadline: taskForm.date,
        dueDate: taskForm.date,
        date: taskForm.date,
        priority: taskForm.priority,
        status: 'not_started',
        notes: taskForm.notes.trim(),
        evidenceText: '',
      });
      setShowAddModal(false);
      setToastMsg(language === 'ar' ? 'تمت إضافة التوصية إلى مهام الفرع' : 'Action item saved to Branch Operations');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const allItems = aiAnalysis?.actionPlan || [];
    const baseList = opts.rowScope === 'all' ? allItems : displayedActionPlan;
    const q = opts.searchText.trim().toLowerCase();
    const list = baseList.filter((item) => {
      if ((opts.fromDate || opts.toDate) && !matchesDateRange(item.suggestedDeadline, opts.fromDate, opts.toDate)) {
        return false;
      }
      if (!q) return true;
      return (
        item.issue.toLowerCase().includes(q) ||
        item.issueAr.toLowerCase().includes(q) ||
        item.evidence.toLowerCase().includes(q) ||
        item.recommendedAction.toLowerCase().includes(q) ||
        item.suggestedOwner.toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleCols : AI_TABLE_COLUMNS;
    const rows =
      list.length > 0
        ? list.map((item) => {
            const out: Record<string, unknown> = { Branch: currentBranch?.code || '' };
            for (const col of cols) {
              const header = language === 'ar' ? col.labelAr : col.label;
              if (col.key === 'done') out[header] = item.isCompleted ? 'Completed' : 'Open';
              else if (col.key === 'priority') out[header] = item.priority;
              else if (col.key === 'issue') out[header] = language === 'ar' ? item.issueAr : item.issue;
              else if (col.key === 'evidence') out[header] = language === 'ar' ? item.evidenceAr : item.evidence;
              else if (col.key === 'impact') out[header] = language === 'ar' ? item.businessImpactAr : item.businessImpact;
              else if (col.key === 'action') out[header] = language === 'ar' ? item.recommendedActionAr : item.recommendedAction;
              else if (col.key === 'owner') out[header] = item.suggestedOwner;
              else if (col.key === 'deadline') out[header] = item.suggestedDeadline;
            }
            return out;
          })
        : [
            {
              Branch: currentBranch?.code || '',
              Summary: currentBranch ? (language === 'ar' ? aiAnalysis?.branchOverview.summaryAr || 'لا يوجد تحليل مولد بعد' : aiAnalysis?.branchOverview.summary || 'No AI diagnostic generated yet') : '',
            },
          ];

    await downloadXlsxSheet(
      `ai_diagnostics_${currentBranch?.code || 'branch'}.xlsx`,
      'AI Diagnostics',
      rows
    );
  };

  const handleToggleColumn = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMoveColumn = (key: string, direction: 'up' | 'down') => {
    const idx = colOrder.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= colOrder.length) return;
    const next = [...colOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setColOrder(next);
  };

  const resolvedCount = aiAnalysis
    ? aiAnalysis.actionPlan.filter((p) => p.isCompleted).length
    : 0;
  const totalCount = aiAnalysis ? aiAnalysis.actionPlan.length : 0;

  return (
    <div className="space-y-4 content-container">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Executive Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-[#092d52] dark:text-teal-300 border border-slate-200 dark:border-slate-700">
            {t('aiModelIndicator')}
          </span>
          {currentBranch && (
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-500 dark:text-slate-400">
              {currentBranch.code} ·{' '}
              {language === 'ar' ? currentBranch.nameAr || currentBranch.name : currentBranch.name}
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{t('aiTitle')}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('aiSubtitle')}
        </p>
      </div>

      {/* Single-Row Unified Toolbar */}
      <FilterBar
        search={planSearch}
        onSearchChange={setPlanSearch}
        showDateFilters
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={planSearch}
          />
        }
        onAddNew={canEdit ? openAddTaskModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <ColumnControlMenu
              columns={AI_TABLE_COLUMNS}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={handleToggleColumn}
              onMoveColumn={handleMoveColumn}
              onResetColumns={() => {
                setHiddenCols([]);
                setColOrder(AI_TABLE_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddTaskModal : undefined}
              totalRowsCount={filteredActionPlan.length}
            />

            <button
              type="button"
              onClick={runAiDiagnostic}
              disabled={isAiLoading || !currentBranch}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] h-[36px] text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isAiLoading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('generatingAi')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiAnalysis ? t('refreshAiPlan') : t('generateAiAnalysis')}</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Gemini Unavailable / Diagnostic Error Banners */}
      {!geminiConfigured && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {language === 'ar'
              ? 'مفتاح Gemini غير مهيأ على الخادم حالياً (GEMINI_API_KEY). سيتم إعادة خطأ 503 عند التشغيل حتى يتم ضبطه على بيئة التشغيل.'
              : 'Server GEMINI_API_KEY is not configured. Running diagnostics will return a controlled 503 error until the server environment variable is set.'}
          </span>
        </div>
      )}

      {aiError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Grounding Rule Notice */}
      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 dark:text-white block mb-0.5">
            {language === 'ar' ? 'معايير النزاهة التحليلية' : 'Server-Grounded Database Intelligence'}
          </strong>
          {t('aiDisclaimerNote')}
        </div>
      </div>

      {/* Empty Prompt State */}
      {!aiAnalysis && !isAiLoading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {currentBranch
              ? `${language === 'ar' ? 'تشخيص عمليات الفرع' : 'Run Branch Shift Diagnostic'} (${currentBranch.code})`
              : t('noBranchesInScope')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-5 leading-relaxed">
            {language === 'ar'
              ? 'يقوم الخادم بقراءة بيانات الفرع مباشرة من قاعدة البيانات وتوليد خطة عمل مبنية على الأدلة الفعلية.'
              : 'The backend queries verified PostgreSQL branch records and generates an evidence-based operational action plan.'}
          </p>
          <button
            type="button"
            disabled={!currentBranch}
            onClick={runAiDiagnostic}
            className="px-5 min-h-[40px] text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('generateAiAnalysis')}</span>
          </button>
        </div>
      )}

      {/* Clean Loading Panel */}
      {isAiLoading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <RotateCw className="w-6 h-6 text-teal-600 dark:text-teal-400 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {t('generatingAi')}
          </p>
        </div>
      )}

      {/* Intelligence Output */}
      {aiAnalysis && !isAiLoading && (
        <div className="space-y-5">
          {/* Executive Synthesis Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-[#092d52] dark:text-teal-300">
                {language === 'ar' ? 'ملخص أداء الفرع' : 'Branch Performance Synthesis'}
              </h2>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {aiAnalysis.modelUsed} · {new Date(aiAnalysis.generatedAt).toLocaleString()}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {language === 'ar' ? aiAnalysis.branchOverview.summaryAr : aiAnalysis.branchOverview.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-rose-600 dark:text-rose-400 block">
                  {language === 'ar' ? 'أبرز نقاط الضعف المرصودة' : 'Identified Operational Weaknesses'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  {(language === 'ar'
                    ? aiAnalysis.branchOverview.operationalWeaknessesAr
                    : aiAnalysis.branchOverview.operationalWeaknesses
                  ).map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-teal-600 dark:text-teal-400 block">
                  {language === 'ar' ? 'الأولويات العاجلة' : 'Immediate Shift Priorities'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  {(language === 'ar'
                    ? aiAnalysis.branchOverview.immediatePrioritiesAr
                    : aiAnalysis.branchOverview.immediatePriorities
                  ).map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 4 Intelligence Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'ذكاء العمليات والامتثال' : 'Operations Intelligence'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong>{language === 'ar' ? 'الحالة: ' : 'Status: '}</strong>
                {language === 'ar'
                  ? aiAnalysis.operationsIntelligence.auditStatusAr
                  : aiAnalysis.operationsIntelligence.auditStatus}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar'
                  ? aiAnalysis.operationsIntelligence.criticalFindingsAr
                  : aiAnalysis.operationsIntelligence.criticalFindings
                ).map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Users className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'تحليلات الفريق والتوجيه' : 'Team Insights'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong>{language === 'ar' ? 'الأفضل أداءً: ' : 'Top Performer: '}</strong>
                {language === 'ar'
                  ? aiAnalysis.teamInsights.topPerformerAr
                  : aiAnalysis.teamInsights.topPerformer}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <strong>{language === 'ar' ? 'أولوية التطوير: ' : 'Development Priority: '}</strong>
                {(language === 'ar'
                  ? aiAnalysis.teamInsights.priorityCoacheesAr
                  : aiAnalysis.teamInsights.priorityCoachees
                ).join(', ') || '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Target className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'ذكاء المبيعات' : 'Sales Intelligence'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong>{language === 'ar' ? 'أضعف صندوق: ' : 'Weakest Box: '}</strong>
                {language === 'ar'
                  ? aiAnalysis.salesIntelligence.weakestBoxAr
                  : aiAnalysis.salesIntelligence.weakestBox}
              </div>
              <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                {language === 'ar'
                  ? aiAnalysis.salesIntelligence.runRateAlertAr
                  : aiAnalysis.salesIntelligence.runRateAlert}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar'
                  ? aiAnalysis.salesIntelligence.strategicActionsAr
                  : aiAnalysis.salesIntelligence.strategicActions
                ).map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'رؤى العملاء والشكاوى' : 'Customer Insights'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {language === 'ar'
                  ? aiAnalysis.customerInsights.agingSummaryAr
                  : aiAnalysis.customerInsights.agingSummary}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar'
                  ? aiAnalysis.customerInsights.recurringRootCausesAr
                  : aiAnalysis.customerInsights.recurringRootCauses
                ).map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interactive Action Plan Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('aiActionPlanTitle')}
                </h2>
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-500">
                  ({resolvedCount}/{totalCount})
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {displayedActionPlan.length} {t('rowsLabel')}
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#092d52] text-white">
                  <tr>
                    {visibleCols.map((col) => (
                      <th
                        key={col.key}
                        className="py-2.5 px-3.5 text-start font-semibold whitespace-nowrap"
                      >
                        {language === 'ar' ? col.labelAr : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedActionPlan.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        item.isCompleted ? 'opacity-60' : ''
                      }`}
                    >
                      {visibleCols.map((col) => {
                        if (col.key === 'done') {
                          return (
                            <td key={col.key} className="py-3 px-3.5">
                              <button
                                type="button"
                                onClick={() => toggleActionPlanItem(item.id)}
                                aria-label={t('markActionComplete')}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                                  item.isCompleted
                                    ? 'bg-teal-600 border-teal-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-teal-500'
                                }`}
                              >
                                {item.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        }
                        if (col.key === 'priority') {
                          return (
                            <td key={col.key} className="py-3 px-3.5 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  item.priority === 'Critical'
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                    : item.priority === 'High'
                                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {item.priority}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'issue') {
                          return (
                            <td
                              key={col.key}
                              className="py-3 px-3.5 font-semibold text-slate-900 dark:text-white"
                            >
                              {language === 'ar' ? item.issueAr : item.issue}
                            </td>
                          );
                        }
                        if (col.key === 'evidence') {
                          return (
                            <td
                              key={col.key}
                              className="py-3 px-3.5 text-slate-600 dark:text-slate-400 font-mono tabular-nums text-[11px]"
                            >
                              {language === 'ar' ? item.evidenceAr : item.evidence}
                            </td>
                          );
                        }
                        if (col.key === 'impact') {
                          return (
                            <td key={col.key} className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                              {language === 'ar' ? item.businessImpactAr : item.businessImpact}
                            </td>
                          );
                        }
                        if (col.key === 'action') {
                          return (
                            <td
                              key={col.key}
                              className="py-3 px-3.5 font-medium text-teal-700 dark:text-teal-300"
                            >
                              {language === 'ar' ? item.recommendedActionAr : item.recommendedAction}
                            </td>
                          );
                        }
                        if (col.key === 'owner') {
                          return (
                            <td
                              key={col.key}
                              className="py-3 px-3.5 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap"
                            >
                              {item.suggestedOwner}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col.key}
                            className="py-3 px-3.5 text-slate-500 font-mono tabular-nums text-[11px] whitespace-nowrap"
                          >
                            {item.suggestedDeadline}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Add Diagnostic Action Item Modal (Strict 1-Column Inputs) */}
      {canEdit && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveAiTask}
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
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskPriority')}</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((p) => ({ ...p, priority: e.target.value as any }))
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
                  value={taskForm.owner}
                  onChange={(e) => setTaskForm((p) => ({ ...p, owner: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('businessDate')}</label>
                <input
                  type="date"
                  value={taskForm.date}
                  onChange={(e) => setTaskForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskNotes')}</label>
                <textarea
                  rows={2}
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm((p) => ({ ...p, notes: e.target.value }))}
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
                disabled={taskSaving}
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer disabled:opacity-50"
              >
                {taskSaving ? '...' : t('saveRecord')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
