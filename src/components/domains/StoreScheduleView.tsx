import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Download,
  Upload,
  Lock,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiDownloadFile, apiRequest, buildQueryParams } from '../../services/apiClient';
import { ImportSummaryModal } from '../shared/ImportSummaryModal';

const SHIFT_OPTIONS = ['', 'AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF'] as const;

interface SchedulePayload {
  branchCode: string;
  month: string;
  fiscalYear: { startDate: string; endDate: string };
  days: string[];
  agents: Array<{ agentKey: string; agentName: string; sid: string }>;
  cells: Record<string, Record<string, { shift: string; notes: string }>>;
}

function getFiscalMonths(startDate: string, endDate: string): string[] {
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return ['2026-04'];
  const list: string[] = [];
  let y = sy;
  let m = sm;
  for (let i = 0; i < 36; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    list.push(key);
    if (key >= endMonth) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return list;
}

function shiftBadgeClass(shift: string): string {
  switch (shift) {
    case 'AM':
      return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
    case 'PM':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800';
    case 'SUP AM':
    case 'SUP PM':
      return 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800';
    case 'FULL':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    case 'OFF':
      return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-white text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-700';
  }
}

export const StoreScheduleView: React.FC = () => {
  const {
    language,
    t,
    canEdit,
    user,
    authorizedBranches,
    selectedBranchCode,
    setSelectedBranchCode,
    fiscalYear,
  } = useApp();

  const fyMonths = getFiscalMonths(fiscalYear.startDate, fiscalYear.endDate);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    fyMonths.includes(currentMonth) ? currentMonth : fyMonths[0] || '2026-04'
  );

  useEffect(() => {
    if (fyMonths.length > 0 && !fyMonths.includes(selectedMonth)) {
      setSelectedMonth(fyMonths[0]);
    }
  }, [fiscalYear.startDate, fiscalYear.endDate]);

  const activeBranch =
    user?.role === 'STORE_MANAGER'
      ? user.branchCode || ''
      : selectedBranchCode || authorizedBranches[0]?.code || '';

  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!activeBranch) {
      setSchedule(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryParams({
        month: selectedMonth,
        branchCode: activeBranch,
      });
      const data = await apiRequest<SchedulePayload>(`/api/v1/store-schedule/month${qs}`);
      setSchedule(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load store schedule.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, selectedMonth]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleCellChange = async (
    agent: { agentKey: string; agentName: string; sid: string },
    dateStr: string,
    shift: string
  ) => {
    if (!canEdit || !schedule) return;
    try {
      await apiRequest('/api/v1/store-schedule/cell', {
        method: 'PUT',
        body: {
          month: schedule.month,
          date: dateStr,
          agentName: agent.agentName,
          sid: agent.sid,
          shift,
        },
      });
      setSchedule((prev) => {
        if (!prev) return prev;
        const nextCells = { ...prev.cells };
        const agentMap = { ...(nextCells[agent.agentKey] || {}) };
        if (shift === '') {
          delete agentMap[dateStr];
        } else {
          agentMap[dateStr] = { shift, notes: agentMap[dateStr]?.notes || '' };
        }
        nextCells[agent.agentKey] = agentMap;
        return { ...prev, cells: nextCells };
      });
      setToast(language === 'ar' ? 'تم تحديث الوردية' : 'Shift updated');
      setTimeout(() => setToast(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shift cell.');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!activeBranch) return;
    const qs = buildQueryParams({
      month: selectedMonth,
      branchCode: activeBranch,
      format,
    });
    await apiDownloadFile(
      `/api/v1/store-schedule/export${qs}`,
      `store_schedule_${activeBranch}_${selectedMonth}.${format}`
    );
  };

  return (
    <div className="space-y-4 content-container">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('navStoreSchedule')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'ar'
              ? 'شبكة جدول ورديات الموظفين الشهرية (AM · PM · SUP AM · SUP PM · FULL · OFF) ضمن السنة المالية'
              : 'Monthly shift roster grid (AM · PM · SUP AM · SUP PM · FULL · OFF) scoped to Fiscal Year'}
          </p>
        </div>

        {!canEdit && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
            <Lock className="w-3.5 h-3.5 text-[#092d52] dark:text-teal-400" />
            <span>{t('readOnlyBadge')}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'AREA_MANAGER' && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
              <select
                value={activeBranch}
                onChange={(e) => setSelectedBranchCode(e.target.value)}
                className="px-3 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {authorizedBranches.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} · {language === 'ar' ? b.nameAr || b.name : b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 min-h-[40px] rounded-xl text-xs font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {fyMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportCsv')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportXlsx')}</span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('importData')}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {language === 'ar' ? 'جارٍ تحميل الجدول...' : 'Loading shift schedule...'}
        </div>
      ) : !schedule || schedule.agents.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {language === 'ar'
              ? 'لا يوجد موظفون مضافون لهذا الفرع بعد'
              : 'No roster agents found for this branch yet'}
          </p>
          <p>
            {language === 'ar'
              ? 'أضف أعضاء الفريق في قسم فريق العمل أو استورد ملف جدول CSV / Excel.'
              : 'Add staff members in Staff Roster or import a schedule CSV / Excel sheet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Schedule Grid */}
          <div className="hidden md:block rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="text-[11px] border-collapse">
                <thead className="bg-[#092d52] text-white">
                  <tr>
                    <th className="sticky start-0 z-20 bg-[#092d52] px-3 py-2.5 text-start font-semibold min-w-[160px] border-e border-white/10">
                      {language === 'ar' ? 'الموظف' : 'Agent'}
                    </th>
                    <th className="px-2.5 py-2.5 text-start font-semibold whitespace-nowrap border-e border-white/10">
                      SID
                    </th>
                    {schedule.days.map((d) => (
                      <th
                        key={d}
                        className="px-1.5 py-2.5 text-center font-mono font-semibold whitespace-nowrap min-w-[78px]"
                      >
                        {d.slice(8)}/{d.slice(5, 7)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {schedule.agents.map((agent) => (
                    <tr
                      key={agent.agentKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="sticky start-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-semibold text-slate-900 dark:text-white border-e border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {agent.agentName}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-slate-500 border-e border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {agent.sid || '—'}
                      </td>
                      {schedule.days.map((day) => {
                        const val = schedule.cells[agent.agentKey]?.[day]?.shift || '';
                        return (
                          <td key={day} className="p-1 text-center">
                            {canEdit ? (
                              <select
                                aria-label={`${agent.agentName} ${day}`}
                                value={val}
                                onChange={(e) => handleCellChange(agent, day, e.target.value)}
                                className={`w-full px-1 py-1 rounded-lg border text-[10px] font-mono font-bold text-center cursor-pointer ${shiftBadgeClass(val)}`}
                              >
                                {SHIFT_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt === '' ? '—' : opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-block w-full px-1.5 py-1 rounded-lg border text-[10px] font-mono font-bold ${shiftBadgeClass(val)}`}
                              >
                                {val || '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Cards per Agent */}
          <div className="md:hidden space-y-3">
            {schedule.agents.map((agent) => (
              <div
                key={agent.agentKey}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {agent.agentName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {agent.sid || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {schedule.days.map((day) => {
                    const val = schedule.cells[agent.agentKey]?.[day]?.shift || '';
                    return (
                      <div key={day} className="space-y-0.5">
                        <div className="text-[10px] font-mono text-slate-400 text-center">
                          {day.slice(8)}/{day.slice(5, 7)}
                        </div>
                        {canEdit ? (
                          <select
                            value={val}
                            onChange={(e) => handleCellChange(agent, day, e.target.value)}
                            className={`w-full px-1 min-h-[36px] rounded-lg border text-[10px] font-mono font-bold text-center ${shiftBadgeClass(val)}`}
                          >
                            {SHIFT_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt === '' ? '—' : opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div
                            className={`px-1 py-1.5 rounded-lg border text-[10px] font-mono font-bold text-center ${shiftBadgeClass(val)}`}
                          >
                            {val || '—'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showImport && (
        <ImportSummaryModal
          title={`${t('importData')} — ${t('navStoreSchedule')} (${selectedMonth})`}
          endpoint="/api/v1/store-schedule/import-grid"
          extraPayload={{ month: selectedMonth }}
          expectedHeadersHint="Date (YYYY-MM-DD), Agent Name, SID, Shift (AM | PM | SUP AM | SUP PM | FULL | OFF)"
          onClose={() => setShowImport(false)}
          onSuccess={loadSchedule}
        />
      )}
    </div>
  );
};
