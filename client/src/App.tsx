import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Contracts from './pages/Contracts';
import ContractDetail from './pages/ContractDetail';
import ContractEditor from './pages/ContractEditor';
import SignPage from './pages/SignPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/sign/:token" element={<SignPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/contracts" replace />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="contracts/:id/edit" element={<ContractEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/contracts" replace />} />
    </Routes>
  );
}
