import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, SlidersHorizontal, Calendar, RotateCcw, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface ExportFilterOptions {
  fromDate: string;
  toDate: string;
  rowScope: 'filtered' | 'all';
  colScope: 'visible' | 'all';
  searchText: string;
}

interface ExportExcelMenuProps {
  onExport: (options: ExportFilterOptions) => Promise<void> | void;
  defaultFromDate?: string;
  defaultToDate?: string;
  defaultSearchText?: string;
  extraFilterContent?: React.ReactNode;
  showColumnScope?: boolean;
  showRowScope?: boolean;
  showSearchFilter?: boolean;
  disabled?: boolean;
}

export async function downloadXlsxSheet(
  filename: string,
  sheetName: string,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const XLSX = await import('xlsx');
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Sheet1');
  XLSX.writeFile(wb, safeName);
}

export const ExportExcelMenu: React.FC<ExportExcelMenuProps> = ({
  onExport,
  defaultFromDate,
  defaultToDate,
  defaultSearchText = '',
  extraFilterContent,
  showColumnScope = true,
  showRowScope = true,
  showSearchFilter = true,
  disabled = false,
}) => {
  const { t, dateRange } = useApp();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [fromDate, setFromDate] = useState(defaultFromDate ?? dateRange.fromDate ?? '');
  const [toDate, setToDate] = useState(defaultToDate ?? dateRange.toDate ?? '');
  const [rowScope, setRowScope] = useState<'filtered' | 'all'>('filtered');
  const [colScope, setColScope] = useState<'visible' | 'all'>('visible');
  const [searchText, setSearchText] = useState(defaultSearchText);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (open) {
      setFromDate(defaultFromDate ?? dateRange.fromDate ?? '');
      setToDate(defaultToDate ?? dateRange.toDate ?? '');
      setSearchText(defaultSearchText);
    }
  }, [open, defaultFromDate, defaultToDate, dateRange.fromDate, dateRange.toDate, defaultSearchText]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const isRtl = document.documentElement.dir === 'rtl';
    let left = isRtl ? rect.left : rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const maxHeight = Math.min(440, window.innerHeight - 24);
    let top = rect.bottom + 8;
    if (top + maxHeight > window.innerHeight - 8 && rect.top - maxHeight - 8 > 8) {
      top = Math.max(8, rect.top - maxHeight - 8);
    }
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  const handleRunExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exporting || disabled) return;
    setExporting(true);
    try {
      await onExport({
        fromDate,
        toDate,
        rowScope,
        colScope,
        searchText,
      });
      setOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{t('exportXlsx')}</span>
        <SlidersHorizontal className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {open &&
        createPortal(
          <form
            ref={popoverRef as any}
            onSubmit={handleRunExport}
            style={{ top: coords.top, left: coords.left, width: Math.min(340, window.innerWidth - 16) }}
            className="fixed rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[120] overflow-hidden text-xs"
          >
            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('exportFilterTitle')}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setSearchText('');
                  setRowScope('filtered');
                  setColScope('visible');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('resetExportFilter')}</span>
              </button>
            </div>

            <div className="p-3.5 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{t('fromDateLabel')}</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2.5 min-h-[36px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{t('toDateLabel')}</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2.5 min-h-[36px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-slate-900 dark:text-white"
                />
              </div>

              {showSearchFilter && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('exportSearchLabel')}
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="w-full ps-8 pe-2.5 min-h-[36px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {extraFilterContent}

              {showRowScope && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('exportRowsScope')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRowScope('filtered')}
                      className={`min-h-[32px] px-2 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                        rowScope === 'filtered'
                          ? 'bg-[#092d52] text-white border-[#092d52] dark:bg-teal-600 dark:border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t('filteredRowsOnly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowScope('all')}
                      className={`min-h-[32px] px-2 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                        rowScope === 'all'
                          ? 'bg-[#092d52] text-white border-[#092d52] dark:bg-teal-600 dark:border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t('allRowsScope')}
                    </button>
                  </div>
                </div>
              )}

              {showColumnScope && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('exportColsScope')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setColScope('visible')}
                      className={`min-h-[32px] px-2 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                        colScope === 'visible'
                          ? 'bg-[#092d52] text-white border-[#092d52] dark:bg-teal-600 dark:border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t('visibleColsOnly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setColScope('all')}
                      className={`min-h-[32px] px-2 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                        colScope === 'all'
                          ? 'bg-[#092d52] text-white border-[#092d52] dark:bg-teal-600 dark:border-teal-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t('allColsScope')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 min-h-[34px] rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[34px] rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting ? '...' : t('downloadExcel')}</span>
              </button>
            </div>
          </form>,
          document.body
        )}
    </div>
  );
};
