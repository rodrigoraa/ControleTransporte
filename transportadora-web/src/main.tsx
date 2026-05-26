import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/AppLayout';
import { CrudPage } from './pages/CrudPage';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Relatorios } from './pages/Relatorios';
import { crudResources } from './pages/resources';
import './styles.css';

function ProtectedApp() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/relatorios" element={<Relatorios />} />
        {crudResources.map((resource) => (
          <Route key={resource.path} path={`/${resource.path}`} element={<CrudPage resource={resource} />} />
        ))}
      </Routes>
    </AppLayout>
  );
}

function Root() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);

