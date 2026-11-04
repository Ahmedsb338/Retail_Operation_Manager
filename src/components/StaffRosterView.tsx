import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Employee } from '../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  Briefcase,
  Award,
} from 'lucide-react';

export const StaffRosterView: React.FC = () => {
  const { language, employees, addEmployee, updateEmployee, currentBranch } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('Sales Specialist');
  const [roleAr, setRoleAr] = useState('أخصائي مبيعات');
  const [knowledge, setKnowledge] = useState(80);
  const [productivity, setProductivity] = useState(80);
  const [csat, setCsat] = useState(85);
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setName('');
    setNameAr('');
    setIdentifier(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setRole('Sales Specialist');
    setRoleAr('أخصائي مبيعات');
    setKnowledge(80);
    setProductivity(80);
    setCsat(85);
    setNotes('');
    setEditingEmp(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setName(emp.name);
    setNameAr(emp.nameAr || '');
    setIdentifier(emp.identifier);
    setRole(emp.role);
    setRoleAr(emp.roleAr || '');
    setKnowledge(emp.productKnowledgeScore);
    setProductivity(emp.productivityScore);
    setCsat(emp.customerExperienceScore);
    setNotes(emp.coachingNotes || '');
    setEditingEmp(emp);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingEmp) {
      updateEmployee({
        ...editingEmp,
        name,
        nameAr: nameAr || name,
        identifier,
        role,
        roleAr: roleAr || role,
        productKnowledgeScore: knowledge,
        productivityScore: productivity,
        customerExperienceScore: csat,
        coachingNotes: notes,
      });
    } else {
      addEmployee({
        name,
        nameAr: nameAr || name,
        identifier,
        role,
        roleAr: roleAr || role,
        productKnowledgeScore: knowledge,
        productivityScore: productivity,
        customerExperienceScore: csat,
        coachingStatus: 'on_track',
        developmentAreas: [],
        coachingNotes: notes,
        agreedActions: '',
        assignedCoach: currentBranch?.manager || 'Store Manager',
        followUpDate: '2026-11-15',
        progressStatus: 'pending',
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 content-container">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{currentBranch?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <span>{language === 'ar' ? 'سجل فريق العمل والموظفين' : 'Staff & Team Roster'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'ar'
              ? 'تسجيل وحفظ أسماء وبيانات موظفي الفرع بشكل دائم ومربوط بكود الفرع'
              : 'Permanent staff roster saved per branch code, editable on demand'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => {
              try {
                localStorage.setItem(`opm_branch_${currentBranch?.code || '1750'}_staff`, JSON.stringify(employees));
                setToastMsg(language === 'ar' ? 'تم حفظ وتأكيد سجل الموظفين للفرع بشكل دائم' : 'Staff roster saved permanently');
              } catch {
                setToastMsg(language === 'ar' ? 'تم حفظ السجل' : 'Record saved');
              }
              setTimeout(() => setToastMsg(null), 3000);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Save staff roster permanently"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>{language === 'ar' ? 'حفظ السجل' : 'Save Record'}</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة موظف جديد' : 'Add Employee'}</span>
          </button>
        </div>
      </div>

      {/* Info notice */}
      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
        <span>
          {language === 'ar'
            ? 'يتم حفظ قائمة الموظفين بشكل دائم ومستمر لكل فرع على حدة، ولا تمسح عند الخروج من النظام.'
            : 'Staff records persist permanently per branch and will never be cleared automatically upon logout.'}
        </span>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {employees.map((emp) => (
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
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>{emp.identifier}</span>
                    <span>·</span>
                    <span className="font-sans">{language === 'ar' ? emp.roleAr || emp.role : emp.role}</span>
                  </div>
                </div>

                <button
                  onClick={() => openEditModal(emp)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Skill Scores */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800 my-2 text-center font-mono text-[11px]">
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Knowledge</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">{emp.productKnowledgeScore}%</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Productivity</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{emp.productivityScore}%</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">CSAT</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{emp.customerExperienceScore}%</span>
                </div>
              </div>

              {emp.coachingNotes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                  {emp.coachingNotes}
                </p>
              )}
            </div>

            <div className="mt-3 pt-2 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Status: <strong className="text-slate-600 dark:text-slate-300 capitalize">{emp.coachingStatus.replace('_', ' ')}</strong></span>
              <span className="font-mono">Review: {emp.followUpDate}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingEmp ? (language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee') : (language === 'ar' ? 'إضافة موظف جديد' : 'Add Employee')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  {language === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Sobhy"
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                    {language === 'ar' ? 'الكود الوظيفي' : 'Employee ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="EMP-1001"
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                    {language === 'ar' ? 'الدور الوظيفي' : 'Role'}
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Knowledge %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={knowledge}
                    onChange={(e) => setKnowledge(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Productivity %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={productivity}
                    onChange={(e) => setProductivity(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">CSAT %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={csat}
                    onChange={(e) => setCsat(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specializations or notes"
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
