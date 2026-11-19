import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  X,
  History,
  Trash2,
  Edit2,
  Lock,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
import { apiDownloadFile, buildQueryParams } from '../services/apiClient';
import { FilterBar } from './shared/FilterBar';
import { ImportSummaryModal } from './shared/ImportSummaryModal';

interface OperationsViewProps {
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
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
    setEditingTask(null);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (task: Task) => {
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
    setNotes(task.notes);
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
          notes,
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
          notes,
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
  }, [tasks, searchQuery, selectedCategory, selectedStatus, selectedPriority]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const qs = buildQueryParams({
      branchCode:
        user?.role === 'AREA_MANAGER'
          ? selectedBranchCode || undefined
          : user?.branchCode || undefined,
      fromDate: dateRange.fromDate || undefined,
      toDate: dateRange.toDate || undefined,
      search: searchQuery || undefined,
      format,
    });
    await apiDownloadFile(`/api/v1/store-tasks/export${qs}`, `store_tasks.${format}`);
  };

  return (
    <div className="space-y-4 content-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('operationsTitle')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('operationsSubtitle')}
          </p>
        </div>

        {!canEdit && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold self-start">
            <Lock className="w-3.5 h-3.5" />
            {t('readOnlyBadge')}
          </span>
        )}
      </div>

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onExportCsv={() => handleExport('csv')}
        onExportXlsx={() => handleExport('xlsx')}
        onOpenImport={canEdit ? () => setShowImport(true) : undefined}
        onAddNew={canEdit ? openAddModal : undefined}
        addLabel={t('addTask')}
        extraFilters={
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
              className="px-2.5 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
              className="px-2.5 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="all">{t('allPriorities')}</option>
              <option value="low">{t('priority_low')}</option>
              <option value="medium">{t('priority_medium')}</option>
              <option value="high">{t('priority_high')}</option>
              <option value="critical">{t('priority_critical')}</option>
            </select>
          </div>
        }
      />

      {filteredTasks.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {language === 'ar' ? 'لا توجد مهام مطابقة.' : 'No matching store tasks.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                    <span className="font-mono text-[11px] font-bold text-[#092d52] dark:text-teal-400">
                      {task.branchCode}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? task.titleAr || task.title : task.title}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>Owner: {task.owner || '—'}</span>
                    {task.agentName && <span>Agent: {task.agentName}</span>}
                    <span className="flex items-center gap-1 font-mono">
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

      {/* Add / Edit Task Modal */}
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
            <form onSubmit={handleSaveTask} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('taskTitle')} *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('taskCategory')}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  >
                    <option value="low">{t('priority_low')}</option>
                    <option value="medium">{t('priority_medium')}</option>
                    <option value="high">{t('priority_high')}</option>
                    <option value="critical">{t('priority_critical')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('taskOwner')}</label>
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    list="ops-staff-owners"
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  >
                    <option value="not_started">{t('status_not_started')}</option>
                    <option value="in_progress">{t('status_in_progress')}</option>
                    <option value="completed">{t('status_completed')}</option>
                    <option value="blocked">{t('status_blocked')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t('taskDeadline')}</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
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

              {formError && <div className="text-rose-600 font-semibold">{formError}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[36px] rounded-xl bg-teal-600 text-white font-bold cursor-pointer"
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
