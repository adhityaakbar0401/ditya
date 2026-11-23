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
const VALID_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan', 'siswa'];
const EMPLOYEE_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan'];

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

if (isValidHttpUrl(SUPABASE_URL) && isConfiguredKey(SUPABASE_ANON_KEY)) {
  try {
    supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    if (isConfiguredKey(SUPABASE_SERVICE_ROLE_KEY)) {
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
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

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.resolve(process.cwd(), '.data');
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
  return {
    users: parsed.users || [],
    majors: parsed.majors && parsed.majors.length > 0 ? parsed.majors : DEFAULT_MAJORS,
    classes: parsed.classes || [],
    students: parsed.students || [],
    employee_attendance: parsed.employee_attendance || [],
    student_attendance: parsed.student_attendance || [],
  };
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
  accessToken?: string;
}

function createUserSupabaseClient(token: string): SupabaseClient | null {
  if (!useSupabase) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function isAdminKeyError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('bearer token') ||
    lower.includes('not allowed') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid jwt') ||
    lower.includes('forbidden')
  );
}

let cachedServiceRoleValid: boolean | null = null;

async function hasValidServiceRoleKey(): Promise<boolean> {
  if (!useSupabase || !supabaseAdmin) return false;
  if (cachedServiceRoleValid !== null) return cachedServiceRoleValid;
  try {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (!error) {
      cachedServiceRoleValid = true;
      return true;
    }
    if (isAdminKeyError(error.message)) {
      cachedServiceRoleValid = false;
      return false;
    }
    return false;
  } catch {
    cachedServiceRoleValid = false;
    return false;
  }
}

async function getDbClient(req?: AuthenticatedRequest): Promise<SupabaseClient | null> {
  if (!useSupabase) return null;
  if (supabaseAdmin && (await hasValidServiceRoleKey())) {
    return supabaseAdmin;
  }
  if (req?.accessToken) {
    return createUserSupabaseClient(req.accessToken);
  }
  return supabasePublic || supabaseAdmin;
}

function translateSupabaseAuthError(message?: string): string {
  const raw = (message || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi di Supabase. Nonaktifkan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email, atau cek inbox email Anda.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Email/NIS atau kata sandi salah.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Email tersebut sudah terdaftar di sistem autentikasi.';
  }
  return raw || 'Autentikasi gagal.';
}

async function getUserFromToken(token: string): Promise<UserProfile | null> {
  if (!token) return null;

  if (useSupabase && supabasePublic) {
    // supabasePublic.auth.getUser(token) works with both anon and service keys
    const { data: userData, error } = await supabasePublic.auth.getUser(token);
    if (error || !userData.user) return null;

    const authUser = userData.user;
    const userClient = createUserSupabaseClient(token);
    const serviceValid = await hasValidServiceRoleKey();
    const dbClient = serviceValid && supabaseAdmin ? supabaseAdmin : userClient;

    let profile: UserProfile | null = null;
    if (serviceValid && supabaseAdmin) {
      const res = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (!res.error && res.data) {
        profile = res.data as UserProfile;
      }
    }
    if (!profile && userClient) {
      const res = await userClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (!res.error && res.data) {
        profile = res.data as UserProfile;
      }
    }
    if (!profile && userClient) {
      // Gunakan RPC sync_my_profile() agar profil otomatis dibuat di public.profiles meskipun terhalang RLS atau dibuat sebelum trigger
      const rpcRes = await userClient.rpc('sync_my_profile');
      const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
      if (!rpcRes.error && row) {
        profile = row as UserProfile;
      }
    }

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

    const { count } = dbClient
      ? await dbClient.from('profiles').select('*', { count: 'exact', head: true })
      : { count: 0 };
    const metaRole = authUser.user_metadata?.role as UserRole | undefined;
    const resolvedRole: UserRole =
      (count || 0) === 0
        ? 'admin'
        : metaRole && VALID_ROLES.includes(metaRole)
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

    if (serviceValid && supabaseAdmin) {
      await supabaseAdmin.from('profiles').upsert(newProfile);
    }
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
  req.accessToken = token;
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
    if (useSupabase && supabasePublic) {
      if (supabaseAdmin && (await hasValidServiceRoleKey())) {
        const [{ data: listData, error }, { count: adminCount }] = await Promise.all([
          supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 }),
          supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        ]);
        if (!error && listData) {
          const count = listData.users.length;
          res.json({
            backendMode: 'supabase',
            hasUsers: count > 0,
            userCount: count,
            hasAdmin: (adminCount || 0) > 0,
          });
          return;
        }
      }

      const { data: rpcData, error: rpcErr } = await supabasePublic.rpc('get_auth_bootstrap_status');
      if (!rpcErr && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const count = Number((row as { user_count?: number } | null)?.user_count || 0);
        const hasUsers = Boolean((row as { has_users?: boolean } | null)?.has_users || count > 0);
        const rawHasAdmin = (row as { has_admin?: boolean } | null)?.has_admin;
        res.json({
          backendMode: 'supabase',
          hasUsers,
          userCount: count,
          hasAdmin: typeof rawHasAdmin === 'boolean' ? rawHasAdmin : undefined,
        });
        return;
      }

      if (supabaseAdmin) {
        const profRes = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
        if (!profRes.error) {
          const count = profRes.count || 0;
          res.json({ backendMode: 'supabase', hasUsers: count > 0, userCount: count });
          return;
        }
      }

      const pubRes = await supabasePublic.from('profiles').select('id', { count: 'exact', head: true });
      if (!pubRes.error) {
        const count = pubRes.count || 0;
        res.json({ backendMode: 'supabase', hasUsers: count > 0, userCount: count });
        return;
      }

      res.json({ backendMode: 'supabase', hasUsers: false, userCount: 0, hasAdmin: false });
      return;
    }

    const db = ensureDbFile();
    res.json({
      backendMode: 'local',
      hasUsers: db.users.length > 0,
      userCount: db.users.length,
      hasAdmin: db.users.some((u) => u.role === 'admin'),
    });
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

    if (useSupabase && supabasePublic) {
      const serviceRoleValid = Boolean(supabaseAdmin && (await hasValidServiceRoleKey()));
      if (serviceRoleValid && supabaseAdmin) {
        const { data: existingList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 10,
        });

        if (!listErr && (existingList?.users.length || 0) > 0) {
          res.status(403).json({ error: 'Akun admin sudah tersedia. Hubungi admin untuk pembuatan akun baru.' });
          return;
        }
      } else {
        const { data: rpcData } = await supabasePublic.rpc('get_auth_bootstrap_status');
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const rpcCount = Number((row as { user_count?: number } | null)?.user_count || 0);
        if (rpcCount > 0) {
          res.status(403).json({ error: 'Akun admin sudah tersedia. Hubungi admin untuk pembuatan akun baru.' });
          return;
        }
      }

      if (serviceRoleValid && supabaseAdmin) {
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
          res.status(400).json({ error: translateSupabaseAuthError(createError?.message) });
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
          res.status(400).json({ error: translateSupabaseAuthError(signInError?.message) });
          return;
        }

        res.status(201).json({ token: signInData.session.access_token, user: profile });
        return;
      }

      // Fallback ke supabasePublic.auth.signUp jika SUPABASE_SERVICE_ROLE_KEY bukan service_role JWT
      const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: full_name.trim(),
            role: 'admin',
            nip: (nip || '').trim(),
            jabatan: (jabatan || 'Administrator Sistem').trim(),
          },
        },
      });

      if (signUpErr || !signUpData.user) {
        res.status(400).json({ error: translateSupabaseAuthError(signUpErr?.message) });
        return;
      }
      if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        res.status(400).json({ error: 'Email tersebut sudah terdaftar di sistem autentikasi. Gunakan tab Masuk Portal.' });
        return;
      }
      if (!signUpData.session) {
        res.status(400).json({
          error:
            'Akun berhasil dibuat, namun Supabase meminta konfirmasi email. Nonaktifkan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email lalu coba login.',
        });
        return;
      }

      const profile = await getUserFromToken(signUpData.session.access_token);
      res.status(201).json({
        token: signUpData.session.access_token,
        user: profile || {
          id: signUpData.user.id,
          email: normalizedEmail,
          full_name: full_name.trim(),
          role: 'admin',
          nip: (nip || '').trim(),
          jabatan: (jabatan || 'Administrator Sistem').trim(),
          created_at: signUpData.user.created_at,
        },
      });
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

// 3. Login (mendukung Email atau NIS untuk Siswa)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, identifier, password } = req.body as {
      email?: string;
      identifier?: string;
      password?: string;
    };
    const rawIdentifier = (identifier || email || '').trim();
    if (!rawIdentifier || !password) {
      res.status(400).json({ error: 'Email / NIS dan kata sandi wajib diisi.' });
      return;
    }

    let resolvedEmail = rawIdentifier.toLowerCase();

    if (useSupabase && supabasePublic) {
      // Jika input berupa NIS (tidak mengandung @), cari email siswa di relasi students -> profiles
      if (!rawIdentifier.includes('@')) {
        let foundStudentId: string | null = null;
        let foundUserId: string | null = null;
        let foundEmail: string | null = null;

        if (supabaseAdmin && (await hasValidServiceRoleKey())) {
          const { data: stu } = await supabaseAdmin
            .from('students')
            .select('id, user_id, profile:user_id(email)')
            .ilike('nis', rawIdentifier)
            .maybeSingle();
          const linkedProfile = stu?.profile as { email?: string } | null | undefined;
          foundStudentId = stu?.id || null;
          foundUserId = stu?.user_id || null;
          foundEmail = linkedProfile?.email || null;
        } else {
          const { data: rpcRows } = await supabasePublic.rpc('resolve_student_login_email', {
            p_nis: rawIdentifier,
          });
          const firstRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
          if (firstRow) {
            foundStudentId = (firstRow as { student_id?: string }).student_id || null;
            foundUserId = (firstRow as { user_id?: string }).user_id || null;
            foundEmail = (firstRow as { email?: string }).email || null;
          }
        }

        if (!foundStudentId) {
          res.status(401).json({ error: 'NIS tidak ditemukan dalam data siswa.' });
          return;
        }
        if (!foundUserId || !foundEmail) {
          res.status(401).json({
            error: 'Akun login siswa untuk NIS ini belum aktif. Gunakan tab Aktivasi Akun Siswa atau hubungi Admin.',
          });
          return;
        }
        resolvedEmail = foundEmail.toLowerCase();
      }

      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });
      if (error || !data.session || !data.user) {
        res.status(401).json({ error: translateSupabaseAuthError(error?.message) });
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
    if (!rawIdentifier.includes('@')) {
      const stu = db.students.find((s) => s.nis.toLowerCase() === rawIdentifier.toLowerCase());
      if (!stu) {
        res.status(401).json({ error: 'NIS tidak ditemukan dalam data siswa.' });
        return;
      }
      if (!stu.user_id) {
        res.status(401).json({
          error: 'Akun login siswa untuk NIS ini belum aktif. Gunakan tab Aktivasi Siswa atau hubungi Admin.',
        });
        return;
      }
      const linkedUser = db.users.find((u) => u.id === stu.user_id);
      if (!linkedUser) {
        res.status(401).json({ error: 'Akun siswa tidak ditemukan. Hubungi Admin.' });
        return;
      }
      resolvedEmail = linkedUser.email.toLowerCase();
    }

    const found = db.users.find((u) => u.email.toLowerCase() === resolvedEmail);
    if (!found || !verifyPassword(password, found.password_hash)) {
      res.status(401).json({ error: 'Email/NIS atau kata sandi salah.' });
      return;
    }

    const token = signLocalToken(found.id);
    res.json({ token, user: sanitizeLocalUser(found) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal login.' });
  }
});

// 4. Aktivasi Akun Login Siswa menggunakan NIS terdaftar
app.post('/api/auth/activate-student', async (req: Request, res: Response) => {
  try {
    const { nis, email, password } = req.body as {
      nis?: string;
      email?: string;
      password?: string;
    };

    if (!nis || !email || !password) {
      res.status(400).json({ error: 'NIS, email, dan kata sandi wajib diisi.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const cleanNis = nis.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabasePublic) {
      const serviceRoleValid = Boolean(supabaseAdmin && (await hasValidServiceRoleKey()));
      let studentInfo: { id: string; nama: string; kelas: string; user_id: string | null } | null = null;

      if (serviceRoleValid && supabaseAdmin) {
        const { data: student, error: stuErr } = await supabaseAdmin
          .from('students')
          .select('*')
          .ilike('nis', cleanNis)
          .maybeSingle();
        if (!stuErr && student) {
          studentInfo = {
            id: student.id,
            nama: student.nama,
            kelas: student.kelas,
            user_id: student.user_id || null,
          };
        }
      } else {
        const { data: rpcRows } = await supabasePublic.rpc('resolve_student_login_email', {
          p_nis: cleanNis,
        });
        const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        if (row && (row as { student_id?: string }).student_id) {
          studentInfo = {
            id: (row as { student_id: string }).student_id,
            nama: (row as { nama?: string }).nama || 'Siswa',
            kelas: (row as { kelas?: string }).kelas || '',
            user_id: (row as { user_id?: string | null }).user_id || null,
          };
        }
      }

      if (!studentInfo) {
        res.status(404).json({
          error: 'NIS tidak ditemukan. Pastikan Admin telah mendaftarkan data Anda di Data Siswa.',
        });
        return;
      }
      if (studentInfo.user_id) {
        res.status(400).json({
          error: 'Akun siswa untuk NIS ini sudah aktif. Silakan masuk menggunakan tab Masuk.',
        });
        return;
      }

      if (serviceRoleValid && supabaseAdmin) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: studentInfo.nama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${studentInfo.kelas}`,
          },
        });

        if (createErr || !created.user) {
          res.status(400).json({ error: translateSupabaseAuthError(createErr?.message) });
          return;
        }

        const profile: UserProfile = {
          id: created.user.id,
          email: normalizedEmail,
          full_name: studentInfo.nama,
          role: 'siswa',
          nip: cleanNis,
          jabatan: `Siswa ${studentInfo.kelas}`,
          created_at: created.user.created_at,
        };
        await supabaseAdmin.from('profiles').upsert(profile);
        await supabaseAdmin.from('students').update({ user_id: created.user.id }).eq('id', studentInfo.id);

        const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError || !signInData.session) {
          res.status(400).json({ error: translateSupabaseAuthError(signInError?.message) });
          return;
        }

        res.status(201).json({ token: signInData.session.access_token, user: profile });
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: studentInfo.nama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${studentInfo.kelas}`,
          },
        },
      });

      if (signUpErr || !signUpData.user) {
        res.status(400).json({ error: translateSupabaseAuthError(signUpErr?.message) });
        return;
      }
      if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        res.status(400).json({ error: 'Email tersebut sudah terdaftar di sistem autentikasi. Gunakan email lain atau Masuk Portal.' });
        return;
      }
      if (!signUpData.session) {
        res.status(400).json({
          error:
            'Akun siswa dibuat, silakan nonaktifkan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email.',
        });
        return;
      }

      const userClient = createUserSupabaseClient(signUpData.session.access_token);
      if (userClient) {
        await userClient.rpc('activate_student_link', { p_nis: cleanNis });
      }
      const profile = await getUserFromToken(signUpData.session.access_token);
      res.status(201).json({
        token: signUpData.session.access_token,
        user: profile || {
          id: signUpData.user.id,
          email: normalizedEmail,
          full_name: studentInfo.nama,
          role: 'siswa',
          nip: cleanNis,
          jabatan: `Siswa ${studentInfo.kelas}`,
          created_at: signUpData.user.created_at,
        },
      });
      return;
    }

    const db = ensureDbFile();
    const stuIdx = db.students.findIndex((s) => s.nis.toLowerCase() === cleanNis.toLowerCase());
    if (stuIdx < 0) {
      res.status(404).json({
        error: 'NIS tidak ditemukan. Pastikan Admin telah mendaftarkan data Anda di Data Siswa.',
      });
      return;
    }
    const student = db.students[stuIdx];
    if (student.user_id) {
      res.status(400).json({
        error: 'Akun siswa untuk NIS ini sudah aktif. Silakan masuk menggunakan tab Masuk.',
      });
      return;
    }
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      res.status(400).json({ error: 'Email sudah digunakan oleh akun lain.' });
      return;
    }

    const newUser: LocalUserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: student.nama,
      role: 'siswa',
      nip: student.nis,
      jabatan: `Siswa ${student.kelas}`,
      created_at: new Date().toISOString(),
      password_hash: hashPassword(password),
    };
    db.users.push(newUser);
    db.students[stuIdx] = { ...student, user_id: newUser.id, account_email: normalizedEmail };
    writeDbFile(db);

    const token = signLocalToken(newUser.id);
    res.status(201).json({ token, user: sanitizeLocalUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal aktivasi akun siswa.' });
  }
});

// 5. Current User & Klaim Admin Awal (hanya jika belum ada Admin sama sekali)
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.post('/api/auth/claim-admin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'admin') {
      res.json({ user: currentUser });
      return;
    }
    if (currentUser.role === 'siswa') {
      res.status(403).json({ error: 'Akun siswa tidak dapat dijadikan Admin.' });
      return;
    }

    if (useSupabase && supabasePublic) {
      if (supabaseAdmin && (await hasValidServiceRoleKey())) {
        const { count: adminCount } = await supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');
        if ((adminCount || 0) > 0) {
          res.status(403).json({ error: 'Akun Admin sudah tersedia di sistem.' });
          return;
        }
        const { data: updated, error } = await supabaseAdmin
          .from('profiles')
          .update({
            role: 'admin',
            jabatan: currentUser.jabatan || 'Administrator Sekolah',
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id)
          .select()
          .single();
        if (error || !updated) {
          res.status(400).json({ error: error?.message || 'Gagal memperbarui peran Admin.' });
          return;
        }
        res.json({ user: updated });
        return;
      }

      const userClient = req.accessToken ? createUserSupabaseClient(req.accessToken) : null;
      if (!userClient) {
        res.status(401).json({ error: 'Sesi pengguna tidak valid.' });
        return;
      }
      const { data: rpcRows, error: rpcErr } = await userClient.rpc('claim_admin_if_none');
      if (rpcErr) {
        res.status(400).json({ error: rpcErr.message });
        return;
      }
      const updated = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!updated) {
        res.status(400).json({ error: 'Gagal mempromosikan akun ke Admin.' });
        return;
      }
      res.json({ user: updated });
      return;
    }

    const db = ensureDbFile();
    if (db.users.some((u) => u.role === 'admin')) {
      res.status(403).json({ error: 'Akun Admin sudah tersedia di sistem.' });
      return;
    }
    const idx = db.users.findIndex((u) => u.id === currentUser.id);
    if (idx < 0) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    db.users[idx] = {
      ...db.users[idx],
      role: 'admin',
      jabatan: db.users[idx].jabatan || 'Administrator Sekolah',
    };
    writeDbFile(db);
    res.json({ user: sanitizeLocalUser(db.users[idx]) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal klaim peran Admin.' });
  }
});

// 6. Master Jurusan & Kelas Relasional
app.get('/api/majors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data, error } = await dbClient.from('majors').select('*').order('code');
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

app.get('/api/classes', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data, error } = await dbClient
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

// 7. Dashboard Summary
app.get('/api/dashboard/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = getJakartaDate();
    const currentUser = req.user!;

    const dbClient = await getDbClient(req);

    if (currentUser.role === 'siswa') {
      if (useSupabase && dbClient) {
        const { data: student } = await dbClient
          .from('students')
          .select('*, major:jurusan(code, name)')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const myStudentProfile: Student | null = student
          ? {
              id: student.id,
              nis: student.nis,
              nama: student.nama,
              user_id: student.user_id,
              class_id: student.class_id,
              kelas: student.kelas,
              jurusan: student.jurusan,
              major_name: (student.major as { name?: string } | null)?.name || '',
              created_at: student.created_at,
            }
          : null;

        let myLogs: StudentAttendanceRecord[] = [];
        if (myStudentProfile) {
          const { data: logs } = await dbClient
            .from('student_attendance')
            .select('*, recorder:recorded_by(id, full_name)')
            .eq('student_id', myStudentProfile.id)
            .order('date', { ascending: false })
            .limit(30);

          myLogs = (logs || []).map(
            (r: StudentAttendanceRecord & { recorder?: { full_name?: string } | null }) => ({
              ...r,
              student_nis: myStudentProfile.nis,
              student_nama: myStudentProfile.nama,
              student_kelas: myStudentProfile.kelas,
              recorded_by_name: r.recorder?.full_name || 'Mandiri',
            })
          );
        }

        const myStudentAttendanceToday = myLogs.find((r) => r.date === today) || null;
        res.json({
          today,
          myAttendanceToday: null,
          myStudentProfile,
          myStudentAttendanceToday,
          totalEmployees: 0,
          employeesPresentToday: 0,
          employeesOnLeaveToday: 0,
          totalStudents: 1,
          studentsMarkedToday: myStudentAttendanceToday ? 1 : 0,
          studentStatusCountsToday: {
            Hadir: myLogs.filter((r) => r.status === 'Hadir').length,
            Izin: myLogs.filter((r) => r.status === 'Izin').length,
            Sakit: myLogs.filter((r) => r.status === 'Sakit').length,
            Alpha: myLogs.filter((r) => r.status === 'Alpha').length,
          },
          recentEmployeeLogs: [],
          recentStudentLogs: myLogs.slice(0, 8),
        });
        return;
      }

      const db = ensureDbFile();
      const majorMap = new Map(db.majors.map((m) => [m.code, m.name]));
      const userMap = new Map(db.users.map((u) => [u.id, u.full_name]));
      const stu = db.students.find((s) => s.user_id === currentUser.id) || null;
      const myStudentProfile: Student | null = stu
        ? { ...stu, major_name: majorMap.get(stu.jurusan) || '' }
        : null;

      const myLogs = myStudentProfile
        ? db.student_attendance
            .filter((r) => r.student_id === myStudentProfile.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((r) => ({
              ...r,
              student_nis: myStudentProfile.nis,
              student_nama: myStudentProfile.nama,
              student_kelas: myStudentProfile.kelas,
              recorded_by_name: r.recorded_by ? userMap.get(r.recorded_by) || 'Mandiri' : 'Sistem',
            }))
        : [];

      const myStudentAttendanceToday = myLogs.find((r) => r.date === today) || null;

      res.json({
        today,
        myAttendanceToday: null,
        myStudentProfile,
        myStudentAttendanceToday,
        totalEmployees: 0,
        employeesPresentToday: 0,
        employeesOnLeaveToday: 0,
        totalStudents: 1,
        studentsMarkedToday: myStudentAttendanceToday ? 1 : 0,
        studentStatusCountsToday: {
          Hadir: myLogs.filter((r) => r.status === 'Hadir').length,
          Izin: myLogs.filter((r) => r.status === 'Izin').length,
          Sakit: myLogs.filter((r) => r.status === 'Sakit').length,
          Alpha: myLogs.filter((r) => r.status === 'Alpha').length,
        },
        recentEmployeeLogs: [],
        recentStudentLogs: myLogs.slice(0, 8),
      });
      return;
    }

    if (useSupabase && dbClient) {
      const [profilesCountRes, studentsCountRes, empAttRes, stuAttRes] = await Promise.all([
        dbClient.from('profiles').select('*', { count: 'exact', head: true }).in('role', EMPLOYEE_ROLES),
        dbClient.from('students').select('*', { count: 'exact', head: true }),
        dbClient
          .from('employee_attendance')
          .select('*, profile:user_id(id, full_name, role, jabatan)')
          .eq('date', today)
          .order('updated_at', { ascending: false }),
        dbClient
          .from('student_attendance')
          .select('*, student:student_id(id, nis, nama, kelas, jurusan)')
          .eq('date', today)
          .order('updated_at', { ascending: false }),
      ]);

      const firstSchemaErr =
        profilesCountRes.error || studentsCountRes.error || empAttRes.error || stuAttRes.error;
      if (firstSchemaErr && firstSchemaErr.message.toLowerCase().includes('does not exist')) {
        res.status(500).json({
          error:
            'Tabel database Supabase belum dibuat. Jalankan file supabase/schema.sql di SQL Editor Supabase terlebih dahulu.',
        });
        return;
      }

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

      let hasAdmin = currentUser.role === 'admin';
      if (!hasAdmin && supabasePublic) {
        const { data: rpcStatus } = await supabasePublic.rpc('get_auth_bootstrap_status');
        const statusRow = Array.isArray(rpcStatus) ? rpcStatus[0] : rpcStatus;
        if (typeof (statusRow as { has_admin?: boolean } | null)?.has_admin === 'boolean') {
          hasAdmin = Boolean((statusRow as { has_admin?: boolean }).has_admin);
        } else {
          hasAdmin = true;
        }
      }

      res.json({
        today,
        hasAdmin,
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
      hasAdmin: db.users.some((u) => u.role === 'admin'),
      myAttendanceToday,
      totalEmployees: db.users.filter((u) => EMPLOYEE_ROLES.includes(u.role)).length,
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

// 8. Absensi Karyawan (khusus role karyawan: admin, guru, tenaga_kependidikan)
app.get('/api/attendance/employees', requireAuth, requireRole(EMPLOYEE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { startDate, endDate, status, scope } = req.query as {
      startDate?: string;
      endDate?: string;
      status?: string;
      scope?: string;
    };

    const onlySelf = currentUser.role !== 'admin' || scope === 'self';
    const dbClient = await getDbClient(req);

    if (useSupabase && dbClient) {
      let query = dbClient
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

app.post('/api/attendance/employees/check-in', requireAuth, requireRole(EMPLOYEE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data: existing } = await dbClient
        .from('employee_attendance')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await dbClient
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

      const { data: inserted, error } = await dbClient
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

app.post('/api/attendance/employees/check-out', requireAuth, requireRole(EMPLOYEE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const today = getJakartaDate();
    const nowTime = getJakartaTime();
    const nowIso = new Date().toISOString();

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data: existing } = await dbClient
        .from('employee_attendance')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .maybeSingle();

      if (!existing) {
        res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }

      const { data: updated, error } = await dbClient
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

// 9. Data Siswa (dengan dukungan opsional pembuatan/sinkronisasi Akun Login Siswa)
app.get('/api/students', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data, error } = await dbClient
        .from('students')
        .select('*, major:jurusan(code, name), profile:user_id(id, email)')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const mapped = (data || []).map(
        (
          s: Student & {
            major?: { name?: string } | null;
            profile?: { id?: string; email?: string } | null;
          }
        ) => ({
          id: s.id,
          nis: s.nis,
          nama: s.nama,
          user_id: s.user_id || null,
          account_email: s.profile?.email || null,
          class_id: s.class_id,
          kelas: s.kelas,
          jurusan: s.jurusan,
          major_name: s.major?.name || '',
          created_at: s.created_at,
        })
      );
      res.json({ students: mapped });
      return;
    }

    const db = ensureDbFile();
    const majorMap = new Map(db.majors.map((m) => [m.code, m.name]));
    const userMap = new Map(db.users.map((u) => [u.id, u.email]));
    const sorted = [...db.students]
      .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))
      .map((s) => ({
        ...s,
        account_email: s.user_id ? userMap.get(s.user_id) || null : null,
        major_name: majorMap.get(s.jurusan) || '',
      }));
    res.json({ students: sorted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data siswa.' });
  }
});

app.post('/api/students', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nis, nama, kelas, jurusan, account_email, account_password } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
      account_email?: string;
      account_password?: string;
    };

    if (!nis || !nama || !kelas) {
      res.status(400).json({ error: 'NIS, Nama Siswa, dan Kelas wajib diisi.' });
      return;
    }

    const cleanNis = nis.trim();
    const cleanNama = nama.trim();
    const cleanKelas = kelas.trim();
    const cleanJurusan = (jurusan || cleanKelas.split(' ')[1] || 'TKJ').trim().toUpperCase();
    const cleanEmail = (account_email || '').trim().toLowerCase();
    const cleanPassword = (account_password || '').trim();

    if (cleanEmail && cleanPassword && cleanPassword.length < 6) {
      res.status(400).json({ error: 'Kata sandi akun siswa minimal 6 karakter.' });
      return;
    }
    if ((cleanEmail && !cleanPassword) || (!cleanEmail && cleanPassword)) {
      res.status(400).json({ error: 'Untuk membuat akun login siswa, isi Email dan Kata Sandi sekaligus.' });
      return;
    }

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      let classId: string | null = null;
      const { data: existingClass } = await dbClient
        .from('classes')
        .select('id')
        .eq('name', cleanKelas)
        .maybeSingle();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const { data: createdClass } = await dbClient
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

      let linkedUserId: string | null = null;
      if (cleanEmail && cleanPassword) {
        if (supabaseAdmin && (await hasValidServiceRoleKey())) {
          const { data: createdUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              full_name: cleanNama,
              role: 'siswa',
              nip: cleanNis,
              jabatan: `Siswa ${cleanKelas}`,
            },
          });
          if (userErr || !createdUser.user) {
            res.status(400).json({ error: translateSupabaseAuthError(userErr?.message) });
            return;
          }
          linkedUserId = createdUser.user.id;
          await dbClient.from('profiles').upsert({
            id: linkedUserId,
            email: cleanEmail,
            full_name: cleanNama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${cleanKelas}`,
            created_at: createdUser.user.created_at,
          });
        } else if (supabasePublic) {
          const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanNama,
                role: 'siswa',
                nip: cleanNis,
                jabatan: `Siswa ${cleanKelas}`,
              },
            },
          });
          if (signUpErr || !signUpData.user) {
            res.status(400).json({ error: translateSupabaseAuthError(signUpErr?.message) });
            return;
          }
          if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
            res.status(400).json({ error: 'Email siswa tersebut sudah terdaftar di Supabase Auth.' });
            return;
          }
          linkedUserId = signUpData.user.id;
          await dbClient.from('profiles').upsert({
            id: linkedUserId,
            email: cleanEmail,
            full_name: cleanNama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${cleanKelas}`,
            created_at: signUpData.user.created_at,
          });
        }
      }

      const { data, error } = await dbClient
        .from('students')
        .insert({
          nis: cleanNis,
          nama: cleanNama,
          user_id: linkedUserId,
          class_id: classId,
          kelas: cleanKelas,
          jurusan: cleanJurusan,
        })
        .select()
        .single();
      if (error) {
        if (linkedUserId && supabaseAdmin) {
          await supabaseAdmin.auth.admin.deleteUser(linkedUserId);
        }
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

    let linkedUserId: string | null = null;
    if (cleanEmail && cleanPassword) {
      if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        res.status(400).json({ error: 'Email akun siswa sudah digunakan akun lain.' });
        return;
      }
      linkedUserId = crypto.randomUUID();
      db.users.push({
        id: linkedUserId,
        email: cleanEmail,
        full_name: cleanNama,
        role: 'siswa',
        nip: cleanNis,
        jabatan: `Siswa ${cleanKelas}`,
        created_at: new Date().toISOString(),
        password_hash: hashPassword(cleanPassword),
      });
    }

    const cls = ensureLocalClassRelation(db, cleanKelas, cleanJurusan);
    const student: Student = {
      id: crypto.randomUUID(),
      nis: cleanNis,
      nama: cleanNama,
      user_id: linkedUserId,
      account_email: cleanEmail || null,
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
    const { nis, nama, kelas, jurusan, account_email, account_password } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
      account_email?: string;
      account_password?: string;
    };

    if (!nis || !nama || !kelas) {
      res.status(400).json({ error: 'NIS, Nama Siswa, dan Kelas wajib diisi.' });
      return;
    }

    const cleanNis = nis.trim();
    const cleanNama = nama.trim();
    const cleanKelas = kelas.trim();
    const cleanJurusan = (jurusan || 'TKJ').trim().toUpperCase();
    const cleanEmail = (account_email || '').trim().toLowerCase();
    const cleanPassword = (account_password || '').trim();

    if (cleanPassword && cleanPassword.length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data: currentStudent } = await dbClient
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!currentStudent) {
        res.status(404).json({ error: 'Siswa tidak ditemukan.' });
        return;
      }

      let classId: string | null = null;
      const { data: existingClass } = await dbClient
        .from('classes')
        .select('id')
        .eq('name', cleanKelas)
        .maybeSingle();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const { data: createdClass } = await dbClient
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

      let linkedUserId: string | null = currentStudent.user_id || null;
      if (linkedUserId) {
        if (cleanEmail || cleanPassword) {
          if (!(await hasValidServiceRoleKey()) || !supabaseAdmin) {
            res.status(400).json({
              error: 'Pembaruan email/kata sandi akun login siswa membutuhkan SUPABASE_SERVICE_ROLE_KEY (service_role) yang valid.',
            });
            return;
          }
          const updatePayload: {
            email?: string;
            password?: string;
            user_metadata: Record<string, string>;
          } = {
            user_metadata: {
              full_name: cleanNama,
              role: 'siswa',
              nip: cleanNis,
              jabatan: `Siswa ${cleanKelas}`,
            },
          };
          if (cleanEmail) updatePayload.email = cleanEmail;
          if (cleanPassword) updatePayload.password = cleanPassword;

          const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(linkedUserId, updatePayload);
          if (authErr) {
            res.status(400).json({ error: translateSupabaseAuthError(authErr.message) });
            return;
          }
          await dbClient
            .from('profiles')
            .update({
              ...(cleanEmail ? { email: cleanEmail } : {}),
              full_name: cleanNama,
              nip: cleanNis,
              jabatan: `Siswa ${cleanKelas}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linkedUserId);
        }
      } else if (cleanEmail && cleanPassword) {
        if ((await hasValidServiceRoleKey()) && supabaseAdmin) {
          const { data: createdUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              full_name: cleanNama,
              role: 'siswa',
              nip: cleanNis,
              jabatan: `Siswa ${cleanKelas}`,
            },
          });
          if (userErr || !createdUser.user) {
            res.status(400).json({ error: translateSupabaseAuthError(userErr?.message) });
            return;
          }
          linkedUserId = createdUser.user.id;
          await dbClient.from('profiles').upsert({
            id: linkedUserId,
            email: cleanEmail,
            full_name: cleanNama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${cleanKelas}`,
            created_at: createdUser.user.created_at,
          });
        } else if (supabasePublic) {
          const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanNama,
                role: 'siswa',
                nip: cleanNis,
                jabatan: `Siswa ${cleanKelas}`,
              },
            },
          });
          if (signUpErr || !signUpData.user) {
            res.status(400).json({ error: translateSupabaseAuthError(signUpErr?.message) });
            return;
          }
          if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
            res.status(400).json({ error: 'Email siswa tersebut sudah terdaftar di Supabase Auth.' });
            return;
          }
          linkedUserId = signUpData.user.id;
          await dbClient.from('profiles').upsert({
            id: linkedUserId,
            email: cleanEmail,
            full_name: cleanNama,
            role: 'siswa',
            nip: cleanNis,
            jabatan: `Siswa ${cleanKelas}`,
            created_at: signUpData.user.created_at,
          });
        }
      }

      const { data, error } = await dbClient
        .from('students')
        .update({
          nis: cleanNis,
          nama: cleanNama,
          user_id: linkedUserId,
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
    if (db.students.some((s) => s.id !== id && s.nis.toLowerCase() === cleanNis.toLowerCase())) {
      res.status(400).json({ error: 'NIS sudah digunakan siswa lain.' });
      return;
    }

    let linkedUserId: string | null = db.students[idx].user_id || null;
    if (linkedUserId) {
      const uIdx = db.users.findIndex((u) => u.id === linkedUserId);
      if (uIdx >= 0) {
        if (cleanEmail && db.users.some((u) => u.id !== linkedUserId && u.email.toLowerCase() === cleanEmail)) {
          res.status(400).json({ error: 'Email sudah digunakan pengguna lain.' });
          return;
        }
        db.users[uIdx] = {
          ...db.users[uIdx],
          email: cleanEmail || db.users[uIdx].email,
          full_name: cleanNama,
          nip: cleanNis,
          jabatan: `Siswa ${cleanKelas}`,
          password_hash: cleanPassword ? hashPassword(cleanPassword) : db.users[uIdx].password_hash,
        };
      }
    } else if (cleanEmail && cleanPassword) {
      if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        res.status(400).json({ error: 'Email sudah digunakan pengguna lain.' });
        return;
      }
      linkedUserId = crypto.randomUUID();
      db.users.push({
        id: linkedUserId,
        email: cleanEmail,
        full_name: cleanNama,
        role: 'siswa',
        nip: cleanNis,
        jabatan: `Siswa ${cleanKelas}`,
        created_at: new Date().toISOString(),
        password_hash: hashPassword(cleanPassword),
      });
    }

    const cls = ensureLocalClassRelation(db, cleanKelas, cleanJurusan);
    db.students[idx] = {
      ...db.students[idx],
      nis: cleanNis,
      nama: cleanNama,
      user_id: linkedUserId,
      account_email: cleanEmail || db.students[idx].account_email || null,
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
    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { error } = await dbClient.from('students').delete().eq('id', id);
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

// 10. Absensi Mandiri Siswa (khusus role 'siswa')
app.get('/api/attendance/students/self', requireAuth, requireRole(['siswa']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status } = req.query as { status?: string };
    const today = getJakartaDate();

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data: student } = await dbClient
        .from('students')
        .select('*, major:jurusan(code, name)')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!student) {
        res.json({ student: null, records: [], today });
        return;
      }

      let query = dbClient
        .from('student_attendance')
        .select('*, recorder:recorded_by(id, full_name)')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (status && status !== 'all') query = query.eq('status', status);

      const { data: records, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const mapped = (records || []).map(
        (r: StudentAttendanceRecord & { recorder?: { full_name?: string } | null }) => ({
          ...r,
          student_nis: student.nis,
          student_nama: student.nama,
          student_kelas: student.kelas,
          student_jurusan: student.jurusan,
          recorded_by_name: r.recorder?.full_name || 'Mandiri',
        })
      );

      res.json({
        student: {
          ...student,
          major_name: (student.major as { name?: string } | null)?.name || '',
        },
        records: mapped,
        today,
      });
      return;
    }

    const db = ensureDbFile();
    const majorMap = new Map(db.majors.map((m) => [m.code, m.name]));
    const userMap = new Map(db.users.map((u) => [u.id, u.full_name]));
    const student = db.students.find((s) => s.user_id === currentUser.id) || null;
    if (!student) {
      res.json({ student: null, records: [], today });
      return;
    }

    let list = db.student_attendance.filter((r) => r.student_id === student.id);
    if (status && status !== 'all') list = list.filter((r) => r.status === status);

    const mapped = [...list]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({
        ...r,
        student_nis: student.nis,
        student_nama: student.nama,
        student_kelas: student.kelas,
        student_jurusan: student.jurusan,
        recorded_by_name: r.recorded_by ? userMap.get(r.recorded_by) || 'Mandiri' : 'Sistem',
      }));

    res.json({
      student: { ...student, major_name: majorMap.get(student.jurusan) || '' },
      records: mapped,
      today,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat absensi siswa.' });
  }
});

app.post('/api/attendance/students/self', requireAuth, requireRole(['siswa']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, notes } = req.body as {
      status?: StudentAttendanceStatus;
      notes?: string;
    };

    const allowedSelfStatus: StudentAttendanceStatus[] = ['Hadir', 'Izin', 'Sakit'];
    const resolvedStatus: StudentAttendanceStatus =
      status && allowedSelfStatus.includes(status) ? status : 'Hadir';
    const today = getJakartaDate();
    const nowIso = new Date().toISOString();

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const { data: student } = await dbClient
        .from('students')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!student) {
        res.status(400).json({ error: 'Profil data siswa belum tertaut dengan akun ini. Hubungi Admin.' });
        return;
      }

      const { data: saved, error } = await dbClient
        .from('student_attendance')
        .upsert(
          {
            student_id: student.id,
            date: today,
            status: resolvedStatus,
            notes: (notes || '').trim(),
            recorded_by: currentUser.id,
            updated_at: nowIso,
          },
          { onConflict: 'student_id,date' }
        )
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.json({ record: saved });
      return;
    }

    const db = ensureDbFile();
    const student = db.students.find((s) => s.user_id === currentUser.id);
    if (!student) {
      res.status(400).json({ error: 'Profil data siswa belum tertaut dengan akun ini. Hubungi Admin.' });
      return;
    }

    const idx = db.student_attendance.findIndex((r) => r.student_id === student.id && r.date === today);
    if (idx >= 0) {
      db.student_attendance[idx] = {
        ...db.student_attendance[idx],
        status: resolvedStatus,
        notes: (notes || '').trim(),
        recorded_by: currentUser.id,
        updated_at: nowIso,
      };
      writeDbFile(db);
      res.json({ record: db.student_attendance[idx] });
      return;
    }

    const created: StudentAttendanceRecord = {
      id: crypto.randomUUID(),
      student_id: student.id,
      date: today,
      status: resolvedStatus,
      notes: (notes || '').trim(),
      recorded_by: currentUser.id,
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.student_attendance.push(created);
    writeDbFile(db);
    res.status(201).json({ record: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.' });
  }
});

// 11. Absensi Siswa & Rekap Absensi Siswa (Admin & Guru)
app.get('/api/attendance/students', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, startDate, endDate, kelas, status } = req.query as {
      date?: string;
      startDate?: string;
      endDate?: string;
      kelas?: string;
      status?: string;
    };

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      let query = dbClient
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

    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      const rows = entries.map((e) => ({
        student_id: e.student_id,
        date: targetDate,
        status: ['Hadir', 'Izin', 'Sakit', 'Alpha'].includes(e.status) ? e.status : 'Hadir',
        notes: (e.notes || '').trim(),
        recorded_by: currentUser.id,
        updated_at: nowIso,
      }));

      const { error } = await dbClient
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

// 12. User Management (Admin only - Full Sync with Supabase Auth + Hard Delete)
app.get('/api/users', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbClient = await getDbClient(req);
    if (useSupabase && dbClient) {
      if (supabaseAdmin && (await hasValidServiceRoleKey())) {
        const [{ data: authList, error: authErr }, { data: profiles }] = await Promise.all([
          supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
          dbClient.from('profiles').select('*'),
        ]);

        if (!authErr && authList) {
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
                role: metaRole && VALID_ROLES.includes(metaRole) ? metaRole : 'tenaga_kependidikan',
                nip: (au.user_metadata?.nip as string) || '',
                jabatan: (au.user_metadata?.jabatan as string) || '',
                created_at: au.created_at,
              };
              await dbClient.from('profiles').upsert(fallbackProfile);
              syncedUsers.push(fallbackProfile);
            }
          }

          res.json({ users: syncedUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)) });
          return;
        }
      }

      const { data: profiles, error } = await dbClient.from('profiles').select('*').order('full_name');
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ users: profiles || [] });
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
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const dbClient = await getDbClient(req);
    if (useSupabase && supabasePublic && dbClient) {
      if (supabaseAdmin && (await hasValidServiceRoleKey())) {
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
          res.status(400).json({ error: translateSupabaseAuthError(createError?.message) });
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
        await dbClient.from('profiles').upsert(profile);

        if (role === 'siswa' && nip?.trim()) {
          await dbClient
            .from('students')
            .update({ user_id: created.user.id })
            .ilike('nis', nip.trim());
        }

        res.status(201).json({ user: profile });
        return;
      }

      // Fallback menggunakan signUp ketika SUPABASE_SERVICE_ROLE_KEY tidak tersedia
      const { data: signUpData, error: signUpErr } = await supabasePublic.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: full_name.trim(),
            role,
            nip: (nip || '').trim(),
            jabatan: (jabatan || '').trim(),
          },
        },
      });

      if (signUpErr || !signUpData.user) {
        res.status(400).json({ error: translateSupabaseAuthError(signUpErr?.message) });
        return;
      }
      if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        res.status(400).json({ error: 'Email tersebut sudah terdaftar di Supabase Auth.' });
        return;
      }

      const profile: UserProfile = {
        id: signUpData.user.id,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role,
        nip: (nip || '').trim(),
        jabatan: (jabatan || '').trim(),
        created_at: signUpData.user.created_at,
      };
      await dbClient.from('profiles').upsert(profile);

      if (role === 'siswa' && nip?.trim()) {
        await dbClient
          .from('students')
          .update({ user_id: signUpData.user.id })
          .ilike('nis', nip.trim());
      }

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

    if (role === 'siswa' && nip?.trim()) {
      const sIdx = db.students.findIndex((s) => s.nis.toLowerCase() === nip.trim().toLowerCase());
      if (sIdx >= 0) {
        db.students[sIdx] = { ...db.students[sIdx], user_id: newUser.id, account_email: normalizedEmail };
      }
    }

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
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }
    if (password && password.length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (useSupabase && supabaseAdmin) {
      if (!(await hasValidServiceRoleKey())) {
        res.status(400).json({
          error:
            'Sinkronisasi edit user dengan Supabase Auth membutuhkan SUPABASE_SERVICE_ROLE_KEY (service_role) yang valid pada Secrets.',
        });
        return;
      }
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
        res.status(400).json({ error: translateSupabaseAuthError(authErr.message) });
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
      if (!(await hasValidServiceRoleKey())) {
        res.status(400).json({
          error:
            'Hard delete hingga Supabase Authentication membutuhkan SUPABASE_SERVICE_ROLE_KEY (service_role) yang valid pada Secrets.',
        });
        return;
      }
      await supabaseAdmin.from('students').update({ user_id: null }).eq('user_id', id);
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authDeleteErr) {
        res.status(400).json({ error: translateSupabaseAuthError(authDeleteErr.message) });
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
    db.students = db.students.map((s) =>
      s.user_id === id ? { ...s, user_id: null, account_email: null } : s
    );
    db.employee_attendance = db.employee_attendance.filter((a) => a.user_id !== id);
    writeDbFile(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus user.' });
  }
});

// JSON 404 untuk endpoint /api/* yang tidak terdaftar
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

export { app, PORT, isProduction, useSupabase };
export default app;

