export interface SLAInfo {
  deadlineDate: Date | null;
  daysRemaining: number | null;
  isExpired: boolean;
  label: string;
  status: 'ok' | 'warning' | 'expired';
}

const SLA_DAYS = 30;

export function computeSLA(createdAt: string): SLAInfo {
  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  let status: SLAInfo['status'] = 'ok';
  if (daysRemaining < 0) {
    status = 'expired';
  } else if (daysRemaining <= 5) {
    status = 'warning';
  }

  let label: string;
  if (status === 'expired') {
    label = `Past deadline (${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue)`;
  } else if (status === 'warning') {
    label = `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  } else {
    label = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
  }

  return {
    deadlineDate: deadline,
    daysRemaining,
    isExpired: status === 'expired',
    label,
    status,
  };
}
