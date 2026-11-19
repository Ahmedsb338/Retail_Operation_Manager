import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  TrendingUp,
  HeartHandshake,
  Activity,
  Sparkles,
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  Building2,
  Calendar,
  Menu,
  X,
  Plus,
  Calculator,
  Target,
  UserCheck,
  BarChart2,
  Award,
  AlertTriangle,
  Clock,
  DollarSign,
  ClipboardList,
  Briefcase,
  Lock,
  MessageSquareWarning,
  CalendarClock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NavTab } from '../types';

export type { NavTab };

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenQuickTask?: () => void;
  children?: React.ReactNode;
}

interface NavGroup {
  groupLabel: string;
  groupLabelAr: string;
  items: Array<{
    id: NavTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }>;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickTask,
  children,
}) => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    user,
    canEdit,
    authorizedBranches,
    selectedBranchCode,
    setSelectedBranchCode,
    currentBranch,
    logout,
    overdueTasksCount,
    blockedTasksCount,
    pendingCasesCount,
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Executive',
      groupLabelAr: 'نظرة تنفيذية',
      items: [
        { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
        { id: 'health', label: t('navHealth'), icon: Calculator },
        { id: 'ai', label: t('navAi'), icon: Sparkles },
      ],
    },
    {
      groupLabel: 'Performance & RPM',
      groupLabelAr: 'الأداء والمؤشرات',
      items: [
        { id: 'store-rpm', label: t('navStoreRpm'), icon: BarChart2 },
        { id: 'agent-rpm', label: t('navAgentRpm'), icon: Award },
        { id: 'store-kpis', label: t('navStoreKpis'), icon: TrendingUp },
        { id: 'agent-kpis', label: t('navAgentKpis'), icon: Activity },
        { id: 'target-calc', label: t('navTargetCalc'), icon: Target },
        { id: 'sales', label: t('navSales'), icon: Briefcase },
      ],
    },
    {
      groupLabel: 'Customer & TNPS',
      groupLabelAr: 'العملاء والشكاوى',
      items: [
        { id: 'tnps-store', label: t('navTnpsStore'), icon: HeartHandshake },
        { id: 'tnps-agents', label: t('navTnpsAgents'), icon: HeartHandshake },
        { id: 'tnps-calc', label: t('navTnpsCalc'), icon: HeartHandshake },
        {
          id: 'complaints',
          label: t('navComplaints'),
          icon: MessageSquareWarning,
          badge: pendingCasesCount > 0 ? pendingCasesCount : undefined,
        },
      ],
    },
    {
      groupLabel: 'Workforce & Store Ops',
      groupLabelAr: 'الفريق والتشغيل اليومي',
      items: [
        { id: 'team', label: t('navTeam'), icon: Users },
        { id: 'coaching', label: t('navCoaching'), icon: UserCheck },
        { id: 'store-schedule', label: t('navStoreSchedule'), icon: Calendar },
        { id: 'schedule-exceptions', label: t('navScheduleExceptions'), icon: CalendarClock },
        {
          id: 'operations',
          label: t('navOperations'),
          icon: CheckSquare,
          badge:
            overdueTasksCount + blockedTasksCount > 0
              ? overdueTasksCount + blockedTasksCount
              : undefined,
        },
        { id: 'hr-actions', label: t('navHrActions'), icon: ClipboardList },
        { id: 'late-opening', label: t('navLateOpening'), icon: Clock },
        { id: 'short-over', label: t('navShortOver'), icon: DollarSign },
        { id: 'action-plans', label: t('navActionPlans'), icon: AlertTriangle },
      ],
    },
    {
      groupLabel: 'System',
      groupLabelAr: 'الإعدادات',
      items: [{ id: 'settings', label: t('navSettings'), icon: Settings }],
    },
  ];

  const handleTabClick = (tab: NavTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderNavContent = (onPick: (tab: NavTab) => void) => (
    <div className="space-y-4">
      {navGroups.map((group) => (
        <div key={group.groupLabel} className="space-y-1">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? group.groupLabelAr : group.groupLabel}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#092d52] text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
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
      ))}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#092d52] text-white border-b border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-white hover:bg-white/10 cursor-pointer"
              aria-label="Toggle navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-teal-300" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold tracking-tight truncate">
                  ASB Workforce
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {user?.role === 'AREA_MANAGER'
                    ? `${user.displayName} · ${authorizedBranches.length} ${
                        language === 'ar' ? 'فروع' : 'branches'
                      }`
                    : `${currentBranch?.code || user?.branchCode} · ${
                        language === 'ar'
                          ? currentBranch?.nameAr || currentBranch?.name
                          : currentBranch?.name || user?.branchName
                      }`}
                </div>
              </div>
            </div>

            {user?.role === 'AREA_MANAGER' && authorizedBranches.length > 0 && (
              <select
                aria-label={t('switchBranch')}
                value={selectedBranchCode}
                onChange={(e) => setSelectedBranchCode(e.target.value)}
                className="hidden sm:block ms-2 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold text-white max-w-[200px]"
              >
                <option value="" className="text-slate-900">
                  {t('allAuthorizedBranches')}
                </option>
                {authorizedBranches.map((b) => (
                  <option key={b.code} value={b.code} className="text-slate-900">
                    {b.code} · {language === 'ar' ? b.nameAr || b.name : b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-bold">
              {!canEdit && <Lock className="w-3 h-3 text-amber-300" />}
              <span>{canEdit ? t('storeManagerBadge') : t('readOnlyBadge')}</span>
            </div>

            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl hover:bg-white/10 text-white cursor-pointer"
              title="Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-teal-300" />
              <span>{language === 'en' ? 'عربي' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-slate-200" />
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-xl hover:bg-rose-500/20 text-rose-200 hover:text-white cursor-pointer"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex">
          <div className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full p-4 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-extrabold text-sm text-[#092d52] dark:text-white">
                    ASB Workforce
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {canEdit ? t('storeManagerBadge') : t('readOnlyBadge')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderNavContent(handleTabClick)}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar + Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row">
        <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4rem)] p-3.5">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {renderNavContent(setActiveTab)}
          </div>

          {canEdit && onOpenQuickTask && (
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenQuickTask}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addTaskQuick')}</span>
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 h-16 px-2 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium ${
            activeTab === 'dashboard'
              ? 'text-[#092d52] dark:text-teal-400 font-bold'
              : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>{t('navDashboard')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('target-calc')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium ${
            activeTab === 'target-calc'
              ? 'text-[#092d52] dark:text-teal-400 font-bold'
              : 'text-slate-500'
          }`}
        >
          <Target className="w-5 h-5 mb-0.5" />
          <span>{language === 'ar' ? 'التارجت' : 'Target'}</span>
        </button>

        {canEdit && onOpenQuickTask && (
          <button
            type="button"
            onClick={onOpenQuickTask}
            className="-mt-5 w-11 h-11 rounded-full bg-[#092d52] text-white flex items-center justify-center shadow-lg"
            aria-label={t('addTaskQuick')}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('store-schedule')}
          className={`flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium ${
            activeTab === 'store-schedule'
              ? 'text-[#092d52] dark:text-teal-400 font-bold'
              : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>{language === 'ar' ? 'الجدول' : 'Schedule'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center w-14 py-1 text-[10px] font-medium text-slate-500"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>{language === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </nav>
    </>
  );
};
