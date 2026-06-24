import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { crudResources } from './pages/resources';
import './styles.css';

const CrudPage = lazy(() => import('./pages/CrudPage').then((module) => ({ default: module.CrudPage })));
const Auditorias = lazy(() => import('./pages/Auditorias').then((module) => ({ default: module.Auditorias })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Relatorios = lazy(() => import('./pages/Relatorios').then((module) => ({ default: module.Relatorios })));

function ProtectedApp() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/auditorias" element={<Auditorias />} />
        {crudResources.filter((resource) => resource.path !== 'auditorias').map((resource) => (
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
        <Suspense fallback={<div className="page-loading">Carregando...</div>}>
          <Root />
        </Suspense>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
