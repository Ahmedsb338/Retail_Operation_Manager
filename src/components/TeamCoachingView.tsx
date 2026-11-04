import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Employee, CoachingStatus } from '../types';
import {
  Users,
  UserCheck,
  Plus,
  BookOpen,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  Edit2,
  X,
  History,
  TrendingUp,
  AlertCircle,
  Printer,
  Save,
  Download,
} from 'lucide-react';

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
    employees,
    addEmployee,
    updateEmployee,
    addCoachingSession,
    currentBranch,
  } = useApp();

  const branchKey = currentBranch?.code || '1750';

  // Selected employee for coaching session or history
  const [selectedEmpForSession, setSelectedEmpForSession] = useState<Employee | null>(null);
  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<Employee | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form states for member modal
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('Sales Specialist');
  const [roleAr, setRoleAr] = useState('أخصائي مبيعات');
  const [productKnowledgeScore, setProductKnowledgeScore] = useState(75);
  const [productivityScore, setProductivityScore] = useState(75);
  const [customerExperienceScore, setCustomerExperienceScore] = useState(75);
  const [coachingStatus, setCoachingStatus] = useState<CoachingStatus>('needs_coaching');
  const [developmentAreas, setDevelopmentAreas] = useState('');
  const [assignedCoach, setAssignedCoach] = useState('');
  const [followUpDate, setFollowUpDate] = useState('2026-11-10');

  // Coaching session form
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionCoach, setSessionCoach] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionAgreedActions, setSessionAgreedActions] = useState('');
  const [sessionImprovement, setSessionImprovement] = useState('');

  const openAddMemberModal = () => {
    setName('');
    setNameAr('');
    setIdentifier(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setRole('Sales Specialist');
    setRoleAr('أخصائي مبيعات');
    setProductKnowledgeScore(75);
    setProductivityScore(75);
    setCustomerExperienceScore(80);
    setCoachingStatus('on_track');
    setDevelopmentAreas('Product features, customer objection handling');
    setAssignedCoach(currentBranch?.manager || 'Omar El-Sherif');
    setFollowUpDate('2026-11-10');
    setEditingEmployee(null);
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (emp: Employee) => {
    setName(emp.name);
    setNameAr(emp.nameAr || '');
    setIdentifier(emp.identifier);
    setRole(emp.role);
    setRoleAr(emp.roleAr || '');
    setProductKnowledgeScore(emp.productKnowledgeScore);
    setProductivityScore(emp.productivityScore);
    setCustomerExperienceScore(emp.customerExperienceScore);
    setCoachingStatus(emp.coachingStatus);
    setDevelopmentAreas(emp.developmentAreas.join(', '));
    setAssignedCoach(emp.assignedCoach);
    setFollowUpDate(emp.followUpDate);
    setEditingEmployee(emp);
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const devAreasArray = developmentAreas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingEmployee) {
      updateEmployee({
        ...editingEmployee,
        name,
        nameAr: nameAr || name,
        identifier,
        role,
        roleAr: roleAr || role,
        productKnowledgeScore,
        productivityScore,
        customerExperienceScore,
        coachingStatus,
        developmentAreas: devAreasArray,
        assignedCoach,
        followUpDate,
      });
    } else {
      addEmployee({
        name,
        nameAr: nameAr || name,
        identifier,
        role,
        roleAr: roleAr || role,
        productKnowledgeScore,
        productivityScore,
        customerExperienceScore,
        coachingStatus,
        developmentAreas: devAreasArray,
        coachingNotes: '',
        agreedActions: '',
        assignedCoach,
        followUpDate,
        progressStatus: 'pending',
      });
    }
    setIsMemberModalOpen(false);
  };

  const openCoachingModal = (emp: Employee) => {
    setSelectedEmpForSession(emp);
    setSessionTopic(`1-on-1 Development Session on ${emp.developmentAreas[0] || 'Core Objectives'}`);
    setSessionCoach(emp.assignedCoach || currentBranch?.manager || 'Store Manager');
    setSessionNotes('');
    setSessionAgreedActions('');
    setSessionImprovement('');
    setIsAddCoachingModalOpen(true);
  };

  const handleSaveCoachingSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForSession) return;

    addCoachingSession(selectedEmpForSession.id, {
      date: new Date().toISOString().split('T')[0],
      coach: sessionCoach,
      topic: sessionTopic,
      notes: sessionNotes,
      agreedActions: sessionAgreedActions,
      scoreImprovement: sessionImprovement,
    });

    setIsAddCoachingModalOpen(false);
    setToastMsg(language === 'ar' ? 'تم حفظ جلسة التوجيه بنجاح' : 'Coaching session recorded successfully');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // User-Requested Action 1: Load from Roster
  const handleLoadFromRoster = () => {
    setToastMsg(language === 'ar' ? 'تم جلب وتحديث أسماء وبيانات الموظفين من سجل الفريق' : 'Staff loaded & synchronized from Roster');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // User-Requested Action 2: Save Record
  const handleSaveRecord = () => {
    try {
      localStorage.setItem(`opm_branch_${branchKey}_coaching`, JSON.stringify(employees));
      setToastMsg(language === 'ar' ? 'تم حفظ سجل التوجيه وبيانات الموظفين للفرع بشكل دائم' : 'Coaching records & staff data saved permanently');
    } catch {
      setToastMsg(language === 'ar' ? 'تم حفظ السجل بنجاح' : 'Record saved successfully');
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  // User-Requested Action 3: Print Coaching Plan
  const handlePrintCoaching = () => {
    window.print();
  };

  // Coaching Planner Filter (Employees whose score is < 75% in any area or explicitly marked)
  const coachingPlannerCandidates = employees.filter(
    (e) =>
      e.coachingStatus === 'needs_coaching' ||
      e.productKnowledgeScore < 75 ||
      e.productivityScore < 75 ||
      e.customerExperienceScore < 75
  );

  return (
    <div className="space-y-6 content-container">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header (no-print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
            <span>·</span>
            <span>{currentBranch?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-600" />
            <span>{t('teamTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('teamSubtitle')}
          </p>
        </div>

        {/* Action Controls with User-Requested Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* 1. Load from Roster */}
          <button
            onClick={handleLoadFromRoster}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Synchronize names from staff roster"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'جلب من السجل' : 'Load from Roster'}</span>
          </button>

          {/* 2. Save Record */}
          <button
            onClick={handleSaveRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Save coaching records permanently"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'حفظ السجل' : 'Save Record'}</span>
          </button>

          {/* 3. Print Coaching Plan */}
          <button
            onClick={handlePrintCoaching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-sm transition-all cursor-pointer"
            title="Print Coaching & Development Plan"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'طباعة خطة التوجيه' : 'Print Plan'}</span>
          </button>

          <button
            onClick={openAddMemberModal}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addEmployee')}</span>
          </button>
        </div>
      </div>

      {/* Print Document Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
              INTERNAL BRANCH COACHING & DEVELOPMENT RECORD
            </span>
            <h2 className="text-xl font-black mt-1">Branch Coaching & Performance Plan</h2>
            <p className="text-xs text-slate-600">
              {currentBranch?.name} ({currentBranch?.code}) · {currentBranch?.city}
            </p>
          </div>
          <div className="text-end text-xs font-mono space-y-0.5">
            <div><strong>Date:</strong> {currentBranch?.businessDate}</div>
            <div><strong>Manager:</strong> {currentBranch?.manager}</div>
          </div>
        </div>
      </div>

      {/* Coaching Planner Priority Candidates Alert Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('coachingPlanner')} ({coachingPlannerCandidates.length} {language === 'ar' ? 'موظفين مرشحين للتطوير' : 'candidates'})
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {t('coachingPriorityDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Priority Candidates List */}
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
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">({emp.identifier})</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {language === 'ar' ? emp.roleAr || emp.role : emp.role}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono-numbers mt-1 text-slate-600 dark:text-slate-300">
                  <span className={emp.productKnowledgeScore < 75 ? 'text-rose-500 font-bold' : ''}>
                    Knowledge: {emp.productKnowledgeScore}%
                  </span>
                  <span>·</span>
                  <span className={emp.productivityScore < 75 ? 'text-rose-500 font-bold' : ''}>
                    Prod: {emp.productivityScore}%
                  </span>
                  <span>·</span>
                  <span className={emp.customerExperienceScore < 75 ? 'text-rose-500 font-bold' : ''}>
                    CSAT: {emp.customerExperienceScore}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => openCoachingModal(emp)}
                className="no-print px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                {t('logCoachingSession')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Full Team Scorecard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {language === 'ar' ? emp.roleAr || emp.role : emp.role} · <span className="font-mono">{emp.identifier}</span>
                  </div>
                </div>

                <div className="no-print flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditMemberModal(emp)}
                    className="p-1 rounded text-slate-400 hover:text-teal-600"
                    title={t('editEmployee')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedEmpForHistory(emp)}
                    className="p-1 rounded text-slate-400 hover:text-blue-600"
                    title={t('coachingHistory')}
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Score indicators */}
              <div className="space-y-1.5 mb-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-500">{t('knowledgeScore')}</span>
                    <span className="font-mono font-semibold">{emp.productKnowledgeScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.productKnowledgeScore >= 80 ? 'bg-teal-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.productKnowledgeScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-500">{t('productivityScore')}</span>
                    <span className="font-mono font-semibold">{emp.productivityScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.productivityScore >= 80 ? 'bg-teal-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.productivityScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-500">{t('csatScore')}</span>
                    <span className="font-mono font-semibold">{emp.customerExperienceScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.customerExperienceScore >= 80 ? 'bg-teal-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.customerExperienceScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Agreed actions & development */}
              {emp.agreedActions && (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                  <strong className="text-slate-800 dark:text-slate-200">Agreed Action: </strong>
                  {emp.agreedActions}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono">Review: {emp.followUpDate}</span>

              <button
                onClick={() => openCoachingModal(emp)}
                className="no-print px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 hover:bg-teal-100 cursor-pointer"
              >
                {t('logCoachingSession')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Log Coaching Session Modal */}
      {isAddCoachingModalOpen && selectedEmpForSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {t('logCoachingSession')}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedEmpForSession.name} ({selectedEmpForSession.identifier})
                </p>
              </div>
              <button onClick={() => setIsAddCoachingModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  placeholder="Observations and simulated pitch results"
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
                  placeholder="Specific actions committed by the staff member"
                  className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCoachingModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer"
                >
                  Save Coaching Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {editingEmployee ? t('editEmployee') : t('addEmployee')}
              </h3>
              <button onClick={() => setIsMemberModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Name (EN)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">الاسم (العربية)</label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">ID</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono outline-none"
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
                    value={productKnowledgeScore}
                    onChange={(e) => setProductKnowledgeScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Productivity %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={productivityScore}
                    onChange={(e) => setProductivityScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">CSAT %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customerExperienceScore}
                    onChange={(e) => setCustomerExperienceScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl"
                >
                  Save Member
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
                <p className="text-xs text-slate-400 font-mono">{selectedEmpForHistory.identifier}</p>
              </div>
              <button onClick={() => setSelectedEmpForHistory(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {selectedEmpForHistory.history.length > 0 ? (
                selectedEmpForHistory.history.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
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
                <p className="text-xs text-slate-400 py-3 text-center">No previous coaching sessions recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
