import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Minus,
  Plus,
  Trash2,
  UserPlus,
  X,
  Monitor,
  PackagePlus,
  Users,
  Ticket,
  ShoppingCart,
  Repeat,
  WalletCards,
  History,
  ClipboardList,
  RotateCcw,
  Link2,
} from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import {
  submitSale,
  useSalesQueue,
  cacheProducts,
  searchCachedProducts,
  isNetworkError,
  type ThriftCondition,
  type CachedProduct,
  type CreateSalePayload,
  type SaleResult,
  type SalePaymentMethod,
  type TradeInLinePayload,
  type TradeInPayload,
} from '../../lib/pos-offline';
import { broadcastToDisplay } from '../../lib/pos-broadcast';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { Button, Badge, Modal, ModalFooter, useToast } from '../../components/ui';

interface ProductSearchItem {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  condition?: ThriftCondition;
  tags?: string[];
}

interface CartLine {
  productId: string;
  sku: string;
  name: string;
  condition?: ThriftCondition;
  quantity: number;
  unitPrice: number;
}

interface Member {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  tier: string;
  discountPercent: number;
  storeCreditBalance?: number;
}

interface VoucherValidation {
  valid: boolean;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  discountAmount: number;
  message?: string;
}

/** V38: GET /pos/trade-ins/suggest candidate - see TradeInSuggestionService.
 *
 * `aiSuggested`/`aiMatch`: OPTIONAL local LLM reranker for product matching only (never price) -
 * see TradeInSuggestionDto's javadoc. Absent/false on every row when the backend feature is
 * disabled (the default) or didn't produce a validated match - the response is otherwise identical
 * to today's, so this is purely additive. */
interface TradeInSuggestion {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  listedBuyPrice: number | null;
  unitPrice: number;
  suggestedCashOffer: number;
  suggestedCreditOffer: number;
  matchScore: number;
  recentAcquisitions: {
    count: number;
    min: number | null;
    median: number | null;
    max: number | null;
  };
  aiSuggested?: boolean;
  aiMatch?: {
    applied: boolean;
    model: string | null;
    latencyMs: number | null;
    suggestedSku: string | null;
    parsedCondition: ThriftCondition | null;
    parsedHasBox: boolean | null;
    parsedAccessories: string | null;
  } | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

type PaymentMethod = SalePaymentMethod;

interface Confirmation {
  queued: boolean;
  saleNumber: string;
  total: number;
  change: number;
  pointsEarned: number | null;
  netCashDirection?: 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'EVEN';
  netCashAmount?: number;
}

const CONDITION_LABELS: Record<ThriftCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

const CONDITION_VARIANTS: Record<ThriftCondition, 'success' | 'info' | 'default' | 'warning' | 'danger'> = {
  NEW: 'success',
  LIKE_NEW: 'info',
  GOOD: 'default',
  FAIR: 'warning',
  POOR: 'danger',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function newClientSaleId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  // Product search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [usingCache, setUsingCache] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cart
  const [lines, setLines] = useState<CartLine[]>([]);

  // Member
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const memberTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  // Voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherResult, setVoucherResult] = useState<VoucherValidation | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Trade-in (part-exchange + standalone payout)
  const [tradeInDescription, setTradeInDescription] = useState('');
  const [tradeInCondition, setTradeInCondition] = useState<ThriftCondition | ''>('');
  const [tradeInAccessories, setTradeInAccessories] = useState('');
  const [tradeInHasBox, setTradeInHasBox] = useState(false);
  const [tradeInCashValue, setTradeInCashValue] = useState('');
  const [tradeInCreditValue, setTradeInCreditValue] = useState('');
  // BUG FIX: defaults to STORE_CREDIT (the credit rate) - a thrift-shop customer trading in
  // against a purchase normally gets the better credit-style rate, per the approved design
  // decision; CASH must be a deliberate operator choice, never the silent default.
  const [tradeInPayoutType, setTradeInPayoutType] = useState<'CASH' | 'STORE_CREDIT'>('STORE_CREDIT');
  const [tradeInLines, setTradeInLines] = useState<TradeInLinePayload[]>([]);
  const [payingOutTradeIn, setPayingOutTradeIn] = useState(false);

  // V38: catalogue-linked trade-in suggestions (GET /pos/trade-ins/suggest), so a trade-in either
  // links an existing product (stock/acquisitionCost updated in place) or - if nothing matches -
  // falls back to today's free-text "create a new product" path, now REQUIRING a category so it's
  // never left uncategorised.
  const [tradeInSuggestions, setTradeInSuggestions] = useState<TradeInSuggestion[]>([]);
  const [tradeInSuggestLoading, setTradeInSuggestLoading] = useState(false);
  const [tradeInSelected, setTradeInSelected] = useState<TradeInSuggestion | null>(null);
  const [tradeInCategoryId, setTradeInCategoryId] = useState('');
  const [tradeInCategories, setTradeInCategories] = useState<CategoryOption[]>([]);
  // Dirty tracking: once a suggestion pre-fills the cash/credit offer, changing Condition/Has-box
  // recomputes the suggestion but must never silently clobber a value the cashier already edited
  // by hand - see the "reset to suggested" affordance next to each field below.
  const [tradeInCashDirty, setTradeInCashDirty] = useState(false);
  const [tradeInCreditDirty, setTradeInCreditDirty] = useState(false);
  // Same dirty-tracking idea, for the AI reranker's parsed hints (condition/hasBox/accessories -
  // see runTradeInSuggest below): the AI only ever pre-fills a field the cashier hasn't already
  // touched by hand, exactly like the cash/credit dirty flags above.
  const [tradeInConditionDirty, setTradeInConditionDirty] = useState(false);
  const [tradeInHasBoxDirty, setTradeInHasBoxDirty] = useState(false);
  const [tradeInAccessoriesDirty, setTradeInAccessoriesDirty] = useState(false);
  const tradeInSuggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AbortController for the in-flight GET /pos/trade-ins/suggest call - the optional AI reranker
  // can make this request take up to ~2s (mulaerp.tradein.ai-match.timeout-ms), so a fast typist
  // can easily have an older, slower request still in flight when a newer one fires. Without this,
  // an out-of-order response could apply stale AI hints (or a stale suggestion list) after the
  // cashier has already moved on to a different query.
  const tradeInSuggestAbortRef = useRef<AbortController | null>(null);

  // Store credit redemption
  const [storeCreditRedeemedInput, setStoreCreditRedeemedInput] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');

  // Submission / confirmation
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const { online, queuedCount } = useSalesQueue((sale: SaleResult) => {
    success(`Sale ${sale.saleNumber} synced (was queued offline)`);
  });

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // --- Product search --------------------------------------------------
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      setUsingCache(false);
      return;
    }
    searchTimer.current = setTimeout(() => runSearch(query), 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runSearch = async (q: string) => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ search: q, page: '0', size: '8' });
      const response = await api.get(`/products?${params}`);
      const items: ProductSearchItem[] = response.data.content;
      setResults(items);
      setUsingCache(false);
      cacheProducts(
        items.map<CachedProduct>((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unitPrice: p.unitPrice,
          condition: p.condition,
          tags: p.tags,
        }))
      );
    } catch (err) {
      if (isNetworkError(err)) {
        setResults(searchCachedProducts(q));
        setUsingCache(true);
      } else {
        console.error('Product search failed:', err);
        showError('Failed to search products');
      }
    } finally {
      setSearching(false);
    }
  };

  const addProductToCart = (product: ProductSearchItem | CachedProduct) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          condition: product.condition,
          quantity: 1,
          unitPrice: product.unitPrice,
        },
      ];
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      addProductToCart(results[0]);
      setQuery('');
      setResults([]);
    }
  };

  // --- Cart line editing --------------------------------------------------
  const changeQty = (productId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const updateLinePrice = (productId: string, value: string) => {
    const price = parseFloat(value);
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, unitPrice: Number.isNaN(price) ? 0 : price } : l))
    );
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const lineTotal = (line: CartLine) => round2(line.quantity * line.unitPrice);

  // --- Member search / attach ---------------------------------------------
  useEffect(() => {
    if (memberTimer.current) clearTimeout(memberTimer.current);
    if (!memberQuery.trim()) {
      setMemberResults([]);
      return;
    }
    memberTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: memberQuery, page: '0', size: '5' });
        const response = await api.get(`/members?${params}`);
        setMemberResults(response.data.content);
      } catch (err) {
        console.error('Member search failed:', err);
      }
    }, 250);
    return () => {
      if (memberTimer.current) clearTimeout(memberTimer.current);
    };
  }, [memberQuery]);

  const attachMember = (m: Member) => {
    setMember(m);
    setMemberQuery('');
    setMemberResults([]);
  };

  const createMember = async () => {
    if (!newMemberName.trim() || !newMemberPhone.trim()) return;
    setSavingMember(true);
    try {
      const response = await api.post('/members', {
        name: newMemberName.trim(),
        phone: newMemberPhone.trim(),
      });
      attachMember(response.data);
      setMemberModalOpen(false);
      setNewMemberName('');
      setNewMemberPhone('');
      success('Member created and attached');
    } catch (err) {
      console.error('Failed to create member:', err);
      showError('Failed to create member');
    } finally {
      setSavingMember(false);
    }
  };

  // --- Voucher --------------------------------------------------------------
  const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const memberDiscountAmount = member ? round2(subtotal * (member.discountPercent / 100)) : 0;
  // BUG FIX: the voucher is validated/priced off this (sequential stacking - member discount
  // first, then voucher off what's left), matching exactly what PosSaleService computes
  // server-side. This used to send the raw `subtotal` to /vouchers/validate regardless of any
  // member discount already active, so a PERCENT voucher's previewed discount was computed off
  // the wrong (larger) base and came out bigger than the real, sequential one PosSaleService
  // applies - the register's own running "Total" understated what the sale would actually charge,
  // only corrected once "Complete Sale" posted and the real (smaller) discount came back.
  const afterMemberDiscount = Math.max(0, round2(subtotal - memberDiscountAmount));
  const voucherDiscountAmount = voucherResult?.valid ? voucherResult.discountAmount : 0;
  // "S" in the part-exchange contract - the amount owed for the goods before store credit
  // redemption or trade-in netting (mirrors PosSaleService's salesRevenueAmount).
  const total = Math.max(0, round2(subtotal - memberDiscountAmount - voucherDiscountAmount));

  // --- Part-exchange trade-in + store credit --------------------------------
  // BUG FIX: resolves each line's value from the CURRENTLY SELECTED payout type instead of
  // always summing offeredCreditValue - a CASH selection used to apply RM0 for any line whose
  // operator only filled in a cash offer (the credit-value field defaults to 0), while still
  // being silently labelled "Credit" in the chip below. Recomputes on every render, so switching
  // the dropdown after lines are already added updates both this total and the chip label.
  const resolveTradeInLineValue = (line: TradeInLinePayload, payoutType: 'CASH' | 'STORE_CREDIT') =>
    payoutType === 'CASH' ? line.offeredCashValue : line.offeredCreditValue;
  const tradeInValueTotal = round2(
    tradeInLines.reduce((sum, l) => sum + resolveTradeInLineValue(l, tradeInPayoutType), 0)
  );
  // BUG FIX (mode-switch safety): lines that resolve to RM0 under the currently selected payout
  // type (e.g. the operator added items while STORE_CREDIT was selected, filling only the credit
  // offer, then switched to CASH) - never silently apply 0 for these; surfaced as a warning below
  // and used to disable both "Payout" and "Add to Cart" until fixed or removed.
  const zeroValueTradeInLines = tradeInLines.filter(
    (l) => resolveTradeInLineValue(l, tradeInPayoutType) <= 0
  );
  const tradeInModeBlocked = zeroValueTradeInLines.length > 0;
  // V38: an unlinked (free-text, no catalogue match picked) item must have a category chosen
  // before it can be added/paid out - a linked item already has one (the existing product's own).
  const tradeInCategoryRequired = tradeInDescription.trim().length > 0 && !tradeInSelected;
  const tradeInBlockedByCategory = tradeInCategoryRequired && !tradeInCategoryId;
  const storeCreditBalance = member?.storeCreditBalance ?? 0;
  const storeCreditRequested = parseFloat(storeCreditRedeemedInput) || 0;
  // Clamped to the amount owed only (never above `total`) - the member's actual balance is the
  // backend's job (MemberService#debitStoreCredit rejects an overdraft with 400), same as the
  // approved design decision's "clamped to balance" note describes the overall effect.
  const storeCreditRedeemedNum = Math.max(0, Math.min(storeCreditRequested, total));
  const afterStoreCredit = round2(total - storeCreditRedeemedNum);
  // CRITICAL: netCashAmount is NOT clamped to zero - a negative value means the shop owes the
  // customer cash (trade-in value exceeded what was left to pay).
  const netCashAmount = round2(afterStoreCredit - tradeInValueTotal);
  const netCashDirection: 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'EVEN' =
    netCashAmount > 0 ? 'CUSTOMER_PAYS' : netCashAmount < 0 ? 'SHOP_PAYS' : 'EVEN';
  const amountDue = Math.max(0, netCashAmount);

  const amountTenderedNum = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'CASH' && amountDue > 0 ? round2(amountTenderedNum - amountDue) : 0;
  // Deliberately not gated on amountTendered.trim() !== '' - an untouched (empty) field
  // parses to 0 via amountTenderedNum above, so change is already negative for any nonzero
  // amountDue. Previously only flagging this once the field was non-empty meant a cashier could
  // click Complete Sale having typed nothing at all: online that's rejected by the backend's
  // own "Insufficient amount tendered" check, but offline it queues locally (looks like a
  // successful "Queued (offline)" sale) and only fails - silently, dropped from the queue -
  // once it syncs back online. Disabling Complete Sale up front makes that failure mode
  // impossible instead of deferred and invisible.
  const insufficientCash = paymentMethod === 'CASH' && amountDue > 0 && change < 0;

  const applyVoucher = async () => {
    if (!voucherCode.trim()) {
      showError('Enter a voucher code first');
      return;
    }
    setVoucherLoading(true);
    try {
      const response = await api.post('/vouchers/validate', {
        code: voucherCode.trim(),
        subtotal: afterMemberDiscount,
      });
      setVoucherResult(response.data);
    } catch (err) {
      console.error('Voucher validation failed:', err);
      setVoucherResult({
        valid: false,
        code: voucherCode.trim(),
        type: 'FIXED',
        value: 0,
        discountAmount: 0,
        message: 'Failed to validate voucher',
      });
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeVoucher = () => {
    setVoucherResult(null);
    setVoucherCode('');
  };

  // --- Trade-in (part-exchange + standalone payout) --------------------------
  // V38: real categories for the free-text/unlinked fallback's required Category select - fetched
  // once, same source ProductFormPage uses (GET /products/categories).
  useEffect(() => {
    api
      .get('/products/categories')
      .then((response) => setTradeInCategories(response.data))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // V38: debounced suggest search (same 250ms pattern as the register's own product search above)
  // - re-runs on every description keystroke AND whenever Condition/Has-box change, since the
  // suggested cash/credit offers are computed server-side from those two inputs.
  useEffect(() => {
    if (tradeInSuggestTimer.current) clearTimeout(tradeInSuggestTimer.current);
    if (!online || !tradeInDescription.trim()) {
      setTradeInSuggestions([]);
      return;
    }
    tradeInSuggestTimer.current = setTimeout(() => runTradeInSuggest(tradeInDescription), 250);
    return () => {
      if (tradeInSuggestTimer.current) clearTimeout(tradeInSuggestTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeInDescription, tradeInCondition, tradeInHasBox, online]);

  const runTradeInSuggest = async (q: string) => {
    // Cancel whatever suggest request is still in flight before starting a new one - see the
    // AbortController comment on tradeInSuggestAbortRef above. Only ONE suggest request should
    // ever be allowed to resolve-and-apply at a time.
    tradeInSuggestAbortRef.current?.abort();
    const controller = new AbortController();
    tradeInSuggestAbortRef.current = controller;

    setTradeInSuggestLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (tradeInCondition) params.set('condition', tradeInCondition);
      params.set('hasBox', String(tradeInHasBox));
      const response = await api.get(`/pos/trade-ins/suggest?${params}`, { signal: controller.signal });
      const suggestions: TradeInSuggestion[] = response.data;
      setTradeInSuggestions(suggestions);

      // A candidate is already linked and Condition/Has-box just changed - refresh its own
      // suggested figures in place (respecting dirty tracking) instead of requiring a re-pick.
      if (tradeInSelected) {
        const refreshed = suggestions.find((s) => s.productId === tradeInSelected.productId);
        if (refreshed) {
          setTradeInSelected(refreshed);
          if (!tradeInCashDirty) setTradeInCashValue(String(refreshed.suggestedCashOffer));
          if (!tradeInCreditDirty) setTradeInCreditValue(String(refreshed.suggestedCreditOffer));
        }
      }

      // OPTIONAL AI reranker (product matching only, never price - see TradeInSuggestionDto):
      // at most one row comes back marked aiSuggested, and only when the backend feature is
      // enabled AND the model's answer passed validation. Pre-fill only the fields the cashier
      // hasn't manually touched yet (dirty tracking, same pattern as the cash/credit offers
      // above) - a manual edit is never silently clobbered by a (possibly wrong) AI hint.
      const aiRow = suggestions.find((s) => s.aiSuggested && s.aiMatch?.applied);
      if (aiRow?.aiMatch) {
        if (!tradeInConditionDirty && aiRow.aiMatch.parsedCondition) {
          setTradeInCondition(aiRow.aiMatch.parsedCondition);
        }
        if (!tradeInHasBoxDirty && aiRow.aiMatch.parsedHasBox !== null && aiRow.aiMatch.parsedHasBox !== undefined) {
          setTradeInHasBox(aiRow.aiMatch.parsedHasBox);
        }
        if (!tradeInAccessoriesDirty && aiRow.aiMatch.parsedAccessories) {
          setTradeInAccessories(aiRow.aiMatch.parsedAccessories);
        }
      }
    } catch (err) {
      // A cancelled (superseded) request is expected traffic, not a failure - don't log it and
      // don't touch loading state below (the newer request that superseded it owns that now).
      if (axios.isCancel(err) || (err as { code?: string })?.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Trade-in suggest failed:', err);
    } finally {
      if (tradeInSuggestAbortRef.current === controller) {
        setTradeInSuggestLoading(false);
      }
    }
  };

  const selectTradeInSuggestion = (s: TradeInSuggestion) => {
    setTradeInSelected(s);
    setTradeInDescription(s.name);
    setTradeInSuggestions([]);
    setTradeInCategoryId('');
    setTradeInCashValue(String(s.suggestedCashOffer));
    setTradeInCreditValue(String(s.suggestedCreditOffer));
    setTradeInCashDirty(false);
    setTradeInCreditDirty(false);
  };

  const unlinkTradeInSuggestion = () => {
    setTradeInSelected(null);
    setTradeInCashDirty(false);
    setTradeInCreditDirty(false);
  };

  const resetCashToSuggested = () => {
    if (!tradeInSelected) return;
    setTradeInCashValue(String(tradeInSelected.suggestedCashOffer));
    setTradeInCashDirty(false);
  };

  const resetCreditToSuggested = () => {
    if (!tradeInSelected) return;
    setTradeInCreditValue(String(tradeInSelected.suggestedCreditOffer));
    setTradeInCreditDirty(false);
  };

  const buildTradeInLineDraft = (): TradeInLinePayload | null => {
    if (!tradeInDescription.trim()) {
      showError('Enter a description for the trade-in item first');
      return null;
    }
    if (tradeInBlockedByCategory) {
      showError('Select a category for this item - it did not match anything already in the catalogue');
      return null;
    }
    const cashValue = parseFloat(tradeInCashValue) || 0;
    const creditValue = parseFloat(tradeInCreditValue) || 0;
    if (cashValue < 0 || creditValue < 0) {
      showError('Offer values must not be negative');
      return null;
    }
    // BUG FIX: the offer for the CURRENTLY SELECTED payout mode must be > 0 - previously a line
    // could be added with only the other mode's offer filled in, silently applying RM0 once
    // submitted (see tradeInValueTotal above). Both values are still stored on the line either
    // way, so switching modes later never loses data the operator already entered.
    const selectedValue = tradeInPayoutType === 'CASH' ? cashValue : creditValue;
    if (selectedValue <= 0) {
      showError(
        tradeInPayoutType === 'CASH'
          ? 'Enter a cash offer for this item'
          : 'Enter a store credit offer for this item'
      );
      return null;
    }
    return {
      description: tradeInDescription.trim(),
      condition: tradeInCondition || undefined,
      accessories: tradeInAccessories.trim() || undefined,
      hasBox: tradeInHasBox,
      offeredCashValue: cashValue,
      offeredCreditValue: creditValue,
      // V38: linked items skip categoryId entirely (the existing product already has one);
      // unlinked items must carry the cashier-chosen category (enforced above and disabled on
      // the Payout/Add to Cart buttons - see tradeInBlockedByCategory).
      productId: tradeInSelected?.productId,
      categoryId: tradeInSelected ? undefined : tradeInCategoryId || undefined,
    };
  };

  const resetTradeInForm = () => {
    setTradeInDescription('');
    setTradeInCondition('');
    setTradeInAccessories('');
    setTradeInHasBox(false);
    setTradeInCashValue('');
    setTradeInCreditValue('');
    setTradeInSuggestions([]);
    setTradeInSelected(null);
    setTradeInCategoryId('');
    setTradeInCashDirty(false);
    setTradeInCreditDirty(false);
    setTradeInConditionDirty(false);
    setTradeInHasBoxDirty(false);
    setTradeInAccessoriesDirty(false);
  };

  const applyTradeInToCart = () => {
    if (tradeInModeBlocked || tradeInBlockedByCategory) return;
    const draft = buildTradeInLineDraft();
    if (!draft) return;
    setTradeInLines((prev) => [...prev, draft]);
    resetTradeInForm();
    success('Trade-in added to sale');
  };

  const removeTradeInLine = (index: number) => {
    setTradeInLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePayoutTradeIn = async () => {
    if (tradeInModeBlocked || tradeInBlockedByCategory) return;
    const draft = buildTradeInLineDraft();
    if (!draft) return;
    if (tradeInPayoutType === 'STORE_CREDIT' && !member) {
      showError('Attach a member first - store credit payouts require a member');
      return;
    }
    setPayingOutTradeIn(true);
    try {
      const response = await api.post('/pos/trade-ins', {
        clientTradeInId: newClientSaleId(),
        memberId: member?.id,
        payoutType: tradeInPayoutType,
        lines: [draft],
      });
      resetTradeInForm();
      // BUG FIX: a STORE_CREDIT payout credits the member's balance server-side
      // (MemberService#creditStoreCredit), but the attached `member` object in this component's
      // state was never updated to reflect it - PosTradeInDto doesn't echo the member's new
      // balance back, so the still-attached member's storeCreditBalance stayed stale for the rest
      // of this register session (the "Store Credit" redemption panel below either wouldn't
      // appear yet for a member who had 0 before this payout, or would show the pre-payout
      // amount) until the cashier detached and re-searched/re-attached them. Apply the same delta
      // locally instead of a second round-trip.
      if (tradeInPayoutType === 'STORE_CREDIT' && member) {
        const payoutTotal = response.data.payoutTotal ?? 0;
        setMember((prev) =>
          prev ? { ...prev, storeCreditBalance: (prev.storeCreditBalance ?? 0) + payoutTotal } : prev
        );
      }
      success(
        `Trade-in ${response.data.tradeInNumber} paid out - ${formatMoney(response.data.payoutTotal)}`
      );
    } catch (err) {
      console.error('Failed to pay out trade-in:', err);
      showError(getErrorMessage(err, 'Failed to pay out trade-in'));
    } finally {
      setPayingOutTradeIn(false);
    }
  };

  // --- Broadcast to customer display ----------------------------------------
  // BUG FIX: a pure trade-in (or store-credit redemption) has no cart lines, so the display never
  // left its idle screen - it only ever saw {lines, subtotal, memberDiscount, voucherDiscount,
  // total}, none of which carry trade-in/store-credit/net-cash information. Now broadcasts
  // tradeInValue/storeCreditRedeemed/netCashDirection/netCashAmount too, and the dependency array
  // includes the trade-in lines, the resolved trade-in total, and the payout type so the display
  // updates as items are added/removed and when the operator switches CASH/STORE_CREDIT mode.
  useEffect(() => {
    broadcastToDisplay({
      type: 'cart-update',
      lines: lines.map((l) => ({
        id: l.productId,
        name: l.name,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: lineTotal(l),
      })),
      subtotal,
      memberDiscount: memberDiscountAmount,
      voucherDiscount: voucherDiscountAmount,
      tradeInValue: tradeInValueTotal,
      storeCreditRedeemed: storeCreditRedeemedNum,
      total,
      netCashDirection,
      netCashAmount,
    });
  }, [
    lines,
    subtotal,
    memberDiscountAmount,
    voucherDiscountAmount,
    total,
    tradeInLines,
    tradeInValueTotal,
    tradeInPayoutType,
    storeCreditRedeemedNum,
    netCashAmount,
    netCashDirection,
  ]);

  // --- Checkout -----------------------------------------------------------
  const canSubmit = lines.length > 0 && !submitting && !insufficientCash;

  const handleCompleteSale = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    // BUG FIX (display == posted): the backend now honours which of the trade-in's two offered
    // values applies for a part-exchange (CASH -> offeredCashValue, STORE_CREDIT -> the default
    // credit rate) instead of always assuming the credit rate - see PosSaleService#createSale.
    // payoutType is intentionally typed locally (rather than widening the shared TradeInPayload
    // type) since it's a new, backend-recognised field on the wire payload.
    const tradeInPayload: (TradeInPayload & { payoutType: 'CASH' | 'STORE_CREDIT' }) | undefined =
      tradeInLines.length > 0
        ? { clientTradeInId: newClientSaleId(), lines: tradeInLines, payoutType: tradeInPayoutType }
        : undefined;

    const payload: CreateSalePayload = {
      clientSaleId: newClientSaleId(),
      memberId: member?.id,
      voucherCode: voucherResult?.valid ? voucherResult.code : undefined,
      paymentMethod,
      amountTendered: paymentMethod === 'CASH' && amountDue > 0 ? amountTenderedNum : undefined,
      storeCreditRedeemed: storeCreditRedeemedNum > 0 ? storeCreditRedeemedNum : undefined,
      tradeIn: tradeInPayload,
      lines: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };

    try {
      const { sale, queued } = await submitSale(payload);

      const finalTotal = sale?.netCashAmount ?? netCashAmount;
      const finalChange = sale?.change ?? change;

      setConfirmation({
        queued,
        saleNumber: sale?.saleNumber ?? `PENDING-${payload.clientSaleId.slice(0, 8).toUpperCase()}`,
        total: finalTotal,
        change: finalChange,
        pointsEarned: sale?.pointsEarned ?? null,
        netCashDirection: sale?.netCashDirection ?? netCashDirection,
        netCashAmount: finalTotal,
      });

      broadcastToDisplay({
        type: 'checkout',
        total: finalTotal,
        amountTendered: paymentMethod === 'CASH' ? amountTenderedNum : undefined,
        change: finalChange,
      });

      if (queued) {
        showError('No connection - sale queued and will sync automatically');
      } else {
        success(`Sale ${sale?.saleNumber} completed`);
      }
    } catch (err) {
      console.error('Failed to complete sale:', err);
      showError('Failed to complete sale');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewSale = () => {
    setLines([]);
    setMember(null);
    setMemberQuery('');
    setMemberResults([]);
    setVoucherCode('');
    setVoucherResult(null);
    setTradeInLines([]);
    resetTradeInForm();
    setTradeInPayoutType('STORE_CREDIT');
    setStoreCreditRedeemedInput('');
    setPaymentMethod('CASH');
    setAmountTendered('');
    setConfirmation(null);
    setQuery('');
    setResults([]);
    broadcastToDisplay({ type: 'reset' });
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Point of Sale</h1>
            <p className="text-sm text-slate-500 mt-1">Ring up sales, thrift-style - condition, price, and story all matter.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm">
              {online ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-slate-700">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-700">Offline{queuedCount > 0 ? ` — ${queuedCount} queued` : ''}</span>
                </>
              )}
              {online && queuedCount > 0 && (
                <span className="text-slate-500">· syncing {queuedCount}</span>
              )}
            </div>
            <a
              href="/pos/display"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 text-sm"
            >
              <Monitor className="w-4 h-4" />
              Customer Display
            </a>
            <Button variant="secondary" size="sm" icon={<PackagePlus className="w-4 h-4" />} onClick={() => navigate('/pos/intake')}>
              Item Intake
            </Button>
            <Button variant="secondary" size="sm" icon={<Users className="w-4 h-4" />} onClick={() => navigate('/pos/members')}>
              Members
            </Button>
            <Button variant="secondary" size="sm" icon={<Ticket className="w-4 h-4" />} onClick={() => navigate('/pos/vouchers')}>
              Vouchers
            </Button>
            <Button variant="secondary" size="sm" icon={<History className="w-4 h-4" />} onClick={() => navigate('/pos/sales')}>
              Sales History
            </Button>
            <Button variant="secondary" size="sm" icon={<ClipboardList className="w-4 h-4" />} onClick={() => navigate('/oversight/my-day')}>
              My Day
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: product search */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <label htmlFor="pos-search" className="block text-sm font-medium text-slate-700 mb-1">
                Search products
              </label>
              <input
                id="pos-search"
                ref={searchInputRef}
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name or SKU, then press Enter to add..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-brand-600"
              />
              {usingCache && (
                <p className="mt-2 text-xs text-amber-600">Showing cached results (offline)</p>
              )}

              <div className="mt-4 space-y-2 max-h-[32rem] overflow-y-auto">
                {searching && <p className="text-sm text-slate-500">Searching...</p>}
                {!searching && query.trim() && results.length === 0 && (
                  <p className="text-sm text-slate-500">No products found.</p>
                )}
                {results.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      addProductToCart(p);
                      setQuery('');
                      setResults([]);
                      searchInputRef.current?.focus();
                    }}
                    className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-brand-600 hover:bg-brand-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.sku}</p>
                      {p.tags && p.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {p.tags.map((t) => (
                            <Badge key={t} size="sm">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 shrink-0">
                      <span className="font-semibold text-slate-900 tabular-nums">{formatMoney(p.unitPrice)}</span>
                      {p.condition && (
                        <Badge size="sm" variant={CONDITION_VARIANTS[p.condition]}>
                          {CONDITION_LABELS[p.condition]}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: cart */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart
              </h2>

              {lines.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet. Search and add products to start a sale.</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.productId} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{line.name}</p>
                          <p className="text-xs text-slate-500">
                            {line.sku}
                            {line.condition ? ` · ${CONDITION_LABELS[line.condition]}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${line.name} from cart`}
                          onClick={() => removeLine(line.productId)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${line.name}`}
                            onClick={() => changeQty(line.productId, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${line.name}`}
                            onClick={() => changeQty(line.productId, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <label htmlFor={`price-${line.productId}`} className="block text-xs font-medium text-slate-500 mb-1">
                            Price
                          </label>
                          <input
                            id={`price-${line.productId}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => updateLinePrice(line.productId, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                          />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-500">Line total</p>
                          <p className="font-medium text-slate-900 tabular-nums">{formatMoney(lineTotal(line))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Member */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Member</h3>
              {member ? (
                <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">
                      {member.tier} tier · {member.discountPercent}% discount applied
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove member from sale"
                    onClick={() => setMember(null)}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor="member-search" className="sr-only">
                        Search member
                      </label>
                      <input
                        id="member-search"
                        type="text"
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Search member by name or phone..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<UserPlus className="w-4 h-4" />}
                      onClick={() => setMemberModalOpen(true)}
                    >
                      Add Member
                    </Button>
                  </div>
                  {memberResults.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {memberResults.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => attachMember(m)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                        >
                          <span>
                            <span className="font-medium text-slate-900">{m.name}</span>{' '}
                            <span className="text-xs text-slate-500">{m.phone}</span>
                          </span>
                          <span className="text-xs text-slate-500">{m.discountPercent}% off</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Voucher */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Voucher</h3>
              {voucherResult?.valid ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-900">{voucherResult.code}</p>
                    <p className="text-xs text-green-700">-{formatMoney(voucherResult.discountAmount)} applied</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove voucher"
                    onClick={removeVoucher}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor="voucher-code" className="sr-only">
                        Voucher code
                      </label>
                      <input
                        id="voucher-code"
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="Voucher code"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={applyVoucher} loading={voucherLoading}>
                      Apply
                    </Button>
                  </div>
                  {voucherResult && !voucherResult.valid && (
                    <p className="text-sm text-red-600">{voucherResult.message || 'Invalid voucher code'}</p>
                  )}
                </div>
              )}
            </div>

            {/* Trade-In */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Trade-In
              </h3>
              {!online && (
                <p className="text-xs text-amber-600">Requires connection - trade-ins are disabled offline.</p>
              )}

              {tradeInLines.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {tradeInLines.map((line, idx) => {
                    const lineValue = resolveTradeInLineValue(line, tradeInPayoutType);
                    return (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-900">{line.description}</span>
                          {/* BUG FIX: label AND value now follow the currently selected payout
                              type instead of always reading "Credit {offeredCreditValue}" - a
                              zero-value line under the current mode is flagged in red so it's
                              obvious before checkout, matching the warning/disable below. */}
                          <span
                            className={`text-xs ml-2 ${lineValue <= 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}
                          >
                            {tradeInPayoutType === 'CASH' ? 'Cash' : 'Credit'} {formatMoney(lineValue)}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove trade-in ${line.description}`}
                          onClick={() => removeTradeInLine(idx)}
                          disabled={!online}
                          className="text-slate-400 hover:text-red-600 p-1 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {tradeInModeBlocked && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                  Switching to {tradeInPayoutType === 'CASH' ? 'Cash' : 'Store Credit'} would apply{' '}
                  {formatMoney(0)} for: {zeroValueTradeInLines.map((l) => l.description).join(', ')}. Fix the
                  offer or remove {zeroValueTradeInLines.length > 1 ? 'these items' : 'this item'} before
                  continuing.
                </div>
              )}

              {tradeInBlockedByCategory && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs">
                  This item didn't match anything in the catalogue - pick a Category above before paying out or
                  adding it to the cart.
                </div>
              )}

              <div>
                <label htmlFor="trade-in-description" className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <input
                  id="trade-in-description"
                  type="text"
                  value={tradeInDescription}
                  onChange={(e) => {
                    setTradeInDescription(e.target.value);
                    // Typing again after a candidate was picked means the cashier is looking for
                    // something else - drop the link so a stale productId can't sneak through.
                    if (tradeInSelected) unlinkTradeInSuggestion();
                  }}
                  disabled={!online}
                  placeholder="e.g. PS5, Samsung Galaxy S21 (searches the catalogue as you type)"
                  aria-describedby="trade-in-description-help"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                />
                <p id="trade-in-description-help" className="mt-1 text-xs text-slate-400">
                  Pick a match below to link this trade-in to an existing product - stock and cost
                  update in place instead of creating a duplicate.
                </p>

                {tradeInSuggestLoading && <p className="mt-2 text-xs text-slate-500">Searching catalogue...</p>}

                {!tradeInSelected && tradeInSuggestions.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Matching catalogue products"
                    className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto"
                  >
                    {tradeInSuggestions.map((s) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        key={s.productId}
                        onClick={() => selectTradeInSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                              {s.name}
                              {/* OPTIONAL local AI reranker (product matching only, never price -
                                  see TradeInSuggestionDto): only ever set on the one candidate the
                                  model chose, and only once its answer passed the backend's
                                  off-list-SKU validation. Text label (not colour alone) so it's
                                  accessible without relying on the badge's tint. */}
                              {s.aiSuggested && (
                                <Badge variant="info" size="sm" aria-label="AI suggested match">
                                  AI suggested
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.sku}
                              {s.categoryName ? ` · ${s.categoryName}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500">Listed buy price</p>
                            <p className="text-sm font-semibold text-slate-900 tabular-nums">
                              {s.listedBuyPrice != null ? formatMoney(s.listedBuyPrice) : '—'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Suggested: {formatMoney(s.suggestedCashOffer)} cash · {formatMoney(s.suggestedCreditOffer)}{' '}
                          credit
                          {s.recentAcquisitions.count > 0 && s.recentAcquisitions.min != null && s.recentAcquisitions.max != null && (
                            <>
                              {' · '}recent: {formatMoney(s.recentAcquisitions.min)}–{formatMoney(s.recentAcquisitions.max)}
                            </>
                          )}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {tradeInSelected && (
                  <div className="mt-2 flex items-center justify-between gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="w-4 h-4 text-brand-700 shrink-0" />
                      <span>
                        Linked to <span className="font-medium text-slate-900">{tradeInSelected.name}</span>{' '}
                        <span className="text-xs text-slate-500">
                          ({tradeInSelected.sku}
                          {tradeInSelected.categoryName ? ` · ${tradeInSelected.categoryName}` : ''})
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Unlink this trade-in from the matched product"
                      onClick={unlinkTradeInSuggestion}
                      disabled={!online}
                      className="text-slate-400 hover:text-red-600 p-1 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {tradeInCategoryRequired && (
                  <div className="mt-2">
                    <label htmlFor="trade-in-category" className="block text-xs font-medium text-slate-500 mb-1">
                      Category <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="trade-in-category"
                      value={tradeInCategoryId}
                      onChange={(e) => setTradeInCategoryId(e.target.value)}
                      disabled={!online}
                      aria-required="true"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                    >
                      <option value="">Select a category...</option>
                      {tradeInCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      No catalogue match was picked - this will create a new product, so it needs a category.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="trade-in-condition" className="block text-xs font-medium text-slate-500 mb-1">
                    Condition
                  </label>
                  <select
                    id="trade-in-condition"
                    value={tradeInCondition}
                    onChange={(e) => {
                      setTradeInCondition(e.target.value as ThriftCondition | '');
                      // Manual edit - the AI reranker's parsed hint (if any) must never overwrite
                      // this again for the current query (see runTradeInSuggest).
                      setTradeInConditionDirty(true);
                    }}
                    disabled={!online}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                  >
                    <option value="">Select...</option>
                    {(Object.keys(CONDITION_LABELS) as ThriftCondition[]).map((c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="trade-in-accessories" className="block text-xs font-medium text-slate-500 mb-1">
                    Accessories
                  </label>
                  <input
                    id="trade-in-accessories"
                    type="text"
                    value={tradeInAccessories}
                    onChange={(e) => {
                      setTradeInAccessories(e.target.value);
                      setTradeInAccessoriesDirty(true);
                    }}
                    disabled={!online}
                    placeholder="Charger, case..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={tradeInHasBox}
                  onChange={(e) => {
                    setTradeInHasBox(e.target.checked);
                    setTradeInHasBoxDirty(true);
                  }}
                  disabled={!online}
                  className="rounded border-slate-300"
                />
                Has original box
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="trade-in-cash-value" className="block text-xs font-medium text-slate-500">
                      Cash offer{tradeInSelected ? ' (suggested)' : ''}
                    </label>
                    {tradeInSelected && tradeInCashDirty && (
                      <button
                        type="button"
                        onClick={resetCashToSuggested}
                        aria-label="Reset cash offer to the suggested value"
                        className="text-xs text-brand-700 hover:underline flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  <input
                    id="trade-in-cash-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tradeInCashValue}
                    onChange={(e) => {
                      setTradeInCashValue(e.target.value);
                      setTradeInCashDirty(true);
                    }}
                    disabled={!online}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="trade-in-credit-value" className="block text-xs font-medium text-slate-500">
                      Store credit offer{tradeInSelected ? ' (suggested)' : ''}
                    </label>
                    {tradeInSelected && tradeInCreditDirty && (
                      <button
                        type="button"
                        onClick={resetCreditToSuggested}
                        aria-label="Reset store credit offer to the suggested value"
                        className="text-xs text-brand-700 hover:underline flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  <input
                    id="trade-in-credit-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tradeInCreditValue}
                    onChange={(e) => {
                      setTradeInCreditValue(e.target.value);
                      setTradeInCreditDirty(true);
                    }}
                    disabled={!online}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                  />
                </div>
              </div>

              {tradeInSelected && (
                <p className="text-xs text-slate-500">
                  Listed buy price: {tradeInSelected.listedBuyPrice != null ? formatMoney(tradeInSelected.listedBuyPrice) : '—'}
                  {tradeInSelected.recentAcquisitions.count > 0 &&
                    tradeInSelected.recentAcquisitions.min != null &&
                    tradeInSelected.recentAcquisitions.max != null && (
                      <>
                        {' · '}Recent trade-ins ({tradeInSelected.recentAcquisitions.count}):{' '}
                        {formatMoney(tradeInSelected.recentAcquisitions.min)}–{formatMoney(tradeInSelected.recentAcquisitions.max)}
                        {tradeInSelected.recentAcquisitions.median != null &&
                          ` (median ${formatMoney(tradeInSelected.recentAcquisitions.median)})`}
                      </>
                    )}
                </p>
              )}

              <div className="flex items-center gap-2">
                <label htmlFor="trade-in-payout-type" className="sr-only">
                  Payout type
                </label>
                <select
                  id="trade-in-payout-type"
                  value={tradeInPayoutType}
                  onChange={(e) => setTradeInPayoutType(e.target.value as 'CASH' | 'STORE_CREDIT')}
                  disabled={!online}
                  className="px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                >
                  <option value="CASH">Cash</option>
                  <option value="STORE_CREDIT">Store Credit</option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handlePayoutTradeIn}
                  loading={payingOutTradeIn}
                  disabled={!online || tradeInModeBlocked || tradeInBlockedByCategory}
                >
                  Payout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyTradeInToCart}
                  disabled={!online || tradeInModeBlocked || tradeInBlockedByCategory}
                >
                  Add to Cart
                </Button>
              </div>
            </div>

            {/* Store Credit redemption - only shown once a member with a positive balance is attached */}
            {member && storeCreditBalance > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <WalletCards className="w-4 h-4" />
                  Store Credit
                </h3>
                <p className="text-xs text-slate-500">
                  {member.name} has {formatMoney(storeCreditBalance)} available.
                </p>
                {!online && <p className="text-xs text-amber-600">Requires connection.</p>}
                <div>
                  <label htmlFor="store-credit-redeem" className="sr-only">
                    Store credit to redeem
                  </label>
                  <input
                    id="store-credit-redeem"
                    type="number"
                    min="0"
                    max={storeCreditBalance}
                    step="0.01"
                    value={storeCreditRedeemedInput}
                    onChange={(e) => setStoreCreditRedeemedInput(e.target.value)}
                    disabled={!online}
                    placeholder="Amount to redeem"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-700">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>Member discount</span>
                <span className="tabular-nums">-{formatMoney(memberDiscountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>Voucher</span>
                <span className="tabular-nums">-{formatMoney(voucherDiscountAmount)}</span>
              </div>
              {storeCreditRedeemedNum > 0 && (
                <div className="flex justify-between text-sm text-slate-700">
                  <span>Store credit redeemed</span>
                  <span className="tabular-nums">-{formatMoney(storeCreditRedeemedNum)}</span>
                </div>
              )}
              {tradeInValueTotal > 0 && (
                <div className="flex justify-between text-sm text-slate-700">
                  <span>Trade-in applied</span>
                  <span className="tabular-nums">-{formatMoney(tradeInValueTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold text-slate-900 pt-2 border-t border-slate-200">
                <span>{netCashDirection === 'SHOP_PAYS' ? 'Cash owed to customer' : 'Total'}</span>
                <span className="tabular-nums">
                  {formatMoney(netCashDirection === 'SHOP_PAYS' ? Math.abs(netCashAmount) : netCashAmount)}
                </span>
              </div>

              <div className="pt-3 space-y-3">
                <div>
                  <label htmlFor="payment-method" className="block text-sm font-medium text-slate-700 mb-1">
                    Payment method
                  </label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="EWALLET">E-Wallet</option>
                    {member && storeCreditBalance > 0 && <option value="STORE_CREDIT">Store Credit</option>}
                  </select>
                </div>

                {paymentMethod === 'CASH' && amountDue > 0 && (
                  <div>
                    <label htmlFor="amount-tendered" className="block text-sm font-medium text-slate-700 mb-1">
                      Amount tendered
                    </label>
                    <input
                      id="amount-tendered"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    />
                    <p className={`mt-1 text-sm tabular-nums ${insufficientCash ? 'text-red-600' : 'text-slate-500'}`}>
                      Change: {formatMoney(change)}
                      {insufficientCash ? ' (insufficient amount tendered)' : ''}
                    </p>
                  </div>
                )}
                {netCashDirection === 'SHOP_PAYS' && (
                  <p className="text-sm text-amber-600">
                    The trade-in value exceeds this sale - hand the customer {formatMoney(Math.abs(netCashAmount))} in
                    cash.
                  </p>
                )}

                <Button
                  onClick={handleCompleteSale}
                  disabled={!canSubmit}
                  loading={submitting}
                  size="lg"
                  className="w-full"
                >
                  Complete Sale
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add member modal */}
      <Modal isOpen={memberModalOpen} onClose={() => setMemberModalOpen(false)} title="Add Member" size="sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-member-name" className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              id="new-member-name"
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            />
          </div>
          <div>
            <label htmlFor="new-member-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone
            </label>
            <input
              id="new-member-phone"
              type="text"
              value={newMemberPhone}
              onChange={(e) => setNewMemberPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setMemberModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={createMember}
            loading={savingMember}
            disabled={!newMemberName.trim() || !newMemberPhone.trim()}
          >
            Add Member
          </Button>
        </ModalFooter>
      </Modal>

      {/* Confirmation */}
      <Modal isOpen={!!confirmation} onClose={startNewSale} title="Sale Complete" size="sm" showCloseButton={false}>
        {confirmation && (
          <div className="space-y-4">
            {confirmation.queued && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
                Queued (offline) — this sale will sync automatically once you're back online.
              </div>
            )}
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Sale number</span>
                <span className="font-medium text-slate-900">{confirmation.saleNumber}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{confirmation.netCashDirection === 'SHOP_PAYS' ? 'Cash owed to customer' : 'Total'}</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatMoney(Math.abs(confirmation.total))}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Change</span>
                <span className="font-medium text-slate-900 tabular-nums">{formatMoney(confirmation.change)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Points earned</span>
                <span className="font-medium text-slate-900">
                  {confirmation.pointsEarned === null ? 'Pending' : confirmation.pointsEarned}
                </span>
              </div>
            </div>
            <Button className="w-full" onClick={startNewSale}>
              New Sale
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
