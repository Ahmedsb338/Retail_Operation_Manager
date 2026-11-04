import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  Building2,
  Clock,
  User,
  ShieldCheck,
  FileSpreadsheet,
  Sparkles,
  AlertTriangle,
  X,
  Target,
  HeartHandshake,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';

export type ReportType =
  | 'daily_ops'
  | 'weekly_summary'
  | 'monthly_review'
  | 'sales_performance'
  | 'coaching'
  | 'customer_experience'
  | 'pending_tasks'
  | 'branch_health';

export const ReportCenterView: React.FC = () => {
  const {
    t,
    language,
    currentBranch,
    tasks,
    salesBoxes,
    employees,
    cases,
    overallHealthScore,
    healthCategories,
    opsCompletionPercentage,
    completedTasksCount,
    totalTasksCount,
    overdueTasksCount,
    blockedTasksCount,
    salesOverallAchievement,
  } = useApp();

  const [selectedReport, setSelectedReport] = useState<ReportType>('daily_ops');
  const [dateRange, setDateRange] = useState('Today (2026-11-03)');
  const [showActionPlanModal, setShowActionPlanModal] = useState<boolean>(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Arabic support in Excel

    if (selectedReport === 'daily_ops' || selectedReport === 'pending_tasks') {
      csvContent += 'Task ID,Title,Category,Owner,Priority,Status,Deadline,Notes\n';
      const exportList = selectedReport === 'pending_tasks' ? tasks.filter((t) => t.status !== 'completed') : tasks;
      exportList.forEach((t) => {
        csvContent += `"${t.id}","${t.title}","${t.category}","${t.owner}","${t.priority}","${t.status}","${t.deadline}","${(t.notes || '').replace(/"/g, '""')}"\n`;
      });
    } else if (selectedReport === 'sales_performance') {
      csvContent += 'Box Name,Target,Actual,Achievement %,Remaining,Daily Run Rate,Unit\n';
      salesBoxes.forEach((b) => {
        const ach = b.target > 0 ? Math.round((b.actual / b.target) * 100) : 100;
        const rem = Math.max(0, b.target - b.actual);
        const drr = Math.ceil(rem / Math.max(1, b.remainingWorkingDays));
        csvContent += `"${b.name}",${b.target},${b.actual},${ach}%,${rem},${drr},"${b.unit}"\n`;
      });
    } else if (selectedReport === 'coaching') {
      csvContent += 'Identifier,Name,Role,Knowledge Score,Productivity Score,CSAT Score,Status,Follow-up Date\n';
      employees.forEach((e) => {
        csvContent += `"${e.identifier}","${e.name}","${e.role}",${e.productKnowledgeScore}%,${e.productivityScore}%,${e.customerExperienceScore}%,"${e.coachingStatus}","${e.followUpDate}"\n`;
      });
    } else if (selectedReport === 'customer_experience') {
      csvContent += 'Case #,Client ID,Category,Root Cause,Owner,Status,Created At,Corrective Action\n';
      cases.forEach((c) => {
        csvContent += `"${c.caseNumber}","${c.customerIdentifier}","${c.issueCategory}","${c.rootCause}","${c.assignedOwner}","${c.status}","${c.createdAt}","${(c.correctiveAction || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      csvContent += 'Health Category,Score,Weight %,Status,Details\n';
      healthCategories.forEach((h) => {
        csvContent += `"${h.name}",${h.score ?? 'N/A'},${h.weight}%,"${h.status}","${h.details.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentBranch?.code || 'BR'}_${selectedReport}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Weaknesses-Based Action Plan calculation
  const actionPlanItems = useMemo(() => {
    const items = [];

    // 1. Weakest sales boxes
    salesBoxes.forEach((b) => {
      const ach = b.target > 0 ? (b.actual / b.target) * 100 : 100;
      if (ach < 75) {
        const rem = Math.max(0, b.target - b.actual);
        const dailyReq = Math.ceil(rem / Math.max(1, b.remainingWorkingDays));
        items.push({
          domain: 'Sales Opportunities',
          domainAr: 'فرص المبيعات',
          issue: `Lagging Sales Target in ${b.name} (${Math.round(ach)}% achieved)`,
          issueAr: `عجز في مستهدف مبيعات صندوق ${b.nameAr || b.name} (${Math.round(ach)}% محقق)`,
          action: `Deploy floor specialist focus; target minimum daily run rate of ${dailyReq} ${b.unit}/day.`,
          actionAr: `توجيه استشاريي الصالة للتركيز على العروض؛ رفع معدل الإنجاز لـ ${dailyReq} ${b.unitAr || b.unit}/يوم.`,
          priority: 'High',
          owner: 'Sales Supervisor',
          deadline: 'End of Business Week',
        });
      }
    });

    // 2. Blocked or overdue operations
    const blocked = tasks.filter((t) => t.status === 'blocked');
    blocked.forEach((t) => {
      items.push({
        domain: 'Daily Operations',
        domainAr: 'العمليات والتشغيل',
        issue: `Operational Blocker: ${t.title}`,
        issueAr: `عائق تشغيلي نشط: ${t.titleAr || t.title}`,
        action: `Intervene with central team to resolve: ${t.notes || 'Clear dependency and release workflow.'}`,
        actionAr: `التدخل المباشر لحل المشكلة: ${t.notes || 'رفع العائق وتسهيل تدفق العمل.'}`,
        priority: 'Critical',
        owner: t.owner,
        deadline: 'Today',
      });
    });

    // 3. Coaching gaps
    const coachees = employees.filter((e) => e.coachingStatus === 'needs_coaching' || e.productKnowledgeScore < 75);
    if (coachees.length > 0) {
      items.push({
        domain: 'Team & Coaching',
        domainAr: 'تطوير الفريق',
        issue: `${coachees.length} employees requiring structured development`,
        issueAr: `${coachees.length} موظفين يحتاجون لجلسات تطوير ورفع كفاءة`,
        action: `Execute individual coaching on agreed growth areas: ${coachees[0].developmentAreas.slice(0, 2).join(', ') || 'Core products'}.`,
        actionAr: `عقد جلسات توجيه فردية على نقاط التطوير: ${coachees[0].developmentAreas.slice(0, 2).join('، ') || 'المنتجات الأساسية'}.`,
        priority: 'Medium',
        owner: currentBranch?.manager || 'Store Manager',
        deadline: 'Next 5 Days',
      });
    }

    // 4. Repeated customer cases
    const repeated = cases.filter((c) => c.isRepeated);
    if (repeated.length > 0) {
      items.push({
        domain: 'Customer Experience',
        domainAr: 'تجربة العملاء',
        issue: `Repeated Customer Incident: ${repeated[0].issueCategory}`,
        issueAr: `شكوى عملاء متكررة: ${repeated[0].issueCategoryAr || repeated[0].issueCategory}`,
        action: `Implement root cause corrective procedure: ${repeated[0].correctiveAction || 'Equipment inspection and process check.'}`,
        actionAr: `تطبيق الإجراء التصحيحي: ${repeated[0].correctiveAction || 'فحص الأجهزة وتصحيح مسار الإجراء.'}`,
        priority: 'High',
        owner: repeated[0].assignedOwner,
        deadline: 'Within 24 Hours',
      });
    }

    return items;
  }, [salesBoxes, tasks, employees, cases, currentBranch]);

  return (
    <div className="space-y-6 content-container">
      {/* Top Header (no-print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('reportsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('reportsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* User-Requested: Action Plan Button Based on Weaknesses */}
          <button
            onClick={() => setShowActionPlanModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm transition-all cursor-pointer active:scale-95"
            title="Generate Action Plan for Branch Weaknesses"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === 'ar' ? 'خطة العمل (نقاط الضعف)' : 'Weaknesses Action Plan'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('printReport')}</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs (no-print) */}
      <div className="no-print p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedReport('daily_ops')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer ${
              selectedReport === 'daily_ops'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('dailyOpsReport')}
          </button>
          <button
            onClick={() => setSelectedReport('sales_performance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer ${
              selectedReport === 'sales_performance'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('salesPerformanceReport')}
          </button>
          <button
            onClick={() => setSelectedReport('coaching')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer ${
              selectedReport === 'coaching'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('employeeCoachingReport')}
          </button>
          <button
            onClick={() => setSelectedReport('customer_experience')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer ${
              selectedReport === 'customer_experience'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('cxReport')}
          </button>
          <button
            onClick={() => setSelectedReport('branch_health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer ${
              selectedReport === 'branch_health'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('healthReport')}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-mono text-slate-500">{currentBranch?.businessDate}</span>
        </div>
      </div>

      {/* Printable Report Document Card (Fits Mobile & Desktop) */}
      <div className="p-5 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-slate-900 dark:text-slate-100 print:border-none print:shadow-none print:p-0 overflow-x-hidden">
        {/* Document Header */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900 dark:border-slate-100 mb-5 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-teal-600 dark:text-teal-400 font-bold">
              {t('confidentialReport')}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1 truncate">
              {selectedReport === 'daily_ops'
                ? t('dailyOpsReport')
                : selectedReport === 'sales_performance'
                ? t('salesPerformanceReport')
                : selectedReport === 'coaching'
                ? t('employeeCoachingReport')
                : selectedReport === 'customer_experience'
                ? t('cxReport')
                : t('healthReport')}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {currentBranch?.name} ({currentBranch?.code}) · {currentBranch?.city}
            </div>
          </div>

          <div className="text-end text-xs font-mono space-y-0.5 shrink-0">
            <div><strong>Date:</strong> {currentBranch?.businessDate}</div>
            <div><strong>Manager:</strong> {currentBranch?.manager}</div>
          </div>
        </div>

        {/* Content based on selection with table scrolling contained within card */}
        <div className="overflow-x-auto custom-scrollbar">
          {selectedReport === 'daily_ops' && (
            <div className="space-y-4 min-w-[500px]">
              <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-center font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px]">TOTAL</span>
                  <span className="text-sm font-bold">{totalTasksCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">COMPLETED</span>
                  <span className="text-sm font-bold text-teal-600">{completedTasksCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">OVERDUE</span>
                  <span className="text-sm font-bold text-rose-600">{overdueTasksCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">COMPLETION</span>
                  <span className="text-sm font-bold">{opsCompletionPercentage}%</span>
                </div>
              </div>

              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 text-start">Task Title</th>
                    <th className="py-2 text-start">Category</th>
                    <th className="py-2 text-start">Owner</th>
                    <th className="py-2 text-start">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/50">
                      <td className="py-2 font-medium text-slate-900 dark:text-white">{task.title}</td>
                      <td className="py-2 capitalize text-slate-500">{task.category}</td>
                      <td className="py-2">{task.owner}</td>
                      <td className="py-2 uppercase font-bold text-[10px]">
                        <span className={task.status === 'completed' ? 'text-teal-600' : task.status === 'blocked' ? 'text-rose-600' : 'text-amber-600'}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'sales_performance' && (
            <div className="space-y-4 min-w-[500px]">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 text-start">Box Name</th>
                    <th className="py-2 text-end">Target</th>
                    <th className="py-2 text-end">Actual</th>
                    <th className="py-2 text-end">Ach %</th>
                    <th className="py-2 text-end">Remaining</th>
                    <th className="py-2 text-end">Daily Run Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {salesBoxes.map((b) => {
                    const ach = b.target > 0 ? Math.round((b.actual / b.target) * 100) : 100;
                    const rem = Math.max(0, b.target - b.actual);
                    const runRate = Math.ceil(rem / Math.max(1, b.remainingWorkingDays));
                    return (
                      <tr key={b.id}>
                        <td className="py-2.5 font-sans font-bold text-slate-900 dark:text-white">{b.name}</td>
                        <td className="py-2.5 text-end">{b.target.toLocaleString()}</td>
                        <td className="py-2.5 text-end">{b.actual.toLocaleString()}</td>
                        <td className="py-2.5 text-end font-bold">{ach}%</td>
                        <td className="py-2.5 text-end">{rem.toLocaleString()}</td>
                        <td className="py-2.5 text-end font-bold text-teal-600">{runRate} / day</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'coaching' && (
            <div className="space-y-4 min-w-[500px]">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 text-start">Name</th>
                    <th className="py-2 text-start">Role</th>
                    <th className="py-2 text-end">Knowledge %</th>
                    <th className="py-2 text-end">Prod %</th>
                    <th className="py-2 text-end">CSAT %</th>
                    <th className="py-2 text-start">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{e.name}</td>
                      <td className="py-2.5 text-slate-500">{e.role}</td>
                      <td className="py-2.5 text-end font-mono">{e.productKnowledgeScore}%</td>
                      <td className="py-2.5 text-end font-mono">{e.productivityScore}%</td>
                      <td className="py-2.5 text-end font-mono">{e.customerExperienceScore}%</td>
                      <td className="py-2.5 capitalize">{e.coachingStatus.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'customer_experience' && (
            <div className="space-y-4 min-w-[500px]">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 text-start">Case #</th>
                    <th className="py-2 text-start">Category</th>
                    <th className="py-2 text-start">Root Cause</th>
                    <th className="py-2 text-start">Owner</th>
                    <th className="py-2 text-start">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {cases.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 font-mono font-bold">{c.caseNumber}</td>
                      <td className="py-2.5 font-medium">{c.issueCategory}</td>
                      <td className="py-2.5 text-slate-500">{c.rootCause}</td>
                      <td className="py-2.5">{c.assignedOwner}</td>
                      <td className="py-2.5 uppercase font-bold text-[10px]">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'branch_health' && (
            <div className="space-y-4 min-w-[500px]">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center font-mono">
                <span className="text-slate-400 block text-[10px]">BRANCH HEALTH INDEX</span>
                <span className="text-2xl font-black text-teal-600">{overallHealthScore} / 100</span>
              </div>

              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 text-start">Category</th>
                    <th className="py-2 text-end">Score</th>
                    <th className="py-2 text-end">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {healthCategories.map((h) => (
                    <tr key={h.key}>
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">{h.name}</td>
                      <td className="py-2.5 text-end font-mono font-bold">{h.score ?? 'N/A'}</td>
                      <td className="py-2.5 text-end font-mono">{h.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Document Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs text-slate-400">
          <div>
            <div>Branch Manager Sign-off: ________________________</div>
          </div>
          <div className="text-end font-mono text-[10px]">
            Doc Ref: {currentBranch?.code}-{selectedReport.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Action Plan Modal Based on Weaknesses (User-Requested) */}
      {showActionPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-amber-500/10 text-amber-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'خطة العمل الفورية لمعالجة نقاط الضعف' : 'Immediate Branch Weakness Action Plan'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ar' ? 'تم توليدها تلقائياً بالاعتماد على الفجوات البيعية والتشغيلية المرصودة' : 'Dynamically compiled from detected sales deficits, blockers, and coaching needs'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowActionPlanModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {actionPlanItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ {language === 'ar' ? 'لا توجد نقاط ضعف حرجة حالياً. كافة الصناديق والعمليات تسير وفق المستهدف.' : 'All branch operations and sales categories are on target. No critical deficits flagged.'}
                </div>
              ) : (
                actionPlanItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                        {language === 'ar' ? item.domainAr : item.domain}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.2 rounded font-mono ${
                          item.priority === 'Critical'
                            ? 'bg-rose-500/20 text-rose-600'
                            : item.priority === 'High'
                            ? 'bg-amber-500/20 text-amber-600'
                            : 'bg-blue-500/20 text-blue-600'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? item.issueAr : item.issue}
                    </div>

                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-100 dark:border-slate-800">
                      <strong>{language === 'ar' ? 'الإجراء الموصى به: ' : 'Recommended Action: '}</strong>
                      {language === 'ar' ? item.actionAr : item.action}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                      <span>Owner: <strong className="text-slate-600 dark:text-slate-300 font-sans">{item.owner}</strong></span>
                      <span>Deadline: {item.deadline}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Print Action Plan
              </button>
              <button
                onClick={() => setShowActionPlanModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
