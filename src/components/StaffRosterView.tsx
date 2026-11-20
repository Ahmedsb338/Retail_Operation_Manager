import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  UserCheck,
  Briefcase,
  Award,
  Lock,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Employee } from '../types';
import { apiDownloadFile, buildQueryParams } from '../services/apiClient';
import { FilterBar } from './shared/FilterBar';
import { ImportSummaryModal } from './shared/ImportSummaryModal';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type RowSortOrder,
} from './shared/ColumnControlMenu';

const STAFF_COLUMNS = [
  { key: 'name', label: 'Employee Name', labelAr: 'اسم الموظف' },
  { key: 'sid', label: 'SID', labelAr: 'الكود الوظيفي' },
  { key: 'role', label: 'Role', labelAr: 'المسمى الوظيفي' },
  { key: 'knowledge', label: 'Knowledge %', labelAr: 'المعرفة %' },
  { key: 'productivity', label: 'Productivity %', labelAr: 'الإنتاجية %' },
  { key: 'csat', label: 'CSAT %', labelAr: 'رضا العملاء %' },
  { key: 'coachingStatus', label: 'Coaching Status', labelAr: 'حالة التوجيه' },
  { key: 'sessions', label: 'Sessions', labelAr: 'الجلسات' },
];

export const StaffRosterView: React.FC = () => {
  const {
    t,
    language,
    user,
    canEdit,
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    currentBranch,
    selectedBranchCode,
    dateRange,
    refreshWorkspaceData,
  } = useApp();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => STAFF_COLUMNS.map((c) => c.key));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('Sales Specialist');
  const [roleAr, setRoleAr] = useState('أخصائي مبيعات');
  const [knowledge, setKnowledge] = useState<string>('');
  const [productivity, setProductivity] = useState<string>('');
  const [csat, setCsat] = useState<string>('');
  const [notes, setNotes] = useState('');

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(STAFF_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
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

  const openAddModal = () => {
    setName('');
    setNameAr('');
    setIdentifier('');
    setRole('Sales Specialist');
    setRoleAr('أخصائي مبيعات');
    setKnowledge('');
    setProductivity('');
    setCsat('');
    setNotes('');
    setEditingEmp(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setName(emp.name);
    setNameAr(emp.nameAr || '');
    setIdentifier(emp.identifier || '');
    setRole(emp.role || '');
    setRoleAr(emp.roleAr || '');
    setKnowledge(emp.productKnowledgeScore === null ? '' : String(emp.productKnowledgeScore));
    setProductivity(emp.productivityScore === null ? '' : String(emp.productivityScore));
    setCsat(emp.customerExperienceScore === null ? '' : String(emp.customerExperienceScore));
    setNotes(emp.coachingNotes || '');
    setEditingEmp(emp);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const kScore = knowledge.trim() === '' ? null : Math.min(100, Math.max(0, Number(knowledge)));
      const pScore = productivity.trim() === '' ? null : Math.min(100, Math.max(0, Number(productivity)));
      const cScore = csat.trim() === '' ? null : Math.min(100, Math.max(0, Number(csat)));

      if (editingEmp) {
        await updateEmployee({
          ...editingEmp,
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          identifier: identifier.trim(),
          role: role.trim(),
          roleAr: roleAr.trim() || role.trim(),
          productKnowledgeScore: kScore,
          productivityScore: pScore,
          customerExperienceScore: cScore,
          coachingNotes: notes,
        });
      } else {
        await addEmployee({
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          identifier: identifier.trim(),
          role: role.trim(),
          roleAr: roleAr.trim() || role.trim(),
          productKnowledgeScore: kScore,
          productivityScore: pScore,
          customerExperienceScore: cScore,
          coachingStatus: 'on_track',
          developmentAreas: [],
          coachingNotes: notes,
          agreedActions: '',
          assignedCoach: currentBranch?.manager || 'Store Manager',
          followUpDate: '',
          progressStatus: 'pending',
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    await deleteEmployee(id);
    setConfirmDeleteId(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (dateRange.fromDate || dateRange.toDate) {
        const latestHistoryDate = e.history[0]?.date || '';
        const dateCandidate = e.followUpDate || latestHistoryDate;
        if (dateCandidate && !matchesDateRange(dateCandidate, dateRange.fromDate, dateRange.toDate)) {
          return false;
        }
        if (!dateCandidate) return false;
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.nameAr.toLowerCase().includes(q) ||
        (e.identifier || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q)
      );
    });
  }, [employees, search, dateRange.fromDate, dateRange.toDate]);

  const displayedEmployees = useMemo(
    () =>
      applyRowControls(filtered, rowLimit, sortOrder, (e) => e.followUpDate || e.history[0]?.date || ''),
    [filtered, rowLimit, sortOrder]
  );

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    if (opts.rowScope === 'all' && opts.colScope === 'all' && !opts.searchText.trim() && !opts.fromDate && !opts.toDate) {
      const qs = buildQueryParams({
        branchCode:
          user?.role === 'AREA_MANAGER'
            ? selectedBranchCode || undefined
            : user?.branchCode || undefined,
        format: 'xlsx',
      });
      await apiDownloadFile(`/api/v1/staff/export${qs}`, 'staff_roster.xlsx');
      return;
    }

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
        e.nameAr.toLowerCase().includes(q) ||
        (e.identifier || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleColumns : STAFF_COLUMNS;
    const rows = list.map((emp) => {
      const out: Record<string, unknown> = { 'Store ID': emp.branchCode };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr : col.label;
        if (col.key === 'name') out[header] = language === 'ar' ? emp.nameAr || emp.name : emp.name;
        else if (col.key === 'sid') out[header] = emp.identifier || '';
        else if (col.key === 'role') out[header] = language === 'ar' ? emp.roleAr || emp.role : emp.role;
        else if (col.key === 'knowledge') out[header] = emp.productKnowledgeScore ?? '';
        else if (col.key === 'productivity') out[header] = emp.productivityScore ?? '';
        else if (col.key === 'csat') out[header] = emp.customerExperienceScore ?? '';
        else if (col.key === 'coachingStatus') out[header] = emp.coachingStatus;
        else if (col.key === 'sessions') out[header] = emp.history.length;
      }
      return out;
    });
    await downloadXlsxSheet('staff_roster.xlsx', 'Staff Roster', rows);
  };

  return (
    <div className="space-y-4 content-container">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#092d52] dark:text-teal-400" />
          <span>{t('teamTitle')}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('teamSubtitle')}</p>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

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
        onOpenImport={canEdit ? () => setShowImport(true) : undefined}
        onAddNew={canEdit ? openAddModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
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
            </div>

            <ColumnControlMenu
              columns={STAFF_COLUMNS}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={handleToggleColumn}
              onMoveColumn={handleMoveColumn}
              onResetColumns={() => {
                setHiddenCols([]);
                setColOrder(STAFF_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddModal : undefined}
              totalRowsCount={filtered.length}
            />
          </div>
        }
      />

      {displayedEmployees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-xs text-slate-500">
            {language === 'ar'
              ? 'لا يوجد موظفون مسجلون لهذا النطاق بعد.'
              : 'No staff members recorded for this branch scope yet.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
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
                  <th className="px-3.5 py-2.5 font-semibold text-start whitespace-nowrap">
                    {language === 'ar' ? 'كود الفرع' : 'Store ID'}
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="px-3.5 py-2.5 font-semibold text-start whitespace-nowrap">
                      {language === 'ar' ? col.labelAr : col.label}
                    </th>
                  ))}
                  {canEdit && (
                    <th className="px-3.5 py-2.5 font-semibold text-end whitespace-nowrap">
                      {language === 'ar' ? 'إجراءات' : 'Actions'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-2.5 font-mono tabular-nums font-bold text-[#092d52] dark:text-teal-400">
                      {emp.branchCode}
                    </td>
                    {visibleColumns.map((col) => {
                      if (col.key === 'name') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                          </td>
                        );
                      }
                      if (col.key === 'sid') {
                        return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{emp.identifier || '—'}</td>;
                      }
                      if (col.key === 'role') {
                        return <td key={col.key} className="px-3.5 py-2.5">{language === 'ar' ? emp.roleAr || emp.role : emp.role}</td>;
                      }
                      if (col.key === 'knowledge') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">
                            {emp.productKnowledgeScore === null ? t('unconfiguredLabel') : `${emp.productKnowledgeScore}%`}
                          </td>
                        );
                      }
                      if (col.key === 'productivity') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">
                            {emp.productivityScore === null ? t('unconfiguredLabel') : `${emp.productivityScore}%`}
                          </td>
                        );
                      }
                      if (col.key === 'csat') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">
                            {emp.customerExperienceScore === null ? t('unconfiguredLabel') : `${emp.customerExperienceScore}%`}
                          </td>
                        );
                      }
                      if (col.key === 'coachingStatus') {
                        return <td key={col.key} className="px-3.5 py-2.5">{emp.coachingStatus.replace('_', ' ')}</td>;
                      }
                      return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{emp.history.length}</td>;
                    })}
                    {canEdit && (
                      <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            aria-label={t('editEmployee')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(emp.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                            aria-label={t('deleteRecord')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedEmployees.map((emp) => (
            <div
              key={emp.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono tabular-nums text-[#092d52] dark:text-teal-400 font-bold">
                        {emp.branchCode}
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{emp.identifier || 'No SID'}</span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(emp)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        aria-label={t('editEmployee')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(emp.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                        aria-label={t('deleteRecord')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-3">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ar' ? emp.roleAr || emp.role : emp.role}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono tabular-nums">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-[10px] text-slate-400">Knowledge</div>
                    <div className="font-bold">
                      {emp.productKnowledgeScore === null
                        ? t('unconfiguredLabel')
                        : `${emp.productKnowledgeScore}%`}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-[10px] text-slate-400">Prod.</div>
                    <div className="font-bold">
                      {emp.productivityScore === null
                        ? t('unconfiguredLabel')
                        : `${emp.productivityScore}%`}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-[10px] text-slate-400">CSAT</div>
                    <div className="font-bold">
                      {emp.customerExperienceScore === null
                        ? t('unconfiguredLabel')
                        : `${emp.customerExperienceScore}%`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                  {emp.coachingStatus.replace('_', ' ')}
                </span>
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  {emp.history.length} sessions
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal — Strict 1-Column Inputs */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingEmp ? t('editEmployee') : t('addEmployee')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 grid grid-cols-1 gap-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('empName')} *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}
                </label>
                <input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('empIdentifier')}</label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="SID"
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('empRole')}</label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('knowledgeScore')} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  placeholder={t('unconfiguredLabel')}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('productivityScore')} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={productivity}
                  onChange={(e) => setProductivity(e.target.value)}
                  placeholder={t('unconfiguredLabel')}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('csatScore')} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={csat}
                  onChange={(e) => setCsat(e.target.value)}
                  placeholder={t('unconfiguredLabel')}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {formError && <div className="text-rose-600 font-semibold">{formError}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[38px] rounded-xl bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {saving ? '...' : t('saveRecord')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-bold">{t('deleteRecord')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t('confirmDelete')}</p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-3.5 min-h-[36px] rounded-xl bg-rose-600 text-white font-bold"
              >
                {t('deleteRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportSummaryModal
          title={`${t('importData')} — ${t('navTeam')}`}
          endpoint="/api/v1/staff/import"
          expectedHeadersHint="Name, SID, Role, Knowledge Score, Productivity Score, CSAT Score, Coaching Status"
          onClose={() => setShowImport(false)}
          onSuccess={refreshWorkspaceData}
        />
      )}
    </div>
  );
};
