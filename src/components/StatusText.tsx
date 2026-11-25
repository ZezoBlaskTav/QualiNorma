import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  FileEdit,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  PAC_SEVERITY_LABELS,
  PAC_STATUS_LABELS,
  PacSeverity,
  PacStatus,
  POP_STATUS_LABELS,
  PopStatus,
  ROLE_LABELS,
  UserRole,
} from '../types/compliance';

export function PopStatusDisplay({ status }: { status: PopStatus }) {
  const config: Record<PopStatus, { icon: typeof CheckCircle2; color: string }> = {
    vigente: { icon: CheckCircle2, color: 'text-emerald-700' },
    aguardando_aprovacao: { icon: ShieldCheck, color: 'text-blue-700' },
    em_revisao: { icon: Clock, color: 'text-amber-700' },
    rascunho: { icon: FileEdit, color: 'text-slate-600' },
    obsoleto: { icon: Archive, color: 'text-rose-700' },
  };
  const { icon: Icon, color } = config[status] || config.rascunho;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{POP_STATUS_LABELS[status] || status}</span>
    </span>
  );
}

export function PacStatusDisplay({ status }: { status: PacStatus }) {
  const config: Record<PacStatus, { icon: typeof CheckCircle2; color: string }> = {
    concluido: { icon: CheckCircle2, color: 'text-emerald-700' },
    aguardando_verificacao: { icon: ShieldCheck, color: 'text-blue-700' },
    em_execucao: { icon: PlayCircle, color: 'text-amber-700' },
    aberto: { icon: Clock, color: 'text-slate-600' },
    cancelado: { icon: XCircle, color: 'text-rose-700' },
  };
  const { icon: Icon, color } = config[status] || config.aberto;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{PAC_STATUS_LABELS[status] || status}</span>
    </span>
  );
}

export function PacSeverityDisplay({ severity }: { severity: PacSeverity }) {
  const config: Record<PacSeverity, { icon: typeof AlertCircle; color: string }> = {
    critica: { icon: ShieldAlert, color: 'text-rose-700 font-semibold' },
    alta: { icon: AlertCircle, color: 'text-amber-700 font-medium' },
    media: { icon: AlertCircle, color: 'text-slate-700' },
    baixa: { icon: AlertCircle, color: 'text-slate-500' },
  };
  const { icon: Icon, color } = config[severity] || config.media;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{PAC_SEVERITY_LABELS[severity] || severity}</span>
    </span>
  );
}

export function RoleDisplay({ role }: { role: UserRole }) {
  const colorMap: Record<UserRole, string> = {
    admin: 'text-slate-900 font-semibold',
    aprovador: 'text-blue-700 font-medium',
    editor: 'text-emerald-700 font-medium',
    leitor: 'text-slate-600',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${colorMap[role]}`}>
      <UserCheck className="w-3.5 h-3.5 shrink-0" />
      <span>{ROLE_LABELS[role] || role}</span>
    </span>
  );
}
