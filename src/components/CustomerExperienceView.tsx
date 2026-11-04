import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CustomerCase, CaseStatus } from '../types';
import {
  HeartHandshake,
  Plus,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  X,
  Edit2,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface CustomerExperienceViewProps {
  isAddCaseModalOpen: boolean;
  setIsAddCaseModalOpen: (open: boolean) => void;
}

export const CustomerExperienceView: React.FC<CustomerExperienceViewProps> = ({
  isAddCaseModalOpen,
  setIsAddCaseModalOpen,
}) => {
  const { t, language, cases, addCase, updateCase, currentBranch } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingCase, setEditingCase] = useState<CustomerCase | null>(null);

  // Form states
  const [caseNumber, setCaseNumber] = useState('');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [issueCategory, setIssueCategory] = useState('Wallet / Digital Cash');
  const [issueCategoryAr, setIssueCategoryAr] = useState('المحفظة الإلكترونية والمعاملات النقدية');
  const [description, setDescription] = useState('');
  const [isRepeated, setIsRepeated] = useState(false);
  const [repeatedMatchCriteria, setRepeatedMatchCriteria] = useState('');
  const [rootCause, setRootCause] = useState('Backend Verification Delay');
  const [rootCauseAr, setRootCauseAr] = useState('تأخر في معالجة التحقق من النظام المركزي');
  const [assignedOwner, setAssignedOwner] = useState('');
  const [resolutionDeadline, setResolutionDeadline] = useState('2026-11-03T16:00');
  const [status, setStatus] = useState<CaseStatus>('pending');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const openAddModal = () => {
    const num = `CAS-${Math.floor(8000 + Math.random() * 1999)}`;
    setCaseNumber(num);
    setCustomerIdentifier(`Client #${num.slice(4)}`);
    setIssueCategory('Wallet / Digital Cash');
    setIssueCategoryAr('المحفظة الإلكترونية والمعاملات النقدية');
    setDescription('');
    setIsRepeated(false);
    setRepeatedMatchCriteria('');
    setRootCause('Backend Verification Delay');
    setRootCauseAr('تأخر في معالجة التحقق من النظام المركزي');
    setAssignedOwner('Heba Mostafa');
    setResolutionDeadline('2026-11-03T16:00');
    setStatus('pending');
    setCorrectiveAction('');
    setResolutionNotes('');
    setEditingCase(null);
    setIsAddCaseModalOpen(true);
  };

  const openEditModal = (c: CustomerCase) => {
    setCaseNumber(c.caseNumber);
    setCustomerIdentifier(c.customerIdentifier);
    setIssueCategory(c.issueCategory);
    setIssueCategoryAr(c.issueCategoryAr || '');
    setDescription(c.description);
    setIsRepeated(c.isRepeated);
    setRepeatedMatchCriteria(c.repeatedMatchCriteria);
    setRootCause(c.rootCause);
    setRootCauseAr(c.rootCauseAr || '');
    setAssignedOwner(c.assignedOwner);
    setResolutionDeadline(c.resolutionDeadline.slice(0, 16));
    setStatus(c.status);
    setCorrectiveAction(c.correctiveAction);
    setResolutionNotes(c.resolutionNotes);
    setEditingCase(c);
    setIsAddCaseModalOpen(true);
  };

  const handleSaveCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    if (editingCase) {
      updateCase({
        ...editingCase,
        customerIdentifier,
        issueCategory,
        issueCategoryAr: issueCategoryAr || issueCategory,
        description,
        isRepeated,
        repeatedMatchCriteria,
        rootCause,
        rootCauseAr: rootCauseAr || rootCause,
        assignedOwner,
        resolutionDeadline: new Date(resolutionDeadline).toISOString(),
        status,
        correctiveAction,
        resolutionNotes,
      });
    } else {
      addCase({
        caseNumber,
        customerIdentifier,
        issueCategory,
        issueCategoryAr: issueCategoryAr || issueCategory,
        description,
        isRepeated,
        repeatedMatchCriteria: isRepeated
          ? repeatedMatchCriteria || `Matching category '${issueCategory}' within 72h window`
          : 'First reported instance',
        rootCause,
        rootCauseAr: rootCauseAr || rootCause,
        assignedOwner,
        resolutionDeadline: new Date(resolutionDeadline).toISOString(),
        status,
        correctiveAction,
        resolutionNotes,
      });
    }
    setIsAddCaseModalOpen(false);
  };

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        c.caseNumber.toLowerCase().includes(q) ||
        c.customerIdentifier.toLowerCase().includes(q) ||
        c.issueCategory.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    if (selectedCategory !== 'all' && c.issueCategory !== selectedCategory) return false;
    return true;
  });

  // Calculate Aging (hours since creation)
  const getAgingHours = (createdStr: string) => {
    try {
      const diff = new Date().getTime() - new Date(createdStr).getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    } catch {
      return 1;
    }
  };

  // Repeated Issues summary
  const repeatedCases = cases.filter((c) => c.isRepeated);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('cxTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('cxSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addCase')}</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
        <span>{t('privacyNotice')}</span>
      </div>

      {/* Repeated Issues Detection Analysis */}
      {repeatedCases.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{t('repeatedIssues')} ({repeatedCases.length} flagged)</span>
          </div>
          <div className="space-y-2">
            {repeatedCases.map((rc) => (
              <div
                key={rc.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span>{rc.caseNumber}</span>
                    <span className="text-slate-400 font-normal">· {rc.issueCategory}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    <strong>Criteria:</strong> {rc.repeatedMatchCriteria}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono shrink-0">
                  Root Cause: <strong className="text-slate-700 dark:text-slate-300">{rc.rootCause}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Case #, Client ID, category, or notes..."
            className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="under_review">{t('under_review')}</option>
            <option value="resolved">{t('resolved')}</option>
            <option value="escalated">{t('escalated')}</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Wallet / Digital Cash">Wallet / Digital Cash</option>
            <option value="Bill Shock">Bill Shock</option>
            <option value="SIM Replacement">SIM Replacement</option>
            <option value="Handset Warranty">Handset Warranty</option>
            <option value="Service Delay">Service Delay</option>
          </select>
        </div>
      </div>

      {/* Case Cards List */}
      <div className="space-y-3">
        {filteredCases.map((c) => {
          const agingHours = getAgingHours(c.createdAt);
          return (
            <div
              key={c.id}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs ${
                c.status === 'escalated'
                  ? 'border-rose-300 dark:border-rose-900/60'
                  : c.status === 'resolved'
                  ? 'border-slate-200 dark:border-slate-800 opacity-90'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {c.caseNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({c.customerIdentifier})</span>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                        c.status === 'resolved'
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                          : c.status === 'escalated'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {t(c.status as any)}
                    </span>

                    {/* Repeated marker */}
                    {c.isRepeated && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                        Repeated Issue
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    <span>Category: <strong className="text-slate-700 dark:text-slate-300">{c.issueCategory}</strong></span>
                    <span>·</span>
                    <span>Root Cause: <strong className="text-slate-700 dark:text-slate-300">{c.rootCause}</strong></span>
                    <span>·</span>
                    <span>Owner: {c.assignedOwner}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-mono-numbers">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Aging: {agingHours}h
                    </span>
                  </div>

                  {c.correctiveAction && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 mb-1">
                      <strong className="text-slate-800 dark:text-slate-200">Action: </strong>
                      {c.correctiveAction}
                    </div>
                  )}

                  {c.resolutionNotes && (
                    <div className="text-[11px] text-teal-600 dark:text-teal-400 font-mono">
                      ✓ Notes: {c.resolutionNotes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => openEditModal(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={t('editCase')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Case Modal */}
      {isAddCaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCase ? t('editCase') : t('addCase')}
              </h3>
              <button
                onClick={() => setIsAddCaseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCase} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('caseNumber')}
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingCase)}
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('clientIdentifier')}
                  </label>
                  <input
                    type="text"
                    value={customerIdentifier}
                    onChange={(e) => setCustomerIdentifier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('issueCategory')}
                  </label>
                  <select
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Wallet / Digital Cash">Wallet / Digital Cash</option>
                    <option value="Bill Shock">Bill Shock</option>
                    <option value="SIM Replacement">SIM Replacement</option>
                    <option value="Handset Warranty">Handset Warranty</option>
                    <option value="Service Delay">Service Delay</option>
                    <option value="Network Coverage">Network Coverage</option>
                    <option value="Contract Discrepancy">Contract Discrepancy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('rootCause')}
                  </label>
                  <select
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Backend Verification Delay">Backend Verification Delay</option>
                    <option value="Hardware Failure">Hardware Failure</option>
                    <option value="Staff Process Error">Staff Process Error</option>
                    <option value="Customer Clarification">Customer Clarification</option>
                    <option value="System Outage">System Outage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Incident Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of customer query, error code, or transaction issue"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRepeated}
                    onChange={(e) => setIsRepeated(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Flag as Repeated Issue</span>
                </label>
                {isRepeated && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('repeatedMatchingCriteria')}
                    </label>
                    <input
                      type="text"
                      value={repeatedMatchCriteria}
                      onChange={(e) => setRepeatedMatchCriteria(e.target.value)}
                      placeholder="e.g. 3rd incident on Terminal 2 within 48h"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <input
                    type="text"
                    required
                    value={assignedOwner}
                    onChange={(e) => setAssignedOwner(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('caseStatus')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CaseStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="pending">{t('pending')}</option>
                    <option value="under_review">{t('under_review')}</option>
                    <option value="resolved">{t('resolved')}</option>
                    <option value="escalated">{t('escalated')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('correctiveAction')}
                </label>
                <textarea
                  rows={2}
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Immediate correction applied or initiated"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('resolutionNotes')}
                </label>
                <input
                  type="text"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Outcome / customer confirmation"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCaseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-sm cursor-pointer"
                >
                  Save Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
