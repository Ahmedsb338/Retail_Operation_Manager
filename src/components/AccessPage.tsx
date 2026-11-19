import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  UserCheck,
  KeyRound,
  AlertCircle,
  Globe,
  Moon,
  Sun,
  Clock,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DatabaseUnavailableBanner } from './DatabaseUnavailableBanner';

export const AccessPage: React.FC = () => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    configuredBranches,
    unconfiguredBranches,
    databaseUnavailable,
    loginBranch,
    loginArea,
  } = useApp();

  const [loginMode, setLoginMode] = useState<'store' | 'area'>('store');
  const [selectedBranchName, setSelectedBranchName] = useState<string>('');
  const [branchCodeInput, setBranchCodeInput] = useState<string>('');
  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [areaUsername, setAreaUsername] = useState<string>('');
  const [areaPassword, setAreaPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showUnconfigured, setShowUnconfigured] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedBranchName && configuredBranches.length > 0) {
      setSelectedBranchName(configuredBranches[0].name);
    }
  }, [configuredBranches, selectedBranchName]);

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    const result = await loginBranch({
      branchName: selectedBranchName,
      branchCode: branchCodeInput.trim(),
      accessCode: accessCodeInput,
    });
    setSubmitting(false);
    if (!result.success) {
      setErrorMsg(
        result.retryAfterSeconds
          ? `${result.message} (${result.retryAfterSeconds}s)`
          : result.message || t('invalidBranchError')
      );
    }
  };

  const handleAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    const result = await loginArea({
      username: areaUsername.trim(),
      password: areaPassword,
    });
    setSubmitting(false);
    if (!result.success) {
      setErrorMsg(
        result.retryAfterSeconds
          ? `${result.message} (${result.retryAfterSeconds}s)`
          : result.message || 'Invalid credentials.'
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6">
      {/* Top Bar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#092d52] text-white flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-[#092d52] dark:text-white">
              ASB Workforce
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('appSubtitle')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#092d52] dark:text-teal-400" />
            <span>{language === 'en' ? 'العربية' : 'English'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="max-w-lg w-full mx-auto my-8 space-y-4">
        <DatabaseUnavailableBanner />

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="px-6 py-6 bg-[#092d52] text-white space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-semibold text-teal-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('demoBadge')}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t('accessTitle')}</h1>
            <p className="text-xs text-slate-200/90 leading-relaxed">{t('accessSubtitle')}</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Role Tabs (Strictly 2 Roles: Store Manager & Area Manager) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('store');
                  setErrorMsg('');
                }}
                className={`flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  loginMode === 'store'
                    ? 'bg-[#092d52] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{t('storeManagerTab')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginMode('area');
                  setErrorMsg('');
                }}
                className={`flex items-center justify-center gap-2 min-h-[42px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  loginMode === 'area'
                    ? 'bg-[#092d52] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>{t('areaManagerTab')}</span>
              </button>
            </div>

            {loginMode === 'store' ? (
              <form onSubmit={handleStoreSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('branchNameLabel')}
                  </label>
                  <select
                    required
                    disabled={databaseUnavailable || configuredBranches.length === 0}
                    value={selectedBranchName}
                    onChange={(e) => setSelectedBranchName(e.target.value)}
                    className="w-full px-3.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    {configuredBranches.length === 0 ? (
                      <option value="">{t('branchSelectPlaceholder')}</option>
                    ) : (
                      configuredBranches.map((b) => (
                        <option key={b.code} value={b.name}>
                          {language === 'ar' ? b.nameAr || b.name : b.name} ({b.city})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('branchCodeLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    disabled={databaseUnavailable}
                    value={branchCodeInput}
                    onChange={(e) => setBranchCodeInput(e.target.value)}
                    placeholder={t('branchCodePlaceholder')}
                    className="w-full px-3.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('branchAccessCodeLabel')}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      disabled={databaseUnavailable}
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value)}
                      placeholder={t('branchAccessCodePlaceholder')}
                      className="w-full ps-10 pe-3.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || databaseUnavailable || configuredBranches.length === 0}
                  className="w-full min-h-[46px] rounded-xl bg-[#092d52] hover:bg-[#0d3b6b] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? t('signingIn') : t('accessBtn')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAreaSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('areaUsernameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    disabled={databaseUnavailable}
                    value={areaUsername}
                    onChange={(e) => setAreaUsername(e.target.value)}
                    placeholder={t('areaUsernamePlaceholder')}
                    className="w-full px-3.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('areaPasswordLabel')}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      disabled={databaseUnavailable}
                      value={areaPassword}
                      onChange={(e) => setAreaPassword(e.target.value)}
                      placeholder={t('areaPasswordPlaceholder')}
                      className="w-full ps-10 pe-3.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0 mt-0.5" />
                  <span>{t('readOnlyNotice')}</span>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || databaseUnavailable}
                  className="w-full min-h-[46px] rounded-xl bg-[#092d52] hover:bg-[#0d3b6b] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? t('signingIn') : t('accessBtn')}
                </button>
              </form>
            )}

            {/* Separate Non-Loginable Unconfigured Branches Notice */}
            {unconfiguredBranches.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUnconfigured(!showUnconfigured)}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {t('unconfiguredBranchesTitle')} ({unconfiguredBranches.length})
                    </span>
                  </span>
                  <span>{showUnconfigured ? '−' : '+'}</span>
                </button>

                {showUnconfigured && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-1.5 text-[11px]">
                    <p className="text-amber-800 dark:text-amber-200">
                      {t('unconfiguredBranchesHint')}
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-slate-700 dark:text-slate-300">
                      {unconfiguredBranches.map((ub) => (
                        <li key={ub.branchName} className="truncate font-medium">
                          · {ub.branchName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
        Developed by Ahmed Sobhy
      </footer>
    </div>
  );
};
