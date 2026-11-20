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
  onExportXlsx?: () => void;
  exportMenu?: React.ReactNode;
  onOpenImport?: () => void;
  onAddNew?: () => void;
  addLabel?: string;
  extraFilters?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search = '',
  onSearchChange,
  showSearch = true,
  showDateFilters = true,
  onExportXlsx,
  exportMenu,
  onOpenImport,
  onAddNew,
  addLabel,
  extraFilters,
  rightActions,
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
    <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar">
      {isAreaManager && (
        <div className="flex items-center gap-1.5 shrink-0 min-w-[165px] max-w-[220px]">
          <Building2 className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <select
            aria-label={t('switchBranch')}
            value={selectedBranchCode}
            onChange={(e) => setSelectedBranchCode(e.target.value)}
            className="w-full px-2.5 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
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
        <div className="relative shrink-0 w-44 sm:w-52 lg:flex-1 lg:min-w-[170px] lg:max-w-[280px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full ps-8 pe-3 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}

      {showDateFilters && (
        <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              {t('fromDateLabel')}
            </span>
            <input
              type="date"
              aria-label={t('fromDateLabel')}
              value={dateRange.fromDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, fromDate: e.target.value })
              }
              className="px-2 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              {t('toDateLabel')}
            </span>
            <input
              type="date"
              aria-label={t('toDateLabel')}
              value={dateRange.toDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, toDate: e.target.value })
              }
              className="px-2 min-h-[36px] h-[36px] rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-800 dark:text-slate-100"
            />
          </div>

          {(dateRange.fromDate || dateRange.toDate) && (
            <button
              type="button"
              onClick={() => setDateRange({ fromDate: '', toDate: '' })}
              title={t('clearFilters')}
              className="inline-flex items-center gap-1 px-2 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {extraFilters && (
        <div className="flex flex-nowrap items-center gap-1.5 shrink-0">{extraFilters}</div>
      )}

      <div className="flex flex-nowrap items-center gap-1.5 ms-auto shrink-0">
        {rightActions}

        {exportMenu ? (
          exportMenu
        ) : onExportXlsx ? (
          <button
            type="button"
            onClick={onExportXlsx}
            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportXlsx')}</span>
          </button>
        ) : null}

        {canEdit && onOpenImport && (
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-[#092d52] hover:bg-[#0d3b6b] text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('importData')}</span>
          </button>
        )}

        {canEdit && onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addLabel || t('addRecord')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
