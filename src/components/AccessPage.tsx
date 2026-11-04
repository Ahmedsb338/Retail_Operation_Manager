import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, ArrowRight, Store, AlertCircle } from 'lucide-react';

export const AccessPage: React.FC = () => {
  const { t, language, setLanguage, loginWithBranchCode } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(true);
      return;
    }
    const result = loginWithBranchCode(code);
    if (!result.success) {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top utility row */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wide text-white">{t('appTitle')}</span>
            <span className="block text-[11px] text-slate-400">
              {language === 'ar' ? 'منصة العمليات والأداء' : 'Operations & Performance Platform'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors"
          >
            {language === 'en' ? 'العربية (RTL)' : 'English (LTR)'}
          </button>
        </div>
      </div>

      {/* Main Login Card - Secure with NO branch names or codes visible */}
      <div className="w-full max-w-md mx-auto my-auto z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mx-auto flex items-center justify-center mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {language === 'ar' ? 'بوابة دخول الفرع' : 'Branch Access Portal'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
              {language === 'ar'
                ? 'يرجى إدخال كود الفرع المصرح به لفتح لوحة العمليات'
                : 'Enter your authorized Branch Code / Store ID to open the dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="branchCode" className="block text-xs font-semibold text-slate-300 mb-1.5">
                {language === 'ar' ? 'كود الفرع / Store ID' : 'Store ID / Branch Code'}
              </label>
              <div className="relative">
                <input
                  id="branchCode"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(false);
                  }}
                  placeholder={language === 'ar' ? 'أدخل كود الفرع...' : 'Enter store code...'}
                  className={`w-full px-4 py-3 bg-slate-900/90 border rounded-xl text-sm font-medium tracking-wider text-white placeholder-slate-500 focus:outline-none transition-all ${
                    error
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                  }`}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>
                  {language === 'ar'
                    ? 'كود الفرع غير صحيح أو غير مسجل في النظام. يرجى التحقق من الكود والمحاولة مجدداً.'
                    : 'Invalid Store ID. Please verify your code and try again.'}
                </span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{language === 'ar' ? 'تسجيل الدخول للفرع' : 'Access Branch Dashboard'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            <span className="text-[11px] text-slate-400">
              {language === 'ar'
                ? 'نظام تشغيل وإدارة فروع التجزئة المعتمد'
                : 'Retail Branch Operations & Performance Management System'}
            </span>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4 leading-normal">
          Authorized personnel only. Data isolation strictly enforced.
        </p>
      </div>

      <div className="w-full text-center text-xs text-slate-400 z-10 font-medium py-2 font-sans">
        developed by Ahmed Sobhy ©2026
      </div>
    </div>
  );
};
