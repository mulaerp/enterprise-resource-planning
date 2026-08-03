/**
 * Shared repair-job status constants used by RepairListPage and RepairDetailPage.
 *
 * REPAIR_FLOW models the happy-path lifecycle only, used to drive the "advance
 * status" action and the detail-page stepper. CANCELLED is reachable from any
 * non-terminal step (see canCancelRepair) but isn't itself part of the forward
 * flow. The backend (PATCH /repairs/{id}/status) is the actual source of truth
 * for which transitions are allowed - this is only the frontend's "what's the
 * obvious next step" affordance.
 */
export type RepairStatus =
  | 'RECEIVED'
  | 'DIAGNOSED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_REPAIR'
  | 'COMPLETED'
  | 'COLLECTED'
  | 'CANCELLED';

export const REPAIR_FLOW: RepairStatus[] = [
  'RECEIVED',
  'DIAGNOSED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_REPAIR',
  'COMPLETED',
  'COLLECTED',
];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  RECEIVED: 'Received',
  DIAGNOSED: 'Diagnosed',
  AWAITING_APPROVAL: 'Awaiting Approval',
  APPROVED: 'Approved',
  IN_REPAIR: 'In Repair',
  COMPLETED: 'Completed',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

// RECEIVED slate, DIAGNOSED/AWAITING_APPROVAL amber, APPROVED/IN_REPAIR brand,
// COMPLETED/COLLECTED green, CANCELLED red - matches Badge.tsx's soft-surface
// convention (bg-{color}-50 text-{color}-700 border-{color}-200) but Badge
// itself has no "brand" variant, so these statuses render via raw classes.
export const REPAIR_STATUS_BADGE_CLASSES: Record<RepairStatus, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700 border-slate-200',
  DIAGNOSED: 'bg-amber-50 text-amber-700 border-amber-200',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-brand-50 text-brand-700 border-brand-200',
  IN_REPAIR: 'bg-brand-50 text-brand-700 border-brand-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  COLLECTED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export function nextRepairStatus(status: RepairStatus): RepairStatus | null {
  const idx = REPAIR_FLOW.indexOf(status);
  if (idx === -1 || idx === REPAIR_FLOW.length - 1) return null;
  return REPAIR_FLOW[idx + 1];
}

export function canCancelRepair(status: RepairStatus): boolean {
  return status !== 'COLLECTED' && status !== 'CANCELLED';
}
