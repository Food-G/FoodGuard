import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import theme from './theme/theme';
import BreakpointsProvider from './providers/BreakpointsProvider';
import MainLayout from './layouts/main-layout';
import AuthLayout from './layouts/auth-layout';
import { useAuth } from './hooks/useAuth';
import { ConfirmProvider } from './hooks/useConfirm';

// 화면별로 나눠 받는다 (첫 로딩 번들 축소)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Inventory = lazy(() => import('./pages/Inventory'));
const SalesView = lazy(() => import('./pages/SalesView'));
const Predictions = lazy(() => import('./pages/Predictions'));
const Orders = lazy(() => import('./pages/Orders'));
const StoreManagement = lazy(() => import('./pages/admin/StoreManagement'));
const MenuManagement = lazy(() => import('./pages/MenuManagement'));
const StoreRegister = lazy(() => import('./pages/StoreRegister'));
const Stats = lazy(() => import('./pages/admin/Stats'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const POS = lazy(() => import('./pages/POS'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const DeliveryDriver = lazy(() => import('./pages/DeliveryDriver'));
const DeliveryDriverGroup = lazy(() => import('./pages/DeliveryDriverGroup'));
const Donations = lazy(() => import('./pages/Donations'));
const ScanComplete = lazy(() => import('./pages/ScanComplete'));
const OwnerScanComplete = lazy(() => import('./pages/OwnerScanComplete'));
const Reservations = lazy(() => import('./pages/Reservations'));
const SalesStats = lazy(() => import('./pages/SalesStats'));
const Staff = lazy(() => import('./pages/Staff'));
const Clock = lazy(() => import('./pages/Clock'));

function App() {
  const { user, login, logout, isLoggedIn } = useAuth();

  const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: string }) => {
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (role && user?.role !== role) return <Navigate to="/" replace />;
    return <MainLayout role={user?.role || 'OWNER'} onLogout={logout}>{children}</MainLayout>;
  };

  const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    if (isLoggedIn && user) return <Navigate to="/" replace />;
    return <AuthLayout>{children}</AuthLayout>;
  };

  return (
    <ThemeProvider theme={theme}>
      <ConfirmProvider>
      <BreakpointsProvider>
        <CssBaseline />
        <Router>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login onLogin={login} /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/driver/group/:groupToken" element={<DeliveryDriverGroup />} />
            <Route path="/driver/scan" element={<ScanComplete />} />
            <Route path="/owner/scan" element={<OwnerScanComplete />} />
            <Route path="/driver/:token" element={<DeliveryDriver />} />

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

            {/* 재고·폐기 화면과 메뉴 관리로 나뉘었다. 예전 주소 호환 */}
            <Route path="/ingredients" element={<Navigate to="/inventory" replace />} />

            <Route path="/orders" element={
              <ProtectedRoute role="OWNER">
                <Orders user={user} />
              </ProtectedRoute>
            } />

            <Route path="/sales" element={
              <ProtectedRoute role="OWNER">
                <SalesView user={user} />
              </ProtectedRoute>
            } />

            <Route path="/pos" element={
              <ProtectedRoute role="OWNER">
                <POS user={user} />
              </ProtectedRoute>
            } />

            <Route path="/assistant" element={
              <ProtectedRoute role="OWNER">
                <Assistant user={user} />
              </ProtectedRoute>
            } />

            <Route path="/predictions" element={
              <ProtectedRoute role="OWNER">
                <Predictions user={user} />
              </ProtectedRoute>
            } />

            <Route path="/store" element={
              <ProtectedRoute role="OWNER">
                <StoreRegister user={user} />
              </ProtectedRoute>
            } />



            <Route path="/menus" element={
              <ProtectedRoute role="OWNER">
                <MenuManagement user={user} />
              </ProtectedRoute>
            } />

            {/* 재고 화면으로 합쳐졌다. 예전 주소 호환 */}
            <Route path="/waste-prediction" element={<Navigate to="/inventory" replace />} />

            <Route path="/donations" element={
              <ProtectedRoute role="OWNER">
                <Donations user={user} />
              </ProtectedRoute>
            } />

            <Route path="/reservations" element={
              <ProtectedRoute role="OWNER">
                <Reservations user={user} />
              </ProtectedRoute>
            } />

            <Route path="/staff" element={
              <ProtectedRoute role="OWNER">
                <Staff user={user} />
              </ProtectedRoute>
            } />

            <Route path="/clock" element={
              <ProtectedRoute role="OWNER">
                <Clock user={user} />
              </ProtectedRoute>
            } />

            <Route path="/sales-stats" element={
              <ProtectedRoute role="OWNER">
                <SalesStats user={user} />
              </ProtectedRoute>
            } />

            {/* HQ Admin Routes */}
            <Route path="/admin/stores" element={
              <ProtectedRoute role="HQ_ADMIN">
                <StoreManagement />
              </ProtectedRoute>
            } />

            <Route path="/admin/stats" element={
              <ProtectedRoute role="HQ_ADMIN">
                <Stats />
              </ProtectedRoute>
            } />

            <Route path="/admin/orders" element={
              <ProtectedRoute role="HQ_ADMIN">
                <AdminOrders />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
      </BreakpointsProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}

export default App;
