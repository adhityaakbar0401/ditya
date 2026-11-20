import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { formatRoleLabel, useAuth } from '../context/AuthContext';

const ROUTE_TITLES: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/dashboard': 'Dashboard',
  '/app/absensi-karyawan': 'Absensi Karyawan',
  '/app/absensi-saya': 'Absensi Saya',
  '/app/absensi-siswa': 'Absensi Siswa',
  '/app/rekap-absensi/karyawan': 'Rekap Absensi Karyawan',
  '/app/rekap-absensi/siswa': 'Rekap Absensi Siswa',
  '/app/data-siswa': 'Data Siswa',
  '/app/user-management': 'User Management',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rekapOpen, setRekapOpen] = useState(true);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';
  const isSiswa = user.role === 'siswa';
  const isEmployee = !isSiswa;
  const canSeeStudentAttendance = isAdmin || isGuru;
  const canSeeRekapMenu = isAdmin || isGuru;

  const pageTitle = ROUTE_TITLES[location.pathname] || 'Portal Absensi';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-red-700 text-white'
        : 'text-slate-700 hover:bg-red-50 hover:text-red-800'
    }`;

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg py-2 pl-10 pr-3 text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-red-50 text-red-800 font-semibold'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-red-800 px-5 text-white shrink-0">
        <div className="min-w-0">
          <p className="text-base font-extrabold tracking-tight truncate">SMK Prima Unggul</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-red-100 hover:bg-red-700 lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User Identity Block */}
      <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/60">
        <p className="text-sm font-bold text-slate-900 truncate">{user.full_name}</p>
        <p className="mt-0.5 text-xs font-medium text-red-700">
          {formatRoleLabel(user.role)}
          {user.jabatan ? ` · ${user.jabatan}` : ''}
        </p>
      </div>

      {/* Role-based Sidebar Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3.5 py-4" aria-label="Menu Utama">
        <NavLink
          to="/app/dashboard"
          className={navLinkClass}
          onClick={() => setMobileMenuOpen(false)}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        {isEmployee && (
          <NavLink
            to="/app/absensi-karyawan"
            className={navLinkClass}
            onClick={() => setMobileMenuOpen(false)}
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>Absensi Karyawan</span>
          </NavLink>
        )}

        {isSiswa && (
          <NavLink
            to="/app/absensi-saya"
            className={navLinkClass}
            onClick={() => setMobileMenuOpen(false)}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span>Absensi Saya</span>
          </NavLink>
        )}

        {canSeeStudentAttendance && (
          <NavLink
            to="/app/absensi-siswa"
            className={navLinkClass}
            onClick={() => setMobileMenuOpen(false)}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span>Absensi Siswa</span>
          </NavLink>
        )}

        {canSeeRekapMenu && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setRekapOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-800 transition-colors"
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Rekap Absensi</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                  rekapOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {rekapOpen && (
              <div className="mt-1 space-y-1">
                {isAdmin && (
                  <NavLink
                    to="/app/rekap-absensi/karyawan"
                    className={subLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Absensi Karyawan</span>
                  </NavLink>
                )}
                <NavLink
                  to="/app/rekap-absensi/siswa"
                  className={subLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Absensi Siswa</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-slate-200" />
            <NavLink
              to="/app/data-siswa"
              className={navLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span>Data Siswa</span>
            </NavLink>

            <NavLink
              to="/app/user-management"
              className={navLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>User Management</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Sidebar Bottom Quiet Info */}
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Portal Absensi · SMK Prima Unggul
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar with Top-Right Logout Button */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400">Portal Absensi</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-bold text-slate-950 truncate">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-slate-900">{user.full_name}</p>
              <p className="text-[11px] text-slate-500">{formatRoleLabel(user.role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
