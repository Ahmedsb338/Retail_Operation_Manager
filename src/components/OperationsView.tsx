import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  X,
  History,
  Trash2,
  Edit2,
  Lock,
  Calendar,
  Plus,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
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

interface OperationsViewProps {
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

interface CustomColumnDef {
  key: string;
  label: string;
}

const CUSTOM_PREFIX = '__custom__:';
const BASE_TASK_COLUMNS = [
  { key: 'title', label: 'Task Title', labelAr: 'عنوان المهمة' },
  { key: 'category', label: 'Category', labelAr: 'الفئة' },
  { key: 'priority', label: 'Priority', labelAr: 'الأولوية' },
  { key: 'status', label: 'Status', labelAr: 'الحالة' },
  { key: 'owner', label: 'Owner', labelAr: 'المسؤول' },
  { key: 'deadline', label: 'Deadline', labelAr: 'الموعد النهائي' },
  { key: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
];

function parseCustomMeta(rawMeta: string): {
  baseText: string;
  customValues: Record<string, string>;
} {
  const customValues: Record<string, string> = {};
  const keptLines: string[] = [];
  for (const line of String(rawMeta || '').split('\n')) {
    const match = line.match(/^\[COL:([^\]]+)\]\s*(.*)$/);
    if (match) customValues[match[1].trim()] = match[2];
    else keptLines.push(line);
  }
  return { baseText: keptLines.join('\n').trim(), customValues };
}

function serializeCustomMeta(baseText: string, customValues: Record<string, string>): string {
  const cleanBase = baseText.trim();
  const customLines = Object.entries(customValues)
    .filter(([, val]) => val.trim() !== '')
    .map(([colLabel, val]) => `[COL:${colLabel}] ${val.trim()}`);
  return [cleanBase, ...customLines].filter(Boolean).join('\n');
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const {
    t,
    language,
    user,
    canEdit,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    currentBranch,
    employees,
    selectedBranchCode,
    dateRange,
    refreshWorkspaceData,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');

  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => BASE_TASK_COLUMNS.map((c) => c.key));
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>(() => {
    try {
      const saved = localStorage.getItem('asb_cols_store_tasks_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('asb_cols_store_tasks_custom', JSON.stringify(customColumns));
    } catch {
      // ignore storage errors
    }
  }, [customColumns]);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('store');
  const [subcategory, setSubcategory] = useState('');
  const [owner, setOwner] = useState('');
  const [agentName, setAgentName] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [taskDate, setTaskDate] = useState(today);
  const [deadline, setDeadline] = useState(today);
  const [notes, setNotes] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [customFormValues, setCustomFormValues] = useState<Record<string, string>>({});

  const mergedCustomColumns = useMemo(() => {
    const map = new Map<string, CustomColumnDef>();
    for (const c of customColumns) map.set(c.key, c);
    for (const item of tasks) {
      const { customValues } = parseCustomMeta(item.notes);
      for (const label of Object.keys(customValues)) {
        const key = `${CUSTOM_PREFIX}${label}`;
        if (!map.has(key)) map.set(key, { key, label });
      }
    }
    return Array.from(map.values());
  }, [customColumns, tasks]);

  const allColumns = useMemo(
    () => [
      ...BASE_TASK_COLUMNS.map((c) => ({ ...c, isCustom: false })),
      ...mergedCustomColumns.map((c) => ({
        key: c.key,
        label: c.label,
        labelAr: c.label,
        isCustom: true,
      })),
    ],
    [mergedCustomColumns]
  );

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(allColumns, colOrder, hiddenCols),
    [allColumns, colOrder, hiddenCols]
  );

  const openAddModal = () => {
    setTitle('');
    setTitleAr('');
    setDescription('');
    setCategory('store');
    setSubcategory('');
    setOwner(currentBranch?.manager || '');
    setAgentName('');
    setPriority('medium');
    setStatus('not_started');
    setTaskDate(today);
    setDeadline(today);
    setNotes('');
    setEvidenceText('');
    setCustomFormValues({});
    setEditingTask(null);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    const parsedMeta = parseCustomMeta(task.notes);
    setTitle(task.title);
    setTitleAr(task.titleAr || '');
    setDescription(task.description);
    setCategory(task.category);
    setSubcategory(task.subcategory);
    setOwner(task.owner);
    setAgentName(task.agentName || '');
    setPriority(task.priority);
    setStatus(task.status);
    setTaskDate(task.date || today);
    setDeadline((task.deadline || task.date || today).slice(0, 10));
    setNotes(parsedMeta.baseText);
    setCustomFormValues(parsedMeta.customValues);
    setEvidenceText(task.evidenceText || '');
    setEditingTask(task);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !title.trim()) return;
    setSaving(true);
    setFormError(null);
    const serializedNotes = serializeCustomMeta(notes, customFormValues);
    try {
      if (editingTask) {
        await updateTask({
          ...editingTask,
          date: taskDate,
          agentName,
          title: title.trim(),
          titleAr: titleAr.trim() || title.trim(),
          description,
          category,
          subcategory,
          owner,
          priority,
          status,
          deadline,
          notes: serializedNotes,
          evidenceText,
        });
      } else {
        await addTask({
          date: taskDate,
          agentName,
          title: title.trim(),
          titleAr: titleAr.trim() || title.trim(),
          description,
          category,
          subcategory,
          owner,
          priority,
          status,
          deadline,
          notes: serializedNotes,
          evidenceText,
        });
      }
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    await deleteTask(id);
    setConfirmDeleteId(null);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      if (!matchesDateRange(item.date || item.deadline, dateRange.fromDate, dateRange.toDate)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.title.toLowerCase().includes(q) ||
          (item.titleAr || '').toLowerCase().includes(q) ||
          item.owner.toLowerCase().includes(q) ||
          (item.agentName || '').toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
      return true;
    });
  }, [tasks, searchQuery, selectedCategory, selectedStatus, selectedPriority, dateRange.fromDate, dateRange.toDate]);

  const displayedTasks = useMemo(
    () =>
      applyRowControls(filteredTasks, rowLimit, sortOrder, (task) => task.date || task.deadline || ''),
    [filteredTasks, rowLimit, sortOrder]
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
      await apiDownloadFile(`/api/v1/store-tasks/export${qs}`, 'store_tasks.xlsx');
      return;
    }

    const baseList = opts.rowScope === 'all' ? tasks : displayedTasks;
    const q = opts.searchText.trim().toLowerCase();
    const exportList = baseList.filter((item) => {
      if (!matchesDateRange(item.date || item.deadline, opts.fromDate, opts.toDate)) {
        return false;
      }
      if (opts.rowScope === 'filtered') {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
        if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.titleAr || '').toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        (item.agentName || '').toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      );
    });

    const cols = opts.colScope === 'visible' ? visibleColumns : allColumns;
    const sheetRows = exportList.map((task) => {
      const parsedMeta = parseCustomMeta(task.notes);
      const out: Record<string, unknown> = { 'Store ID': task.branchCode };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr || col.label : col.label;
        if (col.key === 'title') out[header] = language === 'ar' ? task.titleAr || task.title : task.title;
        else if (col.key === 'category') out[header] = task.category;
        else if (col.key === 'priority') out[header] = task.priority;
        else if (col.key === 'status') out[header] = task.status;
        else if (col.key === 'owner') out[header] = task.owner || '';
        else if (col.key === 'deadline') out[header] = task.deadline || task.date;
        else if (col.key === 'notes') out[header] = parsedMeta.baseText;
        else out[header] = parsedMeta.customValues[col.key.replace(CUSTOM_PREFIX, '')] || '';
      }
      return out;
    });
    await downloadXlsxSheet('store_tasks.xlsx', 'Store Tasks', sheetRows);
  };

  const handleToggleColumn = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMoveColumn = (key: string, direction: 'up' | 'down') => {
    const allKeys = allColumns.map((c) => c.key);
    const currentOrder = [
      ...colOrder.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !colOrder.includes(k)),
    ];
    const idx = currentOrder.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setColOrder(next);
  };

  const handleAddCustomColumn = (label: string) => {
    const clean = label.replace(/[\[\]\n\r]/g, '').trim();
    if (!clean) return;
    const key = `${CUSTOM_PREFIX}${clean}`;
    if (allColumns.some((c) => c.key === key)) return;
    setCustomColumns((prev) => [...prev, { key, label: clean }]);
    setColOrder((prev) => [...prev, key]);
  };

  const handleRemoveCustomColumn = (key: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.key !== key));
    setHiddenCols((prev) => prev.filter((k) => k !== key));
    setColOrder((prev) => prev.filter((k) => k !== key));
  };

  return (
    <div className="space-y-4 content-container">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('operationsTitle')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('operationsSubtitle')}
        </p>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

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
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="all">{t('allCategories')}</option>
              <option value="financial">{t('financialOps')}</option>
              <option value="contracts">{t('contractsOps')}</option>
              <option value="store">{t('storeOps')}</option>
              <option value="customer">{t('customerOps')}</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="all">{t('allStatuses')}</option>
              <option value="not_started">{t('status_not_started')}</option>
              <option value="in_progress">{t('status_in_progress')}</option>
              <option value="completed">{t('status_completed')}</option>
              <option value="blocked">{t('status_blocked')}</option>
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="all">{t('allPriorities')}</option>
              <option value="low">{t('priority_low')}</option>
              <option value="medium">{t('priority_medium')}</option>
              <option value="high">{t('priority_high')}</option>
              <option value="critical">{t('priority_critical')}</option>
            </select>
          </div>
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
              columns={allColumns}
              hiddenKeys={hiddenCols}
              columnOrder={colOrder}
              onToggleColumn={handleToggleColumn}
              onMoveColumn={handleMoveColumn}
              onResetColumns={() => {
                setHiddenCols([]);
                setColOrder(BASE_TASK_COLUMNS.map((c) => c.key));
                setCustomColumns([]);
              }}
              allowCustomColumns={canEdit}
              onAddCustomColumn={handleAddCustomColumn}
              onRemoveCustomColumn={handleRemoveCustomColumn}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddModal : undefined}
              totalRowsCount={filteredTasks.length}
            />
          </div>
        }
      />

      {displayedTasks.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-xs text-slate-500">
            {language === 'ar' ? 'لا توجد مهام مطابقة.' : 'No matching store tasks.'}
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
                  <th className="px-3.5 py-2.5 text-end font-semibold whitespace-nowrap">
                    {language === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedTasks.map((task) => {
                  const parsedMeta = parseCustomMeta(task.notes);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-3.5 py-2.5 font-mono tabular-nums font-bold text-[#092d52] dark:text-teal-400">
                        {task.branchCode}
                      </td>
                      {visibleColumns.map((col) => {
                        if (col.key === 'title') {
                          return (
                            <td key={col.key} className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() =>
                                    canEdit &&
                                    updateTaskStatus(
                                      task.id,
                                      task.status === 'completed' ? 'in_progress' : 'completed'
                                    )
                                  }
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                    task.status === 'completed'
                                      ? 'bg-teal-600 border-teal-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  } ${canEdit ? 'cursor-pointer' : 'opacity-60'}`}
                                >
                                  {task.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                                </button>
                                <span>{language === 'ar' ? task.titleAr || task.title : task.title}</span>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'category') return <td key={col.key} className="px-3.5 py-2.5">{task.category}</td>;
                        if (col.key === 'priority') return <td key={col.key} className="px-3.5 py-2.5">{task.priority}</td>;
                        if (col.key === 'status') return <td key={col.key} className="px-3.5 py-2.5">{task.status.replace('_', ' ')}</td>;
                        if (col.key === 'owner') return <td key={col.key} className="px-3.5 py-2.5">{task.owner || '—'}</td>;
                        if (col.key === 'deadline') {
                          return (
                            <td key={col.key} className="px-3.5 py-2.5 font-mono tabular-nums whitespace-nowrap">
                              {task.deadline || task.date}
                            </td>
                          );
                        }
                        if (col.key === 'notes') {
                          return <td key={col.key} className="px-3.5 py-2.5 max-w-[220px] truncate">{parsedMeta.baseText || '—'}</td>;
                        }
                        const customLabel = col.key.replace(CUSTOM_PREFIX, '');
                        return (
                          <td key={col.key} className="px-3.5 py-2.5">
                            {parsedMeta.customValues[customLabel] || '—'}
                          </td>
                        );
                      })}
                      <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryTask(task)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                            aria-label={t('taskHistory')}
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(task)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                aria-label={t('editTask')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(task.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                                aria-label={t('deleteTask')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedTasks.map((task) => (
            <div
              key={task.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    canEdit &&
                    updateTaskStatus(
                      task.id,
                      task.status === 'completed' ? 'in_progress' : 'completed'
                    )
                  }
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                    task.status === 'completed'
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  } ${canEdit ? 'cursor-pointer' : 'opacity-60'}`}
                >
                  {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums text-[11px] font-bold text-[#092d52] dark:text-teal-400">
                      {task.branchCode}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? task.titleAr || task.title : task.title}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                      {task.priority}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>Owner: {task.owner || '—'}</span>
                    {task.agentName && <span>Agent: {task.agentName}</span>}
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      <Calendar className="w-3 h-3" />
                      {task.deadline || task.date}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setHistoryTask(task)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  aria-label={t('taskHistory')}
                >
                  <History className="w-4 h-4" />
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(task)}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      aria-label={t('editTask')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(task.id)}
                      className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                      aria-label={t('deleteTask')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Task Modal — Strict Single Column Inputs */}
      {isAddModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{editingTask ? t('editTask') : t('addTask')}</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="p-5 grid grid-cols-1 gap-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('taskTitle')} *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskCategory')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="financial">{t('financialOps')}</option>
                  <option value="contracts">{t('contractsOps')}</option>
                  <option value="store">{t('storeOps')}</option>
                  <option value="customer">{t('customerOps')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskPriority')}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="low">{t('priority_low')}</option>
                  <option value="medium">{t('priority_medium')}</option>
                  <option value="high">{t('priority_high')}</option>
                  <option value="critical">{t('priority_critical')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskOwner')}</label>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  list="ops-staff-owners"
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
                <datalist id="ops-staff-owners">
                  {employees.map((e) => (
                    <option key={e.id} value={e.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskStatus')}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="not_started">{t('status_not_started')}</option>
                  <option value="in_progress">{t('status_in_progress')}</option>
                  <option value="completed">{t('status_completed')}</option>
                  <option value="blocked">{t('status_blocked')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {language === 'ar' ? 'التاريخ' : 'Date'}
                </label>
                <input
                  type="date"
                  required
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskDeadline')}</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskDescription')}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskNotes')}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {mergedCustomColumns.map((col) => (
                <div key={col.key}>
                  <label className="block font-semibold mb-1">{col.label}</label>
                  <input
                    type="text"
                    value={customFormValues[col.label] ?? ''}
                    onChange={(e) =>
                      setCustomFormValues((prev) => ({ ...prev, [col.label]: e.target.value }))
                    }
                    className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              ))}

              {formError && <div className="text-rose-600 font-semibold">{formError}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[38px] rounded-xl bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {saving ? '...' : t('saveTask')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('taskHistory')}</h3>
              <button type="button" onClick={() => setHistoryTask(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
              {historyTask.history.length === 0 ? (
                <p className="text-slate-400">No history entries.</p>
              ) : (
                historyTask.history.map((h, i) => (
                  <div
                    key={h.id || i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="font-semibold">{h.action}</div>
                    <div className="text-[11px] text-slate-500">
                      {h.user} · {h.timestamp}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-bold">{t('deleteTask')}</h3>
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
                {t('deleteTask')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportSummaryModal
          title={`${t('importData')} — ${t('navOperations')}`}
          endpoint="/api/v1/store-tasks/import"
          expectedHeadersHint="Date (YYYY-MM-DD), Title, Category, Priority, Status, Owner, Due Date, Agent Name, Notes"
          onClose={() => setShowImport(false)}
          onSuccess={refreshWorkspaceData}
        />
      )}
    </div>
  );
};
