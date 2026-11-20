import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthedSupabaseClient, supabaseClient } from './supabase';
import type {
  EmployeeAttendanceRecord,
  EmployeeAttendanceStatus,
  Student,
  StudentAttendanceRecord,
  StudentAttendanceStatus,
  UserProfile,
  UserRole,
} from '../types';

const VALID_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan', 'siswa'];
const EMPLOYEE_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan'];

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

function parseGradeLevel(kelas: string): 'X' | 'XI' | 'XII' {
  const upper = kelas.trim().toUpperCase();
  if (upper.startsWith('XII')) return 'XII';
  if (upper.startsWith('XI')) return 'XI';
  return 'X';
}

function translateAuthError(message?: string): string {
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

async function resolveUserProfile(token: string): Promise<UserProfile | null> {
  if (!supabaseClient || !token) return null;
  const { data: userData, error } = await supabaseClient.auth.getUser(token);
  if (error || !userData.user) return null;

  const authUser = userData.user;
  const dbClient = createAuthedSupabaseClient(token);
  if (!dbClient) return null;

  const { data: existing } = await dbClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      full_name: existing.full_name,
      role: existing.role as UserRole,
      nip: existing.nip || '',
      jabatan: existing.jabatan || '',
      created_at: existing.created_at,
    };
  }

  const metaRole = authUser.user_metadata?.role as UserRole | undefined;
  return {
    id: authUser.id,
    email: authUser.email || '',
    full_name: (authUser.user_metadata?.full_name as string) || authUser.email?.split('@')[0] || 'Pengguna',
    role: metaRole && VALID_ROLES.includes(metaRole) ? metaRole : 'tenaga_kependidikan',
    nip: (authUser.user_metadata?.nip as string) || '',
    jabatan: (authUser.user_metadata?.jabatan as string) || '',
    created_at: authUser.created_at,
  };
}

function requireTokenAndClient(token: string | null): { token: string; dbClient: SupabaseClient } {
  if (!token) {
    throw new Error('Sesi tidak ditemukan. Silakan login terlebih dahulu.');
  }
  const dbClient = createAuthedSupabaseClient(token);
  if (!dbClient) {
    throw new Error('Konfigurasi Supabase client tidak tersedia.');
  }
  return { token, dbClient };
}

export async function executeSupabaseFallback(
  rawPath: string,
  options: RequestInit,
  token: string | null
): Promise<unknown> {
  if (!supabaseClient) {
    throw new Error('Konfigurasi Supabase belum tersedia di browser.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const parsedUrl = new URL(rawPath, 'https://local.invalid');
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;
  const body =
    typeof options.body === 'string' && options.body
      ? (JSON.parse(options.body) as Record<string, unknown>)
      : {};

  // 1. GET /api/auth/status
  if (pathname === '/api/auth/status' && method === 'GET') {
    const { data, error } = await supabaseClient.rpc('get_auth_bootstrap_status');
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      const count = Number((row as { user_count?: number } | null)?.user_count || 0);
      const hasUsers = Boolean((row as { has_users?: boolean } | null)?.has_users || count > 0);
      return { backendMode: 'supabase', hasUsers, userCount: count };
    }
    const { count, error: countErr } = await supabaseClient
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    if (!countErr) {
      const total = count || 0;
      return { backendMode: 'supabase', hasUsers: total > 0, userCount: total };
    }
    return { backendMode: 'supabase', hasUsers: false, userCount: 0 };
  }

  // 2. POST /api/auth/register-first
  if (pathname === '/api/auth/register-first' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const full_name = String(body.full_name || '').trim();
    const nip = String(body.nip || '').trim();
    const jabatan = String(body.jabatan || 'Administrator Sistem').trim();

    if (!email || !password || !full_name) {
      throw new Error('Nama lengkap, email, dan kata sandi wajib diisi.');
    }
    if (password.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter.');
    }

    const { data: rpcStatus } = await supabaseClient.rpc('get_auth_bootstrap_status');
    const row = Array.isArray(rpcStatus) ? rpcStatus[0] : rpcStatus;
    if ((row as { has_users?: boolean } | null)?.has_users) {
      throw new Error('Akun admin sudah tersedia. Hubungi admin untuk pembuatan akun baru.');
    }

    const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, role: 'admin', nip, jabatan },
      },
    });
    if (signUpErr || !signUpData.user) {
      throw new Error(translateAuthError(signUpErr?.message));
    }
    if (!signUpData.session) {
      throw new Error(
        'Akun berhasil dibuat, namun Supabase meminta konfirmasi email. Nonaktifkan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email lalu login.'
      );
    }

    const profile = await resolveUserProfile(signUpData.session.access_token);
    return {
      token: signUpData.session.access_token,
      user: profile || {
        id: signUpData.user.id,
        email,
        full_name,
        role: 'admin',
        nip,
        jabatan,
        created_at: signUpData.user.created_at,
      },
    };
  }

  // 3. POST /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const rawIdentifier = String(body.identifier || body.email || '').trim();
    const password = String(body.password || '');
    if (!rawIdentifier || !password) {
      throw new Error('Email / NIS dan kata sandi wajib diisi.');
    }

    let resolvedEmail = rawIdentifier.toLowerCase();
    if (!rawIdentifier.includes('@')) {
      const { data: rpcRows } = await supabaseClient.rpc('resolve_student_login_email', {
        p_nis: rawIdentifier,
      });
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row || !(row as { student_id?: string }).student_id) {
        throw new Error('NIS tidak ditemukan dalam data siswa.');
      }
      const linkedUserId = (row as { user_id?: string }).user_id;
      const linkedEmail = (row as { email?: string }).email;
      if (!linkedUserId || !linkedEmail) {
        throw new Error(
          'Akun login siswa untuk NIS ini belum aktif. Gunakan tab Aktivasi Akun Siswa atau hubungi Admin.'
        );
      }
      resolvedEmail = linkedEmail.toLowerCase();
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new Error(translateAuthError(error?.message));
    }

    const user = await resolveUserProfile(data.session.access_token);
    if (!user) {
      throw new Error('Profil pengguna tidak ditemukan.');
    }
    return { token: data.session.access_token, user };
  }

  // 4. POST /api/auth/activate-student
  if (pathname === '/api/auth/activate-student' && method === 'POST') {
    const cleanNis = String(body.nis || '').trim();
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!cleanNis || !normalizedEmail || !password) {
      throw new Error('NIS, email, dan kata sandi wajib diisi.');
    }
    if (password.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter.');
    }

    const { data: rpcRows } = await supabaseClient.rpc('resolve_student_login_email', {
      p_nis: cleanNis,
    });
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row || !(row as { student_id?: string }).student_id) {
      throw new Error('NIS tidak ditemukan. Pastikan Admin telah mendaftarkan data Anda di Data Siswa.');
    }
    if ((row as { user_id?: string | null }).user_id) {
      throw new Error('Akun siswa untuk NIS ini sudah aktif. Silakan masuk menggunakan tab Masuk Portal.');
    }

    const nama = (row as { nama?: string }).nama || 'Siswa';
    const kelas = (row as { kelas?: string }).kelas || '';

    const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: nama,
          role: 'siswa',
          nip: cleanNis,
          jabatan: `Siswa ${kelas}`,
        },
      },
    });
    if (signUpErr || !signUpData.user) {
      throw new Error(translateAuthError(signUpErr?.message));
    }
    if (!signUpData.session) {
      throw new Error(
        'Akun siswa dibuat, silakan nonaktifkan "Confirm email" di Supabase Dashboard -> Authentication -> Providers -> Email.'
      );
    }

    const userClient = createAuthedSupabaseClient(signUpData.session.access_token);
    if (userClient) {
      await userClient.rpc('activate_student_link', { p_nis: cleanNis });
    }
    const profile = await resolveUserProfile(signUpData.session.access_token);
    return {
      token: signUpData.session.access_token,
      user: profile || {
        id: signUpData.user.id,
        email: normalizedEmail,
        full_name: nama,
        role: 'siswa',
        nip: cleanNis,
        jabatan: `Siswa ${kelas}`,
        created_at: signUpData.user.created_at,
      },
    };
  }

  // Authenticated routes below
  const { token: activeToken, dbClient } = requireTokenAndClient(token);
  const currentUser = await resolveUserProfile(activeToken);
  if (!currentUser) {
    throw new Error('Sesi tidak valid atau telah kedaluwarsa.');
  }

  // 5. GET /api/auth/me
  if (pathname === '/api/auth/me' && method === 'GET') {
    return { user: currentUser };
  }

  // 6. GET /api/majors
  if (pathname === '/api/majors' && method === 'GET') {
    const { data, error } = await dbClient.from('majors').select('*').order('code');
    if (error) throw new Error(error.message);
    return { majors: data || [] };
  }

  // 7. GET /api/classes
  if (pathname === '/api/classes' && method === 'GET') {
    const { data, error } = await dbClient
      .from('classes')
      .select('*, major:major_code(code, name, cluster), homeroom:homeroom_teacher_id(id, full_name)')
      .order('name');
    if (error) throw new Error(error.message);
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
    return { classes: mapped };
  }

  // 8. GET /api/dashboard/summary
  if (pathname === '/api/dashboard/summary' && method === 'GET') {
    const today = getJakartaDate();

    if (currentUser.role === 'siswa') {
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
      return {
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
      };
    }

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

    return {
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
    };
  }

  // 9. GET /api/attendance/employees
  if (pathname === '/api/attendance/employees' && method === 'GET') {
    const startDate = query.get('startDate');
    const endDate = query.get('endDate');
    const status = query.get('status');
    const scope = query.get('scope');
    const onlySelf = currentUser.role !== 'admin' || scope === 'self';

    let q = dbClient
      .from('employee_attendance')
      .select('*, profile:user_id(id, full_name, email, role, nip, jabatan)')
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false });

    if (onlySelf) q = q.eq('user_id', currentUser.id);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data: records, error } = await q;
    if (error) throw new Error(error.message);

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

    return { records: enriched, today: getJakartaDate() };
  }

  // 10. POST /api/attendance/employees/check-in
  if (pathname === '/api/attendance/employees/check-in' && method === 'POST') {
    const rawStatus = body.status as EmployeeAttendanceStatus | undefined;
    const resolvedStatus: EmployeeAttendanceStatus =
      rawStatus && ['Hadir', 'Izin', 'Sakit', 'Dinas Luar'].includes(rawStatus) ? rawStatus : 'Hadir';
    const notes = String(body.notes || '').trim();
    const today = getJakartaDate();
    const nowTime = getJakartaTime();
    const nowIso = new Date().toISOString();

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
          notes,
          check_in: existing.check_in || (resolvedStatus === 'Hadir' ? nowTime : null),
          updated_at: nowIso,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { record: updated };
    }

    const { data: inserted, error } = await dbClient
      .from('employee_attendance')
      .insert({
        user_id: currentUser.id,
        date: today,
        check_in: resolvedStatus === 'Hadir' ? nowTime : null,
        check_out: null,
        status: resolvedStatus,
        notes,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { record: inserted };
  }

  // 11. POST /api/attendance/employees/check-out
  if (pathname === '/api/attendance/employees/check-out' && method === 'POST') {
    const today = getJakartaDate();
    const nowTime = getJakartaTime();
    const nowIso = new Date().toISOString();

    const { data: existing } = await dbClient
      .from('employee_attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', today)
      .maybeSingle();

    if (!existing) {
      throw new Error('Anda belum melakukan absen masuk hari ini.');
    }

    const { data: updated, error } = await dbClient
      .from('employee_attendance')
      .update({ check_out: nowTime, updated_at: nowIso })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { record: updated };
  }

  // 12. Students CRUD
  if (pathname === '/api/students' && method === 'GET') {
    const { data, error } = await dbClient
      .from('students')
      .select('*, major:jurusan(code, name), profile:user_id(id, email)')
      .order('kelas', { ascending: true })
      .order('nama', { ascending: true });
    if (error) throw new Error(error.message);

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
    return { students: mapped };
  }

  if (pathname === '/api/students' && method === 'POST') {
    const cleanNis = String(body.nis || '').trim();
    const cleanNama = String(body.nama || '').trim();
    const cleanKelas = String(body.kelas || '').trim();
    const cleanJurusan = String(body.jurusan || cleanKelas.split(' ')[1] || 'TKJ')
      .trim()
      .toUpperCase();
    const cleanEmail = String(body.account_email || '').trim();
    const cleanPassword = String(body.account_password || '').trim();

    if (!cleanNis || !cleanNama || !cleanKelas) {
      throw new Error('NIS, Nama Siswa, dan Kelas wajib diisi.');
    }
    if (cleanEmail || cleanPassword) {
      throw new Error(
        'Pembuatan akun login siswa langsung oleh Admin memerlukan backend API dengan SUPABASE_SERVICE_ROLE_KEY. Kosongkan Email/Kata Sandi saat menambah siswa, lalu siswa bisa aktivasi mandiri di halaman Login -> Aktivasi Akun Siswa.'
      );
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

    const { data, error } = await dbClient
      .from('students')
      .insert({
        nis: cleanNis,
        nama: cleanNama,
        user_id: null,
        class_id: classId,
        kelas: cleanKelas,
        jurusan: cleanJurusan,
      })
      .select()
      .single();
    if (error) {
      throw new Error(error.message.includes('duplicate') ? 'NIS sudah terdaftar.' : error.message);
    }
    return { student: data };
  }

  if (pathname.startsWith('/api/students/') && method === 'PATCH') {
    const id = pathname.slice('/api/students/'.length);
    const cleanNis = String(body.nis || '').trim();
    const cleanNama = String(body.nama || '').trim();
    const cleanKelas = String(body.kelas || '').trim();
    const cleanJurusan = String(body.jurusan || 'TKJ').trim().toUpperCase();
    const cleanEmail = String(body.account_email || '').trim();
    const cleanPassword = String(body.account_password || '').trim();

    if (!cleanNis || !cleanNama || !cleanKelas) {
      throw new Error('NIS, Nama Siswa, dan Kelas wajib diisi.');
    }
    if (cleanEmail || cleanPassword) {
      throw new Error(
        'Pembaruan akun login siswa langsung oleh Admin membutuhkan backend API dengan SUPABASE_SERVICE_ROLE_KEY.'
      );
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

    const { data, error } = await dbClient
      .from('students')
      .update({
        nis: cleanNis,
        nama: cleanNama,
        class_id: classId,
        kelas: cleanKelas,
        jurusan: cleanJurusan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { student: data };
  }

  if (pathname.startsWith('/api/students/') && method === 'DELETE') {
    const id = pathname.slice('/api/students/'.length);
    const { error } = await dbClient.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // 13. Student Self Attendance
  if (pathname === '/api/attendance/students/self' && method === 'GET') {
    const status = query.get('status');
    const today = getJakartaDate();

    const { data: student } = await dbClient
      .from('students')
      .select('*, major:jurusan(code, name)')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!student) {
      return { student: null, records: [], today };
    }

    let q = dbClient
      .from('student_attendance')
      .select('*, recorder:recorded_by(id, full_name)')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    if (status && status !== 'all') q = q.eq('status', status);

    const { data: records, error } = await q;
    if (error) throw new Error(error.message);

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

    return {
      student: {
        ...student,
        major_name: (student.major as { name?: string } | null)?.name || '',
      },
      records: mapped,
      today,
    };
  }

  if (pathname === '/api/attendance/students/self' && method === 'POST') {
    const rawStatus = body.status as StudentAttendanceStatus | undefined;
    const resolvedStatus: StudentAttendanceStatus =
      rawStatus && ['Hadir', 'Izin', 'Sakit'].includes(rawStatus) ? rawStatus : 'Hadir';
    const notes = String(body.notes || '').trim();
    const today = getJakartaDate();
    const nowIso = new Date().toISOString();

    const { data: student } = await dbClient
      .from('students')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!student) {
      throw new Error('Profil data siswa belum tertaut dengan akun ini. Hubungi Admin.');
    }

    const { data: saved, error } = await dbClient
      .from('student_attendance')
      .upsert(
        {
          student_id: student.id,
          date: today,
          status: resolvedStatus,
          notes,
          recorded_by: currentUser.id,
          updated_at: nowIso,
        },
        { onConflict: 'student_id,date' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { record: saved };
  }

  // 14. Student Attendance (Admin / Guru)
  if (pathname === '/api/attendance/students' && method === 'GET') {
    const date = query.get('date');
    const startDate = query.get('startDate');
    const endDate = query.get('endDate');
    const kelas = query.get('kelas');
    const status = query.get('status');

    let q = dbClient
      .from('student_attendance')
      .select('*, student:student_id(id, nis, nama, kelas, jurusan), recorder:recorded_by(id, full_name)')
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false });

    if (date) q = q.eq('date', date);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data: records, error } = await q;
    if (error) throw new Error(error.message);

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
    return { records: enriched, today: getJakartaDate() };
  }

  if (pathname === '/api/attendance/students/batch' && method === 'POST') {
    const targetDate = String(body.date || getJakartaDate());
    const entries = body.entries as
      | Array<{ student_id: string; status: StudentAttendanceStatus; notes?: string }>
      | undefined;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      throw new Error('Daftar absensi siswa tidak boleh kosong.');
    }

    const nowIso = new Date().toISOString();
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
    if (error) throw new Error(error.message);
    return { success: true, count: rows.length, date: targetDate };
  }

  // 15. Users Management
  if (pathname === '/api/users' && method === 'GET') {
    const { data, error } = await dbClient.from('profiles').select('*').order('full_name');
    if (error) throw new Error(error.message);
    return { users: data || [] };
  }

  if (pathname.startsWith('/api/users')) {
    throw new Error(
      'Operasi tambah/edit/hard-delete user membutuhkan API backend aktif dengan SUPABASE_SERVICE_ROLE_KEY di Environment Variables Vercel.'
    );
  }

  throw new Error(`Endpoint ${pathname} tidak tersedia.`);
}
