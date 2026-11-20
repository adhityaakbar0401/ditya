import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatRoleLabel, useAuth } from '../../context/AuthContext';
import { StatusTag } from '../../components/StatusTag';
import type { DashboardSummary } from '../../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [nowWib, setNowWib] = useState('');

  useEffect(() => {
    const updateClock = () => {
      setNowWib(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setError('');
      const data = await apiRequest<DashboardSummary>('/api/dashboard/summary');
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleQuickCheckIn() {
    setActionBusy(true);
    setError('');
    try {
      await apiRequest('/api/attendance/employees/check-in', {
        method: 'POST',
        body: JSON.stringify({ status: 'Hadir', notes: '' }),
      });
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat kehadiran.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleQuickCheckOut() {
    setActionBusy(true);
    setError('');
    try {
      await apiRequest('/api/attendance/employees/check-out', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat pulang.');
    } finally {
      setActionBusy(false);
    }
  }

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';
  const myToday = summary?.myAttendanceToday || null;

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Self Attendance Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              {formatRoleLabel(user.role)} · {summary?.today || 'Hari Ini'}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
              Selamat Datang, {user.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pantau status kehadiran harian Anda dan aktivitas sekolah SMK Prima Unggul.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">Waktu WIB</p>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {nowWib || '--:--:--'}
              </p>
            </div>

            {!myToday ? (
              <button
                type="button"
                disabled={actionBusy || loading}
                onClick={handleQuickCheckIn}
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>{actionBusy ? 'Menyimpan...' : 'Absen Masuk Sekarang'}</span>
              </button>
            ) : !myToday.check_out && myToday.status === 'Hadir' ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleQuickCheckOut}
                className="inline-flex items-center gap-2 rounded-lg border border-red-700 bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOutIcon className="h-4 w-4 shrink-0" />
                <span>{actionBusy ? 'Menyimpan...' : 'Catat Jam Pulang'}</span>
              </button>
            ) : (
              <Link
                to="/app/absensi-karyawan"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-red-300 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Detail Absensi Saya</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            )}
          </div>
        </div>

        {/* My Today Status Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-200 pt-4 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500">Status Anda Hari Ini:</span>
            <StatusTag status={myToday ? myToday.status : 'Belum Absen'} />
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Jam Masuk:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {myToday?.check_in || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Jam Pulang:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {myToday?.check_out || '—'}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5" />
          ))}
        </div>
      )}

      {/* Role-Specific Summary KPIs */}
      {!loading && summary && (
        <section
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            isAdmin ? 'lg:grid-cols-4' : isGuru ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
          }`}
        >
          {isAdmin && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Karyawan Terdaftar</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950 tabular-nums">
                  {summary.totalEmployees}
                </p>
                <p className="mt-1 text-xs text-slate-500">Admin, Guru & Tendik</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Karyawan Hadir Hari Ini</p>
                <p className="mt-2 text-2xl font-extrabold text-red-700 tabular-nums">
                  {summary.employeesPresentToday}
                </p>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  {summary.employeesOnLeaveToday} izin / sakit / dinas luar
                </p>
              </div>
            </>
          )}

          {(isAdmin || isGuru) && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Siswa Terdaftar</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950 tabular-nums">
                  {summary.totalStudents}
                </p>
                <p className="mt-1 text-xs text-slate-500">Seluruh kelas & jurusan</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Absensi Siswa Hari Ini</p>
                <p className="mt-2 text-2xl font-extrabold text-red-700 tabular-nums">
                  {summary.studentStatusCountsToday.Hadir}{' '}
                  <span className="text-sm font-semibold text-slate-500">Hadir</span>
                </p>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  Izin: {summary.studentStatusCountsToday.Izin} · Sakit:{' '}
                  {summary.studentStatusCountsToday.Sakit} · Alpha:{' '}
                  {summary.studentStatusCountsToday.Alpha}
                </p>
              </div>
            </>
          )}

          {!isAdmin && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Status Kehadiran Pribadi</p>
              <div className="mt-2">
                <StatusTag status={myToday ? myToday.status : 'Belum Absen'} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {myToday?.notes ? `Catatan: ${myToday.notes}` : 'Absensi karyawan mandiri tersedia di menu Absensi Karyawan.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Recent Tables */}
      {!loading && summary && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {isAdmin && (
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-950">Kehadiran Karyawan Hari Ini</h3>
                <Link
                  to="/app/rekap-absensi/karyawan"
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Lihat Rekap
                </Link>
              </div>
              {summary.recentEmployeeLogs.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Belum ada karyawan yang mencatat absensi hari ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Nama</th>
                        <th className="px-4 py-2.5">Masuk</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {summary.recentEmployeeLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {log.user_name}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600 tabular-nums">
                            {log.check_in || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusTag status={log.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {(isAdmin || isGuru) && (
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-950">Absensi Siswa Terbaru Hari Ini</h3>
                <Link
                  to="/app/absensi-siswa"
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Input Absensi
                </Link>
              </div>
              {summary.recentStudentLogs.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Belum ada data absensi siswa yang dicatat hari ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Siswa</th>
                        <th className="px-4 py-2.5">Kelas</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {summary.recentStudentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {log.student_nama}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{log.student_kelas}</td>
                          <td className="px-4 py-2.5">
                            <StatusTag status={log.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
