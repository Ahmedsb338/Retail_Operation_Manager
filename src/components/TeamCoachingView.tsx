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

  // Selected employee for coaching session or history
  const [selectedEmpForSession, setSelectedEmpForSession] = useState<Employee | null>(null);
  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<Employee | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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
    setSessionCoach(emp.assignedCoach || currentBranch?.manager || 'Omar El-Sherif');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('teamTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('teamSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddMemberModal}
          className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addEmployee')}</span>
        </button>
      </div>

      {/* Coaching Planner Alert Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('coachingPlanner')} ({coachingPlannerCandidates.length} {language === 'ar' ? 'موظفين مرشحين' : 'candidates'})
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {t('coachingPriorityDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* List of priority candidates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {coachingPlannerCandidates.map((emp) => (
            <div
              key={emp.id}
              className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200/60 dark:border-amber-900/40 shadow-xs flex items-center justify-between gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? emp.nameAr : emp.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">({emp.identifier})</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'ar' ? emp.roleAr : emp.role}
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono-numbers mt-1.5 text-slate-600 dark:text-slate-300">
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
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shrink-0 cursor-pointer shadow-xs"
              >
                {t('logCoachingSession')}
              </button>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-3 italic">
          * {t('noSupportedConclusions')}
        </p>
      </div>

      {/* Full Team Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
          >
            <div>
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? emp.nameAr : emp.name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'ar' ? emp.roleAr : emp.role} · <span className="font-mono">{emp.identifier}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
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
              <div className="space-y-2 mb-4">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">{t('knowledgeScore')}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{emp.productKnowledgeScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.productKnowledgeScore >= 80 ? 'bg-teal-500' : emp.productKnowledgeScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.productKnowledgeScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">{t('productivityScore')}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{emp.productivityScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.productivityScore >= 80 ? 'bg-teal-500' : emp.productivityScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.productivityScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">{t('csatScore')}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{emp.customerExperienceScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${emp.customerExperienceScore >= 80 ? 'bg-teal-500' : emp.customerExperienceScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${emp.customerExperienceScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Development Focus */}
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t('developmentAreas')}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {emp.developmentAreas.length > 0 ? (
                    emp.developmentAreas.join(' · ')
                  ) : (
                    <span className="text-slate-400 italic">None currently active</span>
                  )}
                </div>
              </div>

              {emp.agreedActions && (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 mb-3">
                  <strong className="text-slate-800 dark:text-slate-200">Agreed Action: </strong>
                  {emp.agreedActions}
                </div>
              )}
            </div>

            {/* Bottom button & follow-up date */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                {t('followUpDate')}: {emp.followUpDate}
              </span>

              <button
                onClick={() => openCoachingModal(emp)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                {t('logCoachingSession')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Log Coaching Session Modal */}
      {isAddCoachingModalOpen && selectedEmpForSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('logCoachingSession')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedEmpForSession.name} ({selectedEmpForSession.identifier})
                </p>
              </div>
              <button
                onClick={() => setIsAddCoachingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoachingSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topic / Skill Focus
                </label>
                <input
                  type="text"
                  required
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Coach
                </label>
                <input
                  type="text"
                  required
                  value={sessionCoach}
                  onChange={(e) => setSessionCoach(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Session Diagnostic Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Specific observations, simulated pitch results, feedback given"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Agreed Action Plan & Next Checkpoint
                </label>
                <textarea
                  rows={2}
                  required
                  value={sessionAgreedActions}
                  onChange={(e) => setSessionAgreedActions(e.target.value)}
                  placeholder="Concrete commitments (e.g. shadow 3 corporate pitches, review guide by Friday)"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCoachingModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer"
                >
                  Record Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingEmployee ? t('editEmployee') : t('addEmployee')}
              </h3>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('empName')} (EN)
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('empName')} (العربية)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('empRole')}
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('empIdentifier')}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Knowledge %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={productKnowledgeScore}
                    onChange={(e) => setProductKnowledgeScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Productivity %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={productivityScore}
                    onChange={(e) => setProductivityScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    CSAT %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={customerExperienceScore}
                    onChange={(e) => setCustomerExperienceScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Development Areas (comma separated)
                </label>
                <input
                  type="text"
                  value={developmentAreas}
                  onChange={(e) => setDevelopmentAreas(e.target.value)}
                  placeholder="e.g. Enterprise Data cards, objection handling"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Coaching History: {selectedEmpForHistory.name}
                </h3>
                <p className="text-xs text-slate-400">{selectedEmpForHistory.identifier}</p>
              </div>
              <button
                onClick={() => setSelectedEmpForHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selectedEmpForHistory.history.length > 0 ? (
                selectedEmpForHistory.history.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1">
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
                <p className="text-xs text-slate-400 py-4 text-center">No previous coaching sessions recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
