import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, buildQueryParams } from '../../services/apiClient';
import {
  TnpsAgentRow,
  ComputedTnpsRow,
  DailyTnpsRecord,
  DEFAULT_TNPS_BENCHMARK,
  computeSingleAgentTnps,
  aggregateDailyTotalTnps,
  aggregateMonthlyRecords,
} from '../../services/tnpsCalculatorEngine';
import {
  HeartHandshake,
  Plus,
  Save,
  Calendar,
  Clock,
  CheckCircle2,
  History,
  Trash2,
  Users,
  Target,
  Lock,
  AlertTriangle,
} from 'lucide-react';

function mapDbRecord(raw: any): DailyTnpsRecord {
  const detractors = Number(raw.detractors ?? 0);
  const passive = Number(raw.passive ?? 0);
  const promoters = Number(raw.promoters ?? 0);
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    businessDate: String(raw.businessDate || ''),
    agentRows: Array.isArray(raw.agentRowsJson) ? raw.agentRowsJson : [],
    totalDetractors: detractors,
    totalPassive: passive,
    totalPromoters: promoters,
    totalResponses: detractors + passive + promoters,
    dailyTnpsPercent: Number(raw.score ?? 0),
    requiredPromoters: Number(raw.requiredPromoters ?? 0),
    dailyRequired: Number(raw.dailyRequired ?? 0),
    targetBenchmark: Number(raw.benchmark ?? DEFAULT_TNPS_BENCHMARK),
    updatedAt: String(raw.updatedAt || ''),
    updatedBy: String(raw.updatedBy || ''),
    revisionNumber: Number(raw.revisionNumber || 1),
  };
}

export const TnpsCalculatorView: React.FC = () => {
  const { t, language, canEdit, currentBranch, employees, refreshWorkspaceData } = useApp();
  const branchCode = currentBranch?.code || '';

  const [benchmarkPercent, setBenchmarkPercent] = useState<number>(DEFAULT_TNPS_BENCHMARK);
  const [remainingShifts, setRemainingShifts] = useState<string>(
    String(currentBranch?.remainingShifts ?? 10)
  );
  const [businessDate, setBusinessDate] = useState<string>(
    currentBranch?.businessDate || new Date().toISOString().slice(0, 10)
  );
  const [agentRows, setAgentRows] = useState<TnpsAgentRow[]>([
    { id: '1', agentName: '', detractors: '0', passive: '0', promoters: '0' },
  ]);
  const [historicalRecords, setHistoricalRecords] = useState<DailyTnpsRecord[]>([]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!branchCode) return;
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ records: any[] }>(
        `/api/v1/tnps-store/daily-calc${buildQueryParams({ branchCode })}`
      );
      const mapped = (res.records || []).map(mapDbRecord);
      setHistoricalRecords(mapped);
      if (mapped.length > 0 && mapped[0].agentRows.length > 0) {
        setAgentRows(mapped[0].agentRows);
        setBenchmarkPercent(mapped[0].targetBenchmark || DEFAULT_TNPS_BENCHMARK);
      } else {
        setAgentRows([
          { id: '1', agentName: '', detractors: '0', passive: '0', promoters: '0' },
        ]);
      }
      setBusinessDate(currentBranch?.businessDate || new Date().toISOString().slice(0, 10));
      setRemainingShifts(String(currentBranch?.remainingShifts ?? 10));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load TNPS calculator records.');
    }
  }, [branchCode, currentBranch?.businessDate, currentBranch?.remainingShifts]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const parsedRemaining = Math.max(1, parseFloat(remainingShifts) || 1);
  const computedRows: ComputedTnpsRow[] = useMemo(
    () => agentRows.map((row) => computeSingleAgentTnps(row, parsedRemaining, benchmarkPercent)),
    [agentRows, parsedRemaining, benchmarkPercent]
  );

  const dailyTotal = useMemo(
    () => aggregateDailyTotalTnps(computedRows, parsedRemaining, benchmarkPercent),
    [computedRows, parsedRemaining, benchmarkPercent]
  );

  const monthlySummary = useMemo(
    () => aggregateMonthlyRecords(historicalRecords, 25, benchmarkPercent),
    [historicalRecords, benchmarkPercent]
  );

  const handleRowChange = (index: number, field: keyof TnpsAgentRow, val: string) => {
    if (!canEdit) return;
    const updated = [...agentRows];
    updated[index] = { ...updated[index], [field]: val };
    setAgentRows(updated);
  };

  const handleAddAgentRow = () => {
    if (!canEdit) return;
    setAgentRows([
      ...agentRows,
      {
        id: `agent-${Date.now()}`,
        agentName: '',
        detractors: '0',
        passive: '0',
        promoters: '0',
      },
    ]);
  };

  const handleImportFromStaffRoster = () => {
    if (!canEdit || !employees || employees.length === 0) return;
    const imported: TnpsAgentRow[] = employees.map((emp, idx) => ({
      id: `agent-roster-${emp.id}`,
      agentName: language === 'ar' ? emp.nameAr || emp.name : emp.name,
      detractors: String(agentRows[idx]?.detractors || '0'),
      passive: String(agentRows[idx]?.passive || '0'),
      promoters: String(agentRows[idx]?.promoters || '0'),
    }));
    setAgentRows(imported);
    setToastMsg(
      language === 'ar' ? 'تم جلب أسماء الموظفين من السجل' : 'Loaded staff names from roster'
    );
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleRemoveRow = (id: string) => {
    if (!canEdit || agentRows.length <= 1) return;
    setAgentRows(agentRows.filter((r) => r.id !== id));
  };

  const handleSaveDailyRecord = async () => {
    if (!canEdit || !branchCode) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      setErrorMsg('Select a valid date (YYYY-MM-DD).');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest('/api/v1/tnps-store/daily-calc', {
        method: 'PUT',
        body: {
          businessDate,
          detractors: Math.round(dailyTotal.detractors),
          passive: Math.round(dailyTotal.passive),
          promoters: Math.round(dailyTotal.promoters),
          score: Math.round(dailyTotal.tnpsPercent * 10) / 10,
          benchmark: benchmarkPercent,
          requiredPromoters: dailyTotal.requiredPromoters,
          dailyRequired: dailyTotal.dailyRequired,
          agentRows: agentRows.map((r) => ({ ...r })),
          notes: '',
        },
      });
      await Promise.all([loadRecords(), refreshWorkspaceData()]);
      setToastMsg(
        language === 'ar'
          ? `تم حفظ قياس TNPS ليوم ${businessDate}`
          : `Saved TNPS measurement for ${businessDate}`
      );
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save daily TNPS record.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentBranch) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        {t('noBranchesInScope')}
      </div>
    );
  }

  return (
    <div className="space-y-5 content-container">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
              {currentBranch.code}
            </span>
            <span>·</span>
            <span>{language === 'ar' ? currentBranch.nameAr : currentBranch.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-500 shrink-0" />
            <span>
              {language === 'ar'
                ? 'حاسبة الـ TNPS وذكاء رضا العملاء'
                : 'TNPS Calculator & CX Intelligence'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {!canEdit && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>{t('readOnlyBadge')}</span>
            </div>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleImportFromStaffRoster}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'جلب أسماء الموظفين' : 'Load from Roster'}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDailyRecord}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? '...' : language === 'ar' ? 'حفظ سجل اليوم' : 'Save Record'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'التاريخ:' : 'Date:'}
            </span>
            <input
              type="date"
              disabled={!canEdit}
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="px-2 py-0.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'الشفتات المتبقية:' : 'Remaining Shifts:'}
            </span>
            <input
              type="number"
              min="1"
              disabled={!canEdit}
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-14 px-2 py-0.5 text-center rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-teal-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <Target className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'مستهدف Benchmark:' : 'TNPS Target Benchmark:'}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="99"
              disabled={!canEdit}
              value={benchmarkPercent}
              onChange={(e) =>
                setBenchmarkPercent(
                  Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 70))
                )
              }
              className="w-12 text-center font-mono font-black text-rose-600 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded px-1 py-0.5 text-xs"
            />
            <span className="font-bold font-mono text-rose-600">%</span>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'نتيجة اليوم (Daily TNPS)' : 'Today TNPS Result'}
          </span>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono my-0.5 ${
              dailyTotal.tnpsPercent >= benchmarkPercent ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {Math.round(dailyTotal.tnpsPercent)}%
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {dailyTotal.promoters} Prom · {dailyTotal.passive} Pass · {dailyTotal.detractors} Det (
            {dailyTotal.total} total)
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar'
              ? `المطلوب للوصول لـ ${benchmarkPercent}%`
              : `Required Promoters for ${benchmarkPercent}%`}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono my-0.5 text-teal-600">
            +{dailyTotal.requiredPromoters}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Daily Run: <strong>{dailyTotal.dailyRequired}</strong> / shift ({parsedRemaining} left)
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'التراكمي المسجل (MTD TNPS)' : 'Logged Cumulative (MTD)'}
          </span>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono my-0.5 ${
              historicalRecords.length === 0
                ? 'text-slate-400'
                : monthlySummary.cumulativeTnpsPercent >= benchmarkPercent
                ? 'text-emerald-600'
                : 'text-amber-600'
            }`}
          >
            {historicalRecords.length === 0
              ? t('unconfigured')
              : `${monthlySummary.cumulativeTnpsPercent}%`}
          </div>
          <span className="text-[11px] text-slate-500">
            {monthlySummary.totalDaysLogged} days logged ({monthlySummary.completenessPercent}% completeness)
          </span>
        </div>
      </div>

      {/* Daily Entry Table */}
      <div className="rounded-2xl border border-[#092d52]/40 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="px-3.5 py-2 bg-[#092d52] text-white flex items-center justify-between text-xs font-black">
          <span>tNPS Daily Entry & Agent Scorecard (Target: {benchmarkPercent}%)</span>
          {canEdit && (
            <button
              type="button"
              onClick={handleAddAgentRow}
              className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-center min-w-[550px]">
            <thead>
              <tr className="bg-[#092d52]/90 text-white text-[10px] font-bold">
                <th className="py-2 px-2.5 text-start">Agent Name</th>
                <th className="py-2 px-1">Det (0-6)</th>
                <th className="py-2 px-1">Pass (7-8)</th>
                <th className="py-2 px-1">Prom (9-10)</th>
                <th className="py-2 px-1">Total</th>
                <th className="py-2 px-1">TNPS %</th>
                <th className="py-2 px-1">Req Prom</th>
                <th className="py-2 px-1">Daily</th>
                <th className="py-2 px-1 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {computedRows.map((row, idx) => {
                const isMet = row.tnpsPercent >= benchmarkPercent;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2.5 font-sans font-bold text-start text-slate-800 dark:text-slate-200">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.agentName}
                        onChange={(e) => handleRowChange(idx, 'agentName', e.target.value)}
                        className="w-full font-bold bg-transparent outline-none border-b border-slate-200 dark:border-slate-700 text-xs"
                        placeholder="Agent Name"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        value={agentRows[idx].detractors}
                        onChange={(e) => handleRowChange(idx, 'detractors', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        value={agentRows[idx].passive}
                        onChange={(e) => handleRowChange(idx, 'passive', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        value={agentRows[idx].promoters}
                        onChange={(e) => handleRowChange(idx, 'promoters', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">
                      {row.total}
                    </td>
                    <td className="py-1 px-1">
                      <div
                        className={`rounded font-mono font-black py-0.5 px-1.5 text-white text-[11px] ${
                          row.total === 0
                            ? 'bg-slate-400'
                            : isMet
                            ? 'bg-emerald-700'
                            : 'bg-rose-600'
                        }`}
                      >
                        {Math.round(row.tnpsPercent)}%
                      </div>
                    </td>
                    <td className="py-1 px-1">
                      <div className="rounded font-mono font-bold py-0.5 px-1.5 text-white bg-emerald-700 text-[11px]">
                        +{row.requiredPromoters}
                      </div>
                    </td>
                    <td className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">
                      {row.daily}
                    </td>
                    <td className="py-1 px-1">
                      {canEdit && agentRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                <td className="py-2 px-2.5 font-sans font-black text-start">Total</td>
                <td className="py-2 px-1 text-amber-600">{dailyTotal.detractors}</td>
                <td className="py-2 px-1 text-amber-600">{dailyTotal.passive}</td>
                <td className="py-2 px-1 text-teal-600">{dailyTotal.promoters}</td>
                <td className="py-2 px-1">{dailyTotal.total}</td>
                <td className="py-1 px-1">
                  <div
                    className={`rounded font-mono font-black py-0.5 px-1.5 text-white text-[11px] ${
                      dailyTotal.tnpsPercent >= benchmarkPercent ? 'bg-emerald-700' : 'bg-rose-600'
                    }`}
                  >
                    {Math.round(dailyTotal.tnpsPercent)}%
                  </div>
                </td>
                <td className="py-1 px-1">
                  <div className="rounded font-mono font-bold py-0.5 px-1.5 text-white bg-emerald-700 text-[11px]">
                    +{dailyTotal.requiredPromoters}
                  </div>
                </td>
                <td className="py-2 px-1">{dailyTotal.dailyRequired}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Audit History Log */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {language === 'ar'
                ? 'سجل قياسات الـ TNPS اليومية في قاعدة البيانات'
                : 'Database Daily TNPS Audit History'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {historicalRecords.length} records
          </span>
        </div>

        {historicalRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">{t('noRecords')}</p>
        ) : (
          <div className="space-y-2">
            {historicalRecords.map((rec) => {
              const isMet = rec.dailyTnpsPercent >= (rec.targetBenchmark || benchmarkPercent);
              return (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {rec.businessDate}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Rev #{rec.revisionNumber})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {rec.totalPromoters} Prom · {rec.totalPassive} Pass · {rec.totalDetractors} Det
                      ({rec.totalResponses} total)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-end font-mono">
                      <span className="text-[9px] text-slate-400 block">
                        Gap to {rec.targetBenchmark || benchmarkPercent}%
                      </span>
                      <span className="font-bold text-teal-600 text-xs">
                        +{rec.requiredPromoters}
                      </span>
                    </div>
                    <div
                      className={`py-0.5 px-2 rounded-lg font-mono font-black text-white text-xs ${
                        isMet ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      {Math.round(rec.dailyTnpsPercent)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
