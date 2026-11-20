import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { StatusTag } from '../../components/StatusTag';
import type { Student, StudentAttendanceRecord } from '../../types';

export default function RekapSiswaPage() {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kelasFilter, setKelasFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (kelasFilter !== 'all') params.set('kelas', kelasFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const [attRes, stuRes] = await Promise.all([
        apiRequest<{ records: StudentAttendanceRecord[] }>(
          `/api/attendance/students?${params.toString()}`
        ),
        apiRequest<{ students: Student[] }>('/api/students'),
      ]);
      setRecords(attRes.records);
      setStudents(stuRes.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi siswa.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, kelasFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        (r.student_nama || '').toLowerCase().includes(q) ||
        (r.student_nis || '').toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const stats = useMemo(() => {
    return {
      Hadir: filtered.filter((r) => r.status === 'Hadir').length,
      Izin: filtered.filter((r) => r.status === 'Izin').length,
      Sakit: filtered.filter((r) => r.status === 'Sakit').length,
      Alpha: filtered.filter((r) => r.status === 'Alpha').length,
    };
  }, [filtered]);

  function exportCsv() {
    const headers = ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Status', 'Catatan', 'Dicatat Oleh'];
    const rows = filtered.map((r) => [
      r.date,
      `"${(r.student_nis || '').replace(/"/g, '""')}"`,
      `"${(r.student_nama || '').replace(/"/g, '""')}"`,
      `"${(r.student_kelas || '').replace(/"/g, '""')}"`,
      r.status,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      `"${(r.recorded_by_name || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-absensi-siswa.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Rekap Absensi Siswa</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pantau dan ekspor riwayat kehadiran siswa berdasarkan tanggal, kelas, atau status.
            </p>
          </div>
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Ekspor CSV</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="rs-start" className="block text-xs font-semibold text-slate-700">
              Dari Tanggal
            </label>
            <input
              id="rs-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rs-end" className="block text-xs font-semibold text-slate-700">
              Sampai Tanggal
            </label>
            <input
              id="rs-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rs-kelas" className="block text-xs font-semibold text-slate-700">
              Kelas
            </label>
            <select
              id="rs-kelas"
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
            >
              <option value="all">Semua Kelas</option>
              {classOptions.map((kls) => (
                <option key={kls} value={kls}>
                  {kls}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rs-status" className="block text-xs font-semibold text-slate-700">
              Status
            </label>
            <select
              id="rs-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Alpha">Alpha</option>
            </select>
          </div>
          <div>
            <label htmlFor="rs-search" className="block text-xs font-semibold text-slate-700">
              Cari NIS / Nama
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="rs-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="NIS atau nama..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="mt-5 grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-3.5">
            <p className="text-xs text-slate-500">Hadir</p>
            <p className="mt-0.5 text-xl font-extrabold text-emerald-700 tabular-nums">{stats.Hadir}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs text-slate-500">Izin</p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-700 tabular-nums">{stats.Izin}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs text-slate-500">Sakit</p>
            <p className="mt-0.5 text-xl font-extrabold text-sky-700 tabular-nums">{stats.Sakit}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs text-slate-500">Alpha</p>
            <p className="mt-0.5 text-xl font-extrabold text-red-700 tabular-nums">{stats.Alpha}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada data rekap absensi siswa yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">NIS</th>
                  <th className="px-5 py-3">Nama Siswa</th>
                  <th className="px-5 py-3">Kelas</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Catatan</th>
                  <th className="px-5 py-3">Pencatat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {rec.student_nis}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{rec.student_nama}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {rec.student_kelas}
                    </td>
                    <td className="px-5 py-3">
                      <StatusTag status={rec.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{rec.notes || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {rec.recorded_by_name || '—'}
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
