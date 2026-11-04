import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TnpsAgentRow,
  ComputedTnpsRow,
  DailyTnpsRecord,
  TNPS_TARGET_PERCENT,
  computeSingleAgentTnps,
  aggregateDailyTotalTnps,
  aggregateMonthlyRecords,
} from '../../services/tnpsCalculatorEngine';
import {
  HeartHandshake,
  Plus,
  RotateCcw,
  Save,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  History,
  Trash2,
  Edit2,
  UserCheck,
  Check,
  Sparkles,
} from 'lucide-react';

export const TnpsCalculatorView: React.FC = () => {
  const { language, currentBranch } = useApp();

  const [remainingShifts, setRemainingShifts] = useState<string>('10');
  const [businessDate, setBusinessDate] = useState<string>(currentBranch?.businessDate || '2026-11-03');

  // Agent Rows
  const [agentRows, setAgentRows] = useState<TnpsAgentRow[]>([
    { id: '1', agentName: 'Store Agent 1', detractors: '6', passive: '2', promoters: '29' },
    { id: '2', agentName: 'Store Agent 2', detractors: '2', passive: '1', promoters: '18' },
  ]);

  // Historical Records (for the month)
  const [historicalRecords, setHistoricalRecords] = useState<DailyTnpsRecord[]>([
    {
      id: 'rec-2026-11-01',
      branchCode: currentBranch?.code || '1750',
      businessDate: '2026-11-01',
      agentRows: [{ id: '1', agentName: 'Store Team', detractors: 5, passive: 2, promoters: 28 }],
      totalDetractors: 5,
      totalPassive: 2,
      totalPromoters: 28,
      totalResponses: 35,
      dailyTnpsPercent: 65.7,
      requiredPromoters: 6,
      dailyRequired: 1,
      updatedAt: '2026-11-01T17:00:00Z',
      updatedBy: 'Store Manager',
      revisionNumber: 1,
    },
    {
      id: 'rec-2026-11-02',
      branchCode: currentBranch?.code || '1750',
      businessDate: '2026-11-02',
      agentRows: [{ id: '1', agentName: 'Store Team', detractors: 3, passive: 1, promoters: 32 }],
      totalDetractors: 3,
      totalPassive: 1,
      totalPromoters: 32,
      totalResponses: 36,
      dailyTnpsPercent: 80.5,
      requiredPromoters: 0,
      dailyRequired: 0,
      updatedAt: '2026-11-02T17:30:00Z',
      updatedBy: 'Store Manager',
      revisionNumber: 1,
    },
  ]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Compute live rows
  const parsedRemaining = Math.max(1, parseFloat(remainingShifts) || 1);
  const computedRows: ComputedTnpsRow[] = useMemo(() => {
    return agentRows.map((row) => computeSingleAgentTnps(row, parsedRemaining));
  }, [agentRows, parsedRemaining]);

  // Daily totals
  const dailyTotal = useMemo(() => {
    return aggregateDailyTotalTnps(computedRows, parsedRemaining);
  }, [computedRows, parsedRemaining]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    return aggregateMonthlyRecords(historicalRecords, 25);
  }, [historicalRecords]);

  // Handlers
  const handleRowChange = (index: number, field: keyof TnpsAgentRow, val: string) => {
    const updated = [...agentRows];
    updated[index] = { ...updated[index], [field]: val };
    setAgentRows(updated);
  };

  const handleAddAgentRow = () => {
    setAgentRows([
      ...agentRows,
      {
        id: `agent-${Date.now()}`,
        agentName: `Agent ${agentRows.length + 1}`,
        detractors: '0',
        passive: '0',
        promoters: '0',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (agentRows.length > 1) {
      setAgentRows(agentRows.filter((r) => r.id !== id));
    }
  };

  const handleSaveDailyRecord = () => {
    const existingIndex = historicalRecords.findIndex(
      (r) => r.branchCode === (currentBranch?.code || '1750') && r.businessDate === businessDate
    );

    const record: DailyTnpsRecord = {
      id: `rec-${businessDate}`,
      branchCode: currentBranch?.code || '1750',
      businessDate,
      agentRows: [...agentRows],
      totalDetractors: dailyTotal.detractors,
      totalPassive: dailyTotal.passive,
      totalPromoters: dailyTotal.promoters,
      totalResponses: dailyTotal.total,
      dailyTnpsPercent: Math.round(dailyTotal.tnpsPercent * 10) / 10,
      requiredPromoters: dailyTotal.requiredPromoters,
      dailyRequired: dailyTotal.dailyRequired,
      updatedAt: new Date().toISOString(),
      updatedBy: currentBranch?.manager || 'Store Manager',
      revisionNumber: existingIndex >= 0 ? historicalRecords[existingIndex].revisionNumber + 1 : 1,
    };

    if (existingIndex >= 0) {
      const updated = [...historicalRecords];
      updated[existingIndex] = record;
      setHistoricalRecords(updated);
      setToastMsg(language === 'ar' ? `تم تحديث سجل TNPS ليوم ${businessDate} (المراجعة #${record.revisionNumber})` : `Updated TNPS record for ${businessDate} (Revision #${record.revisionNumber})`);
    } else {
      setHistoricalRecords([record, ...historicalRecords]);
      setToastMsg(language === 'ar' ? `تم تسجيل وحفظ نتائج TNPS ليوم ${businessDate}` : `Saved TNPS daily record for ${businessDate}`);
    }

    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{currentBranch?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-500" />
            <span>{language === 'ar' ? 'حاسبة الـ TNPS وذكاء تجربة العملاء' : 'TNPS Calculator & CX Intelligence'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'ar'
              ? 'المحرك الرسمي المعتمد لقياس رضا العملاء وحساب المطلوب للوصول لمستهدف 70%'
              : 'Authoritative customer satisfaction engine calculating exact required promoters for 70% target'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSaveDailyRecord}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'حفظ سجل اليوم' : 'Save Daily Record'}</span>
          </button>
        </div>
      </div>

      {/* Top Shift & Date Settings */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'تاريخ القياس:' : 'Measurement Date:'}
            </span>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'الشفتات المتبقية:' : 'Remaining Shifts:'}
            </span>
            <input
              type="number"
              min="1"
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-16 px-2.5 py-1 text-center rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-teal-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'مستهدف الشركة:' : 'Corporate Benchmark:'}
          </span>
          <span className="px-2 py-0.5 rounded font-mono font-extrabold text-white bg-red-800 text-xs shadow-xs">
            {TNPS_TARGET_PERCENT}%
          </span>
        </div>
      </div>

      {/* 3 Main Highlights (Daily TNPS %, Required Promoters, MTD Cumulative) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Daily Score */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'نتيجة اليوم (Daily TNPS)' : 'Today TNPS Result'}
          </span>
          <div
            className={`text-3xl font-black font-mono my-1 ${
              dailyTotal.tnpsPercent >= TNPS_TARGET_PERCENT ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {Math.round(dailyTotal.tnpsPercent)}%
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {dailyTotal.promoters} Promoters · {dailyTotal.detractors} Detractors · {dailyTotal.total} Total
          </span>
        </div>

        {/* Required Promoters to reach 70% */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'المطلوب للوصول لـ 70%' : 'Required Promoters for 70%'}
          </span>
          <div className="text-3xl font-black font-mono my-1 text-teal-600">
            +{dailyTotal.requiredPromoters}
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Daily Run: <strong>{dailyTotal.dailyRequired}</strong> / shift ({parsedRemaining} shifts left)
          </span>
        </div>

        {/* MTD Cumulative */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'التراكمي الشهري (MTD TNPS)' : 'Monthly Cumulative (MTD)'}
          </span>
          <div
            className={`text-3xl font-black font-mono my-1 ${
              monthlySummary.cumulativeTnpsPercent >= TNPS_TARGET_PERCENT ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {monthlySummary.cumulativeTnpsPercent}%
          </div>
          <span className="text-xs text-slate-500">
            {monthlySummary.totalDaysLogged} days logged ({monthlySummary.completenessPercent}% completeness)
          </span>
        </div>
      </div>

      {/* Daily Agent Entry Table (Original Layout Preserved with Red Header) */}
      <div className="rounded-2xl border-2 border-red-900/60 dark:border-red-950 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#8B0000] text-white flex items-center justify-between text-xs sm:text-sm font-black">
          <span>tNPS Daily Entry & Agent Scorecard</span>
          <button
            onClick={handleAddAgentRow}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Agent</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="bg-[#8B0000] text-white text-[10px] font-bold border-b border-red-950/40">
                <th className="py-2 px-3 text-start">Agent Name</th>
                <th className="py-2 px-2">Detractors (0-6)</th>
                <th className="py-2 px-2">Passive (7-8)</th>
                <th className="py-2 px-2">Promoters (9-10)</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Final TNPS %</th>
                <th className="py-2 px-2">Required Promoters</th>
                <th className="py-2 px-2">Daily Run Rate</th>
                <th className="py-2 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {computedRows.map((row, idx) => {
                const isMet = row.tnpsPercent >= TNPS_TARGET_PERCENT;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-sans font-bold text-start text-slate-800 dark:text-slate-200">
                      <input
                        type="text"
                        value={row.agentName}
                        onChange={(e) => handleRowChange(idx, 'agentName', e.target.value)}
                        className="w-full font-bold bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                        placeholder="Agent Name"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        value={agentRows[idx].detractors}
                        onChange={(e) => handleRowChange(idx, 'detractors', e.target.value)}
                        className="w-16 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        value={agentRows[idx].passive}
                        onChange={(e) => handleRowChange(idx, 'passive', e.target.value)}
                        className="w-16 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        value={agentRows[idx].promoters}
                        onChange={(e) => handleRowChange(idx, 'promoters', e.target.value)}
                        className="w-16 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b border-slate-200 dark:border-slate-700"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                      {row.total}
                    </td>
                    <td className="py-1.5 px-2">
                      <div
                        className={`rounded font-mono font-black py-1 px-2 text-white shadow-2xs ${
                          row.total === 0 ? 'bg-red-800' : isMet ? 'bg-[#15803D]' : 'bg-[#DC2626]'
                        }`}
                      >
                        {Math.round(row.tnpsPercent)}%
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="rounded font-mono font-bold py-1 px-2 text-white bg-[#15803D] shadow-2xs">
                        +{row.requiredPromoters}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                      {row.daily}
                    </td>
                    <td className="py-2 px-1">
                      {agentRows.length > 1 && (
                        <button
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with Summary */}
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs border-t-2 border-red-950">
                <td className="py-2.5 px-3 font-sans font-black text-start">Store Daily Total</td>
                <td className="py-2.5 px-2 text-amber-600">{dailyTotal.detractors}</td>
                <td className="py-2.5 px-2 text-amber-600">{dailyTotal.passive}</td>
                <td className="py-2.5 px-2 text-teal-600">{dailyTotal.promoters}</td>
                <td className="py-2.5 px-2">{dailyTotal.total}</td>
                <td className="py-2 px-2">
                  <div
                    className={`rounded font-mono font-black py-1 px-2 text-white text-xs ${
                      dailyTotal.tnpsPercent >= TNPS_TARGET_PERCENT ? 'bg-[#15803D]' : 'bg-[#DC2626]'
                    }`}
                  >
                    {Math.round(dailyTotal.tnpsPercent)}%
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="rounded font-mono font-bold py-1 px-2 text-white bg-[#15803D] text-xs">
                    +{dailyTotal.requiredPromoters}
                  </div>
                </td>
                <td className="py-2.5 px-2">{dailyTotal.dailyRequired}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Monthly Historical Audit Log */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'ar' ? 'سجل قياسات الـ TNPS اليومية للشهر' : 'Monthly Daily Measurement Audit History'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {historicalRecords.length} records verified
          </span>
        </div>

        <div className="space-y-2.5">
          {historicalRecords.map((rec) => {
            const isMet = rec.dailyTnpsPercent >= TNPS_TARGET_PERCENT;
            return (
              <div
                key={rec.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {rec.businessDate}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Rev #{rec.revisionNumber} · by {rec.updatedBy})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {rec.totalPromoters} Promoters · {rec.totalPassive} Passive · {rec.totalDetractors} Detractors ({rec.totalResponses} total)
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-end font-mono">
                    <span className="text-[10px] text-slate-400 block">Gap to 70%</span>
                    <span className="font-bold text-teal-600">+{rec.requiredPromoters}</span>
                  </div>
                  <div
                    className={`py-1 px-3 rounded-lg font-mono font-black text-white text-xs ${
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
      </div>
    </div>
  );
};
