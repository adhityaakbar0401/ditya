import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatRoleLabel, useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { UserProfile, UserRole } from '../../types';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('guru');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ users: UserProfile[] }>('/api/users');
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchQuery =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.nip || '').toLowerCase().includes(q);
      return matchRole && matchQuery;
    });
  }, [users, roleFilter, searchQuery]);

  function openAddModal() {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('guru');
    setNip('');
    setJabatan('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(target: UserProfile) {
    setEditingUser(target);
    setFullName(target.full_name);
    setEmail(target.email);
    setPassword('');
    setRole(target.role);
    setNip(target.nip || '');
    setJabatan(target.jabatan || '');
    setFormError('');
    setModalOpen(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingUser) {
        const payload: Record<string, string> = {
          full_name: fullName,
          email,
          role,
          nip,
          jabatan,
        };
        if (password.trim()) {
          payload.password = password;
        }
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
            nip,
            jabatan,
          }),
        });
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.');
    } finally {
      setSaving(false);
    }
  }

  async function handleHardDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pengguna.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">User Management</h2>
            <p className="mt-1 text-sm text-slate-600">
              Kelola seluruh akun Admin, Guru, dan Tenaga Kependidikan tersinkronisasi penuh dengan autentikasi.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <span>Tambah User</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="um-search" className="block text-xs font-semibold text-slate-700">
              Cari Nama, Email, atau NIP
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="um-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama atau email..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="um-role" className="block text-xs font-semibold text-slate-700">
              Filter Role
            </label>
            <select
              id="um-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
            >
              <option value="all">Semua Role ({users.length} Akun)</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
              <option value="siswa">Siswa</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Users Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada pengguna yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Nama Lengkap</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">NIP / Jabatan</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {u.full_name}
                        {isSelf && (
                          <span className="ml-2 inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{u.email}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : u.role === 'guru'
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'border-slate-200 bg-slate-50 text-slate-800'
                          }`}
                        >
                          {formatRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <span className="font-mono tabular-nums">{u.nip || '—'}</span>
                        {u.jabatan ? ` · ${u.jabatan}` : ''}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50/70 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-amber-800" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            title={isSelf ? 'Tidak dapat menghapus akun sendiri' : 'Hapus permanen'}
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 border-t-4 border-t-red-700 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-950">
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
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

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <label htmlFor="u-name" className="block text-xs font-semibold text-slate-800">
                  Nama Lengkap
                </label>
                <input
                  id="u-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Siti Nurhaliza, S.Kom"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-email" className="block text-xs font-semibold text-slate-800">
                    Email
                  </label>
                  <input
                    id="u-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@smkprimaunggul.sch.id"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="u-role" className="block text-xs font-semibold text-slate-800">
                    Role
                  </label>
                  <select
                    id="u-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="guru">Guru</option>
                    <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
                    <option value="siswa">Siswa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-nip" className="block text-xs font-semibold text-slate-800">
                    NIP / NIS
                  </label>
                  <input
                    id="u-nip"
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="Opsional"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="u-jabatan" className="block text-xs font-semibold text-slate-800">
                    Jabatan / Mapel
                  </label>
                  <input
                    id="u-jabatan"
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    placeholder="Contoh: Guru Produktif TKJ"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="u-pass" className="block text-xs font-semibold text-slate-800">
                  {editingUser ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)' : 'Kata Sandi'}
                </label>
                <input
                  id="u-pass"
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-700 focus:outline-none"
                />
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
                  {saving ? 'Menyimpan...' : editingUser ? 'Perbarui User' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus User Secara Permanen"
        message={`Pengguna "${deleteTarget?.full_name}" (${deleteTarget?.email}) akan dihapus secara permanen (hard delete) dari database dan sistem autentikasi. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Permanen"
        loading={deleting}
        onConfirm={handleHardDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
