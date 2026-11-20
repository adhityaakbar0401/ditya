import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { Major, Student } from '../../types';

const FALLBACK_MAJORS: Major[] = [
  { code: 'TKJ', name: 'Teknik Komputer dan Jaringan', cluster: 'Teknologi Informasi & Penyiaran' },
  { code: 'DKV', name: 'Desain Komunikasi Visual', cluster: 'Desain & Komunikasi Kreatif' },
  { code: 'AK', name: 'Akuntansi', cluster: 'Bisnis, Keuangan & Manajemen' },
  { code: 'BC', name: 'Broadcasting', cluster: 'Teknologi Informasi & Penyiaran' },
  { code: 'MPLB', name: 'Manajemen Perkantoran dan Layanan Bisnis', cluster: 'Bisnis, Keuangan & Manajemen' },
  { code: 'BD', name: 'Bisnis Digital', cluster: 'Bisnis, Keuangan & Manajemen' },
];

export default function DataSiswaPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [majors, setMajors] = useState<Major[]>(FALLBACK_MAJORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [kelasFilter, setKelasFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [nis, setNis] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [jurusan, setJurusan] = useState('TKJ');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stuRes, majRes] = await Promise.all([
        apiRequest<{ students: Student[] }>('/api/students'),
        apiRequest<{ majors: Major[] }>('/api/majors').catch(() => ({ majors: FALLBACK_MAJORS })),
      ]);
      setStudents(stuRes.students);
      if (majRes.majors.length > 0) {
        setMajors(majRes.majors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data siswa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const classOptions = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.kelas))).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchKelas = kelasFilter === 'all' || s.kelas === kelasFilter;
      const matchQuery =
        !q ||
        s.nis.toLowerCase().includes(q) ||
        s.nama.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q);
      return matchKelas && matchQuery;
    });
  }, [students, kelasFilter, searchQuery]);

  function openAddModal() {
    setEditingStudent(null);
    setNis('');
    setNama('');
    setKelas('');
    setJurusan('TKJ');
    setAccountEmail('');
    setAccountPassword('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(student: Student) {
    setEditingStudent(student);
    setNis(student.nis);
    setNama(student.nama);
    setKelas(student.kelas);
    setJurusan(student.jurusan || 'TKJ');
    setAccountEmail(student.account_email || '');
    setAccountPassword('');
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        nis,
        nama,
        kelas,
        jurusan,
        account_email: accountEmail,
        account_password: accountPassword,
      };
      if (editingStudent) {
        await apiRequest(`/api/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadStudents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data siswa.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/students/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus siswa.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Master Data Siswa</h2>
            <p className="mt-1 text-sm text-slate-600">
              Kelola NIS, Nama, Kelas, Jurusan, serta akun login siswa agar siswa dapat masuk ke portal absensi.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Tambah Siswa</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ds-search" className="block text-xs font-semibold text-slate-700">
              Cari NIS, Nama, atau Kelas
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="ds-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik NIS atau nama siswa..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ds-kelas" className="block text-xs font-semibold text-slate-700">
              Filter Kelas
            </label>
            <select
              id="ds-kelas"
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
            >
              <option value="all">Semua Kelas ({students.length} Siswa)</option>
              {classOptions.map((kls) => (
                <option key={kls} value={kls}>
                  {kls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-slate-900">Belum Ada Data Siswa</p>
            <p className="mt-1 text-sm text-slate-600">
              Tambahkan siswa pertama agar guru dapat memulai absensi siswa dan siswa dapat melakukan login.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Siswa Pertama</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada siswa yang sesuai dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">NIS</th>
                  <th className="px-5 py-3">Nama Lengkap</th>
                  <th className="px-5 py-3">Kelas</th>
                  <th className="px-5 py-3">Jurusan</th>
                  <th className="px-5 py-3">Akun Login</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {student.nis}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{student.nama}</td>
                    <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{student.kelas}</td>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-red-700">
                      {student.jurusan}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {student.user_id ? (
                        <span className="font-medium text-emerald-700">
                          Aktif · {student.account_email || 'NIS'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum diaktifkan</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:text-red-700 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(student)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-700 hover:text-white transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Student Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-950">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="s-nis" className="block text-xs font-semibold text-slate-800">
                  NIS (Nomor Induk Siswa)
                </label>
                <input
                  id="s-nis"
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Contoh: 20261001"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="s-nama" className="block text-xs font-semibold text-slate-800">
                  Nama Lengkap Siswa
                </label>
                <input
                  id="s-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Bagas Pratama"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="s-jurusan" className="block text-xs font-semibold text-slate-800">
                    Jurusan
                  </label>
                  <select
                    id="s-jurusan"
                    value={jurusan}
                    onChange={(e) => setJurusan(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                  >
                    {majors.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="s-kelas" className="block text-xs font-semibold text-slate-800">
                    Kelas
                  </label>
                  <input
                    id="s-kelas"
                    type="text"
                    required
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    placeholder="Contoh: XI TKJ 1"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-900">
                  Akun Login Siswa (Opsional)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Isi email & kata sandi jika ingin langsung mengaktifkan login siswa, atau biarkan
                  kosong agar siswa mengaktifkan sendiri via NIS di halaman login.
                </p>

                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="s-acc-email" className="block text-xs font-semibold text-slate-800">
                      Email Akun Siswa
                    </label>
                    <input
                      id="s-acc-email"
                      type="email"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="siswa@smkprimaunggul.sch.id"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="s-acc-pass" className="block text-xs font-semibold text-slate-800">
                      {editingStudent?.user_id
                        ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)'
                        : 'Kata Sandi Akun Siswa'}
                    </label>
                    <input
                      id="s-acc-pass"
                      type="password"
                      minLength={accountPassword ? 6 : undefined}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Data Siswa"
        message={`Apakah Anda yakin ingin menghapus siswa "${deleteTarget?.nama}" (NIS: ${deleteTarget?.nis})? Seluruh riwayat absensi siswa ini juga akan dihapus.`}
        confirmLabel="Hapus Siswa"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
