import { AlertCircle, Briefcase, CheckCircle2, Clock, FileText, HeartPulse, XCircle } from 'lucide-react';

interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  switch (status) {
    case 'Hadir':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          <span>Hadir</span>
        </span>
      );
    case 'Izin':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300 whitespace-nowrap">
          <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>Izin</span>
        </span>
      );
    case 'Sakit':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 border border-sky-200 whitespace-nowrap">
          <HeartPulse className="h-3.5 w-3.5 text-sky-700 shrink-0" />
          <span>Sakit</span>
        </span>
      );
    case 'Dinas Luar':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100/70 px-2.5 py-1 text-xs font-semibold text-amber-950 border border-amber-300 whitespace-nowrap">
          <Briefcase className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>Dinas Luar</span>
        </span>
      );
    case 'Alpha':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-700 shrink-0" />
          <span>Alpha</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">
          {status === 'Belum Absen' ? (
            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          )}
          <span>{status}</span>
        </span>
      );
  }
}
