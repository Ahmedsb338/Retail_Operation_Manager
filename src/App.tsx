import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AccessPage } from './components/AccessPage';

const AuthenticatedWorkspace = lazy(() => import('./components/AuthenticatedWorkspace'));

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#092d52] text-white flex items-center justify-center text-sm font-semibold">
    ASB Workforce...
  </div>
);

const MainAppLayout: React.FC = () => {
  const { isAuthenticated, authLoading } = useApp();

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AccessPage />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthenticatedWorkspace />
    </Suspense>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppLayout />
    </AppProvider>
  );
}
