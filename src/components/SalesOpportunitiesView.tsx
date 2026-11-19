import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SalesBox } from '../types';
import {
  Plus,
  AlertCircle,
  Minus,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Target,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface SalesOpportunitiesViewProps {
  isAddBoxModalOpen: boolean;
  setIsAddBoxModalOpen: (open: boolean) => void;
}

export const SalesOpportunitiesView: React.FC<SalesOpportunitiesViewProps> = ({
  isAddBoxModalOpen,
  setIsAddBoxModalOpen,
}) => {
  const {
    t,
    language,
    canEdit,
    salesBoxes,
    addSalesBox,
    updateSalesBox,
    deleteSalesBox,
  } = useApp();

  const [editingBox, setEditingBox] = useState<SalesBox | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [target, setTarget] = useState('100');
  const [actual, setActual] = useState('0');
  const [unit, setUnit] = useState('Units');
  const [unitAr, setUnitAr] = useState('وحدة');
  const [remainingWorkingDays, setRemainingWorkingDays] = useState('9');
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  const openAddModal = () => {
    if (!canEdit) return;
    setName('');
    setNameAr('');
    setTarget('100');
    setActual('0');
    setUnit('Units');
    setUnitAr('وحدة');
    setRemainingWorkingDays('9');
    setTrend('stable');
    setEditingBox(null);
    setFormError(null);
    setIsAddBoxModalOpen(true);
  };

  const openEditModal = (box: SalesBox) => {
    if (!canEdit) return;
    setName(box.name);
    setNameAr(box.nameAr || '');
    setTarget(String(box.target));
    setActual(String(box.actual));
    setUnit(box.unit);
    setUnitAr(box.unitAr || '');
    setRemainingWorkingDays(String(box.remainingWorkingDays));
    setTrend(box.trend);
    setEditingBox(box);
    setFormError(null);
    setIsAddBoxModalOpen(true);
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    const numTarget = Math.max(0, parseFloat(target) || 0);
    const numActual = Math.max(0, parseFloat(actual) || 0);
    const numDays = Math.max(0, parseInt(remainingWorkingDays, 10) || 0);
    try {
      if (editingBox) {
        await updateSalesBox({
          ...editingBox,
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          target: numTarget,
          actual: numActual,
          unit: unit.trim(),
          unitAr: unitAr.trim() || unit.trim(),
          remainingWorkingDays: numDays,
          trend,
        });
      } else {
        await addSalesBox({
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          target: numTarget,
          actual: numActual,
          unit: unit.trim(),
          unitAr: unitAr.trim() || unit.trim(),
          remainingWorkingDays: numDays,
          trend,
        });
      }
      setIsAddBoxModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save sales box.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await deleteSalesBox(id);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  const boxesWithCalculations = salesBoxes.map((b) => {
    const achievement = b.target > 0 ? Math.round((b.actual / b.target) * 100) : null;
    const remaining = Math.max(0, b.target - b.actual);
    const dailyRunRate =
      b.target > 0 ? Math.ceil(remaining / Math.max(1, b.remainingWorkingDays)) : 0;
    const performanceGap = b.target - b.actual;
    return {
      ...b,
      achievement,
      remaining,
      dailyRunRate,
      performanceGap,
    };
  });

  const boxesNeedingAttention = boxesWithCalculations.filter(
    (b) => b.achievement !== null && b.achievement < 75
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('salesTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('salesSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!canEdit && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>{t('readOnlyBadge')}</span>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addBox')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Policy Note */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <Target className="w-4 h-4 text-teal-600 shrink-0" />
        <span>{t('boxFormulaExplanation')}</span>
      </div>

      {/* Attention Boxes */}
      {boxesNeedingAttention.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
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
                    {language === 'ar' ? box.nameAr : box.name} ({box.branchCode})
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {box.achievement}% Achieved
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  Remaining Gap:{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-mono">
                    {box.remaining} {language === 'ar' ? box.unitAr : box.unit}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[11px] text-rose-800 dark:text-rose-300">
                  <span className="font-semibold">{t('dailyRunRate')}: </span>
                  <strong className="font-mono font-bold">
                    {box.dailyRunRate} {language === 'ar' ? box.unitAr : box.unit}/day
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Boxes Grid */}
      {boxesWithCalculations.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {t('noRecords')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxesWithCalculations.map((box) => (
            <div
              key={box.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? box.nameAr : box.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">{box.branchCode}</span> · {box.unit} ·{' '}
                      {box.remainingWorkingDays} {t('remainingWorkingDays')}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {box.trend === 'up' ? (
                      <span className="p-1 rounded bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    ) : box.trend === 'down' ? (
                      <span className="p-1 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Minus className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(box)}
                          className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title={t('editBox')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(box.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers">
                      {box.actual.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {box.target > 0 ? box.target.toLocaleString() : t('unconfigured')}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold font-mono ${
                      box.achievement === null
                        ? 'text-slate-400'
                        : box.achievement >= 80
                        ? 'text-teal-600 dark:text-teal-400'
                        : box.achievement >= 60
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {box.achievement === null ? t('unconfigured') : `${box.achievement}%`}
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (box.achievement ?? 0) >= 80
                        ? 'bg-teal-500'
                        : (box.achievement ?? 0) >= 60
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, box.achievement ?? 0)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                      {t('remainingTarget')}
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {box.target > 0
                        ? `${box.remaining.toLocaleString()} ${language === 'ar' ? box.unitAr : box.unit}`
                        : t('unconfigured')}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30">
                    <span className="block text-[10px] text-teal-600 dark:text-teal-400 uppercase tracking-wider font-semibold">
                      {t('dailyRunRate')}
                    </span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-xs">
                      {box.target > 0 ? `${box.dailyRunRate} / day` : t('unconfigured')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>{t('performanceGap')}:</span>
                <span
                  className={`font-mono font-bold ${
                    box.target <= 0
                      ? 'text-slate-400'
                      : box.performanceGap <= 0
                      ? 'text-teal-600'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {box.target <= 0
                    ? t('unconfigured')
                    : box.performanceGap <= 0
                    ? `+${Math.abs(box.performanceGap)} (${t('gapPositive')})`
                    : `${box.performanceGap} (${t('gapNegative')})`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {canEdit && confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('confirmDelete')}
            </h3>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {canEdit && isAddBoxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBox ? t('editBox') : t('addBox')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddBoxModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
                    min={0}
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
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
                    onChange={(e) => setActual(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('boxUnit')}
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('remainingWorkingDays')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={remainingWorkingDays}
                    onChange={(e) => setRemainingWorkingDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trend
                  </label>
                  <select
                    value={trend}
                    onChange={(e) => setTrend(e.target.value as 'up' | 'down' | 'stable')}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="up">Up</option>
                    <option value="stable">Stable</option>
                    <option value="down">Down</option>
                  </select>
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
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? '...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
