import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HealthWeights } from '../types';
import {
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  RotateCcw,
  Save,
  ArrowRight,
  ShieldCheck,
  Flame,
} from 'lucide-react';

export const BranchHealthView: React.FC = () => {
  const {
    t,
    language,
    overallHealthScore,
    healthCategories,
    weakestHealthArea,
    strongestHealthArea,
    healthWeights,
    updateHealthWeights,
    resetHealthWeights,
  } = useApp();

  const [isConfiguring, setIsConfiguring] = useState(false);
  const [weights, setWeights] = useState<HealthWeights>({ ...healthWeights });
  const [errorMsg, setErrorMsg] = useState('');

  const currentSum =
    Number(weights.dailyOperations) +
    Number(weights.salesPerformance) +
    Number(weights.teamPerformance) +
    Number(weights.customerExperience) +
    Number(weights.complianceAudits);

  const handleSaveWeights = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSum !== 100) {
      setErrorMsg(`Total weights must equal 100% (currently ${currentSum}%).`);
      return;
    }
    setErrorMsg('');
    updateHealthWeights(weights);
    setIsConfiguring(false);
  };

  const handleReset = () => {
    resetHealthWeights();
    setWeights({
      dailyOperations: 25,
      salesPerformance: 25,
      teamPerformance: 20,
      customerExperience: 15,
      complianceAudits: 15,
    });
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('healthTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('healthSubtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            setWeights({ ...healthWeights });
            setIsConfiguring(!isConfiguring);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Sliders className="w-4 h-4 text-teal-600" />
          <span>{isConfiguring ? 'Close Config' : t('weightConfiguration')}</span>
        </button>
      </div>

      {/* Internal Operational Indicator Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">
            {language === 'ar' ? 'مؤشر تشغيلي داخلي' : 'Internal Operational Indicator'}
          </strong>
          {t('healthDisclaimer')}
        </div>
      </div>

      {/* Weight Configuration Panel (Collapsible) */}
      {isConfiguring && (
        <form
          onSubmit={handleSaveWeights}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-teal-500/30 shadow-lg space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('weightConfiguration')}
              </h3>
              <p className="text-xs text-slate-400">{t('weightTotalRule')}</p>
            </div>
            <div className="text-xs font-mono font-bold">
              {t('currentTotalWeight')}:{' '}
              <span className={currentSum === 100 ? 'text-teal-600 font-bold' : 'text-rose-600 font-bold'}>
                {currentSum}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                {t('dailyOpsReport')} (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.dailyOperations}
                onChange={(e) => setWeights({ ...weights, dailyOperations: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Sales Performance (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.salesPerformance}
                onChange={(e) => setWeights({ ...weights, salesPerformance: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Team & Coaching (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.teamPerformance}
                onChange={(e) => setWeights({ ...weights, teamPerformance: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Customer Exp (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.customerExperience}
                onChange={(e) => setWeights({ ...weights, customerExperience: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Compliance Audits (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.complianceAudits}
                onChange={(e) => setWeights({ ...weights, complianceAudits: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          {errorMsg && <div className="text-xs text-rose-500 font-medium">{errorMsg}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('resetWeights')}</span>
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('saveWeights')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Composite Score Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overall Health Gauge Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between items-center text-center">
          <div className="w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('overallHealthScore')}
            </span>

            {/* Circular Gauge presentation */}
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
                  strokeDashoffset={427 - (427 * overallHealthScore) / 100}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    overallHealthScore >= 80 ? 'text-teal-500' : overallHealthScore >= 60 ? 'text-amber-500' : 'text-rose-500'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {overallHealthScore}
                </span>
                <span className="text-xs text-slate-400 font-mono">/ 100</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              {overallHealthScore >= 80
                ? 'Branch operations are running at peak performance with high compliance and strong run rates.'
                : overallHealthScore >= 60
                ? 'Operational stability maintained with minor attention needed on delayed tasks or coaching gaps.'
                : 'Urgent leadership intervention required to resolve blockers, audits, and sales deficits.'}
            </p>
          </div>

          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-start">
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider">{t('strongestArea')}</span>
              <strong className="text-slate-800 dark:text-slate-200 text-xs truncate block mt-0.5">
                {strongestHealthArea ? (language === 'ar' ? strongestHealthArea.nameAr : strongestHealthArea.name) : 'N/A'}
              </strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-start">
              <span className="block text-[10px] text-rose-500 uppercase tracking-wider font-semibold">{t('weakestArea')}</span>
              <strong className="text-slate-800 dark:text-slate-200 text-xs truncate block mt-0.5">
                {weakestHealthArea ? (language === 'ar' ? weakestHealthArea.nameAr : weakestHealthArea.name) : 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* Right (2 cols): Category Breakdown */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('categoryScores')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Weight breakdown and verified operational drivers
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 font-semibold">
              <TrendingUp className="w-4 h-4" />
              <span>Shift Trend: Stable</span>
            </div>
          </div>

          <div className="space-y-4">
            {healthCategories.map((cat) => (
              <div
                key={cat.key}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {language === 'ar' ? cat.nameAr : cat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (Weight: {cat.weight}%)
                    </span>
                  </div>

                  {cat.score !== null ? (
                    <span
                      className={`font-mono font-bold text-sm ${
                        cat.score >= 80 ? 'text-teal-600 dark:text-teal-400' : cat.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    >
                      {cat.score} / 100
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">{t('dataUnavailable')}</span>
                  )}
                </div>

                {/* Bar */}
                {cat.score !== null ? (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.score >= 80 ? 'bg-teal-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
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
        </div>
      </div>
    </div>
  );
};
