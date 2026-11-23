import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, LogIn, LogOut as LogOutIcon, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatRoleLabel, useAuth } from '../../context/AuthContext';
import { StatusTag } from '../../components/StatusTag';
import type { DashboardSummary } from '../../types';

export default function DashboardPage() {
  const { user, claimAdmin } = useAuth();
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

  async function handleQuickStudentCheckIn() {
    setActionBusy(true);
    setError('');
    try {
      await apiRequest('/api/attendance/students/self', {
        method: 'POST',
        body: JSON.stringify({ status: 'Hadir', notes: '' }),
      });
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat kehadiran siswa.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleClaimAdmin() {
    setActionBusy(true);
    setError('');
    try {
      await claimAdmin();
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan peran Admin.');
    } finally {
      setActionBusy(false);
    }
  }

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';
  const isSiswa = user.role === 'siswa';
  const myToday = summary?.myAttendanceToday || null;
  const myStudentToday = summary?.myStudentAttendanceToday || null;
  const myStudentProfile = summary?.myStudentProfile || null;

  if (isSiswa) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Siswa · {summary?.today || 'Hari Ini'}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
                Selamat Datang, {user.full_name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {myStudentProfile
                  ? `NIS ${myStudentProfile.nis} · Kelas ${myStudentProfile.kelas} (${myStudentProfile.jurusan})`
                  : 'Catat dan pantau kehadiran harian Anda di SMK Prima Unggul.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5">
                <p className="text-[11px] font-semibold text-amber-900">Waktu WIB</p>
                <p className="font-mono text-lg font-bold text-slate-950 tabular-nums">
                  {nowWib || '--:--:--'}
                </p>
              </div>

              {!myStudentToday && myStudentProfile ? (
                <button
                  type="button"
                  disabled={actionBusy || loading}
                  onClick={handleQuickStudentCheckIn}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>{actionBusy ? 'Menyimpan...' : 'Absen Hadir Sekarang'}</span>
                </button>
              ) : (
                <Link
                  to="/app/absensi-saya"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Buka Absensi Saya</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-200 pt-4 text-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-slate-500">Status Kehadiran Hari Ini:</span>
              <StatusTag status={myStudentToday ? myStudentToday.status : 'Belum Absen'} />
            </div>
            {myStudentToday?.notes && (
              <div className="text-slate-600">Catatan: {myStudentToday.notes}</div>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {!loading && summary && (
          <>
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Hadir</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700 tabular-nums">
                  {summary.studentStatusCountsToday.Hadir}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Izin</p>
                <p className="mt-2 text-2xl font-extrabold text-amber-700 tabular-nums">
                  {summary.studentStatusCountsToday.Izin}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Sakit</p>
                <p className="mt-2 text-2xl font-extrabold text-sky-700 tabular-nums">
                  {summary.studentStatusCountsToday.Sakit}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Total Alpha</p>
                <p className="mt-2 text-2xl font-extrabold text-red-700 tabular-nums">
                  {summary.studentStatusCountsToday.Alpha}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-950">Riwayat Absensi Terbaru</h3>
                <Link
                  to="/app/absensi-saya"
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Lihat Semua
                </Link>
              </div>
              {summary.recentStudentLogs.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Belum ada riwayat absensi yang tercatat untuk akun Anda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Tanggal</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Catatan</th>
                        <th className="px-4 py-2.5">Pencatat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {summary.recentStudentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-900 tabular-nums">
                            {log.date}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusTag status={log.status} />
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{log.notes || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {log.recorded_by_name || 'Sistem'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Self Attendance Card */}
      <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
              {formatRoleLabel(user.role)} · {summary?.today || 'Hari Ini'}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
              Selamat Datang, {user.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pantau status kehadiran harian Anda dan aktivitas sekolah SMK Prima Unggul.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5">
              <p className="text-[11px] font-semibold text-amber-900">Waktu WIB</p>
              <p className="font-mono text-lg font-bold text-slate-950 tabular-nums">
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
                className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOutIcon className="h-4 w-4 shrink-0 text-red-700" />
                <span>{actionBusy ? 'Menyimpan...' : 'Catat Jam Pulang'}</span>
              </button>
            ) : (
              <Link
                to="/app/absensi-karyawan"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
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
            <span className="text-slate-600">Status Anda Hari Ini:</span>
            <StatusTag status={myToday ? myToday.status : 'Belum Absen'} />
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>Jam Masuk:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {myToday?.check_in || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="h-4 w-4 text-red-700" />
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

      {!loading && summary?.hasAdmin === false && !isAdmin && (
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Belum Ada Akun Admin di Sistem
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                Akun Anda saat ini tercatat sebagai {formatRoleLabel(user.role)}. Karena belum ada
                administrator terdaftar, Anda dapat menjadikan akun ini sebagai Admin untuk membuka
                menu Rekap, Data Siswa, dan User Management.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={actionBusy}
            onClick={handleClaimAdmin}
            className="shrink-0 rounded-lg bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
          >
            {actionBusy ? 'Memproses...' : 'Jadikan Akun Ini Admin'}
          </button>
        </section>
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
              <div className="rounded-xl border border-slate-200 border-t-2 border-t-amber-500 bg-white p-5">
                <p className="text-xs font-semibold text-slate-600">Total Karyawan Terdaftar</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950 tabular-nums">
                  {summary.totalEmployees}
                </p>
                <p className="mt-1 text-xs text-slate-500">Admin, Guru & Tendik</p>
              </div>

              <div className="rounded-xl border border-slate-200 border-t-2 border-t-red-700 bg-white p-5">
                <p className="text-xs font-semibold text-slate-600">Karyawan Hadir Hari Ini</p>
                <p className="mt-2 text-2xl font-extrabold text-red-700 tabular-nums">
                  {summary.employeesPresentToday}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-800 tabular-nums">
                  {summary.employeesOnLeaveToday} izin / sakit / dinas luar
                </p>
              </div>
            </>
          )}

          {(isAdmin || isGuru) && (
            <>
              <div className="rounded-xl border border-slate-200 border-t-2 border-t-amber-500 bg-white p-5">
                <p className="text-xs font-semibold text-slate-600">Total Siswa Terdaftar</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950 tabular-nums">
                  {summary.totalStudents}
                </p>
                <p className="mt-1 text-xs text-slate-500">Seluruh kelas & jurusan</p>
              </div>

              <div className="rounded-xl border border-slate-200 border-t-2 border-t-red-700 bg-white p-5">
                <p className="text-xs font-semibold text-slate-600">Absensi Siswa Hari Ini</p>
                <p className="mt-2 text-2xl font-extrabold text-red-700 tabular-nums">
                  {summary.studentStatusCountsToday.Hadir}{' '}
                  <span className="text-sm font-semibold text-slate-600">Hadir</span>
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600 tabular-nums">
                  Izin: {summary.studentStatusCountsToday.Izin} · Sakit:{' '}
                  {summary.studentStatusCountsToday.Sakit} · Alpha:{' '}
                  {summary.studentStatusCountsToday.Alpha}
                </p>
              </div>
            </>
          )}

          {!isAdmin && (
            <div className="rounded-xl border border-slate-200 border-t-2 border-t-amber-500 bg-white p-5">
              <p className="text-xs font-semibold text-slate-600">Status Kehadiran Pribadi</p>
              <div className="mt-2">
                <StatusTag status={myToday ? myToday.status : 'Belum Absen'} />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {myToday?.notes
                  ? `Catatan: ${myToday.notes}`
                  : 'Absensi karyawan mandiri tersedia di menu Absensi Karyawan.'}
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
