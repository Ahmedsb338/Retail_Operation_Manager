import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  UserCheck,
  Briefcase,
  Award,
  Download,
  Upload,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Employee } from '../types';
import { apiDownloadFile, buildQueryParams } from '../services/apiClient';
import { ImportSummaryModal } from './shared/ImportSummaryModal';

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
    refreshWorkspaceData,
  } = useApp();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('Sales Specialist');
  const [roleAr, setRoleAr] = useState('أخصائي مبيعات');
  const [knowledge, setKnowledge] = useState<string>('');
  const [productivity, setProductivity] = useState<string>('');
  const [csat, setCsat] = useState<string>('');
  const [notes, setNotes] = useState('');

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

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const qs = buildQueryParams({
      branchCode:
        user?.role === 'AREA_MANAGER'
          ? selectedBranchCode || undefined
          : user?.branchCode || undefined,
      format,
    });
    await apiDownloadFile(`/api/v1/staff/export${qs}`, `staff_roster.${format}`);
  };

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.nameAr.toLowerCase().includes(q) ||
      (e.identifier || '').toLowerCase().includes(q) ||
      (e.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 content-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#092d52] dark:text-teal-400" />
            <span>{t('teamTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('teamSubtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportCsv')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportXlsx')}</span>
          </button>

          {canEdit ? (
            <>
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-bold bg-[#092d52] text-white cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('importData')}</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addEmployee')}</span>
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              {t('readOnlyBadge')}
            </span>
          )}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full max-w-md px-3.5 min-h-[40px] rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      />

      {filtered.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {language === 'ar'
            ? 'لا يوجد موظفون مسجلون لهذا النطاق بعد.'
            : 'No staff members recorded for this branch scope yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? emp.nameAr || emp.name : emp.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[#092d52] dark:text-teal-400 font-bold">
                        {emp.branchCode}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{emp.identifier || 'No SID'}</span>
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

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
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
                <span className="flex items-center gap-1 font-mono">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  {emp.history.length} sessions
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
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
            <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('empName')} *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t('empIdentifier')}</label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="SID"
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('empRole')}</label>
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Arabic Name</label>
                  <input
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full px-3 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Knowledge %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    placeholder={t('unconfiguredLabel')}
                    className="w-full px-2.5 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Prod. %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={productivity}
                    onChange={(e) => setProductivity(e.target.value)}
                    placeholder={t('unconfiguredLabel')}
                    className="w-full px-2.5 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">CSAT %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={csat}
                    onChange={(e) => setCsat(e.target.value)}
                    placeholder={t('unconfiguredLabel')}
                    className="w-full px-2.5 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes</label>
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
                  className="px-3.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[36px] rounded-xl bg-teal-600 text-white font-bold cursor-pointer"
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
