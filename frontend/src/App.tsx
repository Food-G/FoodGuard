import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import BreakpointsProvider from './providers/BreakpointsProvider';
import MainLayout from './layouts/main-layout';
import AuthLayout from './layouts/auth-layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import SalesEntry from './pages/SalesEntry';
import Predictions from './pages/Predictions';
import Orders from './pages/Orders';
import StoreManagement from './pages/admin/StoreManagement';
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

  const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    // 엄격하게 토큰과 유저 정보가 모두 있을 때만 리다이렉트
    if (isLoggedIn && user) {
      return <Navigate to="/" replace />;
    }
    return <AuthLayout>{children}</AuthLayout>;
  };

  return (
    <ThemeProvider theme={theme}>
      <BreakpointsProvider>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login onLogin={login} /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

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

            {/* HQ Admin Routes */}
            <Route path="/admin/stores" element={
              <ProtectedRoute role="HQ">
                <StoreManagement />
              </ProtectedRoute>
            } />


            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </BreakpointsProvider>
    </ThemeProvider>
  );
}

export default App;
