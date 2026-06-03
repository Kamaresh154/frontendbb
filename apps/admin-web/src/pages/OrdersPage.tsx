import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import { getEmployees, addInvoice, getCentres, getInvoices, writeSync, read } from "../lib/store";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Product { id: string; name: string; selling_price: number; unit: string; sku: string; }
interface OrderItem { product_id: string; product_name: string; qty: number; unit_price: number; total: number; }
type PaymentMethod = "gpay" | "cod" | "cash" | "pending";
type PaymentStatus = "unpaid" | "pending_verification" | "paid";

interface Order {
  id: string; order_no: string; customer: string; phone: string; address: string;
  date: string; items: OrderItem[]; subtotal: number; discount: number; total: number;
  status: "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled";
  payment_method: PaymentMethod; payment_ref?: string; payment_status: PaymentStatus;
  upi_ref_submitted?: string;   // franchise enters this after paying
  notes: string; placed_by: string; placed_by_role: string; assigned_to: string;
  status_history: { status: string; changed_by: string; changed_at: string }[];
  purchase_employee?: string;
}

const ORDERS_KEY   = "kv_orders";
const PRODUCTS_KEY = "kv_product_catalogue";
const MERCHANT_VPA  = "kidzventure@okaxis";
const MERCHANT_NAME = "KidzVenture";

function getOrders(): Order[] { try { return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]"); } catch { return []; } }
function saveOrders(o: Order[]) { writeSync(ORDERS_KEY, o); }
function getProducts(): Product[] {
  try { const s = localStorage.getItem(PRODUCTS_KEY); if (s) return JSON.parse(s); } catch {}
  return [
    { id: "p1", name: "Play Kit Pro",         selling_price: 1200, unit: "kit",  sku: "PK-001" },
    { id: "p2", name: "Activity Booklet Set", selling_price: 199,  unit: "set",  sku: "AB-002" },
    { id: "p3", name: "Learning Flash Cards", selling_price: 299,  unit: "pack", sku: "FC-003" },
  ];
}

const STATUS_COLORS: Record<Order["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  dispatched: "bg-purple-100 text-purple-700 border-purple-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_ICONS: Record<Order["status"], string> = {
  pending: "⏳", confirmed: "✅", dispatched: "🚚", delivered: "📦", cancelled: "❌",
};
const PM_LABEL: Record<PaymentMethod, string> = {
  gpay: "📱 GPay/UPI", cod: "🚚 Cash on Delivery", cash: "💵 Cash", pending: "⏳ Not set",
};

/* ─── UPI Link & QR ─────────────────────────────────────────────────────────── */
function buildUPILink(amount: number, ref: string) {
  return `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Order " + ref)}`;
}
function QRCodeImage({ data, size = 200 }: { data: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png&margin=12&ecc=M`;
  return <img src={src} alt="UPI QR" width={size} height={size} className="rounded-2xl border-4 border-white shadow-xl" />;
}

/* ─── Invoice printer ────────────────────────────────────────────────────────── */
function printInvoiceHTML(opts: {
  title: string; invoiceNo: string; date: string; customerName: string; customerPhone: string;
  orderNo: string; address?: string; placedBy: string; placedByRole: string;
  assignedTo?: string; purchaseEmployee?: string;
  items: { name: string; qty: number; unit_price: number }[];
  subtotal: number; taxTotal: number; total: number;
  paymentMethod?: string; paymentRef?: string; isPaid: boolean; invoiceType: "order" | "delivery";
}) {
  const fmt2 = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) return;
  const itemRows = opts.items.map((l) =>
    `<tr><td>${l.name}</td><td align="right">${l.qty}</td><td align="right">${fmt2(l.unit_price)}</td><td align="right">${fmt2(l.qty * l.unit_price)}</td></tr>`
  ).join("");
  const stamp = opts.isPaid
    ? `<div class="paid-stamp">✓ PAID — ${opts.paymentMethod === "gpay" ? "GPay/UPI" : opts.paymentMethod === "cash" ? "Cash" : "UPI"}</div>`
    : `<div class="unpaid-stamp">⏳ PENDING PAYMENT</div>`;
  win.document.write(`<!DOCTYPE html><html><head><title>${opts.title} ${opts.invoiceNo}</title>
  <style>*{font-family:Arial,sans-serif;margin:0;padding:0;box-sizing:border-box}body{padding:24px;color:#1e293b;max-width:620px;margin:auto}
  .brand{font-size:22px;font-weight:900;color:#6d28d9}.sub{color:#64748b;font-size:12px;margin-top:4px}
  .badge{display:inline-block;background:#ede9fe;color:#6d28d9;font-size:10px;font-weight:700;padding:2px 8px;border-radius:9999px;margin-top:4px}
  .divider{border-top:1px dashed #cbd5e1;margin:14px 0}
  table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:#94a3b8;font-size:11px;padding:6px 0;border-bottom:1px solid #e2e8f0}td{padding:6px 0;border-bottom:1px solid #f1f5f9}
  .tr{display:flex;justify-content:space-between;font-size:13px;margin:3px 0}
  .grand{font-size:18px;font-weight:900;color:#6d28d9;border-top:2px solid #6d28d9;padding-top:8px;margin-top:8px}
  .paid-stamp{background:#dcfce7;border:2px solid #16a34a;border-radius:8px;padding:8px 16px;text-align:center;color:#16a34a;font-weight:900;font-size:15px;margin:14px 0}
  .unpaid-stamp{background:#fef9c3;border:2px solid #ca8a04;border-radius:8px;padding:8px 16px;text-align:center;color:#92400e;font-weight:700;font-size:14px;margin:14px 0}
  .meta{font-size:12px;margin-bottom:10px}.meta div{margin:2px 0}
  .sec{font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 4px}
  .footer{margin-top:18px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:8px}}</style></head><body>
  <div class="brand">KidzVenture</div>
  <div class="sub">${opts.title} ${opts.invoiceNo} · ${new Date(opts.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
  <span class="badge">${opts.invoiceType === "delivery" ? "Payment Receipt" : "Order Invoice"}</span>
  <div class="divider"></div>
  <div class="sec">Customer</div><div class="meta">
    <div><strong>${opts.customerName}</strong>${opts.customerPhone ? ` · ${opts.customerPhone}` : ""}</div>
    ${opts.address ? `<div>📍 ${opts.address}</div>` : ""}<div>Order: ${opts.orderNo}</div></div>
  <div class="sec">Placed By</div><div class="meta">
    <div><strong>${opts.placedBy}</strong> (${opts.placedByRole})</div>
    ${opts.assignedTo ? `<div>Handled by: ${opts.assignedTo}</div>` : ""}
    ${opts.purchaseEmployee ? `<div>Purchase by: <strong>${opts.purchaseEmployee}</strong></div>` : ""}</div>
  <div class="sec">Items</div>
  <table><thead><tr><th>Item</th><th align="right">Qty</th><th align="right">Rate</th><th align="right">Amount</th></tr></thead>
  <tbody>${itemRows}</tbody></table>
  <div class="divider"></div>
  <div class="tr"><span>Subtotal</span><span>${fmt2(opts.subtotal)}</span></div>
  <div class="tr"><span>GST (18%)</span><span>${fmt2(opts.taxTotal)}</span></div>
  <div class="tr grand"><span>TOTAL</span><span>${fmt2(opts.total)}</span></div>
  ${stamp}${opts.paymentRef ? `<div style="font-size:11px;color:#64748b;text-align:center;margin-top:6px">UPI Ref: ${opts.paymentRef}</div>` : ""}
  <div class="footer">KidzVenture · ${MERCHANT_VPA} · Thank you!</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FRANCHISE PAYMENT VIEW — shown to franchise_manager when they click Pay
   ═══════════════════════════════════════════════════════════════════════════════ */
function FranchisePaymentModal({ order, onClose, onSubmitRef }: {
  order: Order;
  onClose: () => void;
  onSubmitRef: (ref: string) => void;
}) {
  const [step, setStep]       = useState<"qr" | "ref" | "done">("qr");
  const [upiRef, setUpiRef]   = useState("");
  const [error, setError]     = useState("");
  const upiLink = buildUPILink(order.total, order.order_no);

  function handleSubmitRef() {
    if (!upiRef.trim() || upiRef.trim().length < 6) {
      setError("Please enter a valid UPI transaction / reference ID (min 6 characters).");
      return;
    }
    onSubmitRef(upiRef.trim());
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-white">
          <p className="font-bold text-lg">Pay for Order</p>
          <p className="text-sm text-white/70 mt-0.5">{order.order_no} · ₹{order.total.toLocaleString("en-IN")}</p>
        </div>

        <div className="p-6">
          {/* Step 1: Show QR */}
          {step === "qr" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-semibold text-slate-700 text-center">
                Scan this QR with GPay, PhonePe, Paytm or any UPI app
              </p>
              <div className="rounded-3xl bg-gradient-to-b from-green-50 to-white p-4 border-2 border-green-100 flex flex-col items-center gap-3">
                <QRCodeImage data={upiLink} size={200} />
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900">₹{order.total.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{MERCHANT_NAME} · {order.order_no}</p>
                  <p className="text-[11px] font-mono text-green-700 mt-1">{MERCHANT_VPA}</p>
                </div>
              </div>
              <a href={upiLink}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition">
                📱 Open GPay / UPI App
              </a>
              <p className="text-center text-[11px] text-slate-400">GPay · PhonePe · Paytm · BHIM · Any UPI</p>
              <button type="button" onClick={() => setStep("ref")}
                className="w-full rounded-2xl border-2 border-brand-purple py-2.5 text-sm font-bold text-brand-purple hover:bg-purple-50 transition">
                ✓ I've Paid — Enter Transaction ID →
              </button>
            </div>
          )}

          {/* Step 2: Enter UPI ref */}
          {step === "ref" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl mb-3">✅</div>
                <p className="font-bold text-slate-800">Payment Done?</p>
                <p className="text-xs text-slate-500 mt-1">Enter the UPI Transaction ID / Reference Number from your payment app</p>
              </div>
              {error && <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">⚠️ {error}</p>}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">UPI Transaction / Reference ID *</label>
                <input
                  autoFocus
                  value={upiRef}
                  onChange={(e) => { setUpiRef(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitRef()}
                  placeholder="e.g. 1234567890 or TXN123456"
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand-purple"
                />
                <p className="mt-1 text-[10px] text-slate-400">Find this in your GPay/PhonePe transaction history</p>
              </div>
              <button type="button" onClick={handleSubmitRef}
                className="w-full rounded-2xl bg-brand-purple py-3 text-sm font-bold text-white hover:opacity-90 shadow">
                Submit for Verification
              </button>
              <button type="button" onClick={() => { setStep("qr"); setError(""); }}
                className="w-full rounded-2xl border py-2 text-xs text-slate-500 hover:bg-slate-50">← Back to QR</button>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl">⏳</div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Submitted for Verification</p>
                <p className="text-sm text-slate-500 mt-1">Your payment reference <strong className="font-mono text-brand-purple">{upiRef}</strong> has been sent to the admin for verification.</p>
                <p className="text-xs text-slate-400 mt-2">You'll see the order marked as <strong>Paid</strong> once verified.</p>
              </div>
              <button type="button" onClick={onClose}
                className="rounded-2xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ADMIN VERIFICATION MODAL — shown to super_admin / employee to verify payment
   ═══════════════════════════════════════════════════════════════════════════════ */
function AdminVerifyModal({ order, onClose, onVerify, onReject }: {
  order: Order;
  onClose: () => void;
  onVerify: (ref: string) => void;
  onReject: () => void;
}) {
  const [manualRef, setManualRef] = useState(order.upi_ref_submitted ?? "");
  const upiLink = buildUPILink(order.total, order.order_no);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-5 text-white">
          <p className="font-bold text-lg">Verify Payment</p>
          <p className="text-sm text-white/70 mt-0.5">{order.order_no} · {order.customer} · ₹{order.total.toLocaleString("en-IN")}</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Reference check */}
          {order.upi_ref_submitted && (
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Reference ID submitted by Franchise</p>
              <p className="font-mono text-lg font-bold text-blue-900">{order.upi_ref_submitted}</p>
              <p className="text-xs text-blue-600 mt-1">Cross-check this ID in your GPay / bank app to confirm payment received</p>
            </div>
          )}

          {/* QR to verify */}
          <div className="rounded-2xl border bg-slate-50 p-4 flex items-center gap-4">
            <div className="flex-shrink-0">
              <QRCodeImage data={upiLink} size={100} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">Payment QR for ₹{order.total.toLocaleString("en-IN")}</p>
              <p className="text-[11px] font-mono text-green-700">{MERCHANT_VPA}</p>
              <p className="text-[10px] text-slate-400 mt-1">If not yet paid, share this QR again</p>
            </div>
          </div>

          {/* Manual ref override */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              UPI Ref / Transaction ID {order.upi_ref_submitted ? "(pre-filled from franchise)" : "(enter manually)"}
            </label>
            <input value={manualRef} onChange={(e) => setManualRef(e.target.value)}
              placeholder="Transaction reference ID"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-purple" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => onVerify(manualRef)}
              className="flex-1 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 shadow">
              ✓ Verify & Mark Paid
            </button>
            <button type="button" onClick={onReject}
              className="flex-1 rounded-2xl bg-red-50 border-2 border-red-200 py-3 text-sm font-bold text-red-600 hover:bg-red-100">
              ✕ Reject / Re-request
            </button>
          </div>

          {/* Cash option */}
          <div className="border-t pt-4">
            <p className="text-xs text-slate-400 text-center mb-3">— OR mark as cash payment —</p>
            <button type="button" onClick={() => onVerify("cash")}
              className="w-full rounded-2xl bg-blue-50 border border-blue-200 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              💵 Confirm Cash Payment
            </button>
          </div>
        </div>
        <div className="border-t px-6 py-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function OrdersPage() {
  const { user } = useAuth();
  const { isFranchiseManager, isEmployee, isAdmin, isSuperAdmin } = useRole();

  const myIdentity  = user?.full_name ?? user?.email ?? "Unknown";
  const myRoleLabel = isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : isEmployee ? "Employee" : "Franchise";
  const isInternal  = isSuperAdmin || isAdmin || isEmployee;   // can verify
  const canConfirm  = isEmployee || isAdmin || isSuperAdmin;

  const [orders, setOrders]             = useState<Order[]>([]);
  const [products]                      = useState<Product[]>(getProducts);
  const [employees]                     = useState(() => getEmployees().filter((e) => e.status === "active"));
  const [centres]                       = useState(() => getCentres());
  const [filter, setFilter]             = useState<"all" | Order["status"]>("all");
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [toast, setToast]               = useState<{ msg: string; kind: "success" | "info" | "warn" } | null>(null);

  // Payment modals
  const [franchisePayModal, setFranchisePayModal] = useState<Order | null>(null);
  const [adminVerifyModal, setAdminVerifyModal]   = useState<Order | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState<Order | null>(null);
  const [purchaseEmployee, setPurchaseEmployee]   = useState("");

  // New order form
  const [customer, setCustomer]   = useState("");
  const [phone, setPhone]         = useState("");
  const [address, setAddress]     = useState("");
  const [notes, setNotes]         = useState("");
  const [discount, setDiscount]   = useState("0");
  const [assignTo, setAssignTo]   = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("gpay");
  const [cartItems, setCartItems] = useState<{ product_id: string; product_name: string; qty: number; unit_price: number; total: number }[]>([]);
  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty]         = useState("1");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string, kind: "success" | "info" | "warn" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  const reload = () => setOrders(getOrders());
  useEffect(() => {
    reload();
    window.addEventListener("kv-store-update", reload);
    return () => window.removeEventListener("kv-store-update", reload);
  }, []);

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
  const cartSubtotal = cartItems.reduce((s, i) => s + i.total, 0);
  const cartTotal    = Math.max(0, cartSubtotal - (parseFloat(discount) || 0));

  /* ── Cart ── */
  function addToCart() {
    const p = products.find((x) => x.id === selProduct);
    if (!p) return;
    const qty = parseInt(selQty, 10) || 1;
    setCartItems((prev) => {
      const ex = prev.find((i) => i.product_id === p.id);
      if (ex) return prev.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + qty, total: (i.qty + qty) * i.unit_price } : i);
      return [...prev, { product_id: p.id, product_name: p.name, qty, unit_price: p.selling_price, total: qty * p.selling_price }];
    });
    setSelProduct(""); setSelQty("1");
  }

  /* ── Place order ── */
  function placeOrder() {
    if (!customer.trim() || cartItems.length === 0) { alert("Enter customer name and add at least one product."); return; }
    const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
    const disc = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - disc);
    const all = getOrders();
    const order: Order = {
      id: "ord_" + Date.now(), order_no: "ORD-" + String(all.length + 1).padStart(4, "0"),
      customer: customer.trim(), phone, address, date: new Date().toISOString().slice(0, 10),
      items: cartItems, subtotal, discount: disc, total,
      status: "pending", payment_method: payMethod, payment_status: "unpaid",
      notes, placed_by: myIdentity, placed_by_role: myRoleLabel, assigned_to: assignTo,
      status_history: [{ status: "pending", changed_by: myIdentity, changed_at: new Date().toLocaleString("en-IN") }],
    };
    saveOrders([order, ...all]);
    // Print placement invoice immediately
    const tax = subtotal * 0.18;
    printInvoiceHTML({
      title: "Order Invoice", invoiceNo: order.order_no, date: order.date,
      customerName: order.customer, customerPhone: phone, orderNo: order.order_no, address,
      placedBy: myIdentity, placedByRole: myRoleLabel, assignedTo: assignTo,
      items: cartItems.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price })),
      subtotal, taxTotal: tax, total: subtotal + tax,
      isPaid: false, invoiceType: "order",
    });
    setCartItems([]); setCustomer(""); setPhone(""); setAddress(""); setNotes("");
    setDiscount("0"); setAssignTo(""); setPayMethod("gpay"); setShowForm(false);
    showToast(`${order.order_no} placed! Placement invoice printed.`, "info");
  }

  /* ── Status change ── */
  function changeStatus(id: string, status: Order["status"]) {
    saveOrders(getOrders().map((o) => o.id === id ? {
      ...o, status,
      status_history: [...(o.status_history ?? []), { status, changed_by: myIdentity, changed_at: new Date().toLocaleString("en-IN") }],
    } : o));
  }

  /* ── FRANCHISE submits UPI ref ── */
  function handleFranchiseSubmitRef(order: Order, ref: string) {
    saveOrders(getOrders().map((o) => o.id === order.id
      ? { ...o, upi_ref_submitted: ref, payment_status: "pending_verification" as PaymentStatus }
      : o));
    showToast("Payment reference submitted! Admin will verify shortly.", "info");
    setFranchisePayModal(null);
  }

  /* ── ADMIN verifies payment ── */
  function handleAdminVerify(order: Order, ref: string) {
    const isCash = ref === "cash";
    const method: PaymentMethod = isCash ? "cash" : "gpay";
    // Update order
    saveOrders(getOrders().map((o) => o.id === order.id ? {
      ...o, payment_status: "paid" as PaymentStatus,
      payment_method: method, payment_ref: ref,
      status_history: [...(o.status_history ?? []), {
        status: `payment_verified_by_${myIdentity}`, changed_by: myIdentity, changed_at: new Date().toLocaleString("en-IN"),
      }],
    } : o));
    // Create invoice
    const inv = addInvoice({
      invoice_type: "order",
      center_id: centres[0]?.id ?? "", center_name: centres[0]?.name ?? "Main",
      order_id: order.id, order_no: order.order_no,
      customer_name: order.customer, customer_phone: order.phone,
      placed_by: order.placed_by, attended_by: order.assigned_to || undefined,
      lines: order.items.map((item) => ({
        description: item.product_name, qty: item.qty, unit: "unit",
        unit_price: item.unit_price, tax_rate: 18,
        tax_amount: (item.qty * item.unit_price * 0.18),
        line_total: item.qty * item.unit_price * 1.18,
      })),
      subtotal: order.subtotal, tax_total: order.subtotal * 0.18,
      total: order.subtotal * 1.18,
      tax_rate: 18, payment_method: method, payment_ref: ref,
      status: "paid", date: new Date().toISOString().slice(0, 10),
      created_by: myIdentity,
    });
    // Print receipt
    printInvoiceHTML({
      title: "Payment Receipt", invoiceNo: inv.invoice_no, date: inv.date,
      customerName: order.customer, customerPhone: order.phone,
      orderNo: order.order_no, address: order.address,
      placedBy: order.placed_by, placedByRole: order.placed_by_role,
      assignedTo: order.assigned_to,
      items: order.items.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price })),
      subtotal: inv.subtotal, taxTotal: inv.tax_total, total: inv.total,
      paymentMethod: method, paymentRef: ref === "cash" ? undefined : ref,
      isPaid: true, invoiceType: "delivery",
    });
    setAdminVerifyModal(null);
    showToast(`✅ Payment verified! Invoice ${inv.invoice_no} created & printed.`);
  }

  /* ── ADMIN rejects UPI ref ── */
  function handleAdminReject(order: Order) {
    saveOrders(getOrders().map((o) => o.id === order.id
      ? { ...o, upi_ref_submitted: undefined, payment_status: "unpaid" as PaymentStatus }
      : o));
    setAdminVerifyModal(null);
    showToast("Payment reference rejected. Franchise needs to re-submit.", "warn");
  }

  /* ── Assign purchase employee ── */
  function assignPurchaseEmployee(order: Order, empName: string) {
    saveOrders(getOrders().map((o) => o.id === order.id ? { ...o, purchase_employee: empName } : o));
    setShowPurchaseModal(null); setPurchaseEmployee("");
    showToast(`${empName} assigned to purchase products for ${order.order_no}`, "info");
    const tax = order.subtotal * 0.18;
    printInvoiceHTML({
      title: "Purchase Assignment", invoiceNo: order.order_no + "-PA",
      date: new Date().toISOString().slice(0, 10),
      customerName: order.customer, customerPhone: order.phone,
      orderNo: order.order_no, address: order.address,
      placedBy: order.placed_by, placedByRole: order.placed_by_role,
      assignedTo: order.assigned_to, purchaseEmployee: empName,
      items: order.items.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price })),
      subtotal: order.subtotal, taxTotal: tax, total: order.subtotal + tax,
      isPaid: false, invoiceType: "order",
    });
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const pendingVerify = orders.filter((o) => o.payment_status === "pending_verification").length;

  /* ── Payment status badge ── */
  function PayStatusBadge({ order }: { order: Order }) {
    if (order.payment_status === "paid") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700 border border-green-200">
        ✓ Paid
      </span>
    );
    if (order.payment_status === "pending_verification") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 animate-pulse">
        🔍 Verifying…
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-700 border border-yellow-200">
        ⏳ Unpaid
      </span>
    );
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl max-w-sm ${
          toast.kind === "success" ? "bg-green-600 text-white" :
          toast.kind === "warn"    ? "bg-orange-600 text-white" :
                                     "bg-blue-600 text-white"}`}>
          <span className="text-xl flex-shrink-0">{toast.kind === "success" ? "🎉" : toast.kind === "warn" ? "⚠️" : "ℹ️"}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{toast.kind === "success" ? "Payment Confirmed!" : toast.kind === "warn" ? "Payment Rejected" : "Update"}</p>
            <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{toast.msg}</p>
          </div>
          <button type="button" onClick={() => setToast(null)} className="text-white/50 hover:text-white ml-1">×</button>
        </div>
      )}

      {/* Franchise payment modal */}
      {franchisePayModal && (
        <FranchisePaymentModal
          order={franchisePayModal}
          onClose={() => setFranchisePayModal(null)}
          onSubmitRef={(ref) => handleFranchiseSubmitRef(franchisePayModal, ref)}
        />
      )}

      {/* Admin verify modal */}
      {adminVerifyModal && (
        <AdminVerifyModal
          order={adminVerifyModal}
          onClose={() => setAdminVerifyModal(null)}
          onVerify={(ref) => handleAdminVerify(adminVerifyModal, ref)}
          onReject={() => handleAdminReject(adminVerifyModal)}
        />
      )}

      {/* Purchase assignment modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-amber-600 px-5 py-4 text-white">
              <p className="font-bold">Assign Purchase Employee</p>
              <p className="text-xs text-white/70 mt-0.5">{showPurchaseModal.order_no} — who will go buy?</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-2">Products to Purchase:</p>
                {showPurchaseModal.items.map((i) => (
                  <p key={i.product_id} className="text-xs text-amber-700">• {i.product_name} × {i.qty}</p>
                ))}
              </div>
              <select value={purchaseEmployee} onChange={(e) => setPurchaseEmployee(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                <option value="">— Select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.full_name}>{e.full_name}{e.designation ? ` (${e.designation})` : ""}</option>)}
              </select>
              <button type="button" onClick={() => { if (!purchaseEmployee) return; assignPurchaseEmployee(showPurchaseModal, purchaseEmployee); }}
                className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700">
                🛍 Assign & Print Slip
              </button>
            </div>
            <div className="border-t px-5 py-3">
              <button type="button" onClick={() => setShowPurchaseModal(null)} className="text-sm text-slate-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders & Payments</h1>
          <p className="text-sm text-slate-500">
            {orders.length} total · {orders.filter((o) => o.payment_status === "unpaid" && o.status !== "cancelled").length} unpaid
            {pendingVerify > 0 && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">🔍 {pendingVerify} awaiting verification</span>}
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90">
          🛒 New Order
        </button>
      </div>

      {/* Admin pending verification alert */}
      {isInternal && pendingVerify > 0 && (
        <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 px-5 py-4 flex items-center gap-4">
          <span className="text-2xl">🔍</span>
          <div className="flex-1">
            <p className="font-bold text-blue-800">{pendingVerify} payment{pendingVerify > 1 ? "s" : ""} awaiting your verification</p>
            <p className="text-xs text-blue-600 mt-0.5">Franchise{pendingVerify > 1 ? "s" : ""} have submitted UPI reference IDs — please verify and mark paid</p>
          </div>
          <button type="button"
            onClick={() => { const o = orders.find((x) => x.payment_status === "pending_verification"); if (o) setAdminVerifyModal(o); }}
            className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800">
            Verify Now →
          </button>
        </div>
      )}

      {/* New order form */}
      {showForm && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-bold text-slate-800">New Order</h2>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5 text-xs text-blue-700">
            📄 A placement invoice prints immediately. Payment receipt prints after verification.
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Customer Name *</label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Delivery Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Payment method */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Payment Method</label>
            <div className="flex gap-2 flex-wrap">
              {(["gpay", "cod", "cash"] as PaymentMethod[]).map((pm) => (
                <button key={pm} type="button" onClick={() => setPayMethod(pm)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${payMethod === pm ? "bg-brand-purple text-white border-brand-purple shadow" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {PM_LABEL[pm]}
                </button>
              ))}
            </div>
          </div>
          {/* Products */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Products</label>
            <div className="flex gap-2 mb-3">
              <select value={selProduct} onChange={(e) => setSelProduct(e.target.value)} className="flex-1 rounded-xl border px-3 py-2 text-sm">
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmt(p.selling_price)}</option>)}
              </select>
              <input type="number" min="1" value={selQty} onChange={(e) => setSelQty(e.target.value)} className="w-20 rounded-xl border px-3 py-2 text-sm text-center" />
              <button type="button" onClick={addToCart} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white">Add</button>
            </div>
            {cartItems.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-400"><tr><th className="px-3 py-2 text-left">Product</th><th className="text-center px-3 py-2">Qty</th><th className="text-right px-3 py-2">Rate</th><th className="text-right px-3 py-2">Amount</th><th /></tr></thead>
                <tbody className="divide-y">{cartItems.map((i) => (
                  <tr key={i.product_id}><td className="px-3 py-2 font-medium">{i.product_name}</td><td className="px-3 py-2 text-center">{i.qty}</td><td className="px-3 py-2 text-right">{fmt(i.unit_price)}</td><td className="px-3 py-2 text-right font-bold">{fmt(i.total)}</td>
                  <td className="px-3 py-2"><button type="button" onClick={() => setCartItems(cartItems.filter((x) => x.product_id !== i.product_id))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button></td></tr>
                ))}</tbody></table>
                <div className="bg-slate-50 px-4 py-2 text-sm flex gap-4 items-center justify-end">
                  <span>Subtotal: <strong>{fmt(cartSubtotal)}</strong></span>
                  <div className="flex items-center gap-1"><span>Discount:</span><input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 rounded-lg border px-2 py-1 text-sm" /></div>
                  <span className="font-bold text-brand-purple">Total: {fmt(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Assign to Employee</label>
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
                <option value="">— None —</option>
                {employees.map((e) => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={placeOrder} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-bold text-white">Place Order + Print Invoice</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(["all","pending","confirmed","dispatched","delivered","cancelled"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === s ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>
            {s === "all" ? `All (${orders.length})` : `${STATUS_ICONS[s as Order["status"]]} ${s} (${orders.filter((o) => o.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center"><p className="text-3xl mb-2">📋</p><p className="text-slate-500 text-sm">No orders found.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3 w-4" />
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Placed By</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Order Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((o) => (
                <>
                  <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="px-3 py-3 text-slate-300 text-xs">{expanded === o.id ? "▼" : "▶"}</td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold text-slate-700">{o.order_no}</p>
                      <p className="text-[10px] text-slate-400">{o.date}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{o.customer}</p>
                      <p className="text-xs text-slate-400">{o.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <p className="font-medium">{o.placed_by}</p>
                      <p className="text-slate-400">{o.placed_by_role}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{fmt(o.total)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <PayStatusBadge order={o} />
                        {o.upi_ref_submitted && o.payment_status === "pending_verification" && (
                          <p className="text-[10px] font-mono text-blue-600">Ref: {o.upi_ref_submitted}</p>
                        )}
                        <p className="text-[10px] text-slate-400">{PM_LABEL[o.payment_method ?? "pending"]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${STATUS_COLORS[o.status]}`}>
                        {STATUS_ICONS[o.status]} {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 flex-wrap">
                        {/* Franchise: Pay via GPay QR */}
                        {isFranchiseManager && o.payment_status === "unpaid" && o.payment_method === "gpay" && o.status !== "cancelled" && (
                          <button type="button" onClick={() => setFranchisePayModal(o)}
                            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700">
                            📱 Pay via GPay
                          </button>
                        )}
                        {/* Franchise re-submit if rejected */}
                        {isFranchiseManager && o.payment_status === "unpaid" && o.payment_method === "gpay" && o.upi_ref_submitted === undefined && o.status !== "cancelled" && (
                          <></>
                        )}
                        {/* Admin: verify pending */}
                        {isInternal && o.payment_status === "pending_verification" && (
                          <button type="button" onClick={() => setAdminVerifyModal(o)}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 animate-pulse">
                            🔍 Verify Payment
                          </button>
                        )}
                        {/* Admin: collect cash */}
                        {isInternal && o.payment_status === "unpaid" && o.status !== "cancelled" && (
                          <button type="button" onClick={() => setAdminVerifyModal(o)}
                            className="rounded-lg bg-green-100 border border-green-200 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-200">
                            💳 Collect Payment
                          </button>
                        )}
                        {/* Re-print receipt */}
                        {o.payment_status === "paid" && (
                          <button type="button" onClick={() => {
                            const inv = getInvoices().find((i) => i.order_id === o.id);
                            if (!inv) return;
                            printInvoiceHTML({
                              title: "Payment Receipt", invoiceNo: inv.invoice_no, date: inv.date,
                              customerName: o.customer, customerPhone: o.phone,
                              orderNo: o.order_no, address: o.address,
                              placedBy: o.placed_by, placedByRole: o.placed_by_role,
                              assignedTo: o.assigned_to, purchaseEmployee: o.purchase_employee,
                              items: o.items.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price })),
                              subtotal: inv.subtotal, taxTotal: inv.tax_total, total: inv.total,
                              paymentMethod: inv.payment_method, paymentRef: inv.payment_ref,
                              isPaid: true, invoiceType: "delivery",
                            });
                          }} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                            🖨 Receipt
                          </button>
                        )}
                        {/* Purchase assign */}
                        {!o.purchase_employee && o.status !== "cancelled" && isInternal && (
                          <button type="button" onClick={() => setShowPurchaseModal(o)}
                            className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100">
                            🛍 Assign
                          </button>
                        )}
                        {/* Status transitions */}
                        {o.status === "pending" && canConfirm && <button type="button" onClick={() => changeStatus(o.id, "confirmed")} className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200">✅ Confirm</button>}
                        {o.status === "confirmed" && canConfirm && <button type="button" onClick={() => changeStatus(o.id, "dispatched")} className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200">🚚 Dispatch</button>}
                        {o.status === "dispatched" && canConfirm && <button type="button" onClick={() => changeStatus(o.id, "delivered")} className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-200">📦 Deliver</button>}
                        {["pending","confirmed","dispatched"].includes(o.status) && (isSuperAdmin || isAdmin) && (
                          <button type="button" onClick={() => { if (confirm("Cancel this order?")) changeStatus(o.id, "cancelled"); }}
                            className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr key={o.id + "-exp"}>
                      <td colSpan={8} className="bg-slate-50/70 px-6 py-5">
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Items</p>
                            <table className="w-full text-xs"><thead><tr className="border-b text-slate-400"><th className="text-left pb-2">Product</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Rate</th><th className="text-right pb-2">Amount</th></tr></thead>
                            <tbody>{o.items.map((i) => <tr key={i.product_id} className="border-b border-slate-100"><td className="py-1.5 font-medium">{i.product_name}</td><td className="py-1.5 text-right">{i.qty}</td><td className="py-1.5 text-right">{fmt(i.unit_price)}</td><td className="py-1.5 text-right font-bold">{fmt(i.total)}</td></tr>)}</tbody></table>
                            <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                              {o.address && <p>📍 {o.address}</p>}
                              {o.assigned_to && <p>👤 Assigned: {o.assigned_to}</p>}
                              {o.purchase_employee && <p>🛍 Purchase by: <strong>{o.purchase_employee}</strong></p>}
                              {o.upi_ref_submitted && <p>🔗 UPI Ref Submitted: <span className="font-mono">{o.upi_ref_submitted}</span></p>}
                              {o.payment_ref && o.payment_ref !== o.upi_ref_submitted && <p>✅ Verified Ref: <span className="font-mono">{o.payment_ref}</span></p>}
                              {o.notes && <p>📝 {o.notes}</p>}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Status History</p>
                            <ol className="relative border-l-2 border-brand-purple/20 ml-2 space-y-3">
                              {(o.status_history ?? []).map((h, idx) => (
                                <li key={idx} className="ml-5">
                                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white text-[8px]">{idx + 1}</span>
                                  <p className="text-xs font-bold capitalize text-slate-700">{h.status}</p>
                                  <p className="text-[11px] text-slate-400">by {h.changed_by} · {h.changed_at}</p>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
