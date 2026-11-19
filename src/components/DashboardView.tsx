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
import { apiDownloadFile, buildQueryParams } from '../services/apiClient';

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
    updateTaskStatus,
  } = useApp();

  const [showWeaknessModal, setShowWeaknessModal] = useState(false);

  const scopeBranchParam =
    user?.role === 'AREA_MANAGER'
      ? selectedBranchCode || undefined
      : user?.branchCode || undefined;

  const handleExportTasks = async (format: 'csv' | 'xlsx') => {
    const qs = buildQueryParams({
      branchCode: scopeBranchParam,
      fromDate: dateRange.fromDate || undefined,
      toDate: dateRange.toDate || undefined,
      format,
    });
    await apiDownloadFile(`/api/v1/store-tasks/export${qs}`, `dashboard_tasks.${format}`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowWeaknessModal(true)}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t('weaknessesPlanBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('target-calc')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            <span>{t('navTargetCalc')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tnps-calc')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>{t('navTnpsCalc')}</span>
          </button>
        </div>
      </div>

      {/* Area / Branch / Date Filter Bar */}
      <FilterBar
        showSearch={false}
        showDateFilters
        onExportCsv={() => handleExportTasks('csv')}
        onExportXlsx={() => handleExportTasks('xlsx')}
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

          {!dashboardData || dashboardData.agents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {language === 'ar'
                ? 'لا توجد سجلات Agent RPM مسجلة بعد.'
                : 'No Agent RPM records recorded yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {dashboardData.agents.slice(0, 10).map((ag, idx) => (
                <div
                  key={`${ag.agentName}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {idx + 1}. {ag.agentName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      SID: {ag.sid || '—'} · {ag.passedCount}/{ag.pillarCount} passed
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#092d52] dark:text-teal-300">
                    {ag.avgAchievement === null ? t('unconfiguredLabel') : `${ag.avgAchievement}%`}
                  </div>
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

          {tasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا توجد مهام مسجلة حالياً.' : 'No store tasks logged yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 6).map((task) => (
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
                      <div
                        className={`font-semibold truncate ${
                          task.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {language === 'ar' ? task.titleAr || task.title : task.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {task.owner || '—'} · {task.date}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                    {task.status}
                  </span>
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
                onClick={() => handleExportTasks('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('exportCsv')}</span>
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
    </div>
  );
};
