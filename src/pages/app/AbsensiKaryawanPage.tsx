import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusTag } from '../../components/StatusTag';
import type { EmployeeAttendanceRecord, EmployeeAttendanceStatus } from '../../types';

const STATUS_OPTIONS: EmployeeAttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Dinas Luar'];

export default function AbsensiKaryawanPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [selectedStatus, setSelectedStatus] = useState<EmployeeAttendanceStatus>('Hadir');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
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

  const fetchMyAttendance = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({ scope: 'self' });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await apiRequest<{ records: EmployeeAttendanceRecord[]; today: string }>(
        `/api/attendance/employees?${params.toString()}`
      );
      setRecords(res.records);
      setToday(res.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat absensi.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchMyAttendance();
  }, [fetchMyAttendance]);

  const todayRecord = records.find((r) => r.date === today) || null;

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiRequest('/api/attendance/employees/check-in', {
        method: 'POST',
        body: JSON.stringify({ status: selectedStatus, notes }),
      });
      setSuccessMsg('Absensi hari ini berhasil dicatat.');
      await fetchMyAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat absensi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut() {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiRequest('/api/attendance/employees/check-out', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSuccessMsg('Jam pulang berhasil dicatat.');
      await fetchMyAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat jam pulang.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Self Attendance Form Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Absensi Mandiri Karyawan</h2>
            <p className="mt-1 text-sm text-slate-600">
              {user?.full_name} · Tanggal {today || 'Hari Ini'}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
            <Clock className="h-4 w-4 text-red-700" />
            <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
              {nowWib || '--:--:--'} WIB
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckIn} className="mt-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-800">Status Kehadiran</label>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedStatus(opt)}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedStatus === opt
                      ? 'border-red-700 bg-red-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:text-red-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-slate-800">
              Keterangan / Catatan (Opsional)
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Rapat dinas di Disdikbud, atau hadir tepat waktu"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>
                {submitting
                  ? 'Menyimpan...'
                  : todayRecord
                    ? 'Perbarui Status Hari Ini'
                    : 'Simpan Absen Masuk'}
              </span>
            </button>

            {todayRecord && todayRecord.status === 'Hadir' && !todayRecord.check_out && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckOut}
                className="inline-flex items-center gap-2 rounded-lg border border-red-700 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOutIcon className="h-4 w-4 shrink-0" />
                <span>Catat Jam Pulang</span>
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Personal History Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
          <h3 className="text-base font-bold text-slate-950">Riwayat Kehadiran Saya</h3>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {['all', ...STATUS_OPTIONS].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada riwayat absensi karyawan yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Jam Masuk</th>
                  <th className="px-5 py-3">Jam Pulang</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3">
                      <StatusTag status={rec.status} />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {rec.check_in || '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {rec.check_out || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{rec.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
