import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { NavTab } from '../types';
import {
  CheckCircle2,
  Activity,
  TrendingUp,
  ArrowRight,
  Calendar,
  Target,
  HeartHandshake,
  Users,
  ShieldAlert,
  Sparkles,
  Download,
  MessageSquareWarning,
  X,
  Lock,
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
import { apiDownloadFile, buildQueryParams } from '../services/apiClient';
import type { TaskCategory, TaskPriority, TaskStatus } from '../types';

const DASHBOARD_COLUMNS = [
  { key: 'title', label: 'Task / Agent', labelAr: 'المهمة / الموظف' },
  { key: 'owner', label: 'Owner / SID', labelAr: 'المسؤول / SID' },
  { key: 'date', label: 'Date / Score', labelAr: 'التاريخ / النسبة' },
  { key: 'status', label: 'Status', labelAr: 'الحالة' },
];

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const {
    t,
    language,
    user,
    canEdit,
    currentBranch,
    dashboardData,
    selectedBranchCode,
    dateRange,
    overallHealthScore,
    weakestHealthArea,
    criticalAlerts,
    salesBoxes,
    tasks,
    employees,
    cases,
    addTask,
    updateTaskStatus,
  } = useApp();

  const [showWeaknessModal, setShowWeaknessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => DASHBOARD_COLUMNS.map((c) => c.key));

  // Quick Add Record (Store Task) single-column modal
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('store');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskOwner, setNewTaskOwner] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(todayStr);
  const [newTaskNotes, setNewTaskNotes] = useState('');

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(DASHBOARD_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const visibleColsSet = useMemo(() => new Set(visibleColumns.map((c) => c.key)), [visibleColumns]);

  const openQuickAdd = () => {
    setNewTaskTitle('');
    setNewTaskCategory('store');
    setNewTaskPriority('medium');
    setNewTaskOwner(currentBranch?.manager || '');
    setNewTaskDate(todayStr);
    setNewTaskNotes('');
    setAddError(null);
    setShowAddModal(true);
  };

  const handleSaveQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newTaskTitle.trim()) return;
    setSavingAdd(true);
    setAddError(null);
    try {
      await addTask({
        date: newTaskDate || todayStr,
        agentName: '',
        title: newTaskTitle.trim(),
        titleAr: newTaskTitle.trim(),
        description: '',
        category: newTaskCategory,
        subcategory: '',
        owner: newTaskOwner.trim(),
        priority: newTaskPriority,
        status: 'not_started' as TaskStatus,
        deadline: newTaskDate || todayStr,
        notes: newTaskNotes.trim(),
        evidenceText: '',
      });
      setShowAddModal(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to save record.');
    } finally {
      setSavingAdd(false);
    }
  };

  const filteredDashboardTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = tasks.filter((task) => {
      if (!matchesDateRange(task.date || task.deadline, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        (task.titleAr || '').toLowerCase().includes(q) ||
        (task.owner || '').toLowerCase().includes(q) ||
        task.status.toLowerCase().includes(q)
      );
    });
    const limited = applyRowControls(list, rowLimit > 0 ? rowLimit : 6, sortOrder, (item) => item.date || item.deadline || '');
    return rowLimit === 0 ? list.slice(0, 10) : limited;
  }, [tasks, searchQuery, dateRange.fromDate, dateRange.toDate, rowLimit, sortOrder]);

  const filteredTopAgents = useMemo(() => {
    const list = dashboardData?.agents || [];
    const q = searchQuery.trim().toLowerCase();
    const matched = !q
      ? list
      : list.filter(
          (ag) =>
            ag.agentName.toLowerCase().includes(q) ||
            (ag.sid || '').toLowerCase().includes(q)
        );
    return rowLimit > 0 ? matched.slice(0, rowLimit) : matched.slice(0, 10);
  }, [dashboardData?.agents, searchQuery, rowLimit]);

  const scopeBranchParam =
    user?.role === 'AREA_MANAGER'
      ? selectedBranchCode || undefined
      : user?.branchCode || undefined;

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    if (opts.rowScope === 'all' && opts.colScope === 'all' && !opts.searchText.trim()) {
      const qs = buildQueryParams({
        branchCode: scopeBranchParam,
        fromDate: opts.fromDate || undefined,
        toDate: opts.toDate || undefined,
        format: 'xlsx',
      });
      await apiDownloadFile(`/api/v1/store-tasks/export${qs}`, 'dashboard_tasks.xlsx');
      return;
    }

    const q = opts.searchText.trim().toLowerCase();
    const sourceTasks = opts.rowScope === 'all' ? tasks : filteredDashboardTasks;
    const filteredList = sourceTasks.filter((task) => {
      if (!matchesDateRange(task.date || task.deadline, opts.fromDate, opts.toDate)) {
        return false;
      }
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        (task.titleAr || '').toLowerCase().includes(q) ||
        (task.owner || '').toLowerCase().includes(q) ||
        task.status.toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleColumns : DASHBOARD_COLUMNS;
    const rows = filteredList.map((task) => {
      const out: Record<string, unknown> = { 'Store ID': task.branchCode };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr : col.label;
        if (col.key === 'title') out[header] = language === 'ar' ? task.titleAr || task.title : task.title;
        else if (col.key === 'owner') out[header] = task.owner || '';
        else if (col.key === 'date') out[header] = task.date || task.deadline;
        else if (col.key === 'status') out[header] = task.status;
      }
      return out;
    });
    await downloadXlsxSheet('dashboard_tasks.xlsx', 'Dashboard', rows);
  };

  // Grounded weaknesses action plan derived strictly from live database records
  const weaknessPlanItems = useMemo(() => {
    const items: Array<{
      domain: string;
      domainAr: string;
      issue: string;
      issueAr: string;
      action: string;
      actionAr: string;
      priority: 'Critical' | 'High' | 'Medium';
    }> = [];

    if (dashboardData?.weakestPillar && (dashboardData.weakestPillar.achievement ?? 100) < 100) {
      items.push({
        domain: 'Store RPM',
        domainAr: 'ركائز المبيعات',
        issue: `${dashboardData.weakestPillar.pillar} below 100% (${dashboardData.weakestPillar.achievement}%)`,
        issueAr: `ركيزة ${dashboardData.weakestPillar.pillar} أقل من 100% (${dashboardData.weakestPillar.achievement}%)`,
        action: 'Open Action Plans and assign daily agent targets for lagging pillar.',
        actionAr: 'تفعيل خطة عمل وتوزيع مستهدفات يومية للموظفين على الركيزة الأضعف.',
        priority: 'High',
      });
    }

    salesBoxes.forEach((b) => {
      const ach = b.target > 0 ? (b.actual / b.target) * 100 : 100;
      if (b.target > 0 && ach < 75) {
        const rem = Math.max(0, b.target - b.actual);
        const daily = Math.ceil(rem / Math.max(1, b.remainingWorkingDays));
        items.push({
          domain: 'Sales Boxes',
          domainAr: 'صناديق المبيعات',
          issue: `${b.name} at ${Math.round(ach)}% (${b.actual}/${b.target})`,
          issueAr: `صندوق ${b.nameAr || b.name} عند ${Math.round(ach)}% (${b.actual}/${b.target})`,
          action: `Maintain daily run rate of ${daily} ${b.unit}/day across remaining days.`,
          actionAr: `تحقيق معدل يومي ${daily} ${b.unitAr || b.unit}/يوم في الأيام المتبقية.`,
          priority: 'High',
        });
      }
    });

    tasks
      .filter((task) => task.status === 'blocked')
      .forEach((task) => {
        items.push({
          domain: 'Store Tasks',
          domainAr: 'مهام الفرع',
          issue: `Blocked Task: ${task.title}`,
          issueAr: `مهمة معطلة: ${task.titleAr || task.title}`,
          action: task.notes || 'Coordinate blocker resolution immediately.',
          actionAr: task.notes || 'حل العائق التشغيلي مع الفريق المعني فوراً.',
          priority: 'Critical',
        });
      });

    const lowStaff = employees.filter(
      (e) =>
        (e.productKnowledgeScore !== null && e.productKnowledgeScore < 75) ||
        (e.productivityScore !== null && e.productivityScore < 75)
    );
    if (lowStaff.length > 0) {
      items.push({
        domain: 'Team Coaching',
        domainAr: 'تطوير الفريق',
        issue: `${lowStaff.length} staff members with score < 75%`,
        issueAr: `${lowStaff.length} موظفين بدرجة تقييم أقل من 75%`,
        action: `Schedule 1-on-1 coaching starting with ${lowStaff[0].name}.`,
        actionAr: `عقد جلسات توجيه فردية بدءاً من ${lowStaff[0].nameAr || lowStaff[0].name}.`,
        priority: 'Medium',
      });
    }

    const repeated = cases.filter((c) => c.isRepeated);
    if (repeated.length > 0) {
      items.push({
        domain: 'Complaints',
        domainAr: 'الشكاوى',
        issue: `Repeated complaint category: ${repeated[0].issueCategory}`,
        issueAr: `شكوى متكررة: ${repeated[0].issueCategoryAr || repeated[0].issueCategory}`,
        action: repeated[0].correctiveAction || 'Execute root cause remediation check.',
        actionAr: repeated[0].correctiveAction || 'تنفيذ فحص السبب الجذري وتصحيح المسار.',
        priority: 'High',
      });
    }

    return items;
  }, [dashboardData, salesBoxes, tasks, employees, cases]);

  const tnpsScore = dashboardData?.tnps.latestScore ?? null;
  const tnpsBenchmark = dashboardData?.tnps.benchmark ?? 70;
  const fyOverall = dashboardData?.overallAchievement ?? null;
  const opsPercent = dashboardData?.operations.completionPercent ?? null;

  return (
    <div className="space-y-5 content-container">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
          {currentBranch ? (
            <>
              <span className="font-mono font-bold text-white bg-[#092d52] px-2 py-0.5 rounded">
                Store ID: {currentBranch.code}
              </span>
              <span>·</span>
              <span>{language === 'ar' ? currentBranch.cityAr : currentBranch.city}</span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono-numbers">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {currentBranch.businessDate}
              </span>
            </>
          ) : (
            <span className="font-semibold text-[#092d52] dark:text-teal-400">
              {user?.role === 'AREA_MANAGER'
                ? `${t('allAuthorizedBranches')} (${user.authorizedBranches.length})`
                : t('unconfiguredLabel')}
            </span>
          )}
        </div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('dashboardTitle')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('dashboardSubtitle')}
          {dashboardData?.fiscalYear && (
            <span className="ms-2 font-mono text-[11px]">
              (FY {dashboardData.fiscalYear.startDate} → {dashboardData.fiscalYear.endDate})
            </span>
          )}
        </p>
      </div>

      {/* Single-Row Area / Branch / Date Filter & Action Bar */}
      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        showDateFilters
        onAddNew={canEdit ? openQuickAdd : undefined}
        addLabel={t('addRecord')}
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={searchQuery}
          />
        }
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <ColumnControlMenu
              columns={DASHBOARD_COLUMNS}
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
                setColOrder(DASHBOARD_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openQuickAdd : undefined}
              totalRowsCount={tasks.length}
            />

            <button
              type="button"
              onClick={() => setShowWeaknessModal(true)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{t('weaknessesPlanBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('target-calc')}
              className="inline-flex items-center gap-1.5 px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>{t('navTargetCalc')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tnps-calc')}
              className="inline-flex items-center gap-1.5 px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
              <span>{t('navTnpsCalc')}</span>
            </button>
          </div>
        }
      />

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3.5">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {t('priorityAlerts')} ({criticalAlerts.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criticalAlerts.slice(0, 4).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  if (alert.type === 'task') setActiveTab('operations');
                  else if (alert.type === 'case') setActiveTab('complaints');
                  else setActiveTab('sales');
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-xs hover:border-rose-400 cursor-pointer text-start"
              >
                <span className="font-medium truncate">
                  {language === 'ar' ? alert.titleAr : alert.title}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180 shrink-0 ms-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* FY YTD Pillar Average */}
        <div
          onClick={() => setActiveTab('store-rpm')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-[#092d52]"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold truncate">
              {language === 'ar' ? 'إنجاز ركائز السنة' : 'FY Pillar Avg'}
            </span>
            <TrendingUp className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono-numbers">
            {fyOverall === null ? (
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {t('unconfiguredLabel')}
              </span>
            ) : (
              `${fyOverall}%`
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            {dashboardData?.passedCount ?? 0} / {dashboardData?.pillarCount ?? 5}{' '}
            {language === 'ar' ? 'ركائز محققة >= 100%' : 'pillars passed'}
          </div>
        </div>

        {/* Operations Tasks */}
        <div
          onClick={() => setActiveTab('operations')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-teal-500"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold truncate">{t('completionRate')}</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono-numbers">
            {opsPercent === null ? (
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {t('unconfiguredLabel')}
              </span>
            ) : (
              `${opsPercent}%`
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            {dashboardData?.operations.completed ?? 0} / {dashboardData?.operations.total ?? 0}{' '}
            {t('completedTasks')}
          </div>
        </div>

        {/* Latest TNPS (Never hardcoded 65%) */}
        <div
          onClick={() => setActiveTab('tnps-store')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-rose-500"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold truncate">TNPS</span>
            <HeartHandshake className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono-numbers">
            {tnpsScore === null ? (
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {t('unconfiguredLabel')}
              </span>
            ) : (
              `${tnpsScore}%`
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 font-mono">
            {language === 'ar' ? 'المعيار:' : 'Target:'} {tnpsBenchmark}%
          </div>
        </div>

        {/* Open Complaints */}
        <div
          onClick={() => setActiveTab('complaints')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-amber-500"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold truncate">{t('pendingCustomerCases')}</span>
            <MessageSquareWarning className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono-numbers">
            {dashboardData?.openComplaintsCount ?? 0}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            {dashboardData?.agentCount ?? 0}{' '}
            {language === 'ar' ? 'موظفاً مسجلاً' : 'active agents'}
          </div>
        </div>

        {/* Branch Health */}
        <div
          onClick={() => setActiveTab('health')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-blue-500 col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold truncate">{t('branchHealthScore')}</span>
            <Activity className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono-numbers">
              {overallHealthScore}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 truncate">
            {weakestHealthArea
              ? `${language === 'ar' ? 'الأضعف:' : 'Focus:'} ${
                  language === 'ar' ? weakestHealthArea.nameAr : weakestHealthArea.name
                }`
              : t('unconfiguredLabel')}
          </div>
        </div>
      </div>

      {/* FY Pillar Progress Breakdown */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {language === 'ar'
              ? 'أداء ركائز الفرع (متوسط السنة المالية)'
              : 'FY Pillar Achievement Progress'}
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('store-rpm')}
            className="text-xs font-semibold text-[#092d52] dark:text-teal-400 flex items-center gap-1 cursor-pointer"
          >
            <span>{t('navStoreRpm')}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(dashboardData?.pillars || []).map((p) => (
            <div
              key={p.pillar}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {p.pillar}
                </span>
                {p.achievement === null ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {t('unconfiguredLabel')}
                  </span>
                ) : (
                  <span
                    className={`font-mono font-bold ${
                      p.passed ? 'text-emerald-600' : 'text-[#092d52] dark:text-teal-300'
                    }`}
                  >
                    {p.achievement}%
                  </span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    p.achievement === null
                      ? 'bg-slate-300 dark:bg-slate-600'
                      : p.passed
                        ? 'bg-emerald-500'
                        : 'bg-[#092d52] dark:bg-teal-400'
                  }`}
                  style={{
                    width: `${
                      p.achievement === null ? 0 : Math.min(100, Math.max(0, p.achievement))
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 10 Agents + Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Agents */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h2 className="text-xs sm:text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
              <span>{language === 'ar' ? 'أفضل 10 موظفين (RPM)' : 'Top 10 Agents (RPM)'}</span>
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('agent-rpm')}
              className="text-xs font-semibold text-[#092d52] dark:text-teal-400 cursor-pointer"
            >
              {t('navAgentRpm')}
            </button>
          </div>

          {!dashboardData || filteredTopAgents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {language === 'ar'
                ? 'لا توجد سجلات Agent RPM مسجلة بعد.'
                : 'No Agent RPM records recorded yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTopAgents.map((ag, idx) => (
                <div
                  key={`${ag.agentName}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                >
                  <div className="min-w-0">
                    {visibleColsSet.has('title') && (
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {idx + 1}. {ag.agentName}
                      </div>
                    )}
                    {visibleColsSet.has('owner') && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        SID: {ag.sid || '—'} · {ag.passedCount}/{ag.pillarCount} passed
                      </div>
                    )}
                  </div>
                  {visibleColsSet.has('date') && (
                    <div className="font-mono font-bold text-[#092d52] dark:text-teal-300">
                      {ag.avgAchievement === null ? t('unconfiguredLabel') : `${ag.avgAchievement}%`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store Tasks Checklist */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h2 className="text-xs sm:text-sm font-bold">
              {language === 'ar' ? 'مهام الفرع النشطة' : 'Active Store Tasks'}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className="text-xs font-semibold text-[#092d52] dark:text-teal-400 cursor-pointer"
            >
              {language === 'ar' ? 'عرض الكل' : 'View All'}
            </button>
          </div>

          {filteredDashboardTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا توجد مهام مسجلة حالياً.' : 'No store tasks logged yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDashboardTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 text-xs gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        canEdit &&
                        updateTaskStatus(
                          task.id,
                          task.status === 'completed' ? 'in_progress' : 'completed'
                        )
                      }
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                        task.status === 'completed'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      } ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : !canEdit ? (
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                      ) : null}
                    </button>
                    <div className="min-w-0">
                      {visibleColsSet.has('title') && (
                        <div
                          className={`font-semibold truncate ${
                            task.status === 'completed'
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {language === 'ar' ? task.titleAr || task.title : task.title}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 truncate">
                        {visibleColsSet.has('owner') ? task.owner || '—' : ''}
                        {visibleColsSet.has('owner') && visibleColsSet.has('date') ? ' · ' : ''}
                        {visibleColsSet.has('date') ? task.date : ''}
                      </div>
                    </div>
                  </div>
                  {visibleColsSet.has('status') && (
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                      {task.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weaknesses Action Plan Modal (preserved from ReportCenterView) */}
      {showWeaknessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 bg-[#092d52] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">{t('weaknessesPlanBtn')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWeaknessModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {weaknessPlanItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  {language === 'ar'
                    ? 'لا توجد نقاط ضعف حرجة مرصودة حالياً في السجلات.'
                    : 'No lagging weaknesses detected across current branch records.'}
                </div>
              ) : (
                weaknessPlanItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#092d52] dark:text-teal-300">
                        {language === 'ar' ? item.domainAr : item.domain}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {item.priority}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? item.issueAr : item.issue}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      {language === 'ar' ? item.actionAr : item.action}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={async () => {
                  const rows = weaknessPlanItems.map((it) => ({
                    Domain: language === 'ar' ? it.domainAr : it.domain,
                    Priority: it.priority,
                    Issue: language === 'ar' ? it.issueAr : it.issue,
                    Action: language === 'ar' ? it.actionAr : it.action,
                  }));
                  await downloadXlsxSheet('weaknesses_action_plan.xlsx', 'Weaknesses', rows);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('downloadExcel')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWeaknessModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#092d52] text-white cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Record Modal — Strict Single Column */}
      {canEdit && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveQuickTask}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('addRecord')} — {t('navOperations')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('taskTitle')} *</label>
                <input
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('taskCategory')}</label>
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="store">{t('storeOps')}</option>
                  <option value="financial">{t('financialOps')}</option>
                  <option value="contracts">{t('contractsOps')}</option>
                  <option value="customer">{t('customerOps')}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('taskPriority')}</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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
                  value={newTaskOwner}
                  onChange={(e) => setNewTaskOwner(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('businessDate')}</label>
                <input
                  type="date"
                  required
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('taskNotes')}</label>
                <textarea
                  rows={2}
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>
              {addError && <div className="text-rose-600 font-semibold">{addError}</div>}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="px-4 min-h-[38px] rounded-xl bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {savingAdd ? '...' : t('saveRecord')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
