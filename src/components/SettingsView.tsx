import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Moon,
  Sun,
  Calendar,
  KeyRound,
  ShieldCheck,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Building2,
  LogOut,
  Lock,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/apiClient';
import type { ImportSummary } from '../types';
import { FilterBar } from './shared/FilterBar';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './shared/ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  type RowSortOrder,
} from './shared/ColumnControlMenu';

const PILLARS = ['Gross Adds', 'Red & Flex', 'VF Cash', 'Fixed', 'Enterprise'];

const SETTINGS_COLUMNS = [
  { key: 'pillar', label: 'Strategic Pillar', labelAr: 'المحور الاستراتيجي' },
  { key: 'target', label: 'Monthly Target', labelAr: 'المستهدف الشهري' },
  { key: 'fyStart', label: 'FY Start', labelAr: 'بداية السنة المالية' },
  { key: 'fyEnd', label: 'FY End', labelAr: 'نهاية السنة المالية' },
  { key: 'branch', label: 'Branch', labelAr: 'الفرع' },
];

interface ScannedLegacyData {
  keysFound: string[];
  bundle: {
    tasks: unknown[];
    employees: unknown[];
    salesBoxes: unknown[];
    cases: unknown[];
    healthWeights?: Record<string, unknown>;
    targetCalculator?: Record<string, unknown>;
    tnpsDailyRecords: Array<Record<string, unknown>>;
  };
}

function scanBrowserLocalStorage(): ScannedLegacyData {
  const keysFound: string[] = [];
  const tasks: unknown[] = [];
  const employees: unknown[] = [];
  const salesBoxes: unknown[] = [];
  const cases: unknown[] = [];
  let healthWeights: Record<string, unknown> | undefined;
  let targetCalculator: Record<string, unknown> | undefined;
  const tnpsDailyRecords: Array<Record<string, unknown>> = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('opm_branch_data_')) {
        keysFound.push(key);
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        if (Array.isArray(parsed.tasks)) tasks.push(...parsed.tasks);
        if (Array.isArray(parsed.employees)) employees.push(...parsed.employees);
        if (Array.isArray(parsed.salesBoxes)) salesBoxes.push(...parsed.salesBoxes);
        if (Array.isArray(parsed.cases)) cases.push(...parsed.cases);
        if (parsed.healthWeights) healthWeights = parsed.healthWeights;
      } else if (key.startsWith('opm_branch_') && key.endsWith('_tnps_history')) {
        keysFound.push(key);
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) tnpsDailyRecords.push(...arr);
      } else if (key.startsWith('opm_branch_') && key.endsWith('_items')) {
        keysFound.push(key);
        const branchPrefix = key.replace(/_items$/, '');
        const items = JSON.parse(localStorage.getItem(key) || '{}');
        const weights = JSON.parse(
          localStorage.getItem(`${branchPrefix}_box_weights`) || '{}'
        );
        const redSalesToday = localStorage.getItem(`${branchPrefix}_red_today`) || '0';
        const redSalesTarget = localStorage.getItem(`${branchPrefix}_red_target`) || '0';
        const dailyTrend = JSON.parse(
          localStorage.getItem(`${branchPrefix}_history`) || '[]'
        );
        const totalShifts = Number(localStorage.getItem(`${branchPrefix}_total_shifts`) || '25');
        const remainingShifts = Number(
          localStorage.getItem(`${branchPrefix}_rem_shifts`) || '10'
        );
        targetCalculator = {
          items,
          weights,
          redSalesToday,
          redSalesTarget,
          dailyTrend,
          totalShifts,
          remainingShifts,
        };
      }
    }
  } catch {
    // ignore malformed localStorage entries
  }

  return {
    keysFound,
    bundle: {
      tasks,
      employees,
      salesBoxes,
      cases,
      healthWeights,
      targetCalculator,
      tnpsDailyRecords,
    },
  };
}

export const SettingsView: React.FC = () => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    user,
    canEdit,
    currentBranch,
    fiscalYear,
    saveFiscalYear,
    updateBranchProfile,
    logoutAll,
    dateRange,
    addTask,
  } = useApp();

  // Unified Toolbar Controls & Quick Add Modal
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>(() => SETTINGS_COLUMNS.map((c) => c.key));
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    owner: currentBranch?.manager || '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(SETTINGS_COLUMNS, colOrder, hiddenCols),
    [colOrder, hiddenCols]
  );

  // Fiscal Year State
  const [fyStart, setFyStart] = useState(fiscalYear.startDate);
  const [fyEnd, setFyEnd] = useState(fiscalYear.endDate);
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});
  const [fySaving, setFySaving] = useState(false);
  const [fyMsg, setFyMsg] = useState<string | null>(null);

  useEffect(() => {
    setFyStart(fiscalYear.startDate);
    setFyEnd(fiscalYear.endDate);
    const map: Record<string, string> = {};
    PILLARS.forEach((p) => {
      const hit = fiscalYear.pillarTargets?.find((pt) => pt.pillar === p);
      map[p] = hit && hit.monthlyTarget !== null ? String(hit.monthlyTarget) : '';
    });
    setTargetInputs(map);
  }, [fiscalYear]);

  // Branch Profile Operational Fields
  const [managerName, setManagerName] = useState(currentBranch?.manager || '');
  const [businessDate, setBusinessDate] = useState(currentBranch?.businessDate || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentBranch) {
      setManagerName(currentBranch.manager);
      setBusinessDate(currentBranch.businessDate);
    }
  }, [currentBranch]);

  // Area Manager Password Rotation
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // LocalStorage Migration Wizard
  const [scanned, setScanned] = useState<ScannedLegacyData | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    summary: ImportSummary;
    perDomain: Record<string, { valid: number; invalid: number; duplicate: number }>;
  } | null>(null);
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);
  const [commitResult, setCommitResult] = useState<ImportSummary | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const handleSaveFy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setFySaving(true);
    setFyMsg(null);
    try {
      await saveFiscalYear({
        startDate: fyStart,
        endDate: fyEnd,
        pillarTargets: PILLARS.map((p) => ({
          pillar: p,
          monthlyTarget: targetInputs[p] ? parseFloat(targetInputs[p]) : null,
          unit: '%',
        })),
      });
      setFyMsg(language === 'ar' ? 'تم حفظ السنة المالية والمستهدفات' : 'Fiscal Year saved.');
    } catch (err) {
      setFyMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setFySaving(false);
    }
  };

  const handleSaveBranchProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateBranchProfile({ managerName, businessDate });
      setProfileMsg(language === 'ar' ? 'تم تحديث بيانات الفرع التشغيلية' : 'Branch settings saved.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Failed to update branch profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    setPwdSaving(true);
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdMsg({
        ok: true,
        text:
          language === 'ar'
            ? 'تم تغيير كلمة المرور وإنهاء كافة الجلسات السابقة.'
            : 'Password updated and all prior sessions revoked.',
      });
    } catch (err) {
      setPwdMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Password change failed.',
      });
    } finally {
      setPwdSaving(false);
    }
  };

  const handleScanLocal = () => {
    setMigrationError(null);
    setPreviewResult(null);
    setCommitResult(null);
    setScanned(scanBrowserLocalStorage());
  };

  const handleDownloadJsonBackup = () => {
    if (!scanned) return;
    const blob = new Blob([JSON.stringify(scanned.bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asb_local_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePreviewMigration = async () => {
    if (!scanned) return;
    setMigrationError(null);
    try {
      const res = await apiRequest<{
        summary: ImportSummary;
        perDomain: Record<string, { valid: number; invalid: number; duplicate: number }>;
      }>('/api/v1/migrations/local-import/preview', {
        method: 'POST',
        body: { confirmed: false, bundle: scanned.bundle },
      });
      setPreviewResult(res);
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : 'Preview failed.');
    }
  };

  const handleCommitMigration = async () => {
    if (!scanned || !migrationConfirmed) return;
    setMigrationError(null);
    try {
      const res = await apiRequest<{ summary: ImportSummary }>(
        '/api/v1/migrations/local-import/commit',
        {
          method: 'POST',
          body: { confirmed: true, bundle: scanned.bundle },
        }
      );
      setCommitResult(res.summary);
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : 'Commit failed.');
    }
  };

  const filteredPillars = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q ? PILLARS : PILLARS.filter((p) => p.toLowerCase().includes(q));
    return applyRowControls(list, rowLimit, sortOrder);
  }, [search, rowLimit, sortOrder]);

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const baseList = opts.rowScope === 'all' ? PILLARS : filteredPillars;
    const q = opts.searchText.trim().toLowerCase();
    const list = baseList.filter((p) => !q || p.toLowerCase().includes(q));
    const cols = opts.colScope === 'visible' ? visibleColumns : SETTINGS_COLUMNS;
    const rows = list.map((p) => {
      const out: Record<string, unknown> = {
        Manager: managerName || currentBranch?.manager || '',
        BusinessDate: businessDate || currentBranch?.businessDate || '',
        Period: opts.fromDate || opts.toDate ? `${opts.fromDate || '...'} -> ${opts.toDate || '...'}` : 'Fiscal Year',
      };
      for (const col of cols) {
        const header = language === 'ar' ? col.labelAr : col.label;
        if (col.key === 'pillar') out[header] = p;
        else if (col.key === 'target') out[header] = targetInputs[p] || t('unconfiguredLabel');
        else if (col.key === 'fyStart') out[header] = fyStart;
        else if (col.key === 'fyEnd') out[header] = fyEnd;
        else if (col.key === 'branch') out[header] = currentBranch?.code || '';
      }
      return out;
    });
    await downloadXlsxSheet(
      `branch_settings_${currentBranch?.code || 'config'}.xlsx`,
      'Settings',
      rows
    );
  };

  const openAddGoalModal = () => {
    setGoalForm({
      title: '',
      owner: currentBranch?.manager || '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleSaveGoalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !goalForm.title.trim()) return;
    setTaskSaving(true);
    try {
      await addTask({
        title: goalForm.title.trim(),
        titleAr: goalForm.title.trim(),
        description: goalForm.notes.trim() || goalForm.title.trim(),
        descriptionAr: goalForm.notes.trim() || goalForm.title.trim(),
        category: 'financial',
        subcategory: 'fiscal_milestone',
        owner: goalForm.owner.trim() || currentBranch?.manager || 'Store Manager',
        ownerRole: 'Store Manager',
        deadline: goalForm.date,
        dueDate: goalForm.date,
        date: goalForm.date,
        priority: 'medium',
        status: 'not_started',
        notes: goalForm.notes.trim(),
        evidenceText: '',
      });
      setShowAddModal(false);
      setToastMsg(language === 'ar' ? 'تم حفظ السجل بنجاح' : 'Fiscal governance milestone saved');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setTaskSaving(false);
    }
  };

  return (
    <div className="space-y-5 content-container">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('settingsTitle')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Single-Row Unified Toolbar */}
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
        onAddNew={canEdit ? openAddGoalModal : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
            <ColumnControlMenu
              columns={SETTINGS_COLUMNS}
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
                setColOrder(SETTINGS_COLUMNS.map((c) => c.key));
              }}
              rowLimit={rowLimit}
              onRowLimitChange={setRowLimit}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onAddRow={canEdit ? openAddGoalModal : undefined}
              totalRowsCount={filteredPillars.length}
            />

            <button
              type="button"
              onClick={logoutAll}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] h-[36px] rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('logoutAll')}</span>
            </button>
          </div>
        }
      />

      {/* Language & Theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Globe className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
            <span>{t('languageSetting')}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                language === 'en'
                  ? 'bg-[#092d52] text-white border-[#092d52]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('englishOption')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              className={`min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                language === 'ar'
                  ? 'bg-[#092d52] text-white border-[#092d52]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('arabicOption')}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span>{t('themeSetting')}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#092d52] text-white border-[#092d52]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('lightTheme')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#092d52] text-white border-[#092d52]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('darkTheme')}
            </button>
          </div>
        </div>
      </div>

      {/* Configurable Fiscal Year & Pillar Targets */}
      <form
        onSubmit={handleSaveFy}
        className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
            <span>{t('fiscalYearSetting')}</span>
          </h3>
          {!canEdit && <Lock className="w-4 h-4 text-slate-400" />}
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {t('fiscalYearStartLabel')}
            </label>
            <input
              type="date"
              disabled={!canEdit}
              value={fyStart}
              onChange={(e) => setFyStart(e.target.value)}
              className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {t('fiscalYearEndLabel')}
            </label>
            <input
              type="date"
              disabled={!canEdit}
              value={fyEnd}
              onChange={(e) => setFyEnd(e.target.value)}
              className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
            />
          </div>
          {filteredPillars.map((p) => (
            <div key={p}>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1 truncate">
                {p}
              </label>
              <input
                type="number"
                step="any"
                disabled={!canEdit}
                value={targetInputs[p] ?? ''}
                onChange={(e) => setTargetInputs({ ...targetInputs, [p]: e.target.value })}
                placeholder={t('unconfiguredLabel')}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
              />
            </div>
          ))}
        </div>

        {fyMsg && <div className="text-xs font-semibold text-teal-600">{fyMsg}</div>}

        {canEdit && (
          <button
            type="submit"
            disabled={fySaving}
            className="px-4 min-h-[40px] rounded-xl text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer"
          >
            {fySaving ? '...' : t('saveFiscalYearBtn')}
          </button>
        )}
      </form>

      {/* Branch Operational Profile (Store Manager Only) */}
      {canEdit && currentBranch && (
        <form
          onSubmit={handleSaveBranchProfile}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
            <span>
              {t('branchProfileTitle')} ({currentBranch.code} · {currentBranch.name})
            </span>
          </h3>

          <div className="grid grid-cols-1 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('branchManager')}
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('businessDate')}
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {profileMsg && <div className="text-xs font-semibold text-teal-600">{profileMsg}</div>}

          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 min-h-[40px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
          >
            {profileSaving ? '...' : t('saveRecord')}
          </button>
        </form>
      )}

      {/* Area Manager Password Change */}
      {user?.role === 'AREA_MANAGER' && (
        <form
          onSubmit={handleChangePassword}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
            <span>{t('changePasswordTitle')}</span>
          </h3>

          <div className="grid grid-cols-1 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'ar' ? 'كلمة المرور الحالية' : 'Current password'}
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'ar' ? 'كلمة المرور الجديدة (12 حرف على الأقل)' : 'New password (min 12 chars)'}
              </label>
              <input
                type="password"
                required
                minLength={12}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
              </label>
              <input
                type="password"
                required
                minLength={12}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {pwdMsg && (
            <div
              className={`text-xs font-semibold ${
                pwdMsg.ok ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {pwdMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pwdSaving}
            className="px-4 min-h-[40px] rounded-xl text-xs font-bold bg-[#092d52] text-white cursor-pointer"
          >
            {pwdSaving ? '...' : t('changePasswordTitle')}
          </button>
        </form>
      )}

      {/* Safe localStorage Migration Wizard (Store Manager Only, Never Auto-Deletes) */}
      {canEdit && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#092d52] dark:text-teal-400" />
                <span>{t('localMigrationTitle')}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar'
                  ? 'افحص بيانات المتصفح السابقة (إن وجدت)، حمّل نسخة احتياطية JSON، ثم نفذ المعاينة والترحيل إلى PostgreSQL.'
                  : 'Inspect legacy localStorage keys, download a JSON backup, preview validation, and commit safely to PostgreSQL.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleScanLocal}
              className="px-3.5 min-h-[38px] rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 cursor-pointer self-start"
            >
              {language === 'ar' ? 'فحص المتصفح' : 'Scan Browser Data'}
            </button>
          </div>

          {scanned && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="font-mono text-[11px]">
                Keys detected: {scanned.keysFound.length} · Tasks: {scanned.bundle.tasks.length} ·
                Staff: {scanned.bundle.employees.length} · Sales: {scanned.bundle.salesBoxes.length}{' '}
                · Complaints: {scanned.bundle.cases.length} · TNPS:{' '}
                {scanned.bundle.tnpsDailyRecords.length}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JSON Backup</span>
                </button>
                <button
                  type="button"
                  onClick={handlePreviewMigration}
                  className="px-3 min-h-[36px] rounded-xl bg-[#092d52] text-white font-bold cursor-pointer"
                >
                  Preview Validation
                </button>
              </div>

              {previewResult && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold">
                    Preview: {previewResult.summary.valid} valid, {previewResult.summary.invalid}{' '}
                    invalid, {previewResult.summary.duplicate} duplicate (of{' '}
                    {previewResult.summary.total})
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={migrationConfirmed}
                      onChange={(e) => setMigrationConfirmed(e.target.checked)}
                    />
                    <span>
                      I have downloaded my JSON backup and confirm importing valid records into
                      branch {user?.branchCode}.
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!migrationConfirmed}
                    onClick={handleCommitMigration}
                    className="px-4 min-h-[36px] rounded-xl bg-teal-600 disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    Commit Migration to PostgreSQL
                  </button>
                </div>
              )}

              {commitResult && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Imported {commitResult.imported} records ({commitResult.duplicate} duplicates
                    skipped, {commitResult.rejected} rejected). Local browser storage preserved.
                  </span>
                </div>
              )}

              {migrationError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{migrationError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Architecture Footer */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
        <div className="flex items-center gap-2 font-bold text-[#092d52] dark:text-teal-400">
          <ShieldCheck className="w-4 h-4" />
          <span>{t('architectureSummaryTitle')}</span>
        </div>
        <p>{t('architectureSummaryBody')}</p>
        <p className="text-[11px] font-mono text-slate-400 pt-1">{t('versionInfo')}</p>
      </div>

      {/* Add Governance / Fiscal Milestone Modal (Strict 1-Column Inputs) */}
      {canEdit && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveGoalRecord}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('addRecord')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 gap-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold mb-1">{t('taskTitle')} *</label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskOwner')}</label>
                <input
                  type="text"
                  value={goalForm.owner}
                  onChange={(e) => setGoalForm((p) => ({ ...p, owner: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('businessDate')}</label>
                <input
                  type="date"
                  value={goalForm.date}
                  onChange={(e) => setGoalForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t('taskNotes')}</label>
                <textarea
                  rows={2}
                  value={goalForm.notes}
                  onChange={(e) => setGoalForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 min-h-[38px] rounded-xl text-xs bg-slate-100 dark:bg-slate-800 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={taskSaving}
                className="px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer disabled:opacity-50"
              >
                {taskSaving ? '...' : t('saveRecord')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
