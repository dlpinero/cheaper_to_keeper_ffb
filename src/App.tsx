import { AuthProvider, useAuth } from './lib/AuthContext';
import { Login } from './pages/Login';
import { CommissionerDashboard } from './pages/CommissionerDashboard';

function Gate() {
  const { session, manager, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!session) return <Login />;
  if (!manager) {
    return <p>Signed in, but no manager seat found for your email. Ask the commissioner to add you.</p>;
  }
  if (manager.role === 'commissioner') return <CommissionerDashboard />;

  return <p>Manager portal coming in Phase 3. You're signed in as {manager.display_name}.</p>;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
