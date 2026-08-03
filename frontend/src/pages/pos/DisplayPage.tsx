import { useEffect, useRef, useState } from 'react';
import {
  subscribeToDisplay,
  getLastDisplayMessage,
  type DisplayCartLine,
  type NetCashDirection,
} from '../../lib/pos-broadcast';
import { formatMoney } from '../../lib/money';
import { branding } from '../../branding';

type DisplayState = 'idle' | 'active' | 'thanks';

const THANK_YOU_DURATION_MS = 10000;

export default function DisplayPage() {
  const [state, setState] = useState<DisplayState>('idle');
  const [lines, setLines] = useState<DisplayCartLine[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [memberDiscount, setMemberDiscount] = useState(0);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [tradeInValue, setTradeInValue] = useState(0);
  const [storeCreditRedeemed, setStoreCreditRedeemed] = useState(0);
  // BUG FIX: the bottom-line figure below now mirrors the register's own summary panel
  // (RegisterPage.tsx), which shows netCashAmount/netCashDirection rather than the pre-trade-in/
  // pre-store-credit `total` ("S") the broadcast also carries - so `total` itself has no display
  // use here (it collapses to the same value as netCashAmount whenever neither feature is used,
  // which is why the plain-sale e2e case is unaffected).
  const [netCashDirection, setNetCashDirection] = useState<NetCashDirection>('EVEN');
  const [netCashAmount, setNetCashAmount] = useState(0);
  const [paid, setPaid] = useState<{ total: number; amountTendered?: number; change?: number } | null>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToIdle = () => {
    setState('idle');
    setLines([]);
    setSubtotal(0);
    setMemberDiscount(0);
    setVoucherDiscount(0);
    setTradeInValue(0);
    setStoreCreditRedeemed(0);
    setNetCashDirection('EVEN');
    setNetCashAmount(0);
    setPaid(null);
  };

  // BUG FIX: a trade-in-only session (no cart lines) must still leave the idle screen - the
  // display previously only checked lines.length, so a customer trading in an item with no
  // purchase attached never saw anything but the idle "Welcome" logo.
  const hasActiveSession = (msgLines: DisplayCartLine[], msgTradeInValue: number) =>
    msgLines.length > 0 || msgTradeInValue > 0;

  useEffect(() => {
    // Catch up on the last known state if this tab was opened mid-sale.
    const last = getLastDisplayMessage();
    if (last?.type === 'cart-update' && hasActiveSession(last.lines, last.tradeInValue)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount catch-up from an external broadcast channel snapshot, not a render-derived value; restructuring into a lazy initializer risks behaviour changes ahead of the e2e run
      setLines(last.lines);
      setSubtotal(last.subtotal);
      setMemberDiscount(last.memberDiscount);
      setVoucherDiscount(last.voucherDiscount);
      setTradeInValue(last.tradeInValue);
      setStoreCreditRedeemed(last.storeCreditRedeemed);
      setNetCashDirection(last.netCashDirection);
      setNetCashAmount(last.netCashAmount);
      setState('active');
    }

    const unsubscribe = subscribeToDisplay((message) => {
      if (message.type === 'cart-update') {
        setLines(message.lines);
        setSubtotal(message.subtotal);
        setMemberDiscount(message.memberDiscount);
        setVoucherDiscount(message.voucherDiscount);
        setTradeInValue(message.tradeInValue);
        setStoreCreditRedeemed(message.storeCreditRedeemed);
        setNetCashDirection(message.netCashDirection);
        setNetCashAmount(message.netCashAmount);
        setState(hasActiveSession(message.lines, message.tradeInValue) ? 'active' : 'idle');
      } else if (message.type === 'checkout') {
        if (revertTimer.current) clearTimeout(revertTimer.current);
        setPaid({ total: message.total, amountTendered: message.amountTendered, change: message.change });
        setState('thanks');
        revertTimer.current = setTimeout(resetToIdle, THANK_YOU_DURATION_MS);
      } else if (message.type === 'reset') {
        if (revertTimer.current) clearTimeout(revertTimer.current);
        resetToIdle();
      }
    });

    return () => {
      unsubscribe();
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, []);

  if (state === 'thanks' && paid) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-12 text-center">
        <h1 className="text-6xl font-bold mb-6">Thank You</h1>
        <div className="space-y-4">
          <div>
            <p className="text-xl text-slate-400">Total Paid</p>
            <p className="text-5xl font-semibold tabular-nums text-brand-400">{formatMoney(paid.total)}</p>
          </div>
          {typeof paid.change === 'number' && (
            <div>
              <p className="text-xl text-slate-400">Change Due</p>
              <p className="text-4xl font-semibold tabular-nums">{formatMoney(Math.max(0, paid.change))}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-12 text-center">
        <h1 className="text-7xl font-bold mb-4">Welcome</h1>
        <p className="text-2xl text-slate-400">{branding.storeName}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-10">
      <h1 className="text-3xl font-semibold text-slate-300 mb-6">Your Order</h1>

      <div className="flex-1 overflow-y-auto space-y-3">
        {lines.map((line) => (
          <div
            key={line.id}
            className="flex items-center justify-between border-b border-slate-700 pb-3 text-2xl"
          >
            <div>
              <p className="font-medium">{line.name}</p>
              {line.sku && <p className="text-sm text-slate-500">{line.sku}</p>}
            </div>
            <div className="flex items-center gap-8 tabular-nums">
              <span className="text-slate-400">
                {line.quantity} × {formatMoney(line.unitPrice)}
              </span>
              <span className="font-semibold w-28 text-right">{formatMoney(line.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-700 pt-6 space-y-3 text-2xl">
        <div className="flex justify-between text-slate-300">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Member discount</span>
          <span className="tabular-nums">-{formatMoney(memberDiscount)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Voucher</span>
          <span className="tabular-nums">-{formatMoney(voucherDiscount)}</span>
        </div>
        {/* BUG FIX: trade-in and store-credit rows, in the same large readable style as the rows
            above - previously nothing about a trade-in or store-credit redemption ever reached
            this page at all. Only shown once actually used, matching the register's own summary
            panel (RegisterPage.tsx). */}
        {tradeInValue > 0 && (
          <div className="flex justify-between text-slate-300">
            <span>Trade-in</span>
            <span className="tabular-nums">-{formatMoney(tradeInValue)}</span>
          </div>
        )}
        {storeCreditRedeemed > 0 && (
          <div className="flex justify-between text-slate-300">
            <span>Store credit</span>
            <span className="tabular-nums">-{formatMoney(storeCreditRedeemed)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-4 border-t border-slate-700">
          {/* BUG FIX: when the trade-in value (net of store credit) exceeds what's owed, the shop
              owes the customer cash - replace the big TOTAL with a prominent "Cash owed to
              customer" figure instead, wording consistent with the register's own summary
              (RegisterPage.tsx) and its "hand the customer ... in cash" note. */}
          <span className="text-3xl font-semibold">
            {netCashDirection === 'SHOP_PAYS' ? 'Cash owed to customer' : 'TOTAL'}
          </span>
          <span className="text-6xl font-bold tabular-nums text-brand-400">
            {formatMoney(netCashDirection === 'SHOP_PAYS' ? Math.abs(netCashAmount) : netCashAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
