import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AccessPage } from './components/AccessPage';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TargetCalculatorView } from './components/calculators/TargetCalculatorView';
import { TnpsCalculatorView } from './components/calculators/TnpsCalculatorView';
import { StaffRosterView } from './components/StaffRosterView';
import { OperationsView } from './components/OperationsView';
import { TeamCoachingView } from './components/TeamCoachingView';
import { SalesOpportunitiesView } from './components/SalesOpportunitiesView';
import { CustomerExperienceView } from './components/CustomerExperienceView';
import { BranchHealthView } from './components/BranchHealthView';
import { AiAnalyticsView } from './components/AiAnalyticsView';
import { SettingsView } from './components/SettingsView';
import { StoreScheduleView } from './components/domains/StoreScheduleView';
import {
  StoreRpmView,
  AgentRpmView,
  StoreKpisView,
  AgentKpisView,
  TnpsStoreLogsView,
  TnpsAgentsView,
  ScheduleExceptionsView,
  HrActionsView,
  LateOpeningView,
  ShortOverView,
  ActionPlansView,
} from './components/domains/OperationalDomainsViews';
import { DatabaseUnavailableBanner } from './components/DatabaseUnavailableBanner';

const MainAppLayout: React.FC = () => {
  const { isAuthenticated, authLoading, canEdit } = useApp();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCoachingModalOpen, setIsCoachingModalOpen] = useState(false);
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#092d52] text-white flex items-center justify-center text-sm font-semibold">
        ASB Workforce...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AccessPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors pb-16 lg:pb-0 overflow-x-hidden">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickTask={
          canEdit
            ? () => {
                setActiveTab('operations');
                setIsTaskModalOpen(true);
              }
            : undefined
        }
      >
        <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 content-container space-y-4">
          <DatabaseUnavailableBanner />

          {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
          {activeTab === 'health' && <BranchHealthView />}
          {activeTab === 'ai' && <AiAnalyticsView />}

          {activeTab === 'store-rpm' && <StoreRpmView />}
          {activeTab === 'agent-rpm' && <AgentRpmView />}
          {activeTab === 'store-kpis' && <StoreKpisView />}
          {activeTab === 'agent-kpis' && <AgentKpisView />}
          {activeTab === 'target-calc' && <TargetCalculatorView />}
          {activeTab === 'sales' && (
            <SalesOpportunitiesView
              isAddBoxModalOpen={isBoxModalOpen}
              setIsAddBoxModalOpen={setIsBoxModalOpen}
            />
          )}

          {activeTab === 'tnps-store' && <TnpsStoreLogsView />}
          {activeTab === 'tnps-agents' && <TnpsAgentsView />}
          {activeTab === 'tnps-calc' && <TnpsCalculatorView />}
          {activeTab === 'complaints' && (
            <CustomerExperienceView
              isAddCaseModalOpen={isCaseModalOpen}
              setIsAddCaseModalOpen={setIsCaseModalOpen}
            />
          )}

          {activeTab === 'team' && <StaffRosterView />}
          {activeTab === 'coaching' && (
            <TeamCoachingView
              isAddCoachingModalOpen={isCoachingModalOpen}
              setIsAddCoachingModalOpen={setIsCoachingModalOpen}
            />
          )}
          {activeTab === 'store-schedule' && <StoreScheduleView />}
          {activeTab === 'schedule-exceptions' && <ScheduleExceptionsView />}
          {activeTab === 'operations' && (
            <OperationsView
              isAddModalOpen={isTaskModalOpen}
              setIsAddModalOpen={setIsTaskModalOpen}
            />
          )}
          {activeTab === 'hr-actions' && <HrActionsView />}
          {activeTab === 'late-opening' && <LateOpeningView />}
          {activeTab === 'short-over' && <ShortOverView />}
          {activeTab === 'action-plans' && <ActionPlansView />}

          {activeTab === 'settings' && <SettingsView />}
        </main>

        <footer className="w-full py-3.5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs no-print font-medium font-sans">
          Developed by Ahmed Sobhy
        </footer>
      </Navigation>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppLayout />
    </AppProvider>
  );
}
