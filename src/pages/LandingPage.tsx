import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, GraduationCap, Monitor, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}

function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-slate-900 p-8 text-white ${className}`}
      >
        <Building2 className="h-10 w-10 text-red-200 mb-3" />
        <p className="text-sm font-semibold text-center text-red-100">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

const MAJOR_CLUSTERS = [
  {
    index: '01',
    cluster: 'Bidang Teknologi Informasi & Penyiaran',
    summary: 'Fokus pada infrastruktur jaringan komputer, administrasi server, serta produksi konten audio visual dan penyiaran digital.',
    majors: [
      {
        code: 'TKJ',
        name: 'Teknik Komputer dan Jaringan',
        desc: 'Perakitan perangkat keras, routing & switching jaringan, konfigurasi server Linux, dan keamanan infrastruktur IT.',
      },
      {
        code: 'BC',
        name: 'Broadcasting',
        desc: 'Teknik pengambilan gambar, tata cahaya studio, penyuntingan video, manajemen siaran langsung, dan produksi program media.',
      },
    ],
  },
  {
    index: '02',
    cluster: 'Bidang Desain & Komunikasi Kreatif',
    summary: 'Mengembangkan kompetensi desain grafis, identitas visual, ilustrasi digital, dan komunikasi merek berbasis industri kreatif.',
    majors: [
      {
        code: 'DKV',
        name: 'Desain Komunikasi Visual',
        desc: 'Tipografi, desain antarmuka, fotografi komersial, ilustrasi vektor, serta perancangan kampanye visual terpadu.',
      },
    ],
  },
  {
    index: '03',
    cluster: 'Bidang Bisnis, Keuangan & Manajemen',
    summary: 'Menyiapkan tenaga profesional di bidang pembukuan keuangan, tata kelola perkantoran modern, dan pemasaran niaga digital.',
    majors: [
      {
        code: 'AK',
        name: 'Akuntansi',
        desc: 'Siklus akuntansi perusahaan jasa dan dagang, perpajakan, spreadsheet keuangan, serta pelaporan akuntansi digital.',
      },
      {
        code: 'MPLB',
        name: 'Manajemen Perkantoran dan Layanan Bisnis',
        desc: 'Korespondensi bisnis, kearsipan elektronik, administrasi perkantoran, pelayanan prima, dan manajemen jadwal pimpinan.',
      },
      {
        code: 'BD',
        name: 'Bisnis Digital',
        desc: 'Pemasaran digital, pengelolaan e-commerce, analisis perilaku pasar daring, copywriting, dan manajemen konten niaga.',
      },
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Bar Contract: Exact 3 Zones */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-extrabold tracking-tight text-red-700 whitespace-nowrap shrink-0"
          >
            SMK Prima Unggul
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#profil"
              className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Profil
            </a>
            <a
              href="#jurusan"
              className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Program Keahlian
            </a>
            <a
              href="#fasilitas"
              className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Fasilitas
            </a>
            <a
              href="#sistem"
              className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Sistem Absensi
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Link
              to={user ? '/app/dashboard' : '/login'}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{user ? 'Buka Dashboard' : 'Masuk Portal'}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="profil" className="border-b border-slate-200 bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Sekolah Menengah Kejuruan · Terakreditasi Unggul
              </p>

              <h1
                className="mt-3 font-extrabold tracking-tight text-slate-950"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', lineHeight: 1.1, textWrap: 'balance' }}
              >
                Mencetak Lulusan Vokasi Siap Kerja, Disiplin, dan Berkarakter.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                SMK Prima Unggul adalah institusi pendidikan kejuruan berbasis praktik industri
                dengan 3 rumpun bidang keahlian utama yang menaungi 6 jurusan unggulan: TKJ, DKV,
                AK, BC, MPLB, dan BD. Didukung sistem absensi digital terpadu untuk menjaga budaya
                disiplin siswa dan seluruh karyawan sekolah.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/app/dashboard' : '/login'}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-6 py-3 text-sm font-semibold text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{user ? 'Masuk ke Aplikasi' : 'Masuk Portal Absensi'}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
                <a
                  href="#jurusan"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-red-300 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Lihat Program Keahlian
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-96 lg:h-full lg:min-h-[420px]">
                <SafeImage
                  src="/src/assets/images/hero_smk_campus_1795061325875.jpg"
                  alt="Gedung Kampus SMK Prima Unggul"
                  fallbackTitle="Kampus SMK Prima Unggul"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-6">
                  <p className="text-xs font-semibold text-red-200">Lingkungan Belajar Modern</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Kampus terpadu dengan laboratorium jaringan, studio penyiaran, studio kreatif, dan ruang praktik bisnis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Full-Width Strip Below Hero Split */}
          <div className="mt-12 grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="p-6">
              <p className="text-2xl font-extrabold text-red-700 tabular-nums">3 Bidang</p>
              <p className="mt-1 text-sm font-medium text-slate-600">Rumpun Keahlian Utama</p>
            </div>
            <div className="p-6">
              <p className="text-2xl font-extrabold text-slate-950 tabular-nums">6 Jurusan</p>
              <p className="mt-1 text-sm font-medium text-slate-600">TKJ · DKV · AK · BC · MPLB · BD</p>
            </div>
            <div className="p-6">
              <p className="text-2xl font-extrabold text-slate-950 tabular-nums">3 Peran</p>
              <p className="mt-1 text-sm font-medium text-slate-600">Admin, Guru & Tenaga Kependidikan</p>
            </div>
            <div className="p-6">
              <p className="text-2xl font-extrabold text-slate-950 tabular-nums">100% Digital</p>
              <p className="mt-1 text-sm font-medium text-slate-600">Rekap Kehadiran Siswa & Karyawan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Program Keahlian Section */}
      <section id="jurusan" className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
            Program Pendidikan Vokasi
          </p>
          <h2
            className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            3 Rumpun Bidang & 6 Kompetensi Keahlian SMK Prima Unggul
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Kurikulum disusun bersama mitra industri agar setiap peserta didik menguasai keterampilan
            teknis yang relevan sejak bangku sekolah.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {MAJOR_CLUSTERS.map((group) => (
            <div
              key={group.index}
              className="rounded-xl border border-slate-200 bg-white p-6 lg:p-8"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
                <div>
                  <p className="font-mono text-xs font-semibold text-red-700 tabular-nums">
                    {group.index}. Rumpun Keahlian
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{group.cluster}</h3>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600">{group.summary}</p>
              </div>

              <div
                className={`mt-6 grid grid-cols-1 gap-6 ${
                  group.majors.length === 1
                    ? 'md:grid-cols-1'
                    : group.majors.length === 2
                      ? 'md:grid-cols-2'
                      : 'md:grid-cols-3'
                }`}
              >
                {group.majors.map((major) => (
                  <div
                    key={major.code}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-bold text-red-700">{major.code}</span>
                      <span className="text-xs font-medium text-slate-500">Program 3 Tahun</span>
                    </div>
                    <h4 className="mt-2 text-base font-bold text-slate-900">{major.name}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{major.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fasilitas & Laboratorium */}
      <section id="fasilitas" className="border-y border-slate-200 bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Sarana Praktik Standar Industri
            </p>
            <h2
              className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Laboratorium Jaringan, Studio Penyiaran, dan Ruang Kreatif Bisnis
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-4/3 w-full overflow-hidden bg-slate-100">
                <SafeImage
                  src="/src/assets/images/lab_tkj_broadcast_1795061325696.jpg"
                  alt="Laboratorium TKJ dan Studio Broadcasting SMK Prima Unggul"
                  fallbackTitle="Laboratorium TKJ & Studio Broadcasting"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold text-red-700">TKJ · Broadcasting</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">
                  Laboratorium Infrastruktur Jaringan & Studio Penyiaran
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Dilengkapi perangkat router enterprise, rak server praktik, kamera produksi studio,
                  pencahayaan profesional, dan perangkat audio-video switcher untuk pembelajaran berbasis proyek.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col">
              <div className="aspect-4/3 w-full overflow-hidden bg-slate-100">
                <SafeImage
                  src="/src/assets/images/studio_dkv_business_1795061325376.jpg"
                  alt="Studio DKV dan Bisnis Digital SMK Prima Unggul"
                  fallbackTitle="Studio DKV & Bisnis Digital"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-700">DKV · AK · MPLB · BD</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    Studio Desain Kreatif & Simulasi Bisnis Digital
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Ruang kolaborasi dengan workstation desain grafis, laboratorium akuntansi
                    terkomputerisasi, serta unit praktik layanan bisnis dan pemasaran digital.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alur Sistem Absensi Terpadu */}
      <section id="sistem" className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Sistem Informasi Sekolah
            </p>
            <h2
              className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Portal Absensi Siswa & Karyawan Berbasis Peran
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Setiap sivitas akademika mengakses menu sesuai tugas dan wewenangnya secara terstruktur.
            </p>
          </div>
          <Link
            to={user ? '/app/dashboard' : '/login'}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <span>{user ? 'Masuk ke Dashboard' : 'Buka Halaman Login'}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-100">
              <Monitor className="h-5 w-5" />
            </div>
            <p className="mt-4 font-mono text-xs font-semibold text-red-700">01. Peran Admin</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Administrator Sekolah</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Mengelola user (Admin, Guru, Tenaga Kependidikan) tersinkronisasi Auth.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Mengelola data induk siswa (NIS, Nama, Kelas) untuk absensi kelas.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Memantau rekap kehadiran seluruh karyawan maupun siswa serta absen mandiri.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-100">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="mt-4 font-mono text-xs font-semibold text-red-700">02. Peran Guru</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Dewan Guru Pengajar</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Melakukan absensi karyawan mandiri (jam masuk, pulang, atau izin).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Mencatat kehadiran siswa per kelas dan tanggal di menu Absensi Siswa.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Melihat dan mengekspor rekapitulasi absensi siswa.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-100">
              <Users className="h-5 w-5" />
            </div>
            <p className="mt-4 font-mono text-xs font-semibold text-red-700">03. Peran Tendik</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Tenaga Kependidikan</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Melihat ringkasan status kehadiran pribadi di halaman Dashboard.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Melakukan absensi karyawan mandiri setiap hari kerja secara langsung.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>Memantau riwayat jam masuk, jam pulang, dan catatan izin pribadi.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-bold text-white">SMK Prima Unggul</p>
            <p className="mt-1 text-xs text-slate-400">
              Kompetensi Keahlian: TKJ · DKV · AK · BC · MPLB · BD
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <a href="#profil" className="hover:text-white transition-colors">
              Profil Sekolah
            </a>
            <a href="#jurusan" className="hover:text-white transition-colors">
              Jurusan
            </a>
            <Link to="/login" className="font-semibold text-red-400 hover:text-red-300 transition-colors">
              Login Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
