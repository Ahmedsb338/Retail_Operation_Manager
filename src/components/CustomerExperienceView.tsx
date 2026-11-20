import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Edit2,
  Trash2,
  X,
  Lock,
  AlertTriangle,
  Plus,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CaseStatus, CustomerCase } from '../types';
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

const COMPLAINT_COLUMNS = [
  { key: 'caseNumber', label: 'Complaint #', labelAr: 'رقم الشكوى' },
  { key: 'issueCategory', label: 'Category', labelAr: 'التصنيف' },
  { key: 'status', label: 'Status', labelAr: 'الحالة' },
  { key: 'rootCause', label: 'Root Cause', labelAr: 'السبب الجذري' },
  { key: 'assignedOwner', label: 'Owner', labelAr: 'المسؤول' },
  { key: 'date', label: 'Date', labelAr: 'التاريخ' },
];

interface CustomerExperienceViewProps {
  isAddCaseModalOpen: boolean;
  setIsAddCaseModalOpen: (open: boolean) => void;
}

export const CustomerExperienceView: React.FC<CustomerExperienceViewProps> = ({
  isAddCaseModalOpen,
  setIsAddCaseModalOpen,
}) => {
  const {
    t,
    language,
    user,
    canEdit,
    cases,
    addCase,
    updateCase,
    deleteCase,
    selectedBranchCode,
    dateRange,
    refreshWorkspaceData,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => COMPLAINT_COLUMNS.map((c) => c.key));
  const [editingCase, setEditingCase] = useState<CustomerCase | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(COMPLAINT_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  const today = new Date().toISOString().slice(0, 10);
  const [caseNumber, setCaseNumber] = useState('');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [agentName, setAgentName] = useState('');
  const [caseDate, setCaseDate] = useState(today);
  const [issueCategory, setIssueCategory] = useState('Service Delay');
  const [description, setDescription] = useState('');
  const [isRepeated, setIsRepeated] = useState(false);
  const [repeatedMatchCriteria, setRepeatedMatchCriteria] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [assignedOwner, setAssignedOwner] = useState('');
  const [resolutionDeadline, setResolutionDeadline] = useState(today);
  const [status, setStatus] = useState<CaseStatus>('pending');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const openAddModal = () => {
    const num = `CMP-${Math.floor(1000 + Math.random() * 8999)}`;
    setCaseNumber(num);
    setCustomerIdentifier('');
    setAgentName('');
    setCaseDate(today);
    setIssueCategory('Service Delay');
    setDescription('');
    setIsRepeated(false);
    setRepeatedMatchCriteria('');
    setRootCause('');
    setAssignedOwner('');
    setResolutionDeadline(today);
    setStatus('pending');
    setCorrectiveAction('');
    setResolutionNotes('');
    setEditingCase(null);
    setFormError(null);
    setIsAddCaseModalOpen(true);
  };

  const openEditModal = (c: CustomerCase) => {
    setCaseNumber(c.caseNumber);
    setCustomerIdentifier(c.customerIdentifier);
    setAgentName(c.agentName || '');
    setCaseDate((c.date || today).slice(0, 10));
    setIssueCategory(c.issueCategory || c.category || '');
    setDescription(c.description);
    setIsRepeated(c.isRepeated);
    setRepeatedMatchCriteria(c.repeatedMatchCriteria);
    setRootCause(c.rootCause);
    setAssignedOwner(c.assignedOwner);
    setResolutionDeadline((c.resolutionDeadline || today).slice(0, 10));
    setStatus(c.status);
    setCorrectiveAction(c.correctiveAction);
    setResolutionNotes(c.resolutionNotes || '');
    setEditingCase(c);
    setFormError(null);
    setIsAddCaseModalOpen(true);
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !caseNumber.trim() || !issueCategory.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingCase) {
        await updateCase({
          ...editingCase,
          caseNumber: caseNumber.trim(),
          customerIdentifier,
          agentName,
          date: caseDate,
          issueCategory: issueCategory.trim(),
          issueCategoryAr: issueCategory.trim(),
          description,
          isRepeated,
          repeatedMatchCriteria,
          rootCause,
          rootCauseAr: rootCause,
          assignedOwner,
          resolutionDeadline,
          status,
          correctiveAction,
          resolutionNotes,
        });
      } else {
        await addCase({
          caseNumber: caseNumber.trim(),
          customerIdentifier,
          agentName,
          date: caseDate,
          issueCategory: issueCategory.trim(),
          issueCategoryAr: issueCategory.trim(),
          description,
          isRepeated,
          repeatedMatchCriteria,
          rootCause,
          rootCauseAr: rootCause,
          assignedOwner,
          resolutionDeadline,
          status,
          correctiveAction,
          resolutionNotes,
        });
      }
      setIsAddCaseModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save complaint.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    await deleteCase(id);
    setConfirmDeleteId(null);
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (!matchesDateRange(c.date || c.createdAt, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          c.caseNumber.toLowerCase().includes(q) ||
          c.customerIdentifier.toLowerCase().includes(q) ||
          c.issueCategory.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.agentName || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      return true;
    });
  }, [cases, searchQuery, selectedStatus, dateRange.fromDate, dateRange.toDate]);

  const displayedCases = useMemo(
    () =>
      applyRowControls(filteredCases, rowLimit, sortOrder, (c) => c.date || c.createdAt || ''),
    [filteredCases, rowLimit, sortOrder]
  );

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const isDefaultFull =
      opts.rowScope === 'all' &&
      opts.colScope === 'all' &&
      !opts.searchText.trim();

    if (isDefaultFull) {
      const qs = buildQueryParams({
        branchCode:
          user?.role === 'AREA_MANAGER'
            ? selectedBranchCode || undefined
            : user?.branchCode || undefined,
        fromDate: opts.fromDate || undefined,
        toDate: opts.toDate || undefined,
        format: 'xlsx',
      });
      await apiDownloadFile(`/api/v1/complaints/export${qs}`, 'complaints.xlsx');
      return;
    }

    const baseList = opts.rowScope === 'all' ? cases : displayedCases;
    const q = opts.searchText.trim().toLowerCase();
    const exportList = baseList.filter((c) => {
      if (!matchesDateRange(c.date || c.createdAt, opts.fromDate, opts.toDate)) {
        return false;
      }
      if (opts.rowScope === 'filtered' && selectedStatus !== 'all' && c.status !== selectedStatus) {
        return false;
      }
      if (!q) return true;
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.customerIdentifier.toLowerCase().includes(q) ||
        c.issueCategory.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.agentName || '').toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleColumns : COMPLAINT_COLUMNS;
    const sheetRows = exportList.map((c) => {
      const out: Record<string, unknown> = { 'Store ID': c.branchCode };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr || col.label : col.label;
        if (col.key === 'caseNumber') out[header] = c.caseNumber;
        else if (col.key === 'issueCategory') out[header] = c.issueCategory;
        else if (col.key === 'status') out[header] = c.status;
        else if (col.key === 'rootCause') out[header] = c.rootCause || '';
        else if (col.key === 'assignedOwner') out[header] = c.assignedOwner || '';
        else out[header] = c.date || c.createdAt.slice(0, 10);
      }
      return out;
    });
    await downloadXlsxSheet('complaints.xlsx', 'Complaints', sheetRows);
  };

  return (
    <div className="space-y-4 content-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('cxTitle')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('cxSubtitle')}</p>
        </div>

        {!canEdit && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold self-start">
            <Lock className="w-3.5 h-3.5" />
            {t('readOnlyBadge')}
          </span>
        )}
      </div>

      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
        <span>{t('privacyNotice')}</span>
      </div>

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={searchQuery}
          />
        }
        onOpenImport={canEdit ? () => setShowImport(true) : undefined}
        onAddNew={canEdit ? openAddModal : undefined}
        addLabel={t('addRecord')}
        extraFilters={
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="under_review">{t('under_review')}</option>
            <option value="resolved">{t('resolved')}</option>
            <option value="escalated">{t('escalated')}</option>
          </select>
        }
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
              columns={COMPLAINT_COLUMNS}
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
                setColOrder(COMPLAINT_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddModal : undefined}
              totalRowsCount={filteredCases.length}
            />
          </div>
        }
      />

      {displayedCases.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-xs text-slate-500">
            {language === 'ar' ? 'لا توجد شكاوى مسجلة.' : 'No complaints logged yet.'}
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
                  <th className="px-3.5 py-2.5 text-start font-semibold whitespace-nowrap">
                    {language === 'ar' ? 'كود الفرع' : 'Store ID'}
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="px-3.5 py-2.5 text-start font-semibold whitespace-nowrap">
                      {language === 'ar' ? col.labelAr : col.label}
                    </th>
                  ))}
                  {canEdit && (
                    <th className="px-3.5 py-2.5 text-end font-semibold whitespace-nowrap">
                      {language === 'ar' ? 'إجراءات' : 'Actions'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-2.5 font-mono tabular-nums font-bold text-[#092d52] dark:text-teal-400">
                      {c.branchCode}
                    </td>
                    {visibleColumns.map((col) => {
                      if (col.key === 'caseNumber') return <td key={col.key} className="px-3.5 py-2.5 font-mono font-semibold">#{c.caseNumber}</td>;
                      if (col.key === 'issueCategory') return <td key={col.key} className="px-3.5 py-2.5">{c.issueCategory}</td>;
                      if (col.key === 'status') return <td key={col.key} className="px-3.5 py-2.5">{c.status}</td>;
                      if (col.key === 'rootCause') return <td key={col.key} className="px-3.5 py-2.5">{c.rootCause || '—'}</td>;
                      if (col.key === 'assignedOwner') return <td key={col.key} className="px-3.5 py-2.5">{c.assignedOwner || '—'}</td>;
                      return <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums">{c.date || c.createdAt.slice(0, 10)}</td>;
                    })}
                    {canEdit && (
                      <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => openEditModal(c)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer">
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
        <div className="space-y-3">
          {displayedCases.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#092d52] dark:text-teal-400">
                    {c.branchCode}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    #{c.caseNumber}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {c.issueCategory}
                  </span>
                  {c.isRepeated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" /> Repeated
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] uppercase">
                    {c.status}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {c.description && (
                <p className="text-xs text-slate-700 dark:text-slate-300">{c.description}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 pt-1">
                <div>Root Cause: {c.rootCause || '—'}</div>
                <div>Owner: {c.assignedOwner || '—'}</div>
                <div>Date: {c.date || c.createdAt.slice(0, 10)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddCaseModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingCase ? t('editCase') : t('addCase')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCaseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCase} className="p-5 grid grid-cols-1 gap-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('caseNumber')} *</label>
                <input
                  required
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {language === 'ar' ? 'التاريخ *' : 'Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={caseDate}
                  onChange={(e) => setCaseDate(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('issueCategory')} *</label>
                <input
                  required
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('caseStatus')}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="pending">{t('pending')}</option>
                  <option value="under_review">{t('under_review')}</option>
                  <option value="resolved">{t('resolved')}</option>
                  <option value="escalated">{t('escalated')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('clientIdentifier')}</label>
                <input
                  value={customerIdentifier}
                  onChange={(e) => setCustomerIdentifier(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {language === 'ar' ? 'المسؤول المكلف' : 'Assigned Owner'}
                </label>
                <input
                  value={assignedOwner}
                  onChange={(e) => setAssignedOwner(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('rootCause')}</label>
                <input
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('correctiveAction')}</label>
                <input
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRepeated}
                  onChange={(e) => setIsRepeated(e.target.checked)}
                />
                <span>Flag as Repeated Issue</span>
              </label>

              {formError && <div className="text-rose-600 font-semibold">{formError}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCaseModalOpen(false)}
                  className="px-3.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[36px] rounded-xl bg-teal-600 text-white font-bold"
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
          title={`${t('importData')} — ${t('navComplaints')}`}
          endpoint="/api/v1/complaints/import"
          expectedHeadersHint="Case Number, Date (YYYY-MM-DD), Category, Status, Customer Identifier, Agent Name, Owner, Description, Root Cause"
          onClose={() => setShowImport(false)}
          onSuccess={refreshWorkspaceData}
        />
      )}
    </div>
  );
};
