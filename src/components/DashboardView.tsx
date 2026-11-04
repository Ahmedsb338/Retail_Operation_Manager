import React from 'react';
import { useApp } from '../context/AppContext';
import { NavTab } from './Navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  TrendingUp,
  UserCheck,
  LifeBuoy,
  ShieldAlert,
  ArrowRight,
  Plus,
  Flame,
  CheckSquare,
  Sparkles,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
  onOpenQuickTask: () => void;
  onOpenQuickCoaching: () => void;
  onOpenQuickSale: () => void;
  onOpenQuickCase: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onOpenQuickTask,
  onOpenQuickCoaching,
  onOpenQuickSale,
  onOpenQuickCase,
}) => {
  const {
    t,
    language,
    currentBranch,
    opsCompletionPercentage,
    totalTasksCount,
    completedTasksCount,
    pendingTasksCount,
    overdueTasksCount,
    blockedTasksCount,
    criticalAlerts,
    overallHealthScore,
    weakestHealthArea,
    salesOverallAchievement,
    salesBoxes,
    employeesNeedingCoachingCount,
    employees,
    pendingCasesCount,
    repeatedCasesCount,
    tasks,
    updateTaskStatus,
  } = useApp();

  // Weakest sales box requiring focus
  const sortedBoxes = [...salesBoxes].sort((a, b) => {
    const achA = a.target > 0 ? a.actual / a.target : 1;
    const achB = b.target > 0 ? b.actual / b.target : 1;
    return achA - achB;
  });
  const prioritySalesBox = sortedBoxes[0];

  // Employees needing coaching
  const coachees = employees.filter(
    (e) =>
      e.coachingStatus === 'needs_coaching' ||
      e.productKnowledgeScore < 75 ||
      e.productivityScore < 75 ||
      e.customerExperienceScore < 75
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Situational Awareness */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{language === 'ar' ? currentBranch?.cityAr : currentBranch?.city}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {currentBranch?.businessDate}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {language === 'ar' ? currentBranch?.nameAr : currentBranch?.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('dashboardSubtitle')}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenQuickTask}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addTaskQuick')}</span>
          </button>
          <button
            onClick={onOpenQuickCoaching}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>{t('logCoachingQuick')}</span>
          </button>
          <button
            onClick={onOpenQuickCase}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('newCaseQuick')}</span>
          </button>
        </div>
      </div>

      {/* 2. Critical Alerts Bar (if any critical tasks, blockers or escalations exist) */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{t('priorityAlerts')} ({criticalAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criticalAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.type === 'task') setActiveTab('operations');
                  else if (alert.type === 'case') setActiveTab('customer');
                  else if (alert.type === 'sales') setActiveTab('sales');
                }}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-200/60 dark:border-rose-800/50 text-xs hover:border-rose-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${alert.severity === 'critical' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {language === 'ar' ? alert.titleAr : alert.title}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 rtl:rotate-180 shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Primary 60-Second Dashboard Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Operations Completion */}
        <div
          onClick={() => setActiveTab('operations')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium">{t('completionRate')}</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono-numbers text-slate-900 dark:text-white">
              {opsCompletionPercentage}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({completedTasksCount}/{totalTasksCount})
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${opsCompletionPercentage}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className={overdueTasksCount > 0 ? 'text-rose-500 font-semibold' : ''}>
              {overdueTasksCount} {t('overdueTasks')}
            </span>
            <span>{pendingTasksCount} {t('pendingTasks')}</span>
          </div>
        </div>

        {/* Branch Health Score */}
        <div
          onClick={() => setActiveTab('health')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium">{t('branchHealthScore')}</span>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono-numbers text-slate-900 dark:text-white">
              {overallHealthScore}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallHealthScore >= 80 ? 'bg-emerald-500' : overallHealthScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${overallHealthScore}%` }}
            />
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {weakestHealthArea ? (
              <span>
                {language === 'ar' ? 'الأضعف: ' : 'Lagging: '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? weakestHealthArea.nameAr : weakestHealthArea.name}
                </strong>
              </span>
            ) : (
              <span>{t('dataUnavailable')}</span>
            )}
          </div>
        </div>

        {/* Sales Achievement % */}
        <div
          onClick={() => setActiveTab('sales')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium">{t('salesAchievement')}</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono-numbers text-slate-900 dark:text-white">
              {salesOverallAchievement}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({salesBoxes.length} {language === 'ar' ? 'صناديق' : 'boxes'})
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, salesOverallAchievement)}%` }}
            />
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {prioritySalesBox ? (
              <span>
                {language === 'ar' ? 'تركيز: ' : 'Focus: '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? prioritySalesBox.nameAr : prioritySalesBox.name}
                </strong>
              </span>
            ) : (
              <span>All boxes on track</span>
            )}
          </div>
        </div>

        {/* Team Coaching & Customer Cases */}
        <div
          onClick={() => setActiveTab('team')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium">{t('coachingRequired')}</span>
            <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono-numbers text-slate-900 dark:text-white">
              {employeesNeedingCoachingCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / {employees.length} {language === 'ar' ? 'موظف' : 'staff'}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${employees.length > 0 ? (employeesNeedingCoachingCount / employees.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{pendingCasesCount} {t('pendingCustomerCases')}</span>
            {repeatedCasesCount > 0 && (
              <span className="text-amber-600 font-medium">({repeatedCasesCount} repeat)</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Operational Completion & Sales Boxes Double Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Today's Active Tasks Tracker */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'مهام الوردية اليومية' : "Today's Operational Checklist"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {completedTasksCount} of {totalTasksCount} tasks verified and signed off
              </p>
            </div>
            <button
              onClick={() => setActiveTab('operations')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500 flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'ar' ? 'عرض الكل' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="space-y-2.5">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'in_progress' : 'completed')}
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
                      task.status === 'completed'
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : task.status === 'blocked'
                        ? 'border-rose-400 bg-rose-50 text-rose-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-teal-500'
                    }`}
                  >
                    {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <div className="min-w-0">
                    <div
                      className={`font-medium truncate ${
                        task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {language === 'ar' ? task.titleAr : task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{task.owner}</span>
                      <span>·</span>
                      <span className="capitalize">{task.category}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          task.priority === 'critical' ? 'text-rose-500' : task.priority === 'high' ? 'text-amber-500' : 'text-slate-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="shrink-0 text-end">
                  <span
                    className={`text-[11px] font-medium font-mono uppercase px-2 py-0.5 rounded ${
                      task.status === 'completed'
                        ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40'
                        : task.status === 'blocked'
                        ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40'
                        : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right (1 col): Sales Run Rate Snapshot */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'معدلات تشغيل المبيعات' : 'Sales Boxes Run Rates'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Remaining daily pace required
                </p>
              </div>
              <button
                onClick={() => setActiveTab('sales')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500 flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'ar' ? 'تفاصيل' : 'Details'}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>

            <div className="space-y-3">
              {salesBoxes.slice(0, 4).map((box) => {
                const achievement = box.target > 0 ? Math.round((box.actual / box.target) * 100) : 100;
                const remaining = Math.max(0, box.target - box.actual);
                const dailyRunRate = Math.ceil(remaining / Math.max(1, box.remainingWorkingDays));

                return (
                  <div key={box.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {language === 'ar' ? box.nameAr : box.name}
                      </span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {achievement}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${achievement >= 80 ? 'bg-teal-500' : achievement >= 55 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, achievement)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                      <span>{box.actual} / {box.target} {language === 'ar' ? box.unitAr : box.unit}</span>
                      <span className="text-teal-600 dark:text-teal-400 font-semibold">
                        {dailyRunRate}/day ({box.remainingWorkingDays}d left)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('ai')}
              className="w-full py-2.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تشغيل التشخيص الذكي' : 'Run AI Shift Diagnostic'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Team & Customer Quick Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coaching Focus */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('coachingPriorities')}
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('team')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500"
            >
              {language === 'ar' ? 'المخطط' : 'Planner'}
            </button>
          </div>

          {coachees.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">All team members currently meet performance thresholds (≥75%).</p>
          ) : (
            <div className="space-y-2.5">
              {coachees.slice(0, 3).map((emp) => (
                <div key={emp.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? emp.nameAr : emp.name}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2 font-mono">
                        ({emp.identifier}) · {language === 'ar' ? emp.roleAr : emp.role}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                      Needs Coaching
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                    <span>Knowledge: <strong className="text-slate-700 dark:text-slate-300">{emp.productKnowledgeScore}%</strong></span>
                    <span>Productivity: <strong className="text-slate-700 dark:text-slate-300">{emp.productivityScore}%</strong></span>
                    <span>CSAT: <strong className="text-slate-700 dark:text-slate-300">{emp.customerExperienceScore}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Operational Activity / Cases */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('recentActivity')}
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('customer')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500"
            >
              {language === 'ar' ? 'سجل الشكاوى' : 'Case Queue'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-slate-800 dark:text-slate-200 font-medium">Morning Cash Vault Reconciliation verified</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">By Tarek Zaki · Zero drawer discrepancies noted</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-slate-800 dark:text-slate-200 font-medium">Digital Cash Float Limit Reached (Blocked Task)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ticket #FL-0881 raised for regional cash carrier replenishment</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-slate-800 dark:text-slate-200 font-medium">SIM Replacement Biometric Issue Flagged</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Counter 2 scanner recurrent timeout · Assigned to Dina Farouk</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
