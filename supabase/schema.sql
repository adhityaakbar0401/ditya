-- ============================================================================
-- SMK PRIMA UNGGUL - RELATIONAL SUPABASE POSTGRESQL SCHEMA
-- ============================================================================
-- Struktur relasional penuh yang terhubung langsung dengan Supabase Auth:
--   auth.users (1) <---> (1) public.profiles (admin, guru, tenaga_kependidikan, siswa)
--   public.profiles (1) <--- (1) public.students (user_id)
--   public.profiles (1) <--- (N) public.employee_attendance
--   public.profiles (1) <--- (N) public.student_attendance (recorded_by)
--   public.profiles (1) <--- (N) public.classes (homeroom_teacher_id)
--   public.majors (1) <--- (N) public.classes
--   public.majors (1) <--- (N) public.students
--   public.classes (1) <--- (N) public.students
--   public.students (1) <--- (N) public.student_attendance
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel Profiles (Relasi 1:1 dengan Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa')),
  nip TEXT NOT NULL DEFAULT '',
  jabatan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jika tabel sudah pernah dibuat sebelumnya, pastikan constraint role mencakup 'siswa'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa'));

-- Trigger: User pertama di auth.users otomatis mendapatkan role 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
  assigned_role TEXT;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.profiles;

  IF existing_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', ''),
      'tenaga_kependidikan'
    );
    IF assigned_role NOT IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa') THEN
      assigned_role := 'tenaga_kependidikan';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, nip, jabatan)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'nip', ''),
    COALESCE(NEW.raw_user_meta_data->>'jabatan', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    nip = EXCLUDED.nip,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger sinkronisasi saat email/metadata user diupdate di auth.users
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = COALESCE(NEW.email, email),
    full_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), full_name),
    role = CASE
      WHEN (NEW.raw_user_meta_data->>'role') IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa')
      THEN (NEW.raw_user_meta_data->>'role')
      ELSE role
    END,
    nip = COALESCE(NEW.raw_user_meta_data->>'nip', nip),
    jabatan = COALESCE(NEW.raw_user_meta_data->>'jabatan', jabatan),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();

-- ----------------------------------------------------------------------------
-- 2. Tabel Master Jurusan / Program Keahlian (majors)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.majors (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cluster TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.majors (code, name, cluster) VALUES
  ('TKJ', 'Teknik Komputer dan Jaringan', 'Teknologi Informasi & Penyiaran'),
  ('BC', 'Broadcasting', 'Teknologi Informasi & Penyiaran'),
  ('DKV', 'Desain Komunikasi Visual', 'Desain & Komunikasi Kreatif'),
  ('AK', 'Akuntansi', 'Bisnis, Keuangan & Manajemen'),
  ('MPLB', 'Manajemen Perkantoran dan Layanan Bisnis', 'Bisnis, Keuangan & Manajemen'),
  ('BD', 'Bisnis Digital', 'Bisnis, Keuangan & Manajemen')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  cluster = EXCLUDED.cluster;

-- ----------------------------------------------------------------------------
-- 3. Tabel Master Kelas (classes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  grade_level TEXT NOT NULL DEFAULT 'X' CHECK (grade_level IN ('X', 'XI', 'XII')),
  major_code TEXT NOT NULL REFERENCES public.majors(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  homeroom_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Tabel Data Siswa (students) - Berelasi ke classes, majors & profiles (user_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  kelas TEXT NOT NULL,
  jurusan TEXT NOT NULL DEFAULT 'TKJ' REFERENCES public.majors(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Trigger otomatis membuat/menghubungkan relasi class_id saat siswa ditambah/diubah
CREATE OR REPLACE FUNCTION public.sync_student_class_relation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id UUID;
  v_grade TEXT;
BEGIN
  v_grade := CASE
    WHEN NEW.kelas ILIKE 'XII%' THEN 'XII'
    WHEN NEW.kelas ILIKE 'XI%' THEN 'XI'
    ELSE 'X'
  END;

  IF NEW.class_id IS NULL AND NEW.kelas IS NOT NULL AND length(trim(NEW.kelas)) > 0 THEN
    INSERT INTO public.classes (name, grade_level, major_code)
    VALUES (trim(NEW.kelas), v_grade, COALESCE(NULLIF(NEW.jurusan, ''), 'TKJ'))
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO v_class_id FROM public.classes WHERE name = trim(NEW.kelas) LIMIT 1;
    NEW.class_id := v_class_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_class ON public.students;
CREATE TRIGGER trg_sync_student_class
  BEFORE INSERT OR UPDATE OF kelas, jurusan ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_class_relation();

-- ----------------------------------------------------------------------------
-- 5. Tabel Absensi Karyawan (employee_attendance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Dinas Luar')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ----------------------------------------------------------------------------
-- 6. Tabel Absensi Siswa (student_attendance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpha')),
  notes TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, date)
);

-- ----------------------------------------------------------------------------
-- 7. Indexes untuk Performa Query Relasional
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_major_code ON public.classes(major_code);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_jurusan ON public.students(jurusan);
CREATE INDEX IF NOT EXISTS idx_emp_att_date ON public.employee_attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_emp_att_user_date ON public.employee_attendance(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_stu_att_date ON public.student_attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_stu_att_student_date ON public.student_attendance(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_stu_att_recorded_by ON public.student_attendance(recorded_by);

-- ----------------------------------------------------------------------------
-- 8. Views Relasional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_employee_attendance_detail AS
SELECT
  ea.id,
  ea.user_id,
  p.full_name AS user_name,
  p.email AS user_email,
  p.role AS user_role,
  p.nip AS user_nip,
  p.jabatan AS user_jabatan,
  ea.date,
  ea.check_in,
  ea.check_out,
  ea.status,
  ea.notes,
  ea.created_at,
  ea.updated_at
FROM public.employee_attendance ea
JOIN public.profiles p ON p.id = ea.user_id;

CREATE OR REPLACE VIEW public.v_student_attendance_detail AS
SELECT
  sa.id,
  sa.student_id,
  s.nis AS student_nis,
  s.nama AS student_nama,
  s.kelas AS student_kelas,
  s.jurusan AS student_jurusan,
  m.name AS major_name,
  sa.date,
  sa.status,
  sa.notes,
  sa.recorded_by,
  rec.full_name AS recorded_by_name,
  sa.created_at,
  sa.updated_at
FROM public.student_attendance sa
JOIN public.students s ON s.id = sa.student_id
LEFT JOIN public.majors m ON m.code = s.jurusan
LEFT JOIN public.profiles rec ON rec.id = sa.recorded_by;

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Policies: profiles
DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;
CREATE POLICY "Users can view own profile or admin views all"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;
CREATE POLICY "Admin can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Policies: majors & classes
DROP POLICY IF EXISTS "Authenticated users can read majors" ON public.majors;
CREATE POLICY "Authenticated users can read majors"
  ON public.majors FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin can manage majors" ON public.majors;
CREATE POLICY "Admin can manage majors"
  ON public.majors FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin and Guru can read classes" ON public.classes;
CREATE POLICY "Admin and Guru can read classes"
  ON public.classes FOR SELECT
  USING (public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "Admin can manage classes" ON public.classes;
CREATE POLICY "Admin can manage classes"
  ON public.classes FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Policies: students
DROP POLICY IF EXISTS "Admin and Guru can read students" ON public.students;
DROP POLICY IF EXISTS "Admin, Guru, and own Student can read students" ON public.students;
CREATE POLICY "Admin, Guru, and own Student can read students"
  ON public.students FOR SELECT
  USING (public.current_user_role() IN ('admin', 'guru') OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage students" ON public.students;
CREATE POLICY "Admin can manage students"
  ON public.students FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Policies: employee_attendance
DROP POLICY IF EXISTS "Employees read own attendance or admin reads all" ON public.employee_attendance;
CREATE POLICY "Employees read own attendance or admin reads all"
  ON public.employee_attendance FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Employees insert own attendance" ON public.employee_attendance;
CREATE POLICY "Employees insert own attendance"
  ON public.employee_attendance FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Employees update own attendance" ON public.employee_attendance;
CREATE POLICY "Employees update own attendance"
  ON public.employee_attendance FOR UPDATE
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

-- Policies: student_attendance
DROP POLICY IF EXISTS "Admin and Guru manage student attendance" ON public.student_attendance;
CREATE POLICY "Admin and Guru manage student attendance"
  ON public.student_attendance FOR ALL
  USING (public.current_user_role() IN ('admin', 'guru'))
  WITH CHECK (public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "Students read own attendance" ON public.student_attendance;
CREATE POLICY "Students read own attendance"
  ON public.student_attendance FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Students insert own attendance" ON public.student_attendance;
CREATE POLICY "Students insert own attendance"
  ON public.student_attendance FOR INSERT
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Students update own attendance" ON public.student_attendance;
CREATE POLICY "Students update own attendance"
  ON public.student_attendance FOR UPDATE
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- Helper RPC untuk login siswa menggunakan NIS
CREATE OR REPLACE FUNCTION public.resolve_student_login_email(p_nis TEXT)
RETURNS TABLE(student_id UUID, user_id UUID, email TEXT, nama TEXT, kelas TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id AS student_id, s.user_id, p.email, s.nama, s.kelas
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE lower(s.nis) = lower(trim(p_nis))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_student_login_email(TEXT) TO anon, authenticated;

-- Helper RPC untuk menautkan akun auth siswa yang baru diaktifkan ke data siswa berdasarkan NIS
CREATE OR REPLACE FUNCTION public.activate_student_link(p_nis TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user auth.users%ROWTYPE;
  v_updated INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    SELECT * INTO v_user FROM auth.users WHERE id = v_uid;
    IF FOUND THEN
      INSERT INTO public.profiles (id, email, full_name, role, nip, jabatan)
      VALUES (
        v_user.id,
        COALESCE(v_user.email, ''),
        COALESCE(NULLIF(v_user.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(v_user.email, 'Siswa'), '@', 1)),
        'siswa',
        COALESCE(v_user.raw_user_meta_data->>'nip', trim(p_nis)),
        COALESCE(v_user.raw_user_meta_data->>'jabatan', 'Siswa')
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.students
  SET user_id = v_uid,
      updated_at = NOW()
  WHERE lower(nis) = lower(trim(p_nis))
    AND user_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_student_link(TEXT) TO authenticated;

-- Helper RPC untuk mengecek apakah sudah ada user terdaftar (memeriksa profiles maupun auth.users)
CREATE OR REPLACE FUNCTION public.get_auth_bootstrap_status()
RETURNS TABLE(has_users BOOLEAN, user_count INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH counts AS (
    SELECT
      (SELECT COUNT(*)::INT FROM public.profiles) AS profile_count,
      (SELECT COUNT(*)::INT FROM auth.users) AS auth_count
  )
  SELECT
    (profile_count > 0 OR auth_count > 0) AS has_users,
    GREATEST(profile_count, auth_count) AS user_count
  FROM counts;
$$;
GRANT EXECUTE ON FUNCTION public.get_auth_bootstrap_status() TO anon, authenticated;

-- Helper RPC untuk sinkronisasi otomatis profil user yang sedang login (termasuk jika user dibuat sebelum schema.sql dijalankan)
CREATE OR REPLACE FUNCTION public.sync_my_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user auth.users%ROWTYPE;
  v_existing public.profiles%ROWTYPE;
  v_count INT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_existing FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(NULLIF(v_user.raw_user_meta_data->>'role', ''), 'tenaga_kependidikan');
    IF v_role NOT IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa') THEN
      v_role := 'tenaga_kependidikan';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, nip, jabatan)
  VALUES (
    v_user.id,
    COALESCE(v_user.email, ''),
    COALESCE(NULLIF(v_user.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(v_user.email, 'User'), '@', 1)),
    v_role,
    COALESCE(v_user.raw_user_meta_data->>'nip', ''),
    COALESCE(v_user.raw_user_meta_data->>'jabatan', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING * INTO v_existing;

  RETURN NEXT v_existing;
  RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_my_profile() TO authenticated;

-- Backfill user yang sudah ada di auth.users sebelum trigger dibuat (user paling awal otomatis menjadi admin jika belum ada admin)
INSERT INTO public.profiles (id, email, full_name, role, nip, jabatan)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(u.email, 'User'), '@', 1)),
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin')
      AND u.id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
    THEN 'admin'
    WHEN (u.raw_user_meta_data->>'role') IN ('admin', 'guru', 'tenaga_kependidikan', 'siswa')
    THEN (u.raw_user_meta_data->>'role')
    ELSE 'tenaga_kependidikan'
  END,
  COALESCE(u.raw_user_meta_data->>'nip', ''),
  COALESCE(u.raw_user_meta_data->>'jabatan', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);




