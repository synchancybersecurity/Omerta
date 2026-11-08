import { AppProvider, useApp } from '@omerta/store/AppContext';
import { ApiProvider } from '@omerta/store/ApiContext';
import MatrixBackground from '@omerta/components/MatrixBackground';
import LoginScreen from '@omerta/components/LoginScreen';
import MainShell from '@omerta/components/MainShell';

function AppContent() {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <MatrixBackground />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <MatrixBackground />
      <MainShell />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ApiProvider>
        <AppContent />
      </ApiProvider>
    </AppProvider>
  );
}
