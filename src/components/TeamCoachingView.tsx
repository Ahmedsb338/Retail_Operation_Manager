import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Employee, CoachingStatus } from '../types';
import {
  UserCheck,
  Plus,
  Edit2,
  X,
  History,
  Printer,
  CheckCircle2,
  Lock,
  AlertTriangle,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import { FilterBar } from './shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type RowSortOrder,
} from './shared/ColumnControlMenu';

const COACHING_COLUMNS = [
  { key: 'name', label: 'Employee', labelAr: 'الموظف' },
  { key: 'role', label: 'Role', labelAr: 'الدور' },
  { key: 'knowledge', label: 'Knowledge %', labelAr: 'المعرفة %' },
  { key: 'productivity', label: 'Prod. %', labelAr: 'الإنتاجية %' },
  { key: 'csat', label: 'CSAT %', labelAr: 'CSAT %' },
  { key: 'status', label: 'Coaching Status', labelAr: 'الحالة' },
  { key: 'followUp', label: 'Follow-up Date', labelAr: 'تاريخ المتابعة' },
];

interface TeamCoachingViewProps {
  isAddCoachingModalOpen: boolean;
  setIsAddCoachingModalOpen: (open: boolean) => void;
}

export const TeamCoachingView: React.FC<TeamCoachingViewProps> = ({
  isAddCoachingModalOpen,
  setIsAddCoachingModalOpen,
}) => {
  const {
    t,
    language,
    canEdit,
    employees,
    addEmployee,
    updateEmployee,
    addCoachingSession,
    currentBranch,
    dateRange,
  } = useApp();

  const [selectedEmpForSession, setSelectedEmpForSession] = useState<Employee | null>(null);
  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<Employee | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => COACHING_COLUMNS.map((c) => c.key));

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(COACHING_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (dateRange.fromDate || dateRange.toDate) {
        const dateCandidate = e.followUpDate || e.history[0]?.date || '';
        if (!dateCandidate || !matchesDateRange(dateCandidate, dateRange.fromDate, dateRange.toDate)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.nameAr || '').toLowerCase().includes(q) ||
        (e.identifier || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q) ||
        e.coachingStatus.toLowerCase().includes(q)
      );
    });
  }, [employees, search, dateRange.fromDate, dateRange.toDate]);

  const displayedEmployees = useMemo(
    () =>
      applyRowControls(
        filteredEmployees,
        rowLimit,
        sortOrder,
        (e) => e.followUpDate || e.history[0]?.date || ''
      ),
    [filteredEmployees, rowLimit, sortOrder]
  );

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const baseList = opts.rowScope === 'all' ? employees : displayedEmployees;
    const q = opts.searchText.trim().toLowerCase();
    const list = baseList.filter((e) => {
      if (opts.fromDate || opts.toDate) {
        const d = e.followUpDate || e.history[0]?.date || '';
        if (!d || !matchesDateRange(d, opts.fromDate, opts.toDate)) return false;
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.nameAr || '').toLowerCase().includes(q) ||
        (e.identifier || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleColumns : COACHING_COLUMNS;
    const rows = list.map((emp) => {
      const out: Record<string, unknown> = { Branch: emp.branchCode };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr : col.label;
        if (col.key === 'name') out[header] = language === 'ar' ? emp.nameAr || emp.name : emp.name;
        else if (col.key === 'role') out[header] = language === 'ar' ? emp.roleAr || emp.role : emp.role;
        else if (col.key === 'knowledge') out[header] = emp.productKnowledgeScore ?? '';
        else if (col.key === 'productivity') out[header] = emp.productivityScore ?? '';
        else if (col.key === 'csat') out[header] = emp.customerExperienceScore ?? '';
        else if (col.key === 'status') out[header] = emp.coachingStatus;
        else if (col.key === 'followUp') out[header] = emp.followUpDate || '';
      }
      return out;
    });
    await downloadXlsxSheet('team_coaching.xlsx', 'Coaching', rows);
  };

  const today = new Date().toISOString().slice(0, 10);

  // Member modal form states (nullable scores preserved)
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('Sales Specialist');
  const [roleAr, setRoleAr] = useState('أخصائي مبيعات');
  const [productKnowledgeScore, setProductKnowledgeScore] = useState('');
  const [productivityScore, setProductivityScore] = useState('');
  const [customerExperienceScore, setCustomerExperienceScore] = useState('');
  const [coachingStatus, setCoachingStatus] = useState<CoachingStatus>('needs_coaching');
  const [developmentAreas, setDevelopmentAreas] = useState('');
  const [assignedCoach, setAssignedCoach] = useState('');
  const [followUpDate, setFollowUpDate] = useState(today);

  // Coaching session form states
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionCoach, setSessionCoach] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionAgreedActions, setSessionAgreedActions] = useState('');
  const [sessionImprovement, setSessionImprovement] = useState('');

  const parseNullableScore = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
  };

  const openAddMemberModal = () => {
    if (!canEdit) return;
    setName('');
    setNameAr('');
    setIdentifier('');
    setRole('Sales Specialist');
    setRoleAr('أخصائي مبيعات');
    setProductKnowledgeScore('');
    setProductivityScore('');
    setCustomerExperienceScore('');
    setCoachingStatus('needs_coaching');
    setDevelopmentAreas('');
    setAssignedCoach(currentBranch?.manager || '');
    setFollowUpDate(today);
    setEditingEmployee(null);
    setFormError(null);
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (emp: Employee) => {
    if (!canEdit) return;
    setName(emp.name);
    setNameAr(emp.nameAr || '');
    setIdentifier(emp.identifier);
    setRole(emp.role);
    setRoleAr(emp.roleAr || '');
    setProductKnowledgeScore(
      emp.productKnowledgeScore !== null ? String(emp.productKnowledgeScore) : ''
    );
    setProductivityScore(emp.productivityScore !== null ? String(emp.productivityScore) : '');
    setCustomerExperienceScore(
      emp.customerExperienceScore !== null ? String(emp.customerExperienceScore) : ''
    );
    setCoachingStatus(emp.coachingStatus);
    setDevelopmentAreas(emp.developmentAreas.join(', '));
    setAssignedCoach(emp.assignedCoach || currentBranch?.manager || '');
    setFollowUpDate(emp.followUpDate || today);
    setEditingEmployee(emp);
    setFormError(null);
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    setFormError(null);

    const devAreasArray = developmentAreas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingEmployee) {
        await updateEmployee({
          ...editingEmployee,
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          identifier: identifier.trim(),
          role: role.trim(),
          roleAr: roleAr.trim() || role.trim(),
          productKnowledgeScore: parseNullableScore(productKnowledgeScore),
          productivityScore: parseNullableScore(productivityScore),
          customerExperienceScore: parseNullableScore(customerExperienceScore),
          coachingStatus,
          developmentAreas: devAreasArray,
          assignedCoach: assignedCoach.trim(),
          followUpDate,
        });
      } else {
        await addEmployee({
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          identifier: identifier.trim(),
          role: role.trim(),
          roleAr: roleAr.trim() || role.trim(),
          productKnowledgeScore: parseNullableScore(productKnowledgeScore),
          productivityScore: parseNullableScore(productivityScore),
          customerExperienceScore: parseNullableScore(customerExperienceScore),
          coachingStatus,
          developmentAreas: devAreasArray,
          coachingNotes: '',
          agreedActions: '',
          assignedCoach: assignedCoach.trim(),
          followUpDate,
          progressStatus: 'pending',
        });
      }
      setIsMemberModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const openCoachingModal = (emp: Employee) => {
    if (!canEdit) return;
    setSelectedEmpForSession(emp);
    setSessionTopic(
      `1-on-1 Development Session on ${emp.developmentAreas[0] || 'Core Objectives'}`
    );
    setSessionCoach(emp.assignedCoach || currentBranch?.manager || 'Store Manager');
    setSessionNotes('');
    setSessionAgreedActions('');
    setSessionImprovement('');
    setFormError(null);
    setIsAddCoachingModalOpen(true);
  };

  const handleSaveCoachingSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !selectedEmpForSession) return;
    setSaving(true);
    setFormError(null);
    try {
      await addCoachingSession(selectedEmpForSession.id, {
        date: today,
        coach: sessionCoach.trim(),
        topic: sessionTopic.trim(),
        notes: sessionNotes.trim(),
        agreedActions: sessionAgreedActions.trim(),
        scoreImprovement: sessionImprovement.trim(),
      });
      setIsAddCoachingModalOpen(false);
      setToastMsg(
        language === 'ar'
          ? 'تم تسجيل جلسة التوجيه في قاعدة البيانات بنجاح'
          : 'Coaching session recorded in database'
      );
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to record coaching session.');
    } finally {
      setSaving(false);
    }
  };

  const coachingPlannerCandidates = displayedEmployees.filter(
    (e) =>
      e.coachingStatus === 'needs_coaching' ||
      (e.productKnowledgeScore !== null && e.productKnowledgeScore < 75) ||
      (e.productivityScore !== null && e.productivityScore < 75) ||
      (e.customerExperienceScore !== null && e.customerExperienceScore < 75)
  );

  const renderMetricLabel = (score: number | null) =>
    score === null ? t('unconfigured') : `${score}%`;

  return (
    <div className="space-y-6 content-container">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="no-print pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
          {currentBranch && (
            <>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                {currentBranch.code}
              </span>
              <span>·</span>
              <span>{language === 'ar' ? currentBranch.nameAr : currentBranch.name}</span>
            </>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-teal-600" />
          <span>{t('teamTitle')}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('teamSubtitle')}
        </p>
      </div>

      {/* Single-Row Unified Toolbar */}
      <div className="no-print">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          showDateFilters
          exportMenu={
            <ExportExcelMenu
              onExport={handleFilteredExport}
              defaultFromDate={dateRange.fromDate}
              defaultToDate={dateRange.toDate}
              defaultSearchText={search}
            />
          }
          onAddNew={canEdit ? openAddMemberModal : undefined}
          addLabel={t('addRecord')}
          rightActions={
            <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1 px-2 min-h-[30px] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-[#092d52] dark:text-teal-300'
                      : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t('cardsView')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1 px-2 min-h-[30px] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-[#092d52] dark:text-teal-300'
                      : 'text-slate-500'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>{t('tableView')}</span>
                </button>
              </div>

              <ColumnControlMenu
                columns={COACHING_COLUMNS}
                hiddenKeys={hiddenCols}
                columnOrder={colOrder}
                onToggleColumn={(key) =>
                  setHiddenCols((prev) =>
                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                  )
                }
                onMoveColumn={(key, dir) => {
                  const idx = colOrder.indexOf(key);
                  const swap = dir === 'up' ? idx - 1 : idx + 1;
                  if (idx < 0 || swap < 0 || swap >= colOrder.length) return;
                  const next = [...colOrder];
                  [next[idx], next[swap]] = [next[swap], next[idx]];
                  setColOrder(next);
                }}
                onResetColumns={() => {
                  setHiddenCols([]);
                  setColOrder(COACHING_COLUMNS.map((c) => c.key));
                }}
                rowLimit={rowLimit}
                onRowLimitChange={setRowLimit}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                onAddRow={canEdit ? openAddMemberModal : undefined}
                totalRowsCount={filteredEmployees.length}
              />

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] text-xs font-semibold rounded-xl bg-[#092d52] hover:bg-[#0c3b6b] text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
              </button>
            </div>
          }
        />
      </div>

      {!canEdit && (
        <div className="no-print p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

      {/* Print Document Header */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
              ASB WORKFORCE · COACHING & DEVELOPMENT RECORD
            </span>
            <h2 className="text-xl font-black mt-1">Branch Coaching & Performance Plan</h2>
            <p className="text-xs text-slate-600">
              {currentBranch?.name} ({currentBranch?.code}) · {currentBranch?.city}
            </p>
          </div>
          <div className="text-end text-xs font-mono space-y-0.5">
            <div>
              <strong>Date:</strong> {currentBranch?.businessDate || today}
            </div>
            <div>
              <strong>Manager:</strong> {currentBranch?.manager || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Priority Coaching Planner */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('coachingPlanner')} ({coachingPlannerCandidates.length}{' '}
              {language === 'ar' ? 'مرشحين للتطوير' : 'candidates'})
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {t('coachingPriorityDesc')}
            </p>
          </div>
        </div>

        {coachingPlannerCandidates.length === 0 ? (
          <p className="text-xs text-slate-500 mt-3">{t('noRecords')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
            {coachingPlannerCandidates.map((emp) => (
              <div
                key={emp.id}
                className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-amber-200/60 dark:border-amber-900/40 shadow-xs flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                    </span>
                    {emp.identifier && (
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        ({emp.identifier})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {language === 'ar' ? emp.roleAr || emp.role : emp.role}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono-numbers mt-1 text-slate-600 dark:text-slate-300">
                    <span
                      className={
                        emp.productKnowledgeScore !== null && emp.productKnowledgeScore < 75
                          ? 'text-rose-500 font-bold'
                          : ''
                      }
                    >
                      Knowledge: {renderMetricLabel(emp.productKnowledgeScore)}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        emp.productivityScore !== null && emp.productivityScore < 75
                          ? 'text-rose-500 font-bold'
                          : ''
                      }
                    >
                      Prod: {renderMetricLabel(emp.productivityScore)}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        emp.customerExperienceScore !== null && emp.customerExperienceScore < 75
                          ? 'text-rose-500 font-bold'
                          : ''
                      }
                    >
                      CSAT: {renderMetricLabel(emp.customerExperienceScore)}
                    </span>
                  </div>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openCoachingModal(emp)}
                    className="no-print px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shrink-0 cursor-pointer shadow-xs"
                  >
                    {t('logCoachingSession')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Scorecard Cards / Table */}
      {displayedEmployees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-xs text-slate-500">{t('noRecords')}</p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddMemberModal}
              className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addRecord')}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#092d52] text-white">
                <tr>
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="px-3.5 py-2.5 font-semibold text-start whitespace-nowrap">
                      {language === 'ar' ? col.labelAr : col.label}
                    </th>
                  ))}
                  <th className="px-3.5 py-2.5 font-semibold text-end whitespace-nowrap">
                    {language === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    {visibleColumns.map((col) => {
                      if (col.key === 'name') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                          </td>
                        );
                      }
                      if (col.key === 'role') return <td key={col.key} className="px-3.5 py-2.5">{language === 'ar' ? emp.roleAr || emp.role : emp.role}</td>;
                      if (col.key === 'knowledge') return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{renderMetricLabel(emp.productKnowledgeScore)}</td>;
                      if (col.key === 'productivity') return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{renderMetricLabel(emp.productivityScore)}</td>;
                      if (col.key === 'csat') return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{renderMetricLabel(emp.customerExperienceScore)}</td>;
                      if (col.key === 'status') return <td key={col.key} className="px-3.5 py-2.5">{emp.coachingStatus.replace('_', ' ')}</td>;
                      return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{emp.followUpDate || t('unconfigured')}</td>;
                    })}
                    <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openCoachingModal(emp)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 cursor-pointer"
                            >
                              {t('logCoachingSession')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditMemberModal(emp)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedEmpForHistory(emp)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedEmployees.map((emp) => (
            <div
              key={emp.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {language === 'ar' ? emp.roleAr || emp.role : emp.role}
                      {emp.identifier ? ` · ${emp.identifier}` : ''} ·{' '}
                      <span className="font-mono">{emp.branchCode}</span>
                    </div>
                  </div>

                  <div className="no-print flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditMemberModal(emp)}
                        className="p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer"
                        title={t('editEmployee')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEmpForHistory(emp)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                      title={t('coachingHistory')}
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nullable Score Indicators */}
                <div className="space-y-1.5 mb-3">
                  {[
                    { label: t('knowledgeScore'), score: emp.productKnowledgeScore },
                    { label: t('productivityScore'), score: emp.productivityScore },
                    { label: t('csatScore'), score: emp.customerExperienceScore },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="font-mono font-semibold">
                          {renderMetricLabel(m.score)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        {m.score !== null && (
                          <div
                            className={`h-full rounded-full ${
                              m.score >= 80 ? 'bg-teal-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${m.score}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {emp.agreedActions && (
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                    <strong className="text-slate-800 dark:text-slate-200">Agreed Action: </strong>
                    {emp.agreedActions}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-mono">
                  Review: {emp.followUpDate || t('unconfigured')}
                </span>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openCoachingModal(emp)}
                    className="no-print px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 hover:bg-teal-100 cursor-pointer"
                  >
                    {t('logCoachingSession')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Coaching Session Modal */}
      {canEdit && isAddCoachingModalOpen && selectedEmpForSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {t('logCoachingSession')}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedEmpForSession.name}{' '}
                  {selectedEmpForSession.identifier ? `(${selectedEmpForSession.identifier})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCoachingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCoachingSession} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Topic / Skill Focus
                </label>
                <input
                  type="text"
                  required
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Assigned Coach
                </label>
                <input
                  type="text"
                  required
                  value={sessionCoach}
                  onChange={(e) => setSessionCoach(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Session Diagnostic Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Agreed Action Plan & Next Checkpoint
                </label>
                <textarea
                  rows={2}
                  required
                  value={sessionAgreedActions}
                  onChange={(e) => setSessionAgreedActions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCoachingModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {saving ? '...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {canEdit && isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {editingEmployee ? t('editEmployee') : t('addEmployee')}
              </h3>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMember} className="grid grid-cols-1 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Name (EN)</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">الاسم (العربية)</label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">SID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Knowledge % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={t('unconfigured')}
                  value={productKnowledgeScore}
                  onChange={(e) => setProductKnowledgeScore(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Productivity % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={t('unconfigured')}
                  value={productivityScore}
                  onChange={(e) => setProductivityScore(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">CSAT % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={t('unconfigured')}
                  value={customerExperienceScore}
                  onChange={(e) => setCustomerExperienceScore(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {saving ? '...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coaching History Modal */}
      {selectedEmpForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Coaching History: {selectedEmpForHistory.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedEmpForHistory.identifier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmpForHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {selectedEmpForHistory.history.length > 0 ? (
                selectedEmpForHistory.history.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      <span>{h.topic}</span>
                      <span className="font-mono text-slate-400 text-[10px]">{h.date}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">{h.notes}</p>
                    <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                      Action: {h.agreedActions}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No previous coaching sessions recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
