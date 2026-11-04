import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
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
  Sliders,
} from 'lucide-react';

export const TnpsCalculatorView: React.FC = () => {
  const { language, currentBranch, employees } = useApp();
  const branchKey = currentBranch?.code || '1750';

  // Benchmark % (Editable by manager and persistent per branch)
  const [benchmarkPercent, setBenchmarkPercent] = useState<number>(() => {
    const saved = localStorage.getItem(`opm_branch_${branchKey}_tnps_benchmark`);
    return saved ? parseInt(saved, 10) || DEFAULT_TNPS_BENCHMARK : DEFAULT_TNPS_BENCHMARK;
  });

  const [remainingShifts, setRemainingShifts] = useState<string>(() => {
    return localStorage.getItem(`opm_branch_${branchKey}_rem_shifts`) || '10';
  });

  const [businessDate, setBusinessDate] = useState<string>(() => {
    return localStorage.getItem(`opm_branch_${branchKey}_business_date`) || currentBranch?.businessDate || '2026-11-03';
  });

  // Agent Rows (Persistent per branch)
  const [agentRows, setAgentRows] = useState<TnpsAgentRow[]>(() => {
    const saved = localStorage.getItem(`opm_branch_${branchKey}_tnps_active_rows`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      { id: '1', agentName: 'Store Agent 1', detractors: '6', passive: '2', promoters: '29' },
      { id: '2', agentName: 'Store Agent 2', detractors: '2', passive: '1', promoters: '18' },
    ];
  });

  // Historical Records for the branch
  const [historicalRecords, setHistoricalRecords] = useState<DailyTnpsRecord[]>(() => {
    const saved = localStorage.getItem(`opm_branch_${branchKey}_tnps_history`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'rec-2026-11-01',
        branchCode: branchKey,
        businessDate: '2026-11-01',
        agentRows: [{ id: '1', agentName: 'Store Team', detractors: 5, passive: 2, promoters: 28 }],
        totalDetractors: 5,
        totalPassive: 2,
        totalPromoters: 28,
        totalResponses: 35,
        dailyTnpsPercent: 65.7,
        requiredPromoters: 6,
        dailyRequired: 1,
        targetBenchmark: 70,
        updatedAt: '2026-11-01T17:00:00Z',
        updatedBy: 'Store Manager',
        revisionNumber: 1,
      },
      {
        id: 'rec-2026-11-02',
        branchCode: branchKey,
        businessDate: '2026-11-02',
        agentRows: [{ id: '1', agentName: 'Store Team', detractors: 3, passive: 1, promoters: 32 }],
        totalDetractors: 3,
        totalPassive: 1,
        totalPromoters: 32,
        totalResponses: 36,
        dailyTnpsPercent: 80.5,
        requiredPromoters: 0,
        dailyRequired: 0,
        targetBenchmark: 70,
        updatedAt: '2026-11-02T17:30:00Z',
        updatedBy: 'Store Manager',
        revisionNumber: 1,
      },
    ];
  });

  // Persistent storage sync
  useEffect(() => {
    try {
      localStorage.setItem(`opm_branch_${branchKey}_tnps_benchmark`, String(benchmarkPercent));
      localStorage.setItem(`opm_branch_${branchKey}_tnps_active_rows`, JSON.stringify(agentRows));
      localStorage.setItem(`opm_branch_${branchKey}_tnps_history`, JSON.stringify(historicalRecords));
    } catch {}
  }, [branchKey, benchmarkPercent, agentRows, historicalRecords]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Compute live rows with customizable benchmark
  const parsedRemaining = Math.max(1, parseFloat(remainingShifts) || 1);
  const computedRows: ComputedTnpsRow[] = useMemo(() => {
    return agentRows.map((row) => computeSingleAgentTnps(row, parsedRemaining, benchmarkPercent));
  }, [agentRows, parsedRemaining, benchmarkPercent]);

  // Daily totals
  const dailyTotal = useMemo(() => {
    return aggregateDailyTotalTnps(computedRows, parsedRemaining, benchmarkPercent);
  }, [computedRows, parsedRemaining, benchmarkPercent]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    return aggregateMonthlyRecords(historicalRecords, 25, benchmarkPercent);
  }, [historicalRecords, benchmarkPercent]);

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

  const handleImportFromStaffRoster = () => {
    if (employees && employees.length > 0) {
      const imported: TnpsAgentRow[] = employees.map((emp, idx) => ({
        id: `agent-roster-${emp.id}`,
        agentName: language === 'ar' ? emp.nameAr || emp.name : emp.name,
        detractors: agentRows[idx]?.detractors || '0',
        passive: agentRows[idx]?.passive || '0',
        promoters: agentRows[idx]?.promoters || '0',
      }));
      setAgentRows(imported);
      setToastMsg(language === 'ar' ? 'تم جلب أسماء الموظفين من سجل الفريق' : 'Loaded staff names from roster');
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  const handleRemoveRow = (id: string) => {
    if (agentRows.length > 1) {
      setAgentRows(agentRows.filter((r) => r.id !== id));
    }
  };

  const handleSaveDailyRecord = () => {
    const existingIndex = historicalRecords.findIndex(
      (r) => r.branchCode === branchKey && r.businessDate === businessDate
    );

    const record: DailyTnpsRecord = {
      id: `rec-${businessDate}`,
      branchCode: branchKey,
      businessDate,
      agentRows: [...agentRows],
      totalDetractors: dailyTotal.detractors,
      totalPassive: dailyTotal.passive,
      totalPromoters: dailyTotal.promoters,
      totalResponses: dailyTotal.total,
      dailyTnpsPercent: Math.round(dailyTotal.tnpsPercent * 10) / 10,
      requiredPromoters: dailyTotal.requiredPromoters,
      dailyRequired: dailyTotal.dailyRequired,
      targetBenchmark: benchmarkPercent,
      updatedAt: new Date().toISOString(),
      updatedBy: currentBranch?.manager || 'Store Manager',
      revisionNumber: existingIndex >= 0 ? historicalRecords[existingIndex].revisionNumber + 1 : 1,
    };

    let nextRecords: DailyTnpsRecord[];
    if (existingIndex >= 0) {
      nextRecords = [...historicalRecords];
      nextRecords[existingIndex] = record;
      setToastMsg(language === 'ar' ? `تم تحديث وحفظ قياس ${businessDate} (مراجعة #${record.revisionNumber})` : `Updated & saved TNPS measurement for ${businessDate}`);
    } else {
      nextRecords = [record, ...historicalRecords];
      setToastMsg(language === 'ar' ? `تم حفظ قياس اليوم في سجل الفرع الدائم` : `Saved daily TNPS record permanently`);
    }

    setHistoricalRecords(nextRecords);
    localStorage.setItem(`opm_branch_${branchKey}_tnps_history`, JSON.stringify(nextRecords));
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="space-y-5 content-container">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{currentBranch?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{language === 'ar' ? 'حاسبة الـ TNPS وذكاء رضا العملاء' : 'TNPS Calculator & CX Intelligence'}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleImportFromStaffRoster}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Import names from staff roster"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'جلب أسماء الموظفين' : 'Load from Roster'}</span>
          </button>

          <button
            onClick={handleSaveDailyRecord}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'حفظ سجل اليوم' : 'Save Record'}</span>
          </button>
        </div>
      </div>

      {/* Settings Row with Editable Benchmark */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'التاريخ:' : 'Date:'}
            </span>
            <input
              type="date"
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
              value={remainingShifts}
              onChange={(e) => setRemainingShifts(e.target.value)}
              className="w-14 px-2 py-0.5 text-center rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-teal-600"
            />
          </div>
        </div>

        {/* User-Requested: Custom Editable Benchmark */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <Target className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'مستهدف البنش مارك (Benchmark %):' : 'TNPS Target Benchmark:'}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="99"
              value={benchmarkPercent}
              onChange={(e) => setBenchmarkPercent(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 70)))}
              className="w-12 text-center font-mono font-black text-rose-600 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded px-1 py-0.5 text-xs shadow-2xs"
            />
            <span className="font-bold font-mono text-rose-600">%</span>
          </div>
        </div>
      </div>

      {/* 3 Main Highlights */}
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
            {dailyTotal.promoters} Prom · {dailyTotal.passive} Pass · {dailyTotal.detractors} Det ({dailyTotal.total} total)
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? `المطلوب للوصول لـ ${benchmarkPercent}%` : `Required Promoters for ${benchmarkPercent}%`}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono my-0.5 text-teal-600">
            +{dailyTotal.requiredPromoters}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Daily Run: <strong>{dailyTotal.dailyRequired}</strong> / shift ({parsedRemaining} shifts left)
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'التراكمي الشهري (MTD TNPS)' : 'Monthly Cumulative (MTD)'}
          </span>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono my-0.5 ${
              monthlySummary.cumulativeTnpsPercent >= benchmarkPercent ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {monthlySummary.cumulativeTnpsPercent}%
          </div>
          <span className="text-[11px] text-slate-500">
            {monthlySummary.totalDaysLogged} days logged ({monthlySummary.completenessPercent}% completeness)
          </span>
        </div>
      </div>

      {/* Daily Agent Entry Table */}
      <div className="rounded-2xl border border-red-900/60 dark:border-red-950 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="px-3.5 py-2 bg-[#8B0000] text-white flex items-center justify-between text-xs font-black">
          <span>tNPS Daily Entry & Agent Scorecard (Target: {benchmarkPercent}%)</span>
          <button
            onClick={handleAddAgentRow}
            className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-center min-w-[550px]">
            <thead>
              <tr className="bg-[#8B0000] text-white text-[10px] font-bold border-b border-red-950/40">
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
                        value={agentRows[idx].detractors}
                        onChange={(e) => handleRowChange(idx, 'detractors', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        value={agentRows[idx].passive}
                        onChange={(e) => handleRowChange(idx, 'passive', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-amber-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min="0"
                        value={agentRows[idx].promoters}
                        onChange={(e) => handleRowChange(idx, 'promoters', e.target.value)}
                        className="w-12 text-center font-mono font-bold text-teal-600 bg-transparent outline-none border-b"
                      />
                    </td>
                    <td className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">{row.total}</td>
                    <td className="py-1 px-1">
                      <div
                        className={`rounded font-mono font-black py-0.5 px-1.5 text-white text-[11px] ${
                          row.total === 0 ? 'bg-red-800' : isMet ? 'bg-[#15803D]' : 'bg-[#DC2626]'
                        }`}
                      >
                        {Math.round(row.tnpsPercent)}%
                      </div>
                    </td>
                    <td className="py-1 px-1">
                      <div className="rounded font-mono font-bold py-0.5 px-1.5 text-white bg-[#15803D] text-[11px]">
                        +{row.requiredPromoters}
                      </div>
                    </td>
                    <td className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">{row.daily}</td>
                    <td className="py-1 px-1">
                      {agentRows.length > 1 && (
                        <button onClick={() => handleRemoveRow(row.id)} className="p-1 rounded text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs border-t-2 border-red-950">
                <td className="py-2 px-2.5 font-sans font-black text-start">Total</td>
                <td className="py-2 px-1 text-amber-600">{dailyTotal.detractors}</td>
                <td className="py-2 px-1 text-amber-600">{dailyTotal.passive}</td>
                <td className="py-2 px-1 text-teal-600">{dailyTotal.promoters}</td>
                <td className="py-2 px-1">{dailyTotal.total}</td>
                <td className="py-1 px-1">
                  <div
                    className={`rounded font-mono font-black py-0.5 px-1.5 text-white text-[11px] ${
                      dailyTotal.tnpsPercent >= benchmarkPercent ? 'bg-[#15803D]' : 'bg-[#DC2626]'
                    }`}
                  >
                    {Math.round(dailyTotal.tnpsPercent)}%
                  </div>
                </td>
                <td className="py-1 px-1">
                  <div className="rounded font-mono font-bold py-0.5 px-1.5 text-white bg-[#15803D] text-[11px]">
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

      {/* Monthly Audit History Log */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {language === 'ar' ? 'سجل قياسات الـ TNPS اليومية للشهر' : 'Monthly Daily Measurement Audit History'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{historicalRecords.length} records</span>
        </div>

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
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{rec.businessDate}</span>
                    <span className="text-[10px] text-slate-400">(Rev #{rec.revisionNumber})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {rec.totalPromoters} Prom · {rec.totalPassive} Pass · {rec.totalDetractors} Det ({rec.totalResponses} total)
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-end font-mono">
                    <span className="text-[9px] text-slate-400 block">Gap to {rec.targetBenchmark || benchmarkPercent}%</span>
                    <span className="font-bold text-teal-600 text-xs">+{rec.requiredPromoters}</span>
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
      </div>
    </div>
  );
};
