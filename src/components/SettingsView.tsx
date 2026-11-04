import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Globe,
  Moon,
  Sun,
  RotateCcw,
  ShieldCheck,
  Server,
  Database,
  Lock,
  Layers,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    currentBranch,
    resetBranchToDemo,
  } = useApp();

  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = () => {
    if (window.confirm('Reset all operational records for this branch back to the initial demo baseline? Any newly added tasks or cases will be reset.')) {
      resetBranchToDemo();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3500);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('settingsTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Language & Direction Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Globe className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('languageSetting')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setLanguage('en')}
            className={`p-3.5 rounded-xl border text-start flex items-center justify-between transition-all cursor-pointer ${
              language === 'en'
                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t('englishOption')}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Left-to-Right layout with Plus Jakarta Sans</div>
            </div>
            {language === 'en' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
          </button>

          <button
            onClick={() => setLanguage('ar')}
            className={`p-3.5 rounded-xl border text-start flex items-center justify-between transition-all cursor-pointer ${
              language === 'ar'
                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t('arabicOption')}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">تخطيط كامل من اليمين لليسار بخط القاهرة الاحترافي</div>
            </div>
            {language === 'ar' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
          </button>
        </div>
      </div>

      {/* Theme Appearance Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Moon className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('themeSetting')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border text-start flex items-center justify-between transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-xs font-bold">{t('lightTheme')}</div>
                <div className="text-[11px] text-slate-500">High-contrast daytime clarity</div>
              </div>
            </div>
            {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border text-start flex items-center justify-between transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-bold">{t('darkTheme')}</div>
                <div className="text-[11px] text-slate-500">Low-glare deep navy surfaces</div>
              </div>
            </div>
            {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
          </button>
        </div>
      </div>

      {/* Sandbox Data Management */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <RotateCcw className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('dataManagement')}
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Active Branch: <strong className="text-slate-900 dark:text-white font-mono">{currentBranch?.code}</strong> ({currentBranch?.name}). Resetting restores all initial audit balances, verified contracts, default sales targets, and test customer cases.
        </p>

        {resetSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{t('resetSuccessMsg')}</span>
          </div>
        )}

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('resetDemoDataBtn')}</span>
        </button>
      </div>

      {/* Architecture & Scalability Blueprint */}
      <div className="p-5 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Server className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            {t('architectureSummaryTitle')}
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {t('architectureSummaryBody')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-teal-400 font-bold mb-1">
              <Database className="w-3.5 h-3.5" />
              <span>Tenant Data Isolation</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Branch-level isolation enforced at the backend query layer (`WHERE branch_code = ?`). No cross-tenant data leakage.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Role-Based Auth (RBAC)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Manager credentials kept on the server. Frontend only receives scoped JWT session tokens with zero service-role keys exposed.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>Server-Side Gemini AI</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              AI requests processed securely in `server.ts` via `@google/genai` (Gemini 3.8 Flash) with strict empirical grounding.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 text-end font-mono">
          {t('versionInfo')}
        </div>
      </div>
    </div>
  );
};
