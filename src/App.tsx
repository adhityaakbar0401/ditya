import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AppShell from './components/AppShell';
import DashboardPage from './pages/app/DashboardPage';
import AbsensiKaryawanPage from './pages/app/AbsensiKaryawanPage';
import AbsensiSiswaPage from './pages/app/AbsensiSiswaPage';
import RekapKaryawanPage from './pages/app/RekapKaryawanPage';
import RekapSiswaPage from './pages/app/RekapSiswaPage';
import DataSiswaPage from './pages/app/DataSiswaPage';
import UserManagementPage from './pages/app/UserManagementPage';
import type { UserRole } from './types';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Memuat sesi portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireRole({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="absensi-karyawan" element={<AbsensiKaryawanPage />} />
            <Route
              path="absensi-siswa"
              element={
                <RequireRole allowed={['admin', 'guru']}>
                  <AbsensiSiswaPage />
                </RequireRole>
              }
            />
            <Route
              path="rekap-absensi/karyawan"
              element={
                <RequireRole allowed={['admin']}>
                  <RekapKaryawanPage />
                </RequireRole>
              }
            />
            <Route
              path="rekap-absensi/siswa"
              element={
                <RequireRole allowed={['admin', 'guru']}>
                  <RekapSiswaPage />
                </RequireRole>
              }
            />
            <Route
              path="data-siswa"
              element={
                <RequireRole allowed={['admin']}>
                  <DataSiswaPage />
                </RequireRole>
              }
            />
            <Route
              path="user-management"
              element={
                <RequireRole allowed={['admin']}>
                  <UserManagementPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
