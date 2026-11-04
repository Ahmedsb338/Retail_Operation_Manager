import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Target,
  Users,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Info,
  Layers,
  FileCheck,
} from 'lucide-react';

export const AiAnalyticsView: React.FC = () => {
  const {
    t,
    language,
    currentBranch,
    aiAnalysis,
    isAiLoading,
    runAiDiagnostic,
    toggleActionPlanItem,
  } = useApp();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
              {t('aiModelIndicator')}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-500" />
            {t('aiTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('aiSubtitle')}
          </p>
        </div>

        <button
          onClick={runAiDiagnostic}
          disabled={isAiLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-700/20 transition-all active:scale-95 disabled:opacity-60 cursor-pointer self-start sm:self-auto"
        >
          {isAiLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>{t('generatingAi')}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{aiAnalysis ? t('refreshAiPlan') : t('generateAiAnalysis')}</span>
            </>
          )}
        </button>
      </div>

      {/* AI Grounding Rule Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">
            {language === 'ar' ? 'معايير النزاهة التحليلية' : 'Grounded Empirical Intelligence'}
          </strong>
          {t('aiDisclaimerNote')}
        </div>
      </div>

      {/* If No Analysis Run Yet */}
      {!aiAnalysis && !isAiLoading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {language === 'ar' ? 'تشخيص عمليات الفرع بذكاء الاصطناعي' : 'Run Branch Shift Diagnostic'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5 leading-relaxed">
            Click the button below to parse all active financial audits, overdue tasks, team development gaps, and sales run rates into a prioritized operational action plan.
          </p>
          <button
            onClick={runAiDiagnostic}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('generateAiAnalysis')}</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isAiLoading && (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      )}

      {/* AI Intelligence Output */}
      {aiAnalysis && !isAiLoading && (
        <div className="space-y-6">
          {/* Executive Overview Banner */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                A. {language === 'ar' ? 'ملخص أداء الفرع' : 'Branch Performance Synthesis'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Model: {aiAnalysis.modelUsed || 'gemini-3.8-flash'} · {new Date(aiAnalysis.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {language === 'ar' ? aiAnalysis.branchOverview.summaryAr : aiAnalysis.branchOverview.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">
                  {language === 'ar' ? 'أبرز نقاط الضعف التشغيلية المرصودة:' : 'Identified Operational Weaknesses:'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  {(language === 'ar' ? aiAnalysis.branchOverview.operationalWeaknessesAr : aiAnalysis.branchOverview.operationalWeaknesses).map(
                    (w, idx) => (
                      <li key={idx}>{w}</li>
                    )
                  )}
                </ul>
              </div>

              <div>
                <span className="font-bold text-teal-600 dark:text-teal-400 block mb-1">
                  {language === 'ar' ? 'الأولويات العاجلة للمناوبة:' : 'Immediate Shift Priorities:'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  {(language === 'ar' ? aiAnalysis.branchOverview.immediatePrioritiesAr : aiAnalysis.branchOverview.immediatePriorities).map(
                    (p, idx) => (
                      <li key={idx}>{p}</li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* 4 Pillars Grid: Ops, Team, Sales, Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* B. Operations Intelligence */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  B. {language === 'ar' ? 'ذكاء العمليات والامتثال' : 'Operations Intelligence'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                <strong>Status: </strong>
                {language === 'ar' ? aiAnalysis.operationsIntelligence.auditStatusAr : aiAnalysis.operationsIntelligence.auditStatus}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar' ? aiAnalysis.operationsIntelligence.criticalFindingsAr : aiAnalysis.operationsIntelligence.criticalFindings).map(
                  (f, idx) => (
                    <li key={idx}>{f}</li>
                  )
                )}
              </ul>
            </div>

            {/* C. Team Insights */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  C. {language === 'ar' ? 'تحليلات أداء الفريق والتوجيه' : 'Team Insights'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                <strong>Top Performer: </strong>
                {language === 'ar' ? aiAnalysis.teamInsights.topPerformerAr : aiAnalysis.teamInsights.topPerformer}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div>
                  <strong>Development Priority: </strong>
                  {(language === 'ar' ? aiAnalysis.teamInsights.priorityCoacheesAr : aiAnalysis.teamInsights.priorityCoachees).join(', ')}
                </div>
              </div>
            </div>

            {/* D. Sales Intelligence */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  D. {language === 'ar' ? 'ذكاء المبيعات وتحليل الفجوات' : 'Sales Intelligence'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 mb-1">
                <strong>Weakest Box: </strong>
                {language === 'ar' ? aiAnalysis.salesIntelligence.weakestBoxAr : aiAnalysis.salesIntelligence.weakestBox}
              </div>
              <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold mb-2">
                {language === 'ar' ? aiAnalysis.salesIntelligence.runRateAlertAr : aiAnalysis.salesIntelligence.runRateAlert}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar' ? aiAnalysis.salesIntelligence.strategicActionsAr : aiAnalysis.salesIntelligence.strategicActions).map(
                  (s, idx) => (
                    <li key={idx}>{s}</li>
                  )
                )}
              </ul>
            </div>

            {/* E. Customer Experience Insights */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  E. {language === 'ar' ? 'رؤى تجربة العملاء والاحتكاك' : 'Customer Insights'}
                </h3>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                {language === 'ar' ? aiAnalysis.customerInsights.agingSummaryAr : aiAnalysis.customerInsights.agingSummary}
              </div>
              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {(language === 'ar' ? aiAnalysis.customerInsights.recurringRootCausesAr : aiAnalysis.customerInsights.recurringRootCauses).map(
                  (r, idx) => (
                    <li key={idx}>{r}</li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* F. AI Action Plan (Interactive Table) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  F. {t('aiActionPlanTitle')}
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {aiAnalysis.actionPlan.filter((p) => p.isCompleted).length} / {aiAnalysis.actionPlan.length} resolved
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-start w-10">Done</th>
                    <th className="py-2.5 px-3 text-start">{t('issueCol')}</th>
                    <th className="py-2.5 px-3 text-start">{t('evidenceCol')}</th>
                    <th className="py-2.5 px-3 text-start">{t('impactCol')}</th>
                    <th className="py-2.5 px-3 text-start">{t('actionCol')}</th>
                    <th className="py-2.5 px-3 text-start w-28">{t('ownerCol')}</th>
                    <th className="py-2.5 px-3 text-start w-28">{t('deadlineCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {aiAnalysis.actionPlan.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${
                        item.isCompleted ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleActionPlanItem(item.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                            item.isCompleted
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-teal-500'
                          }`}
                        >
                          {item.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.priority === 'Critical'
                                ? 'bg-rose-500'
                                : item.priority === 'High'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          <span>{language === 'ar' ? item.issueAr : item.issue}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {language === 'ar' ? item.evidenceAr : item.evidence}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {language === 'ar' ? item.businessImpactAr : item.businessImpact}
                      </td>
                      <td className="py-3 px-3 font-medium text-teal-700 dark:text-teal-300">
                        {language === 'ar' ? item.recommendedActionAr : item.recommendedAction}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {item.suggestedOwner}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {item.suggestedDeadline}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
