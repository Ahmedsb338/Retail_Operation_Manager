import React, { useState } from 'react';
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

  return (
    <div className="space-y-6">
      {/* Top Header (no-print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('reportsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('reportsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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
      <div className="no-print p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedReport('daily_ops')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 cursor-pointer ${
              selectedReport === 'daily_ops'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('dailyOpsReport')}
          </button>
          <button
            onClick={() => setSelectedReport('sales_performance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 cursor-pointer ${
              selectedReport === 'sales_performance'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('salesPerformanceReport')}
          </button>
          <button
            onClick={() => setSelectedReport('coaching')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 cursor-pointer ${
              selectedReport === 'coaching'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('employeeCoachingReport')}
          </button>
          <button
            onClick={() => setSelectedReport('customer_experience')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 cursor-pointer ${
              selectedReport === 'customer_experience'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('cxReport')}
          </button>
          <button
            onClick={() => setSelectedReport('branch_health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 cursor-pointer ${
              selectedReport === 'branch_health'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('healthReport')}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-mono-numbers">{dateRange}</span>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-8 sm:p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-slate-900 dark:text-slate-100 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900 dark:border-slate-100 mb-6">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-teal-600 dark:text-teal-400 font-bold">
              {t('confidentialReport')}
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
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
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentBranch?.name} ({currentBranch?.code}) · {currentBranch?.city}
            </div>
          </div>

          <div className="text-end text-xs font-mono space-y-1">
            <div><strong>Date:</strong> {currentBranch?.businessDate}</div>
            <div><strong>Manager:</strong> {currentBranch?.manager}</div>
            <div className="text-[10px] text-slate-400">Generated: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Report Content based on selection */}
        {selectedReport === 'daily_ops' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-center font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">TOTAL TASKS</span>
                <span className="text-base font-bold">{totalTasksCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">COMPLETED</span>
                <span className="text-base font-bold text-teal-600">{completedTasksCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">OVERDUE</span>
                <span className="text-base font-bold text-rose-600">{overdueTasksCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">COMPLETION</span>
                <span className="text-base font-bold">{opsCompletionPercentage}%</span>
              </div>
            </div>

            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 text-start">Task ID</th>
                  <th className="py-2 text-start">Task Title</th>
                  <th className="py-2 text-start">Category</th>
                  <th className="py-2 text-start">Owner</th>
                  <th className="py-2 text-start">Priority</th>
                  <th className="py-2 text-start">Status</th>
                  <th className="py-2 text-start">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-bold">{task.id}</td>
                    <td className="py-2.5 font-sans font-medium text-slate-900 dark:text-white">{task.title}</td>
                    <td className="py-2.5 capitalize">{task.category}</td>
                    <td className="py-2.5 font-sans">{task.owner}</td>
                    <td className="py-2.5 capitalize">{task.priority}</td>
                    <td className="py-2.5 uppercase font-bold text-[10px]">
                      <span className={task.status === 'completed' ? 'text-teal-600' : task.status === 'blocked' ? 'text-rose-600' : 'text-amber-600'}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-2.5">{task.deadline.slice(11, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'sales_performance' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex justify-between items-center font-mono">
              <span>Overall Achievement: <strong>{salesOverallAchievement}%</strong></span>
              <span>Monitored Boxes: <strong>{salesBoxes.length}</strong></span>
              <span>Working Days Remaining: <strong>{salesBoxes[0]?.remainingWorkingDays || 9}</strong></span>
            </div>

            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 text-start">Box Name</th>
                  <th className="py-2 text-end">Target</th>
                  <th className="py-2 text-end">Actual</th>
                  <th className="py-2 text-end">Ach %</th>
                  <th className="py-2 text-end">Remaining</th>
                  <th className="py-2 text-end">Required Daily Run Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {salesBoxes.map((b) => {
                  const ach = b.target > 0 ? Math.round((b.actual / b.target) * 100) : 100;
                  const rem = Math.max(0, b.target - b.actual);
                  const runRate = Math.ceil(rem / Math.max(1, b.remainingWorkingDays));
                  return (
                    <tr key={b.id}>
                      <td className="py-3 font-sans font-bold text-slate-900 dark:text-white">{b.name}</td>
                      <td className="py-3 text-end">{b.target.toLocaleString()}</td>
                      <td className="py-3 text-end">{b.actual.toLocaleString()}</td>
                      <td className="py-3 text-end font-bold">{ach}%</td>
                      <td className="py-3 text-end">{rem.toLocaleString()}</td>
                      <td className="py-3 text-end font-bold text-teal-600">{runRate} / day</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'coaching' && (
          <div className="space-y-6">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 text-start">Identifier</th>
                  <th className="py-2 text-start">Name</th>
                  <th className="py-2 text-start">Role</th>
                  <th className="py-2 text-end">Knowledge %</th>
                  <th className="py-2 text-end">Productivity %</th>
                  <th className="py-2 text-end">CSAT %</th>
                  <th className="py-2 text-start">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3 font-mono font-bold">{e.identifier}</td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{e.name}</td>
                    <td className="py-3 text-slate-500">{e.role}</td>
                    <td className="py-3 text-end font-mono">{e.productKnowledgeScore}%</td>
                    <td className="py-3 text-end font-mono">{e.productivityScore}%</td>
                    <td className="py-3 text-end font-mono">{e.customerExperienceScore}%</td>
                    <td className="py-3 capitalize">{e.coachingStatus.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'customer_experience' && (
          <div className="space-y-6">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 text-start">Case #</th>
                  <th className="py-2 text-start">Client</th>
                  <th className="py-2 text-start">Category</th>
                  <th className="py-2 text-start">Root Cause</th>
                  <th className="py-2 text-start">Owner</th>
                  <th className="py-2 text-start">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 font-mono font-bold">{c.caseNumber}</td>
                    <td className="py-3 font-mono">{c.customerIdentifier}</td>
                    <td className="py-3 font-medium">{c.issueCategory}</td>
                    <td className="py-3 text-slate-500">{c.rootCause}</td>
                    <td className="py-3">{c.assignedOwner}</td>
                    <td className="py-3 uppercase font-bold text-[10px]">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'branch_health' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center font-mono">
              <span className="text-slate-400 block text-xs">OVERALL BRANCH HEALTH COMPOSITE INDEX</span>
              <span className="text-3xl font-extrabold text-teal-600">{overallHealthScore} / 100</span>
            </div>

            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 text-start">Category</th>
                  <th className="py-2 text-end">Score</th>
                  <th className="py-2 text-end">Weight</th>
                  <th className="py-2 text-start">Operational Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {healthCategories.map((h) => (
                  <tr key={h.key}>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">{h.name}</td>
                    <td className="py-3 text-end font-mono font-bold">{h.score ?? 'N/A'}</td>
                    <td className="py-3 text-end font-mono">{h.weight}%</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{h.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Document Sign-off Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-xs text-slate-400">
          <div>
            <div>Branch Manager Sign-off: ________________________</div>
            <div className="mt-1 text-[10px]">Certified as accurate daily operational record.</div>
          </div>
          <div className="text-end font-mono text-[10px]">
            Doc Ref: {currentBranch?.code}-{selectedReport.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
};
