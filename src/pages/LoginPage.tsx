import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, User, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, authStatus, login, registerFirstAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isFirstSetup = authStatus ? !authStatus.hasUsers : false;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('Administrator Sekolah');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isFirstSetup) {
        await registerFirstAdmin({
          full_name: fullName,
          email,
          password,
          nip,
          jabatan,
        });
      } else {
        await login(email, password);
      }
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses autentikasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left Crimson Brand Panel */}
      <div className="relative hidden lg:flex lg:col-span-5 flex-col justify-between bg-red-800 p-10 text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-multiply"
          style={{ backgroundImage: 'url(/src/assets/images/hero_smk_campus_1795061325875.jpg)' }}
        />
        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-200">
            Portal Sistem Informasi
          </p>
          <h1
            className="mt-3 text-3xl font-extrabold tracking-tight text-white"
            style={{ textWrap: 'balance' }}
          >
            SMK Prima Unggul
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-red-100">
            Sistem absensi terpadu untuk karyawan (Admin, Guru, Tenaga Kependidikan) dan pencatatan
            kehadiran siswa di seluruh program keahlian TKJ, DKV, AK, BC, MPLB, dan BD.
          </p>

          <div className="mt-8 space-y-3 border-t border-red-700/70 pt-6 text-sm text-red-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-red-200 shrink-0" />
              <span>Hak akses otomatis menyesuaikan peran akun Anda</span>
            </div>
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-red-200 shrink-0" />
              <span>Absensi karyawan mandiri & absensi siswa per kelas</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-red-200">
          © {new Date().getFullYear()} SMK Prima Unggul
        </div>
      </div>

      {/* Right Login / First Admin Form */}
      <div className="lg:col-span-7 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="text-base font-extrabold text-red-700">
              SMK Prima Unggul
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Beranda</span>
            </Link>
          </div>

          {authLoading ? (
            <div className="space-y-4 py-12">
              <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
              <div className="mt-6 h-11 w-full animate-pulse rounded-lg bg-slate-100" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                  {isFirstSetup ? 'Inisialisasi Sistem' : 'Autentikasi Pengguna'}
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
                  {isFirstSetup ? 'Buat Akun Admin Pertama' : 'Masuk ke Portal Absensi'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {isFirstSetup
                    ? 'Belum ada akun terdaftar. Akun pertama yang dibuat pada autentikasi akan otomatis mendapatkan peran Admin.'
                    : 'Masukkan email dan kata sandi akun sekolah Anda untuk melanjutkan.'}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                {isFirstSetup && (
                  <>
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-semibold text-slate-800">
                        Nama Lengkap
                      </label>
                      <div className="relative mt-1.5">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="fullName"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Contoh: Drs. Ahmad Suryanto"
                          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="nip" className="block text-sm font-semibold text-slate-800">
                          NIP / ID Karyawan
                        </label>
                        <input
                          id="nip"
                          type="text"
                          value={nip}
                          onChange={(e) => setNip(e.target.value)}
                          placeholder="Opsional"
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
                        />
                      </div>
                      <div>
                        <label htmlFor="jabatan" className="block text-sm font-semibold text-slate-800">
                          Jabatan
                        </label>
                        <input
                          id="jabatan"
                          type="text"
                          value={jabatan}
                          onChange={(e) => setJabatan(e.target.value)}
                          placeholder="Administrator Sekolah"
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                    Email
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@smkprimaunggul.sch.id"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-800">
                    Kata Sandi
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={isFirstSetup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
                >
                  {submitting
                    ? 'Memproses...'
                    : isFirstSetup
                      ? 'Buat Akun Admin & Masuk'
                      : 'Masuk ke Portal'}
                </button>
              </form>

              {!isFirstSetup && (
                <p className="mt-6 text-xs leading-relaxed text-slate-500">
                  Pembuatan akun Guru dan Tenaga Kependidikan dilakukan oleh Administrator melalui
                  menu User Management di dalam portal.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
