export type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan' | 'siswa';

export type EmployeeAttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar';
export type StudentAttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  nip: string;
  jabatan: string;
  created_at: string;
}

export interface Major {
  code: string;
  name: string;
  cluster: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade_level: 'X' | 'XI' | 'XII';
  major_code: string;
  homeroom_teacher_id: string | null;
  homeroom_teacher_name?: string;
  major_name?: string;
}

export interface Student {
  id: string;
  nis: string;
  nama: string;
  user_id?: string | null;
  account_email?: string | null;
  class_id?: string | null;
  kelas: string;
  jurusan: string;
  major_name?: string;
  created_at: string;
}

export interface EmployeeAttendanceRecord {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: UserRole;
  user_nip?: string;
  user_jabatan?: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: EmployeeAttendanceStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface StudentAttendanceRecord {
  id: string;
  student_id: string;
  student_nis?: string;
  student_nama?: string;
  student_kelas?: string;
  student_jurusan?: string;
  date: string;
  status: StudentAttendanceStatus;
  notes: string;
  recorded_by: string | null;
  recorded_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthStatusResponse {
  backendMode: 'supabase' | 'local';
  hasUsers: boolean;
  userCount: number;
}

export interface DashboardSummary {
  today: string;
  myAttendanceToday: EmployeeAttendanceRecord | null;
  myStudentProfile?: Student | null;
  myStudentAttendanceToday?: StudentAttendanceRecord | null;
  totalEmployees: number;
  employeesPresentToday: number;
  employeesOnLeaveToday: number;
  totalStudents: number;
  studentsMarkedToday: number;
  studentStatusCountsToday: {
    Hadir: number;
    Izin: number;
    Sakit: number;
    Alpha: number;
  };
  recentEmployeeLogs: EmployeeAttendanceRecord[];
  recentStudentLogs: StudentAttendanceRecord[];
}
