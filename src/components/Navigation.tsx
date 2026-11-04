import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  TrendingUp,
  HeartHandshake,
  Activity,
  Sparkles,
  FileText,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  Building2,
  Calendar,
  ChevronDown,
  Menu,
  X,
  Plus,
  Calculator,
  Target,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'target_calc'
  | 'tnps_calc'
  | 'operations'
  | 'team'
  | 'sales'
  | 'customer'
  | 'health'
  | 'ai'
  | 'reports'
  | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenQuickTask?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, onOpenQuickTask }) => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    currentBranch,
    logout,
    availableBranches,
    switchBranchCode,
    criticalAlerts,
    overdueTasksCount,
    blockedTasksCount,
  } = useApp();

  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    {
      id: 'target_calc',
      label: language === 'ar' ? 'حاسبة التارجت ومعدلات التشغيل' : 'Target Calculator & Sales',
      icon: Target,
    },
    {
      id: 'tnps_calc',
      label: language === 'ar' ? 'حاسبة الـ TNPS ورضا العملاء' : 'TNPS Calculator & CX',
      icon: HeartHandshake,
    },
    {
      id: 'operations',
      label: t('navOperations'),
      icon: CheckSquare,
      badge: overdueTasksCount + blockedTasksCount > 0 ? overdueTasksCount + blockedTasksCount : undefined,
    },
    { id: 'team', label: t('navTeam'), icon: Users },
    { id: 'sales', label: t('navSales'), icon: TrendingUp },
    { id: 'customer', label: t('navCustomer'), icon: Activity },
    { id: 'health', label: t('navHealth'), icon: Calculator },
    { id: 'ai', label: t('navAi'), icon: Sparkles },
    { id: 'reports', label: t('navReports'), icon: FileText },
    { id: 'settings', label: t('navSettings'), icon: Settings },
  ];

  const handleTabClick = (tab: NavTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand & Active Branch */}
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shadow-teal-700/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  {t('appTitle')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? currentBranch?.nameAr : currentBranch?.name} ({currentBranch?.code})
                </div>
              </div>
            </div>

            {/* Branch Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <span className="font-mono text-teal-600 dark:text-teal-400">{currentBranch?.code}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isBranchDropdownOpen && (
                <div className="absolute left-0 rtl:left-auto rtl:right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    {t('switchBranch')}
                  </div>
                  {availableBranches.map((b) => (
                    <button
                      key={b.code}
                      onClick={() => {
                        switchBranchCode(b.code);
                        setIsBranchDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-start flex items-center justify-between text-xs transition-colors ${
                        b.code === currentBranch?.code
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{language === 'ar' ? b.nameAr : b.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{b.code} · {language === 'ar' ? b.cityAr : b.city}</div>
                      </div>
                      {b.code === currentBranch?.code && (
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Date, Lang, Theme, Exit */}
          <div className="flex items-center gap-2">
            {/* Current Business Date */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium font-mono-numbers">{currentBranch?.businessDate}</span>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'en' ? 'عربي' : 'EN'}</span>
            </button>

            {/* Dark/Light mode toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Sign Out / Exit */}
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation (when hamburger clicked) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex">
          <div className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full p-5 shadow-2xl flex flex-col justify-between border-r dark:border-slate-800 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-800 dark:text-white">{t('appTitle')}</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">{t('authenticatedAs')}</div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {language === 'ar' ? currentBranch?.nameAr : currentBranch?.name}
                </div>
                <div className="text-[11px] text-teal-600 dark:text-teal-400 font-mono mt-0.5">
                  {currentBranch?.code} · {currentBranch?.manager}
                </div>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar (Rendered inside the layout container) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4rem)] p-4 transition-colors">
        <div className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Add Task Button in Sidebar */}
        {onOpenQuickTask && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onOpenQuickTask}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-xl transition-all shadow-sm shadow-teal-700/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addTaskQuick')}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation Bar (Persistent at bottom for mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 h-16 px-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>{t('navDashboard')}</span>
        </button>

        <button
          onClick={() => setActiveTab('target_calc')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'target_calc' ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Target className="w-5 h-5 mb-0.5" />
          <span>{language === 'ar' ? 'التارجت' : 'Target'}</span>
        </button>

        {/* Floating Quick Action Button in Center of Mobile Nav */}
        {onOpenQuickTask && (
          <button
            onClick={onOpenQuickTask}
            className="-mt-5 w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 hover:bg-teal-500 transition-transform active:scale-95"
            title={t('addTaskQuick')}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setActiveTab('tnps_calc')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'tnps_calc' ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <HeartHandshake className="w-5 h-5 mb-0.5" />
          <span>TNPS</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>{language === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </nav>
    </>
  );
};
