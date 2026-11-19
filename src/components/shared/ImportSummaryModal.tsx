import React, { useState } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { ImportSummary } from '../../types';
import { apiRequest, fileToBase64 } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';

interface ImportSummaryModalProps {
  title: string;
  endpoint: string;
  extraPayload?: Record<string, unknown>;
  expectedHeadersHint?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
  title,
  endpoint,
  extraPayload,
  expectedHeadersHint,
  onClose,
  onSuccess,
}) => {
  const { language } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const ext = selectedFile.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
      const base64 = await fileToBase64(selectedFile);
      const res = await apiRequest<{ summary: ImportSummary }>(endpoint, {
        method: 'POST',
        body: {
          ...(extraPayload || {}),
          fileBase64: base64,
          fileType: ext,
        },
      });
      setSummary(res.summary);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#092d52] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-300" />
            <h3 className="text-sm font-bold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {expectedHeadersHint && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <p className="font-bold mb-1">
                {language === 'ar' ? 'الأعمدة المتوقعة:' : 'Supported columns:'}
              </p>
              <p className="font-mono text-[11px] break-words">{expectedHeadersHint}</p>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              {language === 'ar' ? 'اختر ملف CSV أو Excel (.xlsx)' : 'Select CSV or Excel (.xlsx) file'}
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null);
                setSummary(null);
                setError(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {summary && (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {language === 'ar' ? 'ملخص نتيجة الاستيراد' : 'Import Execution Summary'}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400">Total</div>
                  <div className="font-bold text-slate-800 dark:text-white">{summary.total}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400">Valid</div>
                  <div className="font-bold text-slate-800 dark:text-white">{summary.valid}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-amber-500">Invalid</div>
                  <div className="font-bold text-amber-600">{summary.invalid}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400">Duplicate</div>
                  <div className="font-bold text-slate-600 dark:text-slate-300">
                    {summary.duplicate}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700">
                  <div className="text-[10px] text-emerald-600">Imported</div>
                  <div className="font-bold text-emerald-600">{summary.imported}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800">
                  <div className="text-[10px] text-rose-500">Rejected</div>
                  <div className="font-bold text-rose-600">{summary.rejected}</div>
                </div>
              </div>

              {summary.reasons.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 space-y-1">
                  {summary.reasons.map((r, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] font-mono text-slate-700 dark:text-slate-300"
                    >
                      Row {r.row}: {r.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 min-h-[38px] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
          <button
            type="button"
            disabled={!selectedFile || submitting}
            onClick={handleUpload}
            className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {submitting
                ? language === 'ar'
                  ? 'جارٍ الاستيراد...'
                  : 'Importing...'
                : language === 'ar'
                  ? 'تنفيذ الاستيراد'
                  : 'Run Import'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
