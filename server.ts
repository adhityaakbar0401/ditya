import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserRole,
  UserProfile,
  Major,
  SchoolClass,
  Student,
  EmployeeAttendanceRecord,
  StudentAttendanceRecord,
  EmployeeAttendanceStatus,
  StudentAttendanceStatus,
} from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Deteksi konfigurasi Supabase nyata
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isValidHttpUrl(val: string): boolean {
  if (!val) return false;
  if (val.includes('your-project') || val.includes('your-supabase') || val.includes('MY_')) return false;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isConfiguredKey(val: string): boolean {
  if (!val) return false;
  if (val.includes('your-project') || val.includes('your-supabase') || val.includes('MY_')) return false;
  return val.length > 10;
}

let useSupabase = false;
let supabaseAdmin: SupabaseClient | null = null;
let supabasePublic: SupabaseClient | null = null;

if (
  isValidHttpUrl(SUPABASE_URL) &&
  isConfiguredKey(SUPABASE_ANON_KEY) &&
  isConfiguredKey(SUPABASE_SERVICE_ROLE_KEY)
) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    useSupabase = true;
  } catch (err) {
    console.warn('Supabase client initialization failed, falling back to local store:', err);
    supabaseAdmin = null;
    supabasePublic = null;
    useSupabase = false;
  }
}

// Helper Waktu WIB (Asia/Jakarta)
function getJakartaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getJakartaTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

const DEFAULT_MAJORS: Major[] = [
  { code: 'TKJ', name: 'Teknik Komputer dan Jaringan', cluster: 'Teknologi Informasi & Penyiaran' },
  { code: 'BC', name: 'Broadcasting', cluster: 'Teknologi Informasi & Penyiaran' },
  { code: 'DKV', name: 'Desain Komunikasi Visual', cluster: 'Desain & Komunikasi Kreatif' },
  { code: 'AK', name: 'Akuntansi', cluster: 'Bisnis, Keuangan & Manajemen' },
  { code: 'MPLB', name: 'Manajemen Perkantoran dan Layanan Bisnis', cluster: 'Bisnis, Keuangan & Manajemen' },
  { code: 'BD', name: 'Bisnis Digital', cluster: 'Bisnis, Keuangan & Manajemen' },
];

function parseGradeLevel(kelas: string): 'X' | 'XI' | 'XII' {
  const upper = kelas.trim().toUpperCase();
  if (upper.startsWith('XII')) return 'XII';
  if (upper.startsWith('XI')) return 'XI';
  return 'X';
}

// ============================================================================
// PENYIMPANAN LOKAL PERSISTEN (FALLBACK KETIKA ENV SUPABASE BELUM DISET)
// ============================================================================
interface LocalUserRecord extends UserProfile {
  password_hash: string;
}

interface LocalDatabase {
  users: LocalUserRecord[];
  majors: Major[];
  classes: SchoolClass[];
  students: Student[];
  employee_attendance: EmployeeAttendanceRecord[];
  student_attendance: StudentAttendanceRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'school-db.json');
const TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_smk_prima_unggul').digest('hex');

function ensureDbFile(): LocalDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: LocalDatabase = {
      users: [],
      majors: DEFAULT_MAJORS,
      classes: [],
      students: [],
      employee_attendance: [],
      student_attendance: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
  const normalized: LocalDatabase = {
    users: parsed.users || [],
    majors: parsed.majors && parsed.majors.length > 0 ? parsed.majors : DEFAULT_MAJORS,
    classes: parsed.classes || [],
    students: parsed.students || [],
    employee_attendance: parsed.employee_attendance || [],
    student_attendance: parsed.student_attendance || [],
  };
  return normalized;
}

function writeDbFile(db: LocalDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function ensureLocalClassRelation(db: LocalDatabase, kelasName: string, jurusanCode: string): SchoolClass {
  const cleanName = kelasName.trim();
  const existing = db.classes.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const created: SchoolClass = {
    id: crypto.randomUUID(),
    name: cleanName,
    grade_level: parseGradeLevel(cleanName),
    major_code: jurusanCode || 'TKJ',
    homeroom_teacher_id: null,
  };
  db.classes.push(created);
  return created;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signLocalToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyLocalToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub: string;
      exp: number;
    };
    if (Date.now() > parsed.exp) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

function sanitizeLocalUser(u: LocalUserRecord): UserProfile {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    nip: u.nip,
    jabatan: u.jabatan,
    created_at: u.created_at,
  };
}

// ============================================================================
// MIDDLEWARE AUTHENTICATION & ROLE AUTHORIZATION
// ============================================================================
interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

async function getUserFromToken(token: string): Promise<UserProfile | null> {
  if (!token) return null;

  if (useSupabase && supabaseAdmin) {
    const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !userData.user) return null;

    const authUser = userData.user;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profile) {
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role as UserRole,
        nip: profile.nip || '',
        jabatan: profile.jabatan || '',
        created_at: profile.created_at,
      };
    }

    const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
    const metaRole = authUser.user_metadata?.role as UserRole | undefined;
    const resolvedRole: UserRole =
      (count || 0) === 0
        ? 'admin'
        : metaRole && ['admin', 'guru', 'tenaga_kependidikan'].includes(metaRole)
          ? metaRole
          : 'tenaga_kependidikan';

    const newProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email || '',
      full_name: (authUser.user_metadata?.full_name as string) || authUser.email?.split('@')[0] || 'Pengguna',
      role: resolvedRole,
      nip: (authUser.user_metadata?.nip as string) || '',
      jabatan: (authUser.user_metadata?.jabatan as string) || '',
      created_at: authUser.created_at,
    };

    await supabaseAdmin.from('profiles').upsert(newProfile);
    return newProfile;
  }

  const userId = verifyLocalToken(token);
  if (!userId) return null;
  const db = ensureDbFile();
  const found = db.users.find((u) => u.id === userId);
  return found ? sanitizeLocalUser(found) : null;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    return;
  }
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
    return;
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk fitur ini.' });
      return;
    }
    next();
  };
}

// ============================================================================
// INISIALISASI EXPRESS APP & API ROUTES
// ============================================================================
const app = express();
app.use(express.json({ limit: '2mb' }));

// 1. Auth Status
app.get('/api/auth/status', async (_req: Request, res: Response) => {
  try {
    if (useSupabase && supabaseAdmin) {
      const { data: listData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const count = listData.users.length;
      res.json({ backendMode: 'supabase', hasUsers: count > 0, userCount: count });
      return;
    }

    const db = ensureDbFile();
    res.json({ backendMode: 'local', hasUsers: db.users.length > 0, userCount: db.users.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// 2. Registrasi User Pertama (Otomatis Admin)
app.post('/api/auth/register-first', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      nip?: string;
      jabatan?: string;
    };

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabaseAdmin && supabasePublic) {
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10 });
      if ((existingList?.users.length || 0) > 0) {
        res.status(403).json({ error: 'Akun admin sudah tersedia. Hubungi admin untuk pembuatan akun baru.' });
        return;
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: 'admin',
          nip: (nip || '').trim(),
          jabatan: (jabatan || 'Administrator Sistem').trim(),
        },
      });

      if (createError || !created.user) {
        res.status(400).json({ error: createError?.message || 'Gagal membuat akun admin di Supabase Auth.' });
        return;
      }

      const profile: UserProfile = {
        id: created.user.id,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role: 'admin',
        nip: (nip || '').trim(),
        jabatan: (jabatan || 'Administrator Sistem').trim(),
        created_at: created.user.created_at,
      };
      await supabaseAdmin.from('profiles').upsert(profile);

      const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError || !signInData.session) {
        res.status(400).json({ error: signInError?.message || 'Akun dibuat, namun gagal masuk otomatis.' });
        return;
      }

      res.status(201).json({ token: signInData.session.access_token, user: profile });
      return;
    }

    const db = ensureDbFile();
    if (db.users.length > 0) {
      res.status(403).json({ error: 'Akun admin sudah tersedia. Hubungi admin untuk pembuatan akun baru.' });
      return;
    }

    const newUser: LocalUserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: full_name.trim(),
      role: 'admin',
      nip: (nip || '').trim(),
      jabatan: (jabatan || 'Administrator Sistem').trim(),
      created_at: new Date().toISOString(),
      password_hash: hashPassword(password),
    };

    db.users.push(newUser);
    writeDbFile(db);

    const token = signLocalToken(newUser.id);
    res.status(201).json({ token, user: sanitizeLocalUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mendaftarkan admin pertama.' });
  }
});

// 3. Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabasePublic && supabaseAdmin) {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error || !data.session || !data.user) {
        res.status(401).json({ error: 'Email atau kata sandi salah.' });
        return;
      }
      const user = await getUserFromToken(data.session.access_token);
      if (!user) {
        res.status(401).json({ error: 'Profil pengguna tidak ditemukan.' });
        return;
      }
      res.json({ token: data.session.access_token, user });
      return;
    }

    const db = ensureDbFile();
    const found = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!found || !verifyPassword(password, found.password_hash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }

    const token = signLocalToken(found.id);
    res.json({ token, user: sanitizeLocalUser(found) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal login.' });
  }
});

// 4. Current User
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// 5. Master Jurusan & Kelas Relasional
app.get('/api/majors', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('majors').select('*').order('code');
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ majors: data || [] });
      return;
    }
    const db = ensureDbFile();
    res.json({ majors: db.majors });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat jurusan.' });
  }
});

app.get('/api/classes', requireAuth, requireRole(['admin', 'guru']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('classes')
        .select('*, major:major_code(code, name, cluster), homeroom:homeroom_teacher_id(id, full_name)')
        .order('name');
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const mapped = (data || []).map((c: Record<string, unknown>) => {
        const major = c.major as { name?: string } | null;
        const homeroom = c.homeroom as { full_name?: string } | null;
        return {
          id: c.id,
          name: c.name,
          grade_level: c.grade_level,
          major_code: c.major_code,
          homeroom_teacher_id: c.homeroom_teacher_id,
          major_name: major?.name || '',
          homeroom_teacher_name: homeroom?.full_name || '',
        };
      });
      res.json({ classes: mapped });
      return;
    }

    const db = ensureDbFile();
    const majorMap = new Map(db.majors.map((m) => [m.code, m]));
    const userMap = new Map(db.users.map((u) => [u.id, u.full_name]));
    const mapped = [...db.classes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        ...c,
        major_name: majorMap.get(c.major_code)?.name || '',
        homeroom_teacher_name: c.homeroom_teacher_id ? userMap.get(c.homeroom_teacher_id) || '' : '',
      }));
    res.json({ classes: mapped });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data kelas.' });
  }
});

// 6. Dashboard Summary (dengan Relasi Join Langsung)
app.get('/api/dashboard/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = getJakartaDate();
    const currentUser = req.user!;

    if (useSupabase && supabaseAdmin) {
      const [profilesCountRes, studentsCountRes, empAttRes, stuAttRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('students').select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('employee_attendance')
          .select('*, profile:user_id(id, full_name, role, jabatan)')
          .eq('date', today)
          .order('updated_at', { ascending: false }),
        supabaseAdmin
          .from('student_attendance')
          .select('*, student:student_id(id, nis, nama, kelas, jurusan)')
          .eq('date', today)
          .order('updated_at', { ascending: false }),
      ]);

      const empAttToday = (empAttRes.data || []) as Array<
        EmployeeAttendanceRecord & {
          profile?: { id: string; full_name: string; role: UserRole; jabatan: string } | null;
        }
      >;
      const stuAttToday = (stuAttRes.data || []) as Array<
        StudentAttendanceRecord & {
          student?: { id: string; nis: string; nama: string; kelas: string; jurusan: string } | null;
        }
      >;

      const myAttendanceToday = empAttToday.find((r) => r.user_id === currentUser.id) || null;
      const employeesPresentToday = empAttToday.filter((r) => r.status === 'Hadir').length;
      const employeesOnLeaveToday = empAttToday.filter((r) => r.status !== 'Hadir').length;

      const studentStatusCountsToday = {
        Hadir: stuAttToday.filter((r) => r.status === 'Hadir').length,
        Izin: stuAttToday.filter((r) => r.status === 'Izin').length,
        Sakit: stuAttToday.filter((r) => r.status === 'Sakit').length,
        Alpha: stuAttToday.filter((r) => r.status === 'Alpha').length,
      };

      const recentEmployeeLogs =
        currentUser.role === 'admin'
          ? empAttToday.slice(0, 8).map((r) => ({
              ...r,
              user_name: r.profile?.full_name || 'Pengguna',
              user_role: r.profile?.role,
              user_jabatan: r.profile?.jabatan || '',
            }))
          : myAttendanceToday
            ? [{ ...myAttendanceToday, user_name: currentUser.full_name, user_role: currentUser.role }]
            : [];

      const recentStudentLogs =
        currentUser.role === 'tenaga_kependidikan'
          ? []
          : stuAttToday.slice(0, 8).map((r) => ({
              ...r,
              student_nis: r.student?.nis || '',
              student_nama: r.student?.nama || '',
              student_kelas: r.student?.kelas || '',
              student_jurusan: r.student?.jurusan || '',
            }));

      res.json({
        today,
        myAttendanceToday,
        totalEmployees: profilesCountRes.count || 0,
        employeesPresentToday,
        employeesOnLeaveToday,
        totalStudents: studentsCountRes.count || 0,
        studentsMarkedToday: stuAttToday.length,
        studentStatusCountsToday,
        recentEmployeeLogs,
        recentStudentLogs,
      });
      return;
    }

    const db = ensureDbFile();
    const profileMap = new Map(db.users.map((u) => [u.id, sanitizeLocalUser(u)]));
    const studentMap = new Map(db.students.map((s) => [s.id, s]));

    const empAttToday = db.employee_attendance.filter((r) => r.date === today);
    const stuAttToday = db.student_attendance.filter((r) => r.date === today);

    const myAttendanceToday = empAttToday.find((r) => r.user_id === currentUser.id) || null;
    const employeesPresentToday = empAttToday.filter((r) => r.status === 'Hadir').length;
    const employeesOnLeaveToday = empAttToday.filter((r) => r.status !== 'Hadir').length;

    const studentStatusCountsToday = {
      Hadir: stuAttToday.filter((r) => r.status === 'Hadir').length,
      Izin: stuAttToday.filter((r) => r.status === 'Izin').length,
      Sakit: stuAttToday.filter((r) => r.status === 'Sakit').length,
      Alpha: stuAttToday.filter((r) => r.status === 'Alpha').length,
    };

    const recentEmployeeLogs =
      currentUser.role === 'admin'
        ? [...empAttToday]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 8)
            .map((r) => {
              const p = profileMap.get(r.user_id);
              return { ...r, user_name: p?.full_name, user_role: p?.role, user_jabatan: p?.jabatan };
            })
        : myAttendanceToday
          ? [{ ...myAttendanceToday, user_name: currentUser.full_name, user_role: currentUser.role }]
          : [];

    const recentStudentLogs =
      currentUser.role === 'tenaga_kependidikan'
        ? []
        : [...stuAttToday]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 8)
            .map((r) => {
              const s = studentMap.get(r.student_id);
              return {
                ...r,
                student_nis: s?.nis,
                student_nama: s?.nama,
                student_kelas: s?.kelas,
              };
            });

    res.json({
      today,
      myAttendanceToday,
      totalEmployees: db.users.length,
      employeesPresentToday,
      employeesOnLeaveToday,
      totalStudents: db.students.length,
      studentsMarkedToday: stuAttToday.length,
      studentStatusCountsToday,
      recentEmployeeLogs,
      recentStudentLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.' });
  }
});

// 7. Absensi Karyawan (dengan Relasi Join `profile:user_id`)
app.get('/api/attendance/employees', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { startDate, endDate, status, scope } = req.query as {
      startDate?: string;
      endDate?: string;
      status?: string;
      scope?: string;
    };

    const onlySelf = currentUser.role !== 'admin' || scope === 'self';

    if (useSupabase && supabaseAdmin) {
      let query = supabaseAdmin
        .from('employee_attendance')
        .select('*, profile:user_id(id, full_name, email, role, nip, jabatan)')
        .order('date', { ascending: false })
        .order('updated_at', { ascending: false });

      if (onlySelf) query = query.eq('user_id', currentUser.id);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      if (status && status !== 'all') query = query.eq('status', status);

      const { data: records, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const enriched = (records || []).map(
        (
          r: EmployeeAttendanceRecord & {
            profile?: {
              id: string;
              full_name: string;
              email: string;
              role: UserRole;
              nip: string;
              jabatan: string;
            } | null;
          }
        ) => ({
          id: r.id,
          user_id: r.user_id,
          date: r.date,
          check_in: r.check_in,
          check_out: r.check_out,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_name: r.profile?.full_name || 'Pengguna Dihapus',
          user_email: r.profile?.email || '',
          user_role: r.profile?.role,
          user_nip: r.profile?.nip || '',
          user_jabatan: r.profile?.jabatan || '',
        })
      );

      res.json({ records: enriched, today: getJakartaDate() });
      return;
    }

    const db = ensureDbFile();
    const pMap = new Map(db.users.map((u) => [u.id, sanitizeLocalUser(u)]));
    let filtered = db.employee_attendance;
    if (onlySelf) filtered = filtered.filter((r) => r.user_id === currentUser.id);
    if (startDate) filtered = filtered.filter((r) => r.date >= startDate);
    if (endDate) filtered = filtered.filter((r) => r.date <= endDate);
    if (status && status !== 'all') filtered = filtered.filter((r) => r.status === status);

    const enriched = [...filtered]
      .sort((a, b) => b.date.localeCompare(a.date) || b.updated_at.localeCompare(a.updated_at))
      .map((r) => {
        const p = pMap.get(r.user_id);
        return {
          ...r,
          user_name: p?.full_name || 'Pengguna Dihapus',
          user_email: p?.email || '',
          user_role: p?.role,
          user_nip: p?.nip || '',
          user_jabatan: p?.jabatan || '',
        };
      });

    res.json({ records: enriched, today: getJakartaDate() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengambil absensi karyawan.' });
  }
});

app.post('/api/attendance/employees/check-in', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, notes } = req.body as {
      status?: EmployeeAttendanceStatus;
      notes?: string;
    };

    const resolvedStatus: EmployeeAttendanceStatus =
      status && ['Hadir', 'Izin', 'Sakit', 'Dinas Luar'].includes(status) ? status : 'Hadir';
    const today = getJakartaDate();
    const nowTime = getJakartaTime();
    const nowIso = new Date().toISOString();

    if (useSupabase && supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await supabaseAdmin
          .from('employee_attendance')
          .update({
            status: resolvedStatus,
            notes: (notes || '').trim(),
            check_in: existing.check_in || (resolvedStatus === 'Hadir' ? nowTime : null),
            updated_at: nowIso,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.json({ record: updated });
        return;
      }

      const { data: inserted, error } = await supabaseAdmin
        .from('employee_attendance')
        .insert({
          user_id: currentUser.id,
          date: today,
          check_in: resolvedStatus === 'Hadir' ? nowTime : null,
          check_out: null,
          status: resolvedStatus,
          notes: (notes || '').trim(),
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(201).json({ record: inserted });
      return;
    }

    const db = ensureDbFile();
    const idx = db.employee_attendance.findIndex((r) => r.user_id === currentUser.id && r.date === today);
    if (idx >= 0) {
      db.employee_attendance[idx] = {
        ...db.employee_attendance[idx],
        status: resolvedStatus,
        notes: (notes || '').trim(),
        check_in: db.employee_attendance[idx].check_in || (resolvedStatus === 'Hadir' ? nowTime : null),
        updated_at: nowIso,
      };
      writeDbFile(db);
      res.json({ record: db.employee_attendance[idx] });
      return;
    }

    const created: EmployeeAttendanceRecord = {
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      date: today,
      check_in: resolvedStatus === 'Hadir' ? nowTime : null,
      check_out: null,
      status: resolvedStatus,
      notes: (notes || '').trim(),
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.employee_attendance.push(created);
    writeDbFile(db);
    res.status(201).json({ record: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan absen masuk.' });
  }
});

app.post('/api/attendance/employees/check-out', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const today = getJakartaDate();
    const nowTime = getJakartaTime();
    const nowIso = new Date().toISOString();

    if (useSupabase && supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (!existing) {
        res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }

      const { data: updated, error } = await supabaseAdmin
        .from('employee_attendance')
        .update({ check_out: nowTime, updated_at: nowIso })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.json({ record: updated });
      return;
    }

    const db = ensureDbFile();
    const idx = db.employee_attendance.findIndex((r) => r.user_id === currentUser.id && r.date === today);
    if (idx < 0) {
      res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
      return;
    }

    db.employee_attendance[idx] = {
      ...db.employee_attendance[idx],
      check_out: nowTime,
      updated_at: nowIso,
    };
    writeDbFile(db);
    res.json({ record: db.employee_attendance[idx] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mencatat absen pulang.' });
  }
});

// 8. Data Siswa (Relasi ke `majors` & `classes`)
app.get('/api/students', requireAuth, requireRole(['admin', 'guru']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('students')
        .select('*, major:jurusan(code, name)')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const mapped = (data || []).map((s: Student & { major?: { name?: string } | null }) => ({
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        class_id: s.class_id,
        kelas: s.kelas,
        jurusan: s.jurusan,
        major_name: s.major?.name || '',
        created_at: s.created_at,
      }));
      res.json({ students: mapped });
      return;
    }

    const db = ensureDbFile();
    const majorMap = new Map(db.majors.map((m) => [m.code, m.name]));
    const sorted = [...db.students]
      .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))
      .map((s) => ({
        ...s,
        major_name: majorMap.get(s.jurusan) || '',
      }));
    res.json({ students: sorted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data siswa.' });
  }
});

app.post('/api/students', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nis, nama, kelas, jurusan } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
    };

    if (!nis || !nama || !kelas) {
      res.status(400).json({ error: 'NIS, Nama Siswa, dan Kelas wajib diisi.' });
      return;
    }

    const cleanNis = nis.trim();
    const cleanNama = nama.trim();
    const cleanKelas = kelas.trim();
    const cleanJurusan = (jurusan || cleanKelas.split(' ')[1] || 'TKJ').trim().toUpperCase();

    if (useSupabase && supabaseAdmin) {
      // Pastikan relasi class ada dan dapatkan class_id
      let classId: string | null = null;
      const { data: existingClass } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('name', cleanKelas)
        .maybeSingle();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const { data: createdClass } = await supabaseAdmin
          .from('classes')
          .insert({
            name: cleanKelas,
            grade_level: parseGradeLevel(cleanKelas),
            major_code: cleanJurusan,
          })
          .select('id')
          .single();
        classId = createdClass?.id || null;
      }

      const { data, error } = await supabaseAdmin
        .from('students')
        .insert({
          nis: cleanNis,
          nama: cleanNama,
          class_id: classId,
          kelas: cleanKelas,
          jurusan: cleanJurusan,
        })
        .select()
        .single();
      if (error) {
        res.status(400).json({ error: error.message.includes('duplicate') ? 'NIS sudah terdaftar.' : error.message });
        return;
      }
      res.status(201).json({ student: data });
      return;
    }

    const db = ensureDbFile();
    if (db.students.some((s) => s.nis.toLowerCase() === cleanNis.toLowerCase())) {
      res.status(400).json({ error: 'NIS sudah terdaftar.' });
      return;
    }

    const cls = ensureLocalClassRelation(db, cleanKelas, cleanJurusan);
    const student: Student = {
      id: crypto.randomUUID(),
      nis: cleanNis,
      nama: cleanNama,
      class_id: cls.id,
      kelas: cleanKelas,
      jurusan: cleanJurusan,
      created_at: new Date().toISOString(),
    };
    db.students.push(student);
    writeDbFile(db);
    res.status(201).json({ student });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menambahkan siswa.' });
  }
});

app.patch('/api/students/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nis, nama, kelas, jurusan } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
    };

    if (!nis || !nama || !kelas) {
      res.status(400).json({ error: 'NIS, Nama Siswa, dan Kelas wajib diisi.' });
      return;
    }

    const cleanKelas = kelas.trim();
    const cleanJurusan = (jurusan || 'TKJ').trim().toUpperCase();

    if (useSupabase && supabaseAdmin) {
      let classId: string | null = null;
      const { data: existingClass } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('name', cleanKelas)
        .maybeSingle();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const { data: createdClass } = await supabaseAdmin
          .from('classes')
          .insert({
            name: cleanKelas,
            grade_level: parseGradeLevel(cleanKelas),
            major_code: cleanJurusan,
          })
          .select('id')
          .single();
        classId = createdClass?.id || null;
      }

      const { data, error } = await supabaseAdmin
        .from('students')
        .update({
          nis: nis.trim(),
          nama: nama.trim(),
          class_id: classId,
          kelas: cleanKelas,
          jurusan: cleanJurusan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.json({ student: data });
      return;
    }

    const db = ensureDbFile();
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Siswa tidak ditemukan.' });
      return;
    }
    if (db.students.some((s) => s.id !== id && s.nis.toLowerCase() === nis.trim().toLowerCase())) {
      res.status(400).json({ error: 'NIS sudah digunakan siswa lain.' });
      return;
    }
    const cls = ensureLocalClassRelation(db, cleanKelas, cleanJurusan);
    db.students[idx] = {
      ...db.students[idx],
      nis: nis.trim(),
      nama: nama.trim(),
      class_id: cls.id,
      kelas: cleanKelas,
      jurusan: cleanJurusan,
    };
    writeDbFile(db);
    res.json({ student: db.students[idx] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data siswa.' });
  }
});

app.delete('/api/students/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (useSupabase && supabaseAdmin) {
      const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.json({ success: true });
      return;
    }

    const db = ensureDbFile();
    db.students = db.students.filter((s) => s.id !== id);
    db.student_attendance = db.student_attendance.filter((a) => a.student_id !== id);
    writeDbFile(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus siswa.' });
  }
});

// 9. Absensi Siswa & Rekap Absensi Siswa (dengan Relasi Join `student:student_id` & `recorder:recorded_by`)
app.get('/api/attendance/students', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, startDate, endDate, kelas, status } = req.query as {
      date?: string;
      startDate?: string;
      endDate?: string;
      kelas?: string;
      status?: string;
    };

    if (useSupabase && supabaseAdmin) {
      let query = supabaseAdmin
        .from('student_attendance')
        .select('*, student:student_id(id, nis, nama, kelas, jurusan), recorder:recorded_by(id, full_name)')
        .order('date', { ascending: false })
        .order('updated_at', { ascending: false });

      if (date) query = query.eq('date', date);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      if (status && status !== 'all') query = query.eq('status', status);

      const { data: records, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      let enriched = (records || []).map(
        (
          r: StudentAttendanceRecord & {
            student?: { id: string; nis: string; nama: string; kelas: string; jurusan: string } | null;
            recorder?: { id: string; full_name: string } | null;
          }
        ) => ({
          id: r.id,
          student_id: r.student_id,
          date: r.date,
          status: r.status,
          notes: r.notes,
          recorded_by: r.recorded_by,
          created_at: r.created_at,
          updated_at: r.updated_at,
          student_nis: r.student?.nis || '',
          student_nama: r.student?.nama || 'Siswa Dihapus',
          student_kelas: r.student?.kelas || '',
          student_jurusan: r.student?.jurusan || '',
          recorded_by_name: r.recorder?.full_name || 'Sistem',
        })
      );

      if (kelas && kelas !== 'all') {
        enriched = enriched.filter((r) => r.student_kelas === kelas);
      }

      res.json({ records: enriched, today: getJakartaDate() });
      return;
    }

    const db = ensureDbFile();
    const sMap = new Map(db.students.map((s) => [s.id, s]));
    const pMap = new Map(db.users.map((u) => [u.id, u.full_name]));

    let filtered = db.student_attendance;
    if (date) filtered = filtered.filter((r) => r.date === date);
    if (startDate) filtered = filtered.filter((r) => r.date >= startDate);
    if (endDate) filtered = filtered.filter((r) => r.date <= endDate);
    if (status && status !== 'all') filtered = filtered.filter((r) => r.status === status);

    let enriched = [...filtered]
      .sort((a, b) => b.date.localeCompare(a.date) || b.updated_at.localeCompare(a.updated_at))
      .map((r) => {
        const s = sMap.get(r.student_id);
        return {
          ...r,
          student_nis: s?.nis || '',
          student_nama: s?.nama || 'Siswa Dihapus',
          student_kelas: s?.kelas || '',
          student_jurusan: s?.jurusan || '',
          recorded_by_name: r.recorded_by ? pMap.get(r.recorded_by) || 'Guru' : 'Sistem',
        };
      });

    if (kelas && kelas !== 'all') {
      enriched = enriched.filter((r) => r.student_kelas === kelas);
    }

    res.json({ records: enriched, today: getJakartaDate() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat absensi siswa.' });
  }
});

app.post('/api/attendance/students/batch', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { date, entries } = req.body as {
      date?: string;
      entries?: Array<{ student_id: string; status: StudentAttendanceStatus; notes?: string }>;
    };

    const targetDate = date || getJakartaDate();
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Daftar absensi siswa tidak boleh kosong.' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (useSupabase && supabaseAdmin) {
      const rows = entries.map((e) => ({
        student_id: e.student_id,
        date: targetDate,
        status: ['Hadir', 'Izin', 'Sakit', 'Alpha'].includes(e.status) ? e.status : 'Hadir',
        notes: (e.notes || '').trim(),
        recorded_by: currentUser.id,
        updated_at: nowIso,
      }));

      const { error } = await supabaseAdmin
        .from('student_attendance')
        .upsert(rows, { onConflict: 'student_id,date' });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ success: true, count: rows.length, date: targetDate });
      return;
    }

    const db = ensureDbFile();
    for (const entry of entries) {
      const validStatus: StudentAttendanceStatus = ['Hadir', 'Izin', 'Sakit', 'Alpha'].includes(entry.status)
        ? entry.status
        : 'Hadir';
      const idx = db.student_attendance.findIndex(
        (r) => r.student_id === entry.student_id && r.date === targetDate
      );
      if (idx >= 0) {
        db.student_attendance[idx] = {
          ...db.student_attendance[idx],
          status: validStatus,
          notes: (entry.notes || '').trim(),
          recorded_by: currentUser.id,
          updated_at: nowIso,
        };
      } else {
        db.student_attendance.push({
          id: crypto.randomUUID(),
          student_id: entry.student_id,
          date: targetDate,
          status: validStatus,
          notes: (entry.notes || '').trim(),
          recorded_by: currentUser.id,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    writeDbFile(db);
    res.json({ success: true, count: entries.length, date: targetDate });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.' });
  }
});

// 10. User Management (Admin only - Full Sync with Supabase Auth + Hard Delete)
app.get('/api/users', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (useSupabase && supabaseAdmin) {
      const [{ data: authList, error: authErr }, { data: profiles }] = await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
        supabaseAdmin.from('profiles').select('*'),
      ]);

      if (authErr) {
        res.status(500).json({ error: authErr.message });
        return;
      }

      const profileMap = new Map((profiles || []).map((p: UserProfile) => [p.id, p]));
      const syncedUsers: UserProfile[] = [];

      for (const au of authList.users) {
        const p = profileMap.get(au.id);
        if (p) {
          syncedUsers.push(p);
        } else {
          const metaRole = au.user_metadata?.role as UserRole | undefined;
          const fallbackProfile: UserProfile = {
            id: au.id,
            email: au.email || '',
            full_name: (au.user_metadata?.full_name as string) || au.email?.split('@')[0] || 'Pengguna',
            role:
              metaRole && ['admin', 'guru', 'tenaga_kependidikan'].includes(metaRole)
                ? metaRole
                : 'tenaga_kependidikan',
            nip: (au.user_metadata?.nip as string) || '',
            jabatan: (au.user_metadata?.jabatan as string) || '',
            created_at: au.created_at,
          };
          await supabaseAdmin.from('profiles').upsert(fallbackProfile);
          syncedUsers.push(fallbackProfile);
        }
      }

      res.json({ users: syncedUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
      return;
    }

    const db = ensureDbFile();
    const users = db.users.map(sanitizeLocalUser).sort((a, b) => a.full_name.localeCompare(b.full_name));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data user.' });
  }
});

app.post('/api/users', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, full_name, role, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: UserRole;
      nip?: string;
      jabatan?: string;
    };

    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Nama, email, kata sandi, dan role wajib diisi.' });
      return;
    }
    if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabaseAdmin) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      });

      if (createError || !created.user) {
        res.status(400).json({ error: createError?.message || 'Gagal membuat user di Supabase Auth.' });
        return;
      }

      const profile: UserProfile = {
        id: created.user.id,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role,
        nip: (nip || '').trim(),
        jabatan: (jabatan || '').trim(),
        created_at: created.user.created_at,
      };
      await supabaseAdmin.from('profiles').upsert(profile);
      res.status(201).json({ user: profile });
      return;
    }

    const db = ensureDbFile();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      res.status(400).json({ error: 'Email sudah terdaftar.' });
      return;
    }

    const newUser: LocalUserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: full_name.trim(),
      role,
      nip: (nip || '').trim(),
      jabatan: (jabatan || '').trim(),
      created_at: new Date().toISOString(),
      password_hash: hashPassword(password),
    };
    db.users.push(newUser);
    writeDbFile(db);
    res.status(201).json({ user: sanitizeLocalUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat user.' });
  }
});

app.patch('/api/users/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, password, full_name, role, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: UserRole;
      nip?: string;
      jabatan?: string;
    };

    if (!email || !full_name || !role) {
      res.status(400).json({ error: 'Nama, email, dan role wajib diisi.' });
      return;
    }
    if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }
    if (password && password.length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabaseAdmin) {
      const updatePayload: {
        email: string;
        password?: string;
        user_metadata: Record<string, string>;
      } = {
        email: normalizedEmail,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      };
      if (password) updatePayload.password = password;

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
      if (authErr) {
        res.status(400).json({ error: authErr.message });
        return;
      }

      const { data: updatedProfile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .update({
          email: normalizedEmail,
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (profErr) {
        res.status(400).json({ error: profErr.message });
        return;
      }

      res.json({ user: updatedProfile });
      return;
    }

    const db = ensureDbFile();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === normalizedEmail)) {
      res.status(400).json({ error: 'Email sudah digunakan pengguna lain.' });
      return;
    }

    db.users[idx] = {
      ...db.users[idx],
      email: normalizedEmail,
      full_name: full_name.trim(),
      role,
      nip: (nip || '').trim(),
      jabatan: (jabatan || '').trim(),
      password_hash: password ? hashPassword(password) : db.users[idx].password_hash,
    };
    writeDbFile(db);
    res.json({ user: sanitizeLocalUser(db.users[idx]) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui user.' });
  }
});

// Hard delete sampai ke Supabase Authentication
app.delete('/api/users/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
      return;
    }

    if (useSupabase && supabaseAdmin) {
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authDeleteErr) {
        res.status(400).json({ error: authDeleteErr.message });
        return;
      }
      await supabaseAdmin.from('profiles').delete().eq('id', id);
      res.json({ success: true });
      return;
    }

    const db = ensureDbFile();
    const exists = db.users.some((u) => u.id === id);
    if (!exists) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    db.users = db.users.filter((u) => u.id !== id);
    db.employee_attendance = db.employee_attendance.filter((a) => a.user_id !== id);
    writeDbFile(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus user.' });
  }
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
// ============================================================================
async function startServer(): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SMK Prima Unggul server running on http://0.0.0.0:${PORT} (mode: ${useSupabase ? 'supabase' : 'local'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
