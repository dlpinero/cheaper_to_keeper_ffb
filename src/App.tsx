import { AuthProvider, useAuth } from './lib/AuthContext';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { CommissionerDashboard } from './pages/CommissionerDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';

function Gate() {
  const { session, manager, loading, recoveryMode } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (recoveryMode) return <ResetPassword />;
  if (!session) return <Login />;
  if (!manager) {
    return <p>Signed in, but no manager seat found for your email. Ask the commissioner to add you.</p>;
  }
  if (manager.role === 'commissioner') return <CommissionerDashboard />;

  return <ManagerDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
