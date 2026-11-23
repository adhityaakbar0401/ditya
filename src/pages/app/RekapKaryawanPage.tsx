import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatRoleLabel } from '../../context/AuthContext';
import { StatusTag } from '../../components/StatusTag';
import type { EmployeeAttendanceRecord } from '../../types';

export default function RekapKaryawanPage() {
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope: 'all' });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await apiRequest<{ records: EmployeeAttendanceRecord[] }>(
        `/api/attendance/employees?${params.toString()}`
      );
      setRecords(res.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi karyawan.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.user_nip || '').toLowerCase().includes(q) ||
        (r.user_email || '').toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const stats = useMemo(() => {
    return {
      Hadir: filtered.filter((r) => r.status === 'Hadir').length,
      Izin: filtered.filter((r) => r.status === 'Izin').length,
      Sakit: filtered.filter((r) => r.status === 'Sakit').length,
      'Dinas Luar': filtered.filter((r) => r.status === 'Dinas Luar').length,
    };
  }, [filtered]);

  function exportCsv() {
    const headers = ['Tanggal', 'Nama', 'NIP', 'Role', 'Status', 'Jam Masuk', 'Jam Pulang', 'Catatan'];
    const rows = filtered.map((r) => [
      r.date,
      `"${(r.user_name || '').replace(/"/g, '""')}"`,
      `"${(r.user_nip || '').replace(/"/g, '""')}"`,
      r.user_role ? formatRoleLabel(r.user_role) : '',
      r.status,
      r.check_in || '',
      r.check_out || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-absensi-karyawan.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Rekap Absensi Karyawan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Laporan kehadiran Admin, Guru, dan Tenaga Kependidikan SMK Prima Unggul.
            </p>
          </div>
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 shrink-0 text-amber-800" />
            <span>Ekspor CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="rk-start" className="block text-xs font-semibold text-slate-700">
              Dari Tanggal
            </label>
            <input
              id="rk-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rk-end" className="block text-xs font-semibold text-slate-700">
              Sampai Tanggal
            </label>
            <input
              id="rk-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rk-status" className="block text-xs font-semibold text-slate-700">
              Status
            </label>
            <select
              id="rk-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Dinas Luar">Dinas Luar</option>
            </select>
          </div>
          <div>
            <label htmlFor="rk-search" className="block text-xs font-semibold text-slate-700">
              Cari Karyawan
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="rk-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama, NIP, atau email..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="mt-5 grid grid-cols-2 divide-y divide-amber-200/70 rounded-lg border border-amber-200 bg-amber-50/40 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-3.5">
            <p className="text-xs font-medium text-slate-600">Hadir</p>
            <p className="mt-0.5 text-xl font-extrabold text-emerald-700 tabular-nums">{stats.Hadir}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-slate-600">Izin</p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-800 tabular-nums">{stats.Izin}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-slate-600">Sakit</p>
            <p className="mt-0.5 text-xl font-extrabold text-sky-800 tabular-nums">{stats.Sakit}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-slate-600">Dinas Luar</p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-900 tabular-nums">{stats['Dinas Luar']}</p>
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
            Tidak ada data absensi karyawan untuk filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Nama Karyawan</th>
                  <th className="px-5 py-3">Peran</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Masuk</th>
                  <th className="px-5 py-3">Pulang</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{rec.user_name}</p>
                      {rec.user_nip && (
                        <p className="font-mono text-xs text-slate-500 tabular-nums">
                          NIP: {rec.user_nip}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {rec.user_role ? formatRoleLabel(rec.user_role) : '—'}
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
