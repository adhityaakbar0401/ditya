import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Save, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Student, StudentAttendanceRecord, StudentAttendanceStatus } from '../../types';

const STUDENT_STATUSES: StudentAttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Alpha'];

function getTodayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function AbsensiSiswaPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayJakarta());
  const [selectedKelas, setSelectedKelas] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [statusMap, setStatusMap] = useState<Record<string, StudentAttendanceStatus>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentsRes, attRes] = await Promise.all([
        apiRequest<{ students: Student[] }>('/api/students'),
        apiRequest<{ records: StudentAttendanceRecord[] }>(
          `/api/attendance/students?date=${encodeURIComponent(selectedDate)}`
        ),
      ]);

      setStudents(studentsRes.students);

      const nextStatus: Record<string, StudentAttendanceStatus> = {};
      const nextNotes: Record<string, string> = {};

      // Default Hadir untuk siswa yang belum diabsen pada tanggal terpilih
      for (const s of studentsRes.students) {
        nextStatus[s.id] = 'Hadir';
        nextNotes[s.id] = '';
      }

      for (const rec of attRes.records) {
        nextStatus[rec.student_id] = rec.status;
        nextNotes[rec.student_id] = rec.notes || '';
      }

      setStatusMap(nextStatus);
      setNotesMap(nextNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data siswa.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas));
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedKelas === 'all' || s.kelas === selectedKelas;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q || s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, selectedKelas, searchQuery]);

  function markAllFiltered(status: StudentAttendanceStatus) {
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const s of filteredStudents) {
        next[s.id] = status;
      }
      return next;
    });
  }

  async function handleSaveAttendance() {
    if (filteredStudents.length === 0) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const entries = filteredStudents.map((s) => ({
        student_id: s.id,
        status: statusMap[s.id] || 'Hadir',
        notes: notesMap[s.id] || '',
      }));

      await apiRequest('/api/attendance/students/batch', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, entries }),
      });
      setSuccessMsg(
        `Absensi ${entries.length} siswa untuk tanggal ${selectedDate} berhasil disimpan.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Pencatatan Absensi Siswa</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih tanggal dan kelas untuk menandai kehadiran siswa SMK Prima Unggul.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={filteredStudents.length === 0 || saving}
              onClick={() => markAllFiltered('Hadir')}
              className="rounded-lg border border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition-colors whitespace-nowrap"
            >
              Tandai Semua Hadir
            </button>
            <button
              type="button"
              disabled={filteredStudents.length === 0 || saving}
              onClick={handleSaveAttendance}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="h-4 w-4 shrink-0" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Absensi'}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="att-date" className="block text-xs font-semibold text-slate-700">
              Tanggal Absensi
            </label>
            <input
              id="att-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSuccessMsg('');
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
            />
          </div>

          <div>
            <label htmlFor="att-kelas" className="block text-xs font-semibold text-slate-700">
              Filter Kelas
            </label>
            <select
              id="att-kelas"
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
            >
              <option value="all">Semua Kelas ({students.length} Siswa)</option>
              {classOptions.map((kls) => (
                <option key={kls} value={kls}>
                  {kls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="att-search" className="block text-xs font-semibold text-slate-700">
              Cari NIS atau Nama Siswa
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="att-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik NIS atau nama..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
              />
            </div>
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
      </section>

      {/* Student Attendance Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-slate-900">Belum Ada Data Siswa</p>
            <p className="mt-1 text-sm text-slate-600">
              Data siswa harus ditambahkan oleh Admin terlebih dahulu sebelum guru dapat melakukan absensi.
            </p>
            {user?.role === 'admin' && (
              <Link
                to="/app/data-siswa"
                className="mt-4 inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
              >
                Tambah Data Siswa
              </Link>
            )}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada siswa yang sesuai dengan filter kelas atau pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">NIS</th>
                  <th className="px-5 py-3">Nama Siswa</th>
                  <th className="px-5 py-3">Kelas</th>
                  <th className="px-5 py-3">Status Kehadiran</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.map((student) => {
                  const currentStatus = statusMap[student.id] || 'Hadir';
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                        {student.nis}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{student.nama}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{student.kelas}</td>
                      <td className="px-5 py-3">
                        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                          {STUDENT_STATUSES.map((st) => {
                            const active = currentStatus === st;
                            const activeStyle =
                              st === 'Hadir'
                                ? 'bg-emerald-700 text-white'
                                : st === 'Izin'
                                  ? 'bg-amber-600 text-white'
                                  : st === 'Sakit'
                                    ? 'bg-sky-700 text-white'
                                    : 'bg-red-700 text-white';
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setStatusMap((prev) => ({ ...prev, [student.id]: st }))
                                }
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                                  active
                                    ? activeStyle
                                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={notesMap[student.id] || ''}
                          onChange={(e) =>
                            setNotesMap((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                          placeholder="Keterangan opsional..."
                          className="w-full min-w-[160px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-red-700 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
