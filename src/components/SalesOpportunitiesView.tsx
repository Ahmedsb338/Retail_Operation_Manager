import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SalesBox } from '../types';
import {
  TrendingUp,
  Plus,
  AlertCircle,
  TrendingDown,
  Minus,
  Edit2,
  Calendar,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Target,
  Zap,
} from 'lucide-react';

interface SalesOpportunitiesViewProps {
  isAddBoxModalOpen: boolean;
  setIsAddBoxModalOpen: (open: boolean) => void;
}

export const SalesOpportunitiesView: React.FC<SalesOpportunitiesViewProps> = ({
  isAddBoxModalOpen,
  setIsAddBoxModalOpen,
}) => {
  const { t, language, salesBoxes, addSalesBox, updateSalesBox } = useApp();

  const [editingBox, setEditingBox] = useState<SalesBox | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [target, setTarget] = useState(100);
  const [actual, setActual] = useState(50);
  const [unit, setUnit] = useState('Units');
  const [unitAr, setUnitAr] = useState('وحدة');
  const [remainingWorkingDays, setRemainingWorkingDays] = useState(9);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  const openAddModal = () => {
    setName('');
    setNameAr('');
    setTarget(100);
    setActual(0);
    setUnit('Units');
    setUnitAr('وحدة');
    setRemainingWorkingDays(9);
    setTrend('stable');
    setEditingBox(null);
    setIsAddBoxModalOpen(true);
  };

  const openEditModal = (box: SalesBox) => {
    setName(box.name);
    setNameAr(box.nameAr || '');
    setTarget(box.target);
    setActual(box.actual);
    setUnit(box.unit);
    setUnitAr(box.unitAr || '');
    setRemainingWorkingDays(box.remainingWorkingDays);
    setTrend(box.trend);
    setEditingBox(box);
    setIsAddBoxModalOpen(true);
  };

  const handleSaveBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingBox) {
      updateSalesBox({
        ...editingBox,
        name,
        nameAr: nameAr || name,
        target,
        actual,
        unit,
        unitAr: unitAr || unit,
        remainingWorkingDays,
        trend,
      });
    } else {
      addSalesBox({
        name,
        nameAr: nameAr || name,
        target,
        actual,
        unit,
        unitAr: unitAr || unit,
        remainingWorkingDays,
        trend,
      });
    }
    setIsAddBoxModalOpen(false);
  };

  // Opportunity Analysis: Sort boxes by achievement rate
  const boxesWithCalculations = salesBoxes.map((b) => {
    const achievement = b.target > 0 ? Math.round((b.actual / b.target) * 100) : 100;
    const remaining = Math.max(0, b.target - b.actual);
    const dailyRunRate = Math.ceil(remaining / Math.max(1, b.remainingWorkingDays));
    const performanceGap = b.target - b.actual;
    return {
      ...b,
      achievement,
      remaining,
      dailyRunRate,
      performanceGap,
    };
  });

  const boxesNeedingAttention = boxesWithCalculations.filter((b) => b.achievement < 75);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('salesTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('salesSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addBox')}</span>
        </button>
      </div>

      {/* Formula & Policy Note */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <Target className="w-4 h-4 text-teal-600 shrink-0" />
        <span>{t('boxFormulaExplanation')}</span>
      </div>

      {/* Opportunity Analysis Alert Section */}
      {boxesNeedingAttention.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/20 dark:to-amber-950/20 border border-rose-200 dark:border-rose-900/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('boxRequiresAttention')} ({boxesNeedingAttention.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {boxesNeedingAttention.map((box) => (
              <div
                key={box.id}
                className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200/60 dark:border-rose-900/40 shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {language === 'ar' ? box.nameAr : box.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {box.achievement}% Achieved
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  Remaining Gap: <strong className="text-slate-800 dark:text-slate-200 font-mono">{box.remaining} {language === 'ar' ? box.unitAr : box.unit}</strong>
                </div>

                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[11px] text-rose-800 dark:text-rose-300">
                  <span className="font-semibold">{t('dailyRunRate')}: </span>
                  Must achieve <strong className="font-mono font-bold">{box.dailyRunRate} {language === 'ar' ? box.unitAr : box.unit}/day</strong> over the next {box.remainingWorkingDays} working days to reach quota.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid of All Sales Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxesWithCalculations.map((box) => (
          <div
            key={box.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
          >
            <div>
              {/* Box Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? box.nameAr : box.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {box.unit} · {box.remainingWorkingDays} {t('remainingWorkingDays')}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Trend Indicator */}
                  {box.trend === 'up' ? (
                    <span className="p-1 rounded bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400" title="Trending Up">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  ) : box.trend === 'down' ? (
                    <span className="p-1 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" title="Trending Down">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" title="Stable">
                      <Minus className="w-3.5 h-3.5" />
                    </span>
                  )}

                  <button
                    onClick={() => openEditModal(box)}
                    className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={t('editBox')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Achievement Numbers */}
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers">
                    {box.actual.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">/ {box.target.toLocaleString()}</span>
                </div>
                <span
                  className={`text-sm font-bold font-mono ${
                    box.achievement >= 80 ? 'text-teal-600 dark:text-teal-400' : box.achievement >= 60 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {box.achievement}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    box.achievement >= 80 ? 'bg-teal-500' : box.achievement >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, box.achievement)}%` }}
                />
              </div>

              {/* Daily Sparkline / History SVG Chart */}
              {box.dailyHistory && box.dailyHistory.length > 0 && (
                <div className="mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Recent 7-Day Velocity</span>
                    <span className="font-mono">Avg: {Math.round(box.dailyHistory.reduce((a, b) => a + b.actual, 0) / box.dailyHistory.length)}/d</span>
                  </div>
                  <div className="h-10 flex items-end justify-between gap-1 pt-1">
                    {box.dailyHistory.map((d, idx) => {
                      const max = Math.max(...box.dailyHistory.map((h) => h.actual), 1);
                      const heightPercent = Math.max(15, Math.round((d.actual / max) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className={`w-full rounded-t transition-all ${
                              d.actual >= d.target ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[9px] text-slate-400 font-mono">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Run Rate & Remaining Metric Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider">{t('remainingTarget')}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {box.remaining.toLocaleString()} {language === 'ar' ? box.unitAr : box.unit}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30">
                  <span className="block text-[10px] text-teal-600 dark:text-teal-400 uppercase tracking-wider font-semibold">
                    {t('dailyRunRate')}
                  </span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-xs">
                    {box.dailyRunRate} / day
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>{t('performanceGap')}:</span>
              <span
                className={`font-mono font-bold ${
                  box.performanceGap <= 0 ? 'text-teal-600' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {box.performanceGap <= 0 ? `+${Math.abs(box.performanceGap)} (${t('gapPositive')})` : `${box.performanceGap} (${t('gapNegative')})`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Box Modal */}
      {isAddBoxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBox ? t('editBox') : t('addBox')}
              </h3>
              <button
                onClick={() => setIsAddBoxModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBox} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('boxName')} (EN)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise & SME Solutions"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('boxName')} (العربية)
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: حلول الشركات والأعمال"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('boxTarget')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={target}
                    onChange={(e) => setTarget(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('boxActual')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={actual}
                    onChange={(e) => setActual(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('boxUnit')}
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. Lines / EGP / Routers"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('remainingWorkingDays')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={remainingWorkingDays}
                    onChange={(e) => setRemainingWorkingDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBoxModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer"
                >
                  Save Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
