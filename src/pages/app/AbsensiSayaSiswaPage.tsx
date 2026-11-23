import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, LogIn } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { StatusTag } from '../../components/StatusTag';
import type { Student, StudentAttendanceRecord, StudentAttendanceStatus } from '../../types';

const SELF_STATUS_OPTIONS: StudentAttendanceStatus[] = ['Hadir', 'Izin', 'Sakit'];

export default function AbsensiSayaSiswaPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [selectedStatus, setSelectedStatus] = useState<StudentAttendanceStatus>('Hadir');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');
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

  const loadSelfAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await apiRequest<{
        student: Student | null;
        records: StudentAttendanceRecord[];
        today: string;
      }>(`/api/attendance/students/self?${params.toString()}`);
      setStudent(res.student);
      setRecords(res.records);
      setToday(res.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat absensi siswa.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadSelfAttendance();
  }, [loadSelfAttendance]);

  const todayRecord = records.find((r) => r.date === today) || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiRequest('/api/attendance/students/self', {
        method: 'POST',
        body: JSON.stringify({ status: selectedStatus, notes }),
      });
      setSuccessMsg('Kehadiran siswa untuk hari ini berhasil dicatat.');
      await loadSelfAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kehadiran.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Self Attendance Form Card */}
      <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Absensi Mandiri Siswa</h2>
            <p className="mt-1 text-sm text-slate-600">
              {student
                ? `${student.nama} · NIS ${student.nis} · ${student.kelas}`
                : `Tanggal ${today || 'Hari Ini'}`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2">
            <Clock className="h-4 w-4 text-amber-700" />
            <span className="font-mono text-base font-bold text-slate-950 tabular-nums">
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

        {!loading && !student ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Akun ini belum tertaut ke data siswa di Data Siswa. Silakan hubungi Administrator sekolah
            untuk menautkan NIS Anda.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800">Status Kehadiran</label>
              <div className="mt-2 grid grid-cols-3 gap-2.5">
                {SELF_STATUS_OPTIONS.map((opt) => (
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
              <label htmlFor="stu-notes" className="block text-sm font-semibold text-slate-800">
                Keterangan / Catatan (Opsional)
              </label>
              <input
                id="stu-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Hadir di kelas, atau surat izin orang tua"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={submitting || !student}
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>
                  {submitting
                    ? 'Menyimpan...'
                    : todayRecord
                      ? 'Perbarui Absensi Hari Ini'
                      : 'Simpan Kehadiran Hari Ini'}
                </span>
              </button>

              {todayRecord && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Status hari ini:</span>
                  <StatusTag status={todayRecord.status} />
                </div>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Personal Student Attendance History */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
          <h3 className="text-base font-bold text-slate-950">Riwayat Kehadiran Saya</h3>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {['all', 'Hadir', 'Izin', 'Sakit', 'Alpha'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-white text-red-700 border-b-2 border-amber-500 shadow-xs'
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
            Belum ada riwayat kehadiran siswa yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Catatan</th>
                  <th className="px-5 py-3">Dicatat Oleh</th>
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
                    <td className="px-5 py-3 text-slate-600">{rec.notes || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {rec.recorded_by_name || 'Sistem'}
                    </td>
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
