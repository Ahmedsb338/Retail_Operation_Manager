import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiDownloadFile, apiRequest, buildQueryParams } from '../../services/apiClient';
import { ImportSummaryModal } from '../shared/ImportSummaryModal';
import { FilterBar } from '../shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from '../shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type ColumnControlItem,
  type RowSortOrder,
} from '../shared/ColumnControlMenu';

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
  if (!sy || !sm || !ey || !em) return [new Date().toISOString().slice(0, 7)];
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

const SCHEDULE_COLUMNS: ColumnControlItem[] = [
  { key: 'sid', label: 'SID', labelAr: 'الرقم التعريفي SID' },
  { key: 'days1_10', label: 'Days 1–10', labelAr: 'أيام 1–10' },
  { key: 'days11_20', label: 'Days 11–20', labelAr: 'أيام 11–20' },
  { key: 'days21_31', label: 'Days 21–31', labelAr: 'أيام 21–31' },
];

export const StoreScheduleView: React.FC = () => {
  const {
    language,
    t,
    canEdit,
    user,
    employees,
    authorizedBranches,
    selectedBranchCode,
    fiscalYear,
    dateRange,
  } = useApp();

  const fyMonths = getFiscalMonths(fiscalYear.startDate, fiscalYear.endDate);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    fyMonths.includes(currentMonth) ? currentMonth : fyMonths[0] || currentMonth
  );

  useEffect(() => {
    if (fyMonths.length > 0 && !fyMonths.includes(selectedMonth)) {
      setSelectedMonth(fyMonths.includes(currentMonth) ? currentMonth : fyMonths[0]);
    }
  }, [fiscalYear.startDate, fiscalYear.endDate, currentMonth, selectedMonth, fyMonths]);

  const activeBranch =
    user?.role === 'STORE_MANAGER'
      ? user.branchCode || ''
      : selectedBranchCode || authorizedBranches[0]?.code || '';

  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Row & Column Controls
  const [agentQuery, setAgentQuery] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(SCHEDULE_COLUMNS.map((c) => c.key));

  // Add Shift Record Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    agentName: '',
    sid: '',
    date: new Date().toISOString().slice(0, 10),
    shift: 'AM',
    notes: '',
  });

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

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(SCHEDULE_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const visibleDayKeys = useMemo(() => {
    if (!schedule) return [];
    const activeBlocks = new Set(visibleColumns.map((c) => c.key));
    return schedule.days.filter((day) => {
      if ((dateRange.fromDate || dateRange.toDate) && !matchesDateRange(day, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      const dayNum = parseInt(day.slice(8), 10) || 1;
      if (dayNum <= 10) return activeBlocks.has('days1_10');
      if (dayNum <= 20) return activeBlocks.has('days11_20');
      return activeBlocks.has('days21_31');
    });
  }, [schedule, visibleColumns, dateRange.fromDate, dateRange.toDate]);

  const showSidCol = visibleColumns.some((c) => c.key === 'sid');

  const filteredAgents = useMemo(() => {
    if (!schedule) return [];
    const q = agentQuery.trim().toLowerCase();
    if (!q) return schedule.agents;
    return schedule.agents.filter(
      (a) =>
        a.agentName.toLowerCase().includes(q) ||
        (a.sid || '').toLowerCase().includes(q)
    );
  }, [schedule, agentQuery]);

  const displayedAgents = useMemo(
    () => applyRowControls(filteredAgents, rowLimit, sortOrder),
    [filteredAgents, rowLimit, sortOrder]
  );

  const handleToggleColumn = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMoveColumn = (key: string, direction: 'up' | 'down') => {
    setColOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleResetColumns = () => {
    setHiddenCols([]);
    setColOrder(SCHEDULE_COLUMNS.map((c) => c.key));
  };

  const openAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;
    setAddForm({
      agentName: '',
      sid: '',
      date: defaultDate,
      shift: 'AM',
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleAddRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !addForm.agentName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(addForm.date)) return;
    setAddSaving(true);
    setError(null);
    try {
      const monthFromDate = addForm.date.slice(0, 7);
      await apiRequest('/api/v1/store-schedule/cell', {
        method: 'PUT',
        body: {
          month: monthFromDate,
          date: addForm.date,
          agentName: addForm.agentName.trim(),
          sid: addForm.sid.trim(),
          shift: addForm.shift,
          notes: addForm.notes.trim(),
        },
      });
      if (monthFromDate !== selectedMonth && fyMonths.includes(monthFromDate)) {
        setSelectedMonth(monthFromDate);
      }
      await loadSchedule();
      setShowAddModal(false);
      setToast(language === 'ar' ? 'تمت إضافة سجل الوردية' : 'Shift record saved');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift record.');
    } finally {
      setAddSaving(false);
    }
  };

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

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    if (!activeBranch) return;
    if (
      opts.rowScope === 'all' &&
      opts.colScope === 'all' &&
      !opts.searchText.trim() &&
      !opts.fromDate &&
      !opts.toDate
    ) {
      const qs = buildQueryParams({
        month: selectedMonth,
        branchCode: activeBranch,
        format: 'xlsx',
      });
      await apiDownloadFile(
        `/api/v1/store-schedule/export${qs}`,
        `store_schedule_${activeBranch}_${selectedMonth}.xlsx`
      );
      return;
    }

    if (!schedule) return;
    const baseAgents = opts.rowScope === 'all' ? schedule.agents : displayedAgents;
    const q = opts.searchText.trim().toLowerCase();
    const agentsList = baseAgents.filter(
      (a) =>
        !q ||
        a.agentName.toLowerCase().includes(q) ||
        (a.sid || '').toLowerCase().includes(q)
    );
    const baseDays = opts.colScope === 'visible' ? visibleDayKeys : schedule.days;
    const daysList = baseDays.filter((d) => matchesDateRange(d, opts.fromDate, opts.toDate));
    const includeSid = opts.colScope === 'all' || showSidCol;

    const rows = agentsList.map((agent) => {
      const out: Record<string, unknown> = {
        Branch: activeBranch,
        Agent: agent.agentName,
      };
      if (includeSid) out['SID'] = agent.sid || '';
      for (const day of daysList) {
        out[day] = schedule.cells[agent.agentKey]?.[day]?.shift || '';
      }
      return out;
    });
    await downloadXlsxSheet(
      `store_schedule_${activeBranch}_${selectedMonth}.xlsx`,
      selectedMonth,
      rows
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

      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
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
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

      {/* Single-Row Unified Toolbar */}
      <FilterBar
        search={agentQuery}
        onSearchChange={setAgentQuery}
        showDateFilters
        extraFilters={
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              aria-label="Month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs font-mono tabular-nums font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              {fyMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        }
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={agentQuery}
            disabled={!activeBranch}
          />
        }
        onOpenImport={canEdit ? () => setShowImport(true) : undefined}
        onAddNew={canEdit ? openAddModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <ColumnControlMenu
            columns={SCHEDULE_COLUMNS}
            hiddenKeys={hiddenCols}
            columnOrder={colOrder}
            onToggleColumn={handleToggleColumn}
            onMoveColumn={handleMoveColumn}
            onResetColumns={handleResetColumns}
            rowLimit={rowLimit}
            onRowLimitChange={setRowLimit}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onAddRow={canEdit ? openAddModal : undefined}
            totalRowsCount={filteredAgents.length}
          />
        }
      />

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
      ) : !schedule || displayedAgents.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 space-y-3">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {language === 'ar'
              ? 'لا يوجد موظفون مطابقون في الجدول بعد'
              : 'No matching roster agents found in schedule'}
          </p>
          <p>
            {language === 'ar'
              ? 'أضف وردية موظف جديدة مباشرة أو استورد أي ملف Excel / CSV.'
              : 'Add a shift record directly or import any Excel / CSV schedule sheet.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addRecord')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Schedule Grid */}
          <div className="hidden md:block rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="text-[11px] border-collapse">
                <thead className="bg-[#092d52] text-white">
                  <tr>
                    <th className="sticky start-0 z-20 bg-[#092d52] px-3 py-2.5 text-start font-semibold min-w-[160px] border-e border-white/10">
                      {language === 'ar' ? 'الموظف' : 'Agent'}
                    </th>
                    {showSidCol && (
                      <th className="px-2.5 py-2.5 text-start font-semibold whitespace-nowrap border-e border-white/10">
                        SID
                      </th>
                    )}
                    {visibleDayKeys.map((d) => (
                      <th
                        key={d}
                        className="px-1.5 py-2.5 text-center font-mono tabular-nums font-semibold whitespace-nowrap min-w-[78px]"
                      >
                        {d.slice(8)}/{d.slice(5, 7)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedAgents.map((agent) => (
                    <tr
                      key={agent.agentKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="sticky start-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-semibold text-slate-900 dark:text-white border-e border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {agent.agentName}
                      </td>
                      {showSidCol && (
                        <td className="px-2.5 py-2 font-mono tabular-nums text-slate-500 border-e border-slate-100 dark:border-slate-800 whitespace-nowrap">
                          {agent.sid || '—'}
                        </td>
                      )}
                      {visibleDayKeys.map((day) => {
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
            {displayedAgents.map((agent) => (
              <div
                key={agent.agentKey}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {agent.agentName}
                  </span>
                  {showSidCol && (
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {agent.sid || '—'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {visibleDayKeys.map((day) => {
                    const val = schedule.cells[agent.agentKey]?.[day]?.shift || '';
                    return (
                      <div key={day} className="space-y-0.5">
                        <div className="text-[10px] font-mono tabular-nums text-slate-400 text-center">
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

      {/* Single-Column Add Shift Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddRecordSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('addShiftRecord')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t('empName')} *
                </label>
                <input
                  type="text"
                  required
                  list="schedule-agent-suggestions"
                  value={addForm.agentName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const schedMatch = schedule?.agents.find((a) => a.agentName === name);
                    const empMatch = employees.find(
                      (emp) => emp.name === name || emp.nameAr === name
                    );
                    const matchedSid =
                      schedMatch?.sid || empMatch?.sid || empMatch?.identifier || '';
                    setAddForm((prev) => ({
                      ...prev,
                      agentName: name,
                      sid: matchedSid || prev.sid,
                    }));
                  }}
                  placeholder={language === 'ar' ? 'اسم الموظف' : 'Agent name'}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <datalist id="schedule-agent-suggestions">
                  {employees.map((emp) => (
                    <option key={emp.id} value={language === 'ar' ? emp.nameAr || emp.name : emp.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  SID
                </label>
                <input
                  type="text"
                  value={addForm.sid}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, sid: e.target.value }))}
                  placeholder="SID / Staff ID"
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t('businessDate')} *
                </label>
                <input
                  type="date"
                  required
                  value={addForm.date}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'الوردية' : 'Shift'} *
                </label>
                <select
                  value={addForm.shift}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, shift: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                >
                  {SHIFT_OPTIONS.filter((opt) => opt !== '').map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t('taskNotes')}
                </label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 min-h-[38px] rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer disabled:opacity-50"
              >
                {addSaving ? '...' : t('saveRecord')}
              </button>
            </div>
          </form>
        </div>
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

