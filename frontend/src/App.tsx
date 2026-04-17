import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import BreakpointsProvider from './providers/BreakpointsProvider';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import SalesEntry from './pages/SalesEntry';
import Predictions from './pages/Predictions';
import Orders from './pages/Orders';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, login, logout, isLoggedIn } = useAuth();

  const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: string }) => {
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    if (role && user?.role !== role) {
      return <Navigate to="/" replace />;
    }

    return <MainLayout role={user?.role || 'OWNER'} onLogout={logout}>{children}</MainLayout>;
  };

  return (
    <ThemeProvider theme={theme}>
      <BreakpointsProvider>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login onLogin={login} />} />
            <Route path="/signup" element={isLoggedIn ? <Navigate to="/" replace /> : <Signup />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard user={user} />
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute role="OWNER">
                <Inventory user={user} />
              </ProtectedRoute>
            } />

            <Route path="/orders" element={
              <ProtectedRoute role="OWNER">
                <Orders user={user} />
              </ProtectedRoute>
            } />

            <Route path="/sales" element={
              <ProtectedRoute role="OWNER">
                <SalesEntry user={user} />
              </ProtectedRoute>
            } />

            <Route path="/predictions" element={
              <ProtectedRoute role="OWNER">
                <Predictions user={user} />
              </ProtectedRoute>
            } />


            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </BreakpointsProvider>
    </ThemeProvider>
  );
}

// Temporary Typography for placeholder
const Typography = ({ children, variant }: any) => (
  <div style={{ color: 'white', padding: '20px' }}>
    <h1>{children}</h1>
  </div>
);

export default App;
