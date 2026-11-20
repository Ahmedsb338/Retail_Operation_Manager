import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Columns3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Rows3,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface ColumnControlItem {
  key: string;
  label: string;
  labelAr?: string;
  isCustom?: boolean;
}

export type RowSortOrder = 'default' | 'newest' | 'oldest';

export const ROW_LIMIT_OPTIONS = [0, 5, 10, 25, 50, 100] as const;

interface ColumnControlMenuProps {
  columns: ColumnControlItem[];
  hiddenKeys: string[];
  columnOrder: string[];
  onToggleColumn: (key: string) => void;
  onMoveColumn: (key: string, direction: 'up' | 'down') => void;
  onResetColumns: () => void;
  onAddCustomColumn?: (name: string) => void;
  onRemoveCustomColumn?: (key: string) => void;
  allowCustomColumns?: boolean;
  // Row Controls
  rowLimit?: number;
  onRowLimitChange?: (limit: number) => void;
  sortOrder?: RowSortOrder;
  onSortOrderChange?: (order: RowSortOrder) => void;
  onAddRow?: () => void;
  totalRowsCount?: number;
}

export function applyColumnOrderAndVisibility<T extends { key: string }>(
  baseColumns: T[],
  columnOrder: string[],
  hiddenKeys: string[]
): T[] {
  const hiddenSet = new Set(hiddenKeys);
  const byKey = new Map(baseColumns.map((col) => [col.key, col]));
  const ordered: T[] = [];

  for (const key of columnOrder) {
    const col = byKey.get(key);
    if (col) {
      ordered.push(col);
      byKey.delete(key);
    }
  }
  for (const col of baseColumns) {
    if (byKey.has(col.key)) {
      ordered.push(col);
    }
  }
  return ordered.filter((col) => !hiddenSet.has(col.key));
}

export function sortColumnsByOrder<T extends { key: string }>(
  baseColumns: T[],
  columnOrder: string[]
): T[] {
  const byKey = new Map(baseColumns.map((col) => [col.key, col]));
  const ordered: T[] = [];
  for (const key of columnOrder) {
    const col = byKey.get(key);
    if (col) {
      ordered.push(col);
      byKey.delete(key);
    }
  }
  for (const col of baseColumns) {
    if (byKey.has(col.key)) {
      ordered.push(col);
    }
  }
  return ordered;
}

export function applyRowControls<T>(
  rows: T[],
  rowLimit: number = 0,
  sortOrder: RowSortOrder = 'default',
  getDate?: (row: T) => string
): T[] {
  let result = [...rows];
  if (sortOrder !== 'default') {
    if (getDate) {
      result.sort((a, b) => {
        const da = getDate(a) || '';
        const db = getDate(b) || '';
        return sortOrder === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
      });
    } else if (sortOrder === 'newest') {
      result.reverse();
    }
  }
  if (rowLimit > 0) {
    result = result.slice(0, rowLimit);
  }
  return result;
}

export function matchesDateRange(
  rawDate: string | undefined | null,
  fromDate: string,
  toDate: string
): boolean {
  if (!fromDate && !toDate) return true;
  if (!rawDate) return false;
  const d = String(rawDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true;
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

export const ColumnControlMenu: React.FC<ColumnControlMenuProps> = ({
  columns,
  hiddenKeys,
  columnOrder,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  onAddCustomColumn,
  onRemoveCustomColumn,
  allowCustomColumns = false,
  rowLimit = 0,
  onRowLimitChange,
  sortOrder = 'default',
  onSortOrderChange,
  onAddRow,
  totalRowsCount,
}) => {
  const { language, t } = useApp();
  const [open, setOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const isRtl = document.documentElement.dir === 'rtl';
    let left = isRtl ? rect.left : rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const maxHeight = Math.min(480, window.innerHeight - 24);
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
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
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

  const orderedColumns = sortColumnsByOrder(columns, columnOrder);
  const hiddenSet = new Set(hiddenKeys);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed || !onAddCustomColumn) return;
    onAddCustomColumn(trimmed);
    setNewColName('');
  };

  const handleResetAll = () => {
    onResetColumns();
    onRowLimitChange?.(0);
    onSortOrderChange?.('default');
  };

  const hasRowControls = Boolean(onRowLimitChange || onSortOrderChange || onAddRow);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] h-[36px] rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
        aria-expanded={open}
      >
        <Columns3 className="w-3.5 h-3.5 text-[#092d52] dark:text-teal-400 shrink-0" />
        <span>{t('columnsAndRows')}</span>
        <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {orderedColumns.length - hiddenSet.size}/{orderedColumns.length}
          {rowLimit > 0 ? ` · ${rowLimit}` : ''}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: coords.top, left: coords.left, width: Math.min(340, window.innerWidth - 16) }}
            className="fixed rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[120] overflow-hidden text-xs"
          >
            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Columns3 className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('columnsAndRows')}</span>
              </span>
              <div className="flex items-center gap-1">
                {onAddRow && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onAddRow();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('addRecord')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('resetColumns')}</span>
                </button>
              </div>
            </div>

            {hasRowControls && (
              <div className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Rows3 className="w-3.5 h-3.5 text-[#092d52] dark:text-teal-400" />
                    <span>{t('rowsLimit')}</span>
                  </span>
                  {typeof totalRowsCount === 'number' && (
                    <span className="font-mono tabular-nums text-slate-400">
                      {totalRowsCount} {t('rowsLabel')}
                    </span>
                  )}
                </div>

                {onRowLimitChange && (
                  <div className="grid grid-cols-6 gap-1">
                    {ROW_LIMIT_OPTIONS.map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => onRowLimitChange(limit)}
                        className={`min-h-[28px] rounded-lg text-[11px] font-mono tabular-nums font-bold border cursor-pointer ${
                          rowLimit === limit
                            ? 'bg-[#092d52] text-white border-[#092d52] dark:bg-teal-600 dark:border-teal-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {limit === 0 ? t('allRows') : limit}
                      </button>
                    ))}
                  </div>
                )}

                {onSortOrderChange && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {t('rowOrder')}
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5">
                      {(
                        [
                          { value: 'default', label: t('defaultOrder') },
                          { value: 'newest', label: t('newestFirst') },
                          { value: 'oldest', label: t('oldestFirst') },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onSortOrderChange(opt.value)}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                            sortOrder === opt.value
                              ? 'bg-white dark:bg-slate-900 text-[#092d52] dark:text-teal-300 shadow-xs'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1.5 custom-scrollbar">
              {orderedColumns.map((col, idx) => {
                const isVisible = !hiddenSet.has(col.key);
                return (
                  <div
                    key={col.key}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleColumn(col.key)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-start cursor-pointer"
                      aria-label={isVisible ? t('hideColumn') : t('showColumn')}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          isVisible
                            ? 'bg-[#092d52] border-[#092d52] text-white dark:bg-teal-600 dark:border-teal-600'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isVisible && <Check className="w-3 h-3" />}
                      </span>
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? col.labelAr || col.label : col.label}
                      </span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveColumn(col.key, 'up')}
                        aria-label={t('moveUp')}
                        className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedColumns.length - 1}
                        onClick={() => onMoveColumn(col.key, 'down')}
                        aria-label={t('moveDown')}
                        className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      {col.isCustom && onRemoveCustomColumn && (
                        <button
                          type="button"
                          onClick={() => onRemoveCustomColumn(col.key)}
                          aria-label={t('removeColumn')}
                          className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allowCustomColumns && onAddCustomColumn && (
              <form
                onSubmit={handleAdd}
                className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder={t('columnNamePlaceholder')}
                  className="flex-1 min-w-0 px-2.5 min-h-[34px] rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={!newColName.trim()}
                  className="inline-flex items-center gap-1 px-2.5 min-h-[34px] rounded-lg text-xs font-bold bg-[#092d52] hover:bg-[#0d3b6b] disabled:opacity-40 text-white cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('addColumn')}</span>
                </button>
              </form>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
