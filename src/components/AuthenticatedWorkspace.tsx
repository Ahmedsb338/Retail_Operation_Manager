import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Navigation, NavTab } from './Navigation';
import { DashboardView } from './DashboardView';
import { TargetCalculatorView } from './calculators/TargetCalculatorView';
import { TnpsCalculatorView } from './calculators/TnpsCalculatorView';
import { StaffRosterView } from './StaffRosterView';
import { OperationsView } from './OperationsView';
import { TeamCoachingView } from './TeamCoachingView';
import { SalesOpportunitiesView } from './SalesOpportunitiesView';
import { CustomerExperienceView } from './CustomerExperienceView';
import { BranchHealthView } from './BranchHealthView';
import { AiAnalyticsView } from './AiAnalyticsView';
import { SettingsView } from './SettingsView';
import { StoreScheduleView } from './domains/StoreScheduleView';
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
} from './domains/OperationalDomainsViews';
import { DatabaseUnavailableBanner } from './DatabaseUnavailableBanner';

export const AuthenticatedWorkspace: React.FC = () => {
  const { canEdit } = useApp();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCoachingModalOpen, setIsCoachingModalOpen] = useState(false);
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);

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

export default AuthenticatedWorkspace;
