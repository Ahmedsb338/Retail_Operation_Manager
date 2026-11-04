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
import { ReportCenterView } from './components/ReportCenterView';
import { SettingsView } from './components/SettingsView';

const MainAppLayout: React.FC = () => {
  const { isAuthenticated } = useApp();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Quick Action Modal Triggers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCoachingModalOpen, setIsCoachingModalOpen] = useState(false);
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <AccessPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors pb-16 lg:pb-0 overflow-x-hidden">
      {/* Navigation Top Header & Desktop Sidebar & Mobile Bottom Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickTask={() => setIsTaskModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col content-container">
        <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 content-container">
          {activeTab === 'dashboard' && (
            <DashboardView
              setActiveTab={setActiveTab}
              onOpenQuickTask={() => setIsTaskModalOpen(true)}
              onOpenQuickCoaching={() => setIsCoachingModalOpen(true)}
              onOpenQuickSale={() => setIsBoxModalOpen(true)}
              onOpenQuickCase={() => setIsCaseModalOpen(true)}
            />
          )}

          {activeTab === 'target_calc' && <TargetCalculatorView />}

          {activeTab === 'tnps_calc' && <TnpsCalculatorView />}

          {activeTab === 'staff' && <StaffRosterView />}

          {activeTab === 'operations' && (
            <OperationsView
              isAddModalOpen={isTaskModalOpen}
              setIsAddModalOpen={setIsTaskModalOpen}
            />
          )}

          {activeTab === 'team' && (
            <TeamCoachingView
              isAddCoachingModalOpen={isCoachingModalOpen}
              setIsAddCoachingModalOpen={setIsCoachingModalOpen}
            />
          )}

          {activeTab === 'sales' && (
            <SalesOpportunitiesView
              isAddBoxModalOpen={isBoxModalOpen}
              setIsAddBoxModalOpen={setIsBoxModalOpen}
            />
          )}

          {activeTab === 'customer' && (
            <CustomerExperienceView
              isAddCaseModalOpen={isCaseModalOpen}
              setIsAddCaseModalOpen={setIsCaseModalOpen}
            />
          )}

          {activeTab === 'health' && <BranchHealthView />}

          {activeTab === 'ai' && <AiAnalyticsView />}

          {activeTab === 'reports' && <ReportCenterView />}

          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Global Footer Requested by User - Fixed Verbatim in English Regardless of Language */}
        <footer className="w-full py-3.5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs no-print font-medium font-sans">
          developed by Ahmed Sobhy ©2026
        </footer>
      </div>
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
