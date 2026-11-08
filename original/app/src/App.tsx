import { AppProvider, useApp } from '@/store/AppContext';
import { ApiProvider } from '@/store/ApiContext';
import MatrixBackground from '@/components/MatrixBackground';
import LoginScreen from '@/components/LoginScreen';
import MainShell from '@/components/MainShell';

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
