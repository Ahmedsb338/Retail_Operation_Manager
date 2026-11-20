import React from 'react';
import { Database, RefreshCw, AlertTriangle, ServerOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const DatabaseUnavailableBanner: React.FC = () => {
  const {
    language,
    t,
    databaseUnavailable,
    databaseErrorMessage,
    backendUnavailable,
    backendErrorMessage,
    missingDbVars,
    refreshHealth,
    reloadBranchesCatalog,
  } = useApp();

  if (!databaseUnavailable && !backendUnavailable) return null;

  const handleRetry = async () => {
    await refreshHealth();
    await reloadBranchesCatalog();
  };

  const isBackendDown = backendUnavailable;
  const title = isBackendDown ? t('backendUnavailableTitle') : t('dbUnavailableTitle');
  const body = isBackendDown ? t('backendUnavailableBody') : t('dbUnavailableBody');
  const detail = isBackendDown ? backendErrorMessage : databaseErrorMessage;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-4 text-rose-900 dark:text-rose-100 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
            {isBackendDown ? <ServerOff className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{title}</span>
            </div>
            <p className="text-xs leading-relaxed text-rose-800 dark:text-rose-200">{body}</p>
            {detail && (
              <p className="text-[11px] font-mono text-rose-700 dark:text-rose-300 break-all">
                {detail}
              </p>
            )}
            {!isBackendDown && missingDbVars.length > 0 && (
              <p className="text-[11px] font-mono text-rose-700 dark:text-rose-300">
                {language === 'ar' ? 'المتغيرات المفقودة:' : 'Missing env vars:'}{' '}
                {missingDbVars.join(', ')}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('retryConnection')}</span>
        </button>
      </div>
    </div>
  );
};
