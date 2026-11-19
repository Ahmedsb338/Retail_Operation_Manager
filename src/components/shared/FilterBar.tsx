import React from 'react';
import {
  Search,
  Download,
  Upload,
  Plus,
  Calendar,
  Building2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  showDateFilters?: boolean;
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
  onOpenImport?: () => void;
  onAddNew?: () => void;
  addLabel?: string;
  extraFilters?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search = '',
  onSearchChange,
  showSearch = true,
  showDateFilters = true,
  onExportCsv,
  onExportXlsx,
  onOpenImport,
  onAddNew,
  addLabel,
  extraFilters,
}) => {
  const {
    language,
    t,
    user,
    canEdit,
    authorizedBranches,
    selectedBranchCode,
    setSelectedBranchCode,
    dateRange,
    setDateRange,
  } = useApp();

  const isAreaManager = user?.role === 'AREA_MANAGER';

  return (
    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {isAreaManager && (
          <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
            <Building2 className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
            <select
              aria-label={t('switchBranch')}
              value={selectedBranchCode}
              onChange={(e) => setSelectedBranchCode(e.target.value)}
              className="w-full px-3 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">
                {t('allAuthorizedBranches')} ({authorizedBranches.length})
              </option>
              {authorizedBranches.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} · {language === 'ar' ? b.nameAr || b.name : b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showSearch && onSearchChange && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-9 pe-3 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

        {showDateFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500">
                {t('fromDateLabel')}
              </span>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, fromDate: e.target.value })
                }
                className="px-2.5 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                {t('toDateLabel')}
              </span>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, toDate: e.target.value })
                }
                className="px-2.5 min-h-[40px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            {(dateRange.fromDate || dateRange.toDate) && (
              <button
                type="button"
                onClick={() => setDateRange({ fromDate: '', toDate: '' })}
                className="inline-flex items-center gap-1 px-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('clearFilters')}</span>
              </button>
            )}
          </div>
        )}

        {extraFilters}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('exportCsv')}</span>
            </button>
          )}
          {onExportXlsx && (
            <button
              type="button"
              onClick={onExportXlsx}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('exportXlsx')}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('importData')}</span>
            </button>
          )}
          {canEdit && onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{addLabel || t('addRecord')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
