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
  BarChart3,
  Calendar,
  Target,
  HeartHandshake,
  Users,
} from 'lucide-react';

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
  onOpenQuickTask?: () => void;
  onOpenQuickCoaching?: () => void;
  onOpenQuickSale?: () => void;
  onOpenQuickCase?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
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

  // Weakest sales box
  const sortedBoxes = [...salesBoxes].sort((a, b) => {
    const achA = a.target > 0 ? a.actual / a.target : 1;
    const achB = b.target > 0 ? b.actual / b.target : 1;
    return achA - achB;
  });
  const prioritySalesBox = sortedBoxes[0];

  return (
    <div className="space-y-5 content-container">
      {/* 1. Clean Header Banner & Situational Awareness */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded">
              Store ID: {currentBranch?.code}
            </span>
            <span>·</span>
            <span>{currentBranch?.city}</span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono-numbers">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {currentBranch?.businessDate}
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
            {language === 'ar' ? currentBranch?.nameAr || currentBranch?.name : currentBranch?.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'ar'
              ? 'موجز تشغيلي فوري شامل لأداء الفرع، التارجت، ورضا العملاء'
              : 'Real-time 60-second operational situational overview across all branch functions'}
          </p>
        </div>

        {/* Direct Navigation Shortcut Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('target_calc')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1.5 hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'حاسبة التارجت' : 'Target Calc'}</span>
          </button>
          <button
            onClick={() => setActiveTab('tnps_calc')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>TNPS Calc</span>
          </button>
        </div>
      </div>

      {/* 2. Critical Alerts Bar (if blockers or escalations exist) */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3.5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{t('priorityAlerts')} ({criticalAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criticalAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.type === 'task') setActiveTab('operations');
                  else if (alert.type === 'case') setActiveTab('customer');
                  else if (alert.type === 'sales') setActiveTab('target_calc');
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800 text-xs hover:border-rose-400 transition-all cursor-pointer group"
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

      {/* 3. Primary Metrics Grid (Fluid and Auto-Fitting) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Operations Completion */}
        <div
          onClick={() => setActiveTab('operations')}
          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="font-semibold truncate">{t('completionRate')}</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono-numbers text-slate-900 dark:text-white">
              {opsCompletionPercentage}%
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              ({completedTasksCount}/{totalTasksCount})
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${opsCompletionPercentage}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className={overdueTasksCount > 0 ? 'text-rose-500 font-bold' : ''}>
              {overdueTasksCount} {t('overdueTasks')}
            </span>
            <span>{pendingTasksCount} {t('pendingTasks')}</span>
          </div>
        </div>

        {/* Branch Health Score */}
        <div
          onClick={() => setActiveTab('health')}
          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="font-semibold truncate">{t('branchHealthScore')}</span>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono-numbers text-slate-900 dark:text-white">
              {overallHealthScore}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">/ 100</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallHealthScore >= 80 ? 'bg-emerald-500' : overallHealthScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${overallHealthScore}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {weakestHealthArea ? (
              <span>
                {language === 'ar' ? 'الأضعف: ' : 'Lagging: '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? weakestHealthArea.nameAr : weakestHealthArea.name}
                </strong>
              </span>
            ) : (
              <span>On Target</span>
            )}
          </div>
        </div>

        {/* Sales Target Projection */}
        <div
          onClick={() => setActiveTab('target_calc')}
          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="font-semibold truncate">{language === 'ar' ? 'التارجت المتوقع' : 'Sales Projection'}</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono-numbers text-slate-900 dark:text-white">
              {salesOverallAchievement}%
            </span>
            <span className="text-[10px] text-teal-600 font-mono font-bold">RE %</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, salesOverallAchievement)}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {prioritySalesBox ? (
              <span>Focus: <strong className="text-slate-700 dark:text-slate-300">{prioritySalesBox.name}</strong></span>
            ) : (
              <span>All boxes healthy</span>
            )}
          </div>
        </div>

        {/* TNPS & Staff */}
        <div
          onClick={() => setActiveTab('tnps_calc')}
          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="font-semibold truncate">TNPS Satisfaction</span>
            <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono-numbers text-rose-600 dark:text-rose-400">
              65%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Target: 70%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: '65%' }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>{employees.length} {language === 'ar' ? 'موظفين' : 'staff'}</span>
            <span className="text-teal-600 font-medium">Daily Track active</span>
          </div>
        </div>
      </div>

      {/* 4. Active Shift Checklist & Direct Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (2 cols): Shift Tasks */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'مهام الوردية المباشرة' : "Shift Operational Checklist"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {completedTasksCount} / {totalTasksCount} verified
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

          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'in_progress' : 'completed')}
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
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
                        task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {language === 'ar' ? task.titleAr || task.title : task.title}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{task.owner}</span>
                      <span>·</span>
                      <span className="capitalize">{task.category}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded shrink-0 font-bold ${
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
            ))}
          </div>
        </div>

        {/* Right (1 col): Fast Module Jump Cards */}
        <div className="space-y-3">
          <div
            onClick={() => setActiveTab('target_calc')}
            className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-200 dark:border-teal-800 cursor-pointer hover:border-teal-400 transition-all shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                {language === 'ar' ? 'حاسبة التارجت المعتمدة' : 'Authoritative Target Engine'}
              </span>
              <Target className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
              {language === 'ar'
                ? 'تعديل مستهدفات الصناديق الخمسة، حساب الـ RE % وتوليد رسالة الواتساب اليومية.'
                : 'Manage 5 sales boxes, live RE % projections, and instant WhatsApp store reports.'}
            </p>
            <div className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
              <span>{language === 'ar' ? 'فتح الحاسبة' : 'Open Calculator'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('tnps_calc')}
            className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-200 dark:border-rose-800 cursor-pointer hover:border-rose-400 transition-all shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                {language === 'ar' ? 'حاسبة الـ TNPS اليومية' : 'Daily TNPS Tracker'}
              </span>
              <HeartHandshake className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
              {language === 'ar'
                ? 'رصد أصوات العملاء، حساب المطلوب للوصول لمستهدف 70% وتراكمي الشهر.'
                : 'Log customer responses, calculate required promoters, and view monthly cumulative score.'}
            </p>
            <div className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <span>{language === 'ar' ? 'فتح حاسبة الـ TNPS' : 'Open TNPS'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('staff')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-400 transition-all shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {language === 'ar' ? 'سجل فريق العمل' : 'Staff Roster'}
              </span>
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              {employees.length} {language === 'ar' ? 'موظفاً مسجلين ومحفوظين في الفرع.' : 'employees recorded permanently.'}
            </p>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span>{language === 'ar' ? 'عرض السجل' : 'View Roster'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
