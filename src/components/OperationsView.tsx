import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  FileCheck,
  Store,
  Users,
  Calendar,
  X,
  History,
  Trash2,
  Edit2,
  ChevronDown,
} from 'lucide-react';

interface OperationsViewProps {
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({ isAddModalOpen, setIsAddModalOpen }) => {
  const {
    t,
    language,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    currentBranch,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');

  // Edit and History modal states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);

  // Form state for add/edit modal
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('financial');
  const [subcategory, setSubcategory] = useState('cash_recon');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [status, setStatus] = useState<TaskStatus>('in_progress');
  const [deadline, setDeadline] = useState('2026-11-03T14:00');
  const [notes, setNotes] = useState('');
  const [evidenceText, setEvidenceText] = useState('');

  const openAddModal = () => {
    setTitle('');
    setTitleAr('');
    setDescription('');
    setCategory('financial');
    setSubcategory('cash_recon');
    setOwner(currentBranch?.manager || 'Tarek Zaki');
    setPriority('high');
    setStatus('not_started');
    setDeadline('2026-11-03T15:00');
    setNotes('');
    setEvidenceText('');
    setEditingTask(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setTitle(task.title);
    setTitleAr(task.titleAr || '');
    setDescription(task.description);
    setCategory(task.category);
    setSubcategory(task.subcategory);
    setOwner(task.owner);
    setPriority(task.priority);
    setStatus(task.status);
    setDeadline(task.deadline.slice(0, 16));
    setNotes(task.notes);
    setEvidenceText(task.evidenceText || '');
    setEditingTask(task);
    setIsAddModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      updateTask({
        ...editingTask,
        title,
        titleAr: titleAr || title,
        description,
        category,
        subcategory,
        owner,
        priority,
        status,
        deadline: new Date(deadline).toISOString(),
        notes,
        evidenceText,
      });
    } else {
      addTask({
        title,
        titleAr: titleAr || title,
        description,
        category,
        subcategory,
        owner,
        priority,
        status,
        deadline: new Date(deadline).toISOString(),
        notes,
        evidenceText,
      });
    }
    setIsAddModalOpen(false);
  };

  // Distinct owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.owner) set.add(t.owner);
    });
    return Array.from(set);
  }, [tasks]);

  // Filtering
  const now = new Date();
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q) || (t.titleAr && t.titleAr.includes(q));
        const matchOwner = t.owner.toLowerCase().includes(q);
        const matchNotes = t.notes.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner && !matchNotes) return false;
      }
      // Category
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      // Status
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'overdue') {
          if (t.status === 'completed' || new Date(t.deadline) >= now) return false;
        } else if (t.status !== selectedStatus) {
          return false;
        }
      }
      // Priority
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;
      // Owner
      if (selectedOwner !== 'all' && t.owner !== selectedOwner) return false;

      return true;
    });
  }, [tasks, searchQuery, selectedCategory, selectedStatus, selectedPriority, selectedOwner]);

  const categoryIcons: Record<TaskCategory, React.ElementType> = {
    financial: DollarSign,
    contracts: FileCheck,
    store: Store,
    customer: Users,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('operationsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('operationsSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addTask')}</span>
        </button>
      </div>

      {/* Category Tabs (Segmented functional buttons) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          {t('allCategories')} ({tasks.length})
        </button>

        <button
          onClick={() => setSelectedCategory('financial')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'financial'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{t('financialOps')}</span>
          <span className="text-[10px] opacity-70">
            ({tasks.filter((t) => t.category === 'financial').length})
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('contracts')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'contracts'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>{t('contractsOps')}</span>
          <span className="text-[10px] opacity-70">
            ({tasks.filter((t) => t.category === 'contracts').length})
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('store')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'store'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>{t('storeOps')}</span>
          <span className="text-[10px] opacity-70">
            ({tasks.filter((t) => t.category === 'store').length})
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('customer')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'customer'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t('customerOps')}</span>
          <span className="text-[10px] opacity-70">
            ({tasks.filter((t) => t.category === 'customer').length})
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchTasks')}
            className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="not_started">{t('status_not_started')}</option>
            <option value="in_progress">{t('status_in_progress')}</option>
            <option value="completed">{t('status_completed')}</option>
            <option value="blocked">{t('status_blocked')}</option>
            <option value="overdue">{t('status_overdue')}</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{t('allPriorities')}</option>
            <option value="critical">{t('priority_critical')}</option>
            <option value="high">{t('priority_high')}</option>
            <option value="medium">{t('priority_medium')}</option>
            <option value="low">{t('priority_low')}</option>
          </select>

          {/* Assignee Dropdown */}
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none max-w-[140px]"
          >
            <option value="all">{t('filterOwner')} (All)</option>
            {uniqueOwners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No tasks match your filters</h3>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search or category filters.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isTaskOverdue = task.status !== 'completed' && new Date(task.deadline) < now;
            const CategoryIcon = categoryIcons[task.category] || CheckSquare;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs ${
                  task.status === 'blocked'
                    ? 'border-rose-300 dark:border-rose-900/60'
                    : isTaskOverdue
                    ? 'border-amber-300 dark:border-amber-900/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left: Checkbox + Title + Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() =>
                        updateTaskStatus(task.id, task.status === 'completed' ? 'in_progress' : 'completed')
                      }
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all mt-0.5 cursor-pointer ${
                        task.status === 'completed'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : task.status === 'blocked'
                          ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                          : 'border-slate-300 dark:border-slate-600 hover:border-teal-500'
                      }`}
                    >
                      {task.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className={`text-sm font-bold tracking-tight ${
                            task.status === 'completed'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {language === 'ar' ? task.titleAr : task.title}
                        </h3>

                        {/* Overdue Badge */}
                        {isTaskOverdue && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded font-mono">
                            {t('overdueBadge')}
                          </span>
                        )}

                        {/* Blocked Badge */}
                        {task.status === 'blocked' && (
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded font-mono">
                            {t('blockedBadge')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2.5">
                        {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
                      </p>

                      {/* Clean Metadata without generic pills */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{task.owner}</span>
                        <span>·</span>
                        <span className="capitalize">{task.category}</span>
                        <span>·</span>
                        <span
                          className={`font-semibold ${
                            task.priority === 'critical'
                              ? 'text-rose-600'
                              : task.priority === 'high'
                              ? 'text-amber-600'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {t(`priority_${task.priority}` as any)} {t('taskPriority')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono-numbers">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {task.deadline.slice(11, 16)} ({task.deadline.slice(0, 10)})
                        </span>
                      </div>

                      {/* Notes / Evidence block if available */}
                      {task.notes && (
                        <div className="mt-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {language === 'ar' ? 'ملاحظات: ' : 'Notes: '}
                          </span>
                          {task.notes}
                        </div>
                      )}

                      {task.evidenceText && (
                        <div className="mt-1 text-[11px] text-teal-600 dark:text-teal-400 font-mono">
                          ✓ {task.evidenceText}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Status selector & Action buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none cursor-pointer ${
                        task.status === 'completed'
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                          : task.status === 'blocked'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <option value="not_started">{t('status_not_started')}</option>
                      <option value="in_progress">{t('status_in_progress')}</option>
                      <option value="completed">{t('status_completed')}</option>
                      <option value="blocked">{t('status_blocked')}</option>
                    </select>

                    <button
                      onClick={() => setHistoryTask(task)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={t('taskHistory')}
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openEditModal(task)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={t('editTask')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(t('confirmDelete'))) {
                          deleteTask(task.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title={t('deleteTask')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTask ? t('editTask') : t('addTask')}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskTitle')} (English)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Morning Vault Reconciliation"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskTitle')} (العربية)
                </label>
                <input
                  type="text"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: مطابقة الخزينة الصباحية"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('taskCategory')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="financial">{t('financialOps')}</option>
                    <option value="contracts">{t('contractsOps')}</option>
                    <option value="store">{t('storeOps')}</option>
                    <option value="customer">{t('customerOps')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('taskPriority')}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="critical">{t('priority_critical')}</option>
                    <option value="high">{t('priority_high')}</option>
                    <option value="medium">{t('priority_medium')}</option>
                    <option value="low">{t('priority_low')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('taskOwner')}
                  </label>
                  <input
                    type="text"
                    required
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="e.g., Tarek Zaki"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('taskDeadline')}
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskDescription')}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operational details, scope, or specific check steps"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskNotes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Verification findings or supervisor remarks"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskEvidence')}
                </label>
                <input
                  type="text"
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="Slip # / Pouch Batch # / Ticket ID"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer"
                >
                  {t('saveTask')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task History Drawer / Modal */}
      {historyTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('taskHistory')}</h3>
                <p className="text-xs text-slate-400 truncate max-w-xs">{historyTask.title}</p>
              </div>
              <button
                onClick={() => setHistoryTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {historyTask.history && historyTask.history.length > 0 ? (
                historyTask.history.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{h.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      By {h.user}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No audit history entries recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
