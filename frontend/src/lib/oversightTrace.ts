/**
 * Item Trace timeline event-type presentation metadata (icon name + label + accent color) for
 * OversightItemTracePage. Kept as a small lookup here (rather than inline in the page) so the
 * backend's event `type` strings (see ItemTraceEventDto on the API side) have exactly one place
 * that maps them to a human label/icon - new event types only need a new entry here.
 */
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Recycle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShoppingCart,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface TraceEventMeta {
  icon: LucideIcon;
  label: string;
  color: string;
}

const DEFAULT_META: TraceEventMeta = { icon: SlidersHorizontal, label: 'Event', color: 'text-slate-500' };

const META_BY_TYPE: Record<string, TraceEventMeta> = {
  OPENING_STOCK: { icon: ArrowDownToLine, label: 'Opening stock', color: 'text-blue-600' },
  PO_RECEIPT: { icon: ArrowDownToLine, label: 'Purchase order receipt', color: 'text-blue-600' },
  TRADE_IN_RECEIPT: { icon: Recycle, label: 'Trade-in receipt', color: 'text-emerald-600' },
  STOCK_ADJUSTMENT: { icon: SlidersHorizontal, label: 'Stock adjustment', color: 'text-amber-600' },
  RECOUNT: { icon: RotateCcw, label: 'Stock recount', color: 'text-amber-600' },
  WAREHOUSE_TRANSFER_OUT: { icon: ArrowLeftRight, label: 'Transferred out', color: 'text-slate-600' },
  WAREHOUSE_TRANSFER_IN: { icon: ArrowLeftRight, label: 'Transferred in', color: 'text-slate-600' },
  POS_SALE: { icon: ShoppingCart, label: 'PoS sale', color: 'text-brand-600' },
  REPAIR_PART_CONSUMED: { icon: Wrench, label: 'Repair part consumed', color: 'text-orange-600' },
  WARRANTY_ISSUED: { icon: ShieldCheck, label: 'Warranty issued', color: 'text-green-600' },
  WARRANTY_CLAIMED: { icon: ShieldAlert, label: 'Warranty claimed', color: 'text-amber-600' },
  WARRANTY_VOID: { icon: ShieldX, label: 'Warranty voided', color: 'text-red-600' },
};

export function traceEventMeta(type: string): TraceEventMeta {
  return META_BY_TYPE[type] ?? DEFAULT_META;
}
