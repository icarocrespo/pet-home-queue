export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type VisitStatus = 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';
export type QueueRow = {
  id: string;
  public_label: string;
  priority: Priority;
  status: VisitStatus;
  arrived_at: string;
};
export type StaffVisit = QueueRow & {
  patient_id: string;
  patients: { name: string; species: string; tutor_name: string | null } | null;
};
export const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
export const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'URGENTE', HIGH: 'ALTA', MEDIUM: 'MÉDIA', LOW: 'BAIXA'
};
export const STATUS_LABELS: Record<VisitStatus, string> = {
  WAITING: 'Em espera', CALLED: 'Chamado', IN_SERVICE: 'Em atendimento',
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado'
};
export function ordered<T extends QueueRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
    a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id)
  );
}
export function timeBR(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
