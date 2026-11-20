import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Edit2, Trash2, X, Lock, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiDownloadFile, apiRequest, buildQueryParams } from '../../services/apiClient';
import { FilterBar } from './FilterBar';
import { ImportSummaryModal } from './ImportSummaryModal';
import { ExportExcelMenu, downloadXlsxSheet, type ExportFilterOptions } from './ExportExcelMenu';
import {
  ColumnControlMenu,
  applyColumnOrderAndVisibility,
  applyRowControls,
  matchesDateRange,
  type RowSortOrder,
} from './ColumnControlMenu';

export interface FieldDefinition {
  key: string;
  label: string;
  labelAr: string;
  type: 'text' | 'number' | 'integer' | 'date' | 'month' | 'select' | 'textarea' | 'time';
  required?: boolean;
  nullable?: boolean;
  options?: Array<{ value: string; label: string; labelAr?: string }>;
  placeholder?: string;
}

export interface ColumnDefinition<T = Record<string, any>> {
  key: string;
  label: string;
  labelAr: string;
  isNumeric?: boolean;
  isNullableMetric?: boolean;
  suffix?: string;
  render?: (row: T, language: 'en' | 'ar', unconfiguredText: string) => React.ReactNode;
}

interface CustomColumnDef {
  key: string;
  label: string;
}

interface OperationalTableModuleProps {
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  endpoint: string;
  exportFilename: string;
  columns: ColumnDefinition[];
  fields: FieldDefinition[];
  defaultNewValues: () => Record<string, any>;
  importHeadersHint?: string;
  showDateFilters?: boolean;
  topSlot?: React.ReactNode;
  metaField?: 'notes' | 'reason' | 'remarks';
}

const CUSTOM_PREFIX = '__custom__:';

function parseCustomMeta(rawMeta: string): {
  baseText: string;
  customValues: Record<string, string>;
} {
  const customValues: Record<string, string> = {};
  const keptLines: string[] = [];
  for (const line of String(rawMeta || '').split('\n')) {
    const match = line.match(/^\[COL:([^\]]+)\]\s*(.*)$/);
    if (match) {
      customValues[match[1].trim()] = match[2];
    } else {
      keptLines.push(line);
    }
  }
  return {
    baseText: keptLines.join('\n').trim(),
    customValues,
  };
}

function serializeCustomMeta(baseText: string, customValues: Record<string, string>): string {
  const cleanBase = baseText.trim();
  const customLines = Object.entries(customValues)
    .filter(([, val]) => val.trim() !== '')
    .map(([colLabel, val]) => `[COL:${colLabel}] ${val.trim()}`);
  return [cleanBase, ...customLines].filter(Boolean).join('\n');
}

export const OperationalTableModule: React.FC<OperationalTableModuleProps> = ({
  title,
  titleAr,
  subtitle,
  subtitleAr,
  endpoint,
  exportFilename,
  columns,
  fields,
  defaultNewValues,
  importHeadersHint,
  showDateFilters = true,
  topSlot,
  metaField,
}) => {
  const {
    language,
    t,
    canEdit,
    selectedBranchCode,
    user,
    dateRange,
  } = useApp();

  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);

  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rowLimit, setRowLimit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<RowSortOrder>('default');

  const storageKey = `asb_cols_${endpoint.replace(/[^a-z0-9]+/gi, '_')}`;
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_hidden`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [colOrder, setColOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_order`);
      return saved ? JSON.parse(saved) : columns.map((c) => c.key);
    } catch {
      return columns.map((c) => c.key);
    }
  });
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_custom`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_hidden`, JSON.stringify(hiddenCols));
      localStorage.setItem(`${storageKey}_order`, JSON.stringify(colOrder));
      localStorage.setItem(`${storageKey}_custom`, JSON.stringify(customColumns));
    } catch {
      // ignore storage errors
    }
  }, [storageKey, hiddenCols, colOrder, customColumns]);

  const branchQueryParam =
    user?.role === 'AREA_MANAGER'
      ? selectedBranchCode || undefined
      : user?.branchCode || undefined;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryParams({
        branchCode: branchQueryParam,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        search: search || undefined,
      });
      const res = await apiRequest<{ records: Array<Record<string, any>> }>(`${endpoint}${qs}`);
      setRecords(res.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, branchQueryParam, dateRange.fromDate, dateRange.toDate, search]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Discover any custom column labels present in loaded records even if not yet added locally
  const mergedCustomColumns = useMemo(() => {
    const map = new Map<string, CustomColumnDef>();
    for (const c of customColumns) {
      map.set(c.key, c);
    }
    if (metaField) {
      for (const row of records) {
        const { customValues } = parseCustomMeta(String(row[metaField] ?? ''));
        for (const label of Object.keys(customValues)) {
          const key = `${CUSTOM_PREFIX}${label}`;
          if (!map.has(key)) {
            map.set(key, { key, label });
          }
        }
      }
    }
    return Array.from(map.values());
  }, [customColumns, metaField, records]);

  const allColumns: Array<ColumnDefinition & { isCustom?: boolean }> = useMemo(() => {
    const customDefs: Array<ColumnDefinition & { isCustom?: boolean }> = mergedCustomColumns.map(
      (c) => ({
        key: c.key,
        label: c.label,
        labelAr: c.label,
        isCustom: true,
        render: (row) => {
          if (!metaField) return <span className="text-slate-400">—</span>;
          const { customValues } = parseCustomMeta(String(row[metaField] ?? ''));
          const val = customValues[c.label];
          return val ? <span>{val}</span> : <span className="text-slate-400">—</span>;
        },
      })
    );
    return [...columns, ...customDefs];
  }, [columns, mergedCustomColumns, metaField]);

  const visibleColumns = useMemo(
    () => applyColumnOrderAndVisibility(allColumns, colOrder, hiddenCols),
    [allColumns, colOrder, hiddenCols]
  );

  const displayedRecords = useMemo(
    () =>
      applyRowControls(records, rowLimit, sortOrder, (r) =>
        String(r.date || r.month || r.createdAt || '')
      ),
    [records, rowLimit, sortOrder]
  );

  const handleToggleColumn = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMoveColumn = (key: string, direction: 'up' | 'down') => {
    const allKeys = allColumns.map((c) => c.key);
    const currentOrder = [
      ...colOrder.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !colOrder.includes(k)),
    ];
    const idx = currentOrder.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setColOrder(next);
  };

  const handleResetColumns = () => {
    setHiddenCols([]);
    setColOrder(columns.map((c) => c.key));
    setCustomColumns([]);
  };

  const handleAddCustomColumn = (label: string) => {
    const clean = label.replace(/[\[\]\n\r]/g, '').trim();
    if (!clean) return;
    const key = `${CUSTOM_PREFIX}${clean}`;
    if (allColumns.some((c) => c.key === key)) return;
    setCustomColumns((prev) => [...prev, { key, label: clean }]);
    setColOrder((prev) => [...prev, key]);
  };

  const handleRemoveCustomColumn = (key: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.key !== key));
    setHiddenCols((prev) => prev.filter((k) => k !== key));
    setColOrder((prev) => prev.filter((k) => k !== key));
  };

  const handleOpenAdd = () => {
    setEditingRow(null);
    const defaults = defaultNewValues();
    for (const c of mergedCustomColumns) {
      defaults[c.key] = '';
    }
    setFormState(defaults);
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (row: Record<string, any>) => {
    const initial: Record<string, any> = {};
    const parsedMeta = metaField ? parseCustomMeta(String(row[metaField] ?? '')) : null;
    for (const f of fields) {
      if (metaField && f.key === metaField && parsedMeta) {
        initial[f.key] = parsedMeta.baseText;
      } else {
        const val = row[f.key];
        initial[f.key] = val === null || val === undefined ? '' : String(val);
      }
    }
    for (const c of mergedCustomColumns) {
      initial[c.key] = parsedMeta?.customValues[c.label] ?? '';
    }
    setEditingRow(row);
    setFormState(initial);
    setFormError(null);
    setIsAddOpen(true);
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {};
    for (const f of fields) {
      const raw = formState[f.key];
      if (f.type === 'number' || f.type === 'integer') {
        const trimmed = String(raw ?? '').trim();
        if (trimmed === '') {
          payload[f.key] = null;
        } else {
          const parsed = f.type === 'integer' ? parseInt(trimmed, 10) : parseFloat(trimmed);
          payload[f.key] = Number.isFinite(parsed) ? parsed : trimmed;
        }
      } else {
        payload[f.key] = String(raw ?? '');
      }
    }

    if (metaField) {
      const customValues: Record<string, string> = {};
      for (const c of mergedCustomColumns) {
        customValues[c.label] = String(formState[c.key] ?? '');
      }
      payload[metaField] = serializeCustomMeta(String(payload[metaField] ?? ''), customValues);
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload();
      if (editingRow) {
        await apiRequest(`${endpoint}/${editingRow.id}`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await apiRequest(endpoint, {
          method: 'POST',
          body: payload,
        });
      }
      setIsAddOpen(false);
      setToast(language === 'ar' ? 'تم حفظ السجل بنجاح' : 'Record saved successfully');
      setTimeout(() => setToast(null), 2500);
      await fetchRecords();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    try {
      await apiRequest(`${endpoint}/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      await fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const renderCell = (col: ColumnDefinition, row: Record<string, any>) => {
    if (col.render) {
      return col.render(row, language, t('unconfiguredLabel'));
    }
    if (metaField && col.key === metaField) {
      const { baseText } = parseCustomMeta(String(row[metaField] ?? ''));
      return baseText ? <span>{baseText}</span> : <span className="text-slate-400">—</span>;
    }
    const val = row[col.key];
    if (col.isNullableMetric) {
      if (val === null || val === undefined || val === '') {
        return (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {t('unconfiguredLabel')}
          </span>
        );
      }
      return (
        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
          {val}
          {col.suffix || ''}
        </span>
      );
    }
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400">—</span>;
    }
    return (
      <span className={col.isNumeric ? 'font-mono tabular-nums font-medium' : ''}>
        {String(val)}
        {col.suffix || ''}
      </span>
    );
  };

  const handleFilteredExport = async (opts: ExportFilterOptions) => {
    const isDefaultFullExport =
      opts.rowScope === 'all' &&
      opts.colScope === 'all' &&
      !opts.searchText.trim();

    if (isDefaultFullExport) {
      const qs = buildQueryParams({
        branchCode: branchQueryParam,
        fromDate: opts.fromDate || undefined,
        toDate: opts.toDate || undefined,
        format: 'xlsx',
      });
      await apiDownloadFile(`${endpoint}/export${qs}`, `${exportFilename}.xlsx`);
      return;
    }

    let sourceRows = records;
    if (opts.rowScope === 'all') {
      const qs = buildQueryParams({
        branchCode: branchQueryParam,
        fromDate: opts.fromDate || undefined,
        toDate: opts.toDate || undefined,
      });
      const res = await apiRequest<{ records: Array<Record<string, any>> }>(`${endpoint}${qs}`);
      sourceRows = res.records || [];
    } else {
      sourceRows = displayedRecords;
    }

    const q = opts.searchText.trim().toLowerCase();
    const filteredForExport = sourceRows.filter((row) => {
      const rowDate = String(row.date || row.month || row.createdAt || '');
      if (showDateFilters && !matchesDateRange(rowDate, opts.fromDate, opts.toDate)) {
        return false;
      }
      if (!q) return true;
      return Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(q)
      );
    });

    const colsToExport = opts.colScope === 'visible' ? visibleColumns : allColumns;
    const sheetRows = filteredForExport.map((row) => {
      const out: Record<string, unknown> = {
        'Store ID': row.branchCode || '',
      };
      for (const col of colsToExport) {
        const header = language === 'ar' ? col.labelAr || col.label : col.label;
        if (metaField && col.key.startsWith(CUSTOM_PREFIX)) {
          const customLabel = col.key.replace(CUSTOM_PREFIX, '');
          const { customValues } = parseCustomMeta(String(row[metaField] ?? ''));
          out[header] = customValues[customLabel] ?? '';
        } else if (metaField && col.key === metaField) {
          const { baseText } = parseCustomMeta(String(row[metaField] ?? ''));
          out[header] = baseText;
        } else {
          const val = row[col.key];
          out[header] = val === null || val === undefined ? '' : val;
        }
      }
      return out;
    });

    await downloadXlsxSheet(`${exportFilename}.xlsx`, title.slice(0, 31), sheetRows);
  };

  return (
    <div className="space-y-4 content-container">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {language === 'ar' ? titleAr : title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {language === 'ar' ? subtitleAr : subtitle}
        </p>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#092d52] dark:text-teal-400 shrink-0" />
          <span>{t('readOnlyNotice')}</span>
        </div>
      )}

      {topSlot}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        showDateFilters={showDateFilters}
        exportMenu={
          <ExportExcelMenu
            onExport={handleFilteredExport}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            defaultSearchText={search}
          />
        }
        onOpenImport={canEdit ? () => setShowImport(true) : undefined}
        onAddNew={canEdit ? handleOpenAdd : undefined}
        addLabel={t('addRecord')}
        rightActions={
          <ColumnControlMenu
            columns={allColumns.map((c) => ({
              key: c.key,
              label: c.label,
              labelAr: c.labelAr,
              isCustom: c.isCustom,
            }))}
            hiddenKeys={hiddenCols}
            columnOrder={colOrder}
            onToggleColumn={handleToggleColumn}
            onMoveColumn={handleMoveColumn}
            onResetColumns={handleResetColumns}
            allowCustomColumns={Boolean(metaField) && canEdit}
            onAddCustomColumn={handleAddCustomColumn}
            onRemoveCustomColumn={handleRemoveCustomColumn}
            rowLimit={rowLimit}
            onRowLimitChange={setRowLimit}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onAddRow={canEdit ? handleOpenAdd : undefined}
            totalRowsCount={records.length}
          />
        }
      />

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {language === 'ar' ? 'جارٍ تحميل السجلات...' : 'Loading records...'}
        </div>
      ) : records.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {language === 'ar' ? 'لا توجد سجلات مطابقة بعد' : 'No matching records found'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {canEdit
              ? language === 'ar'
                ? 'أضف سجلاً جديداً أو استورد ملف Excel / CSV.'
                : 'Add a new record or import an Excel / CSV file.'
              : language === 'ar'
                ? 'جرّب تغيير نطاق التاريخ أو اختيار فرع آخر.'
                : 'Try adjusting the date range or branch filter.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addRecord')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#092d52] text-white">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold text-start whitespace-nowrap">
                      {language === 'ar' ? 'كود الفرع' : 'Store ID'}
                    </th>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-3.5 py-2.5 font-semibold text-start whitespace-nowrap"
                      >
                        {language === 'ar' ? col.labelAr : col.label}
                      </th>
                    ))}
                    {canEdit && (
                      <th className="px-3.5 py-2.5 font-semibold text-end whitespace-nowrap">
                        {language === 'ar' ? 'إجراءات' : 'Actions'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedRecords.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-mono tabular-nums font-bold text-[#092d52] dark:text-teal-400 whitespace-nowrap">
                        {row.branchCode}
                      </td>
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-3.5 py-2.5 text-slate-800 dark:text-slate-200 max-w-[260px] truncate"
                          title={String(row[col.key] ?? '')}
                        >
                          {renderCell(col, row)}
                        </td>
                      ))}
                      {canEdit && (
                        <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(row)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                              aria-label={t('editRecord')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(String(row.id))}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                              aria-label={t('deleteRecord')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List (No horizontal scroll overflow) */}
          <div className="md:hidden space-y-2.5">
            {displayedRecords.map((row) => (
              <div
                key={row.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-mono tabular-nums text-xs font-bold text-[#092d52] dark:text-teal-400">
                    Store {row.branchCode}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(row)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(String(row.id))}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                  {visibleColumns.map((col) => (
                    <div key={col.key} className="min-w-0 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                        {language === 'ar' ? col.labelAr : col.label}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate text-end">
                        {renderCell(col, row)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Modal — Strict 1-Column Inputs */}
      {isAddOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#092d52] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingRow ? t('editRecord') : t('addRecord')} —{' '}
                {language === 'ar' ? titleAr : title}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 gap-3 overflow-y-auto text-xs">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    {language === 'ar' ? f.labelAr : f.label}
                    {f.required && <span className="text-rose-500 ms-1">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      required={f.required}
                      value={formState[f.key] ?? ''}
                      onChange={(e) =>
                        setFormState({ ...formState, [f.key]: e.target.value })
                      }
                      className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {!f.required && <option value="">—</option>}
                      {(f.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {language === 'ar' ? opt.labelAr || opt.label : opt.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={f.required}
                      value={formState[f.key] ?? ''}
                      onChange={(e) =>
                        setFormState({ ...formState, [f.key]: e.target.value })
                      }
                      placeholder={f.placeholder}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  ) : (
                    <input
                      type={
                        f.type === 'number' || f.type === 'integer'
                          ? 'number'
                          : f.type === 'date'
                            ? 'date'
                            : f.type === 'month'
                              ? 'month'
                              : f.type === 'time'
                                ? 'time'
                                : 'text'
                      }
                      step={f.type === 'number' ? 'any' : f.type === 'integer' ? '1' : undefined}
                      required={f.required}
                      value={formState[f.key] ?? ''}
                      onChange={(e) =>
                        setFormState({ ...formState, [f.key]: e.target.value })
                      }
                      placeholder={f.placeholder}
                      className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  )}
                </div>
              ))}

              {metaField &&
                mergedCustomColumns.map((col) => (
                  <div key={col.key}>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {col.label}
                    </label>
                    <input
                      type="text"
                      value={formState[col.key] ?? ''}
                      onChange={(e) =>
                        setFormState({ ...formState, [col.key]: e.target.value })
                      }
                      className="w-full px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                ))}

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3.5 min-h-[38px] rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 min-h-[38px] rounded-xl font-bold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white cursor-pointer"
                >
                  {saving ? '...' : t('saveRecord')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('deleteRecord')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t('confirmDelete')}</p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-3.5 min-h-[36px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                {t('deleteRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportSummaryModal
          title={`${t('importData')} — ${language === 'ar' ? titleAr : title}`}
          endpoint={`${endpoint}/import`}
          expectedHeadersHint={importHeadersHint}
          onClose={() => setShowImport(false)}
          onSuccess={fetchRecords}
        />
      )}
    </div>
  );
};
