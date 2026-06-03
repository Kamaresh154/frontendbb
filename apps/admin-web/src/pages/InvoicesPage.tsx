import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import {
  addCentre, addInvoice, getCentres, getInvoices, getEmployees, updateInvoiceStatus,
  type Centre, type InvoiceLine, type LocalInvoice,
} from "../lib/store";

type InvoiceTab = "order" | "tuition" | "purchase" | "centres";

interface OrderRef { order_id: string; order_no: string; customer_name: string; customer_phone: string; placed_by: string; total: number; }
function getOrders(): OrderRef[] {
  try { return JSON.parse(localStorage.getItem("kv_orders") ?? "[]").map((o: any) => ({ order_id: o.id, order_no: o.order_no, customer_name: o.customer, customer_phone: o.phone, placed_by: o.placed_by ?? "", total: o.total })); }
  catch { return []; }
}
function buildLinesFromOrder(orderId: string): InvoiceLine[] {
  try {
    const orders: any[] = JSON.parse(localStorage.getItem("kv_orders") ?? "[]");
    const order = orders.find((o) => o.id === orderId);
    if (!order) return [];
    return order.items.map((item: any) => {
      const subtotal = item.qty * item.unit_price;
      const tax = subtotal * 0.18;
      return { description: item.product_name, qty: item.qty, unit: "unit", unit_price: item.unit_price, tax_rate: 18, line_total: subtotal + tax, tax_amount: tax };
    });
  } catch { return []; }
}

function printInvoice(inv: LocalInvoice) {
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_no}</title>
  <style>
    * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 32px; color: #1e293b; }
    .header { display: flex; justify-content: space-between; margin-bottom: 28px; border-bottom: 2px solid #6d28d9; padding-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 900; color: #6d28d9; }
    .inv-no { font-size: 20px; font-weight: 700; text-align: right; }
    .inv-type { font-size: 11px; background: #ede9fe; color: #6d28d9; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .meta-block h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
    .meta-block p { font-size: 13px; margin-bottom: 3px; }
    .meta-block .name { font-weight: 700; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .total-section { text-align: right; }
    .total-row { display: flex; justify-content: flex-end; gap: 48px; font-size: 13px; margin-bottom: 4px; }
    .grand-total { font-size: 18px; font-weight: 900; color: #6d28d9; border-top: 2px solid #6d28d9; padding-top: 10px; margin-top: 10px; }
    .copy-label { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #92400e; display: inline-block; margin-bottom: 20px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    .people { background: #f8fafc; border-radius: 6px; padding: 12px; margin-bottom: 20px; display: flex; gap: 32px; font-size: 12px; }
    @media print { body { padding: 16px; } }
  </style></head><body>`);

  const typeLabel = inv.invoice_type === "order" ? "Order Invoice" : inv.invoice_type === "tuition" ? "Tuition Fee Invoice" : "Purchase Invoice";
  const copies = inv.invoice_type === "purchase"
    ? ["Accounts Copy", "Vendor Copy"]
    : ["Customer Copy", "Employee Copy", "Admin / Super Admin Copy"];

  copies.forEach((copyLabel, idx) => {
    win.document.write(`
    <div style="${idx > 0 ? 'page-break-before: always; padding-top: 0;' : ''}">
      <div class="header">
        <div>
          <div class="brand">KidzVenture</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">${inv.center_name || "Head Office"}</div>
          <div style="font-size:12px;color:#64748b;">${new Date(inv.date).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}</div>
        </div>
        <div style="text-align:right">
          <div class="inv-no">${inv.invoice_no}</div>
          <div class="inv-type">${typeLabel}</div>
        </div>
      </div>
      <div class="copy-label">📋 ${copyLabel}</div>
      <div class="meta">
        <div class="meta-block">
          <h4>${inv.invoice_type === "purchase" ? "Vendor / Supplier" : "Bill To"}</h4>
          <p class="name">${inv.invoice_type === "purchase" ? inv.vendor_name || "—" : inv.customer_name || inv.student_name || "—"}</p>
          ${inv.customer_phone || inv.vendor_contact ? `<p style="color:#64748b">${inv.customer_phone || inv.vendor_contact}</p>` : ""}
          ${inv.order_no ? `<p style="color:#64748b">Order: ${inv.order_no}</p>` : ""}
        </div>
        <div class="meta-block">
          <h4>Invoice Details</h4>
          <p><strong>Invoice No:</strong> ${inv.invoice_no}</p>
          <p><strong>Date:</strong> ${new Date(inv.date).toLocaleDateString("en-IN")}</p>
          <p><strong>Status:</strong> ${inv.status}</p>
          ${inv.notes ? `<p><strong>Notes:</strong> ${inv.notes}</p>` : ""}
        </div>
      </div>
      ${(inv.placed_by || inv.attended_by) ? `
      <div class="people">
        ${inv.placed_by ? `<div><strong>Order placed by:</strong><br/>${inv.placed_by}</div>` : ""}
        ${inv.attended_by ? `<div><strong>Attended by (Employee):</strong><br/>${inv.attended_by}</div>` : ""}
        <div><strong>Invoice created by:</strong><br/>${inv.created_by}</div>
      </div>` : ""}
      <table>
        <thead><tr><th>#</th><th>Description</th><th>Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Tax</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${inv.lines.map((l, i) => `<tr><td>${i+1}</td><td>${l.description}</td><td>${l.qty} ${l.unit}</td><td style="text-align:right">${fmt(l.unit_price)}</td><td style="text-align:right">${l.tax_rate}% (${fmt(l.tax_amount)})</td><td style="text-align:right;font-weight:700">${fmt(l.line_total)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="total-section">
        <div class="total-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
        <div class="total-row"><span>GST / Tax</span><span>${fmt(inv.tax_total)}</span></div>
        <div class="total-row grand-total"><span>Total Amount</span><span>${fmt(inv.total)}</span></div>
      </div>
      <div class="footer">This is a computer generated invoice. No signature required.</div>
    </div>`);
  });

  win.document.write("</body></html>");
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const { isFranchiseManager, isAdmin, isSuperAdmin } = useRole();
  const isFranchiseOnly = isFranchiseManager && !isAdmin && !isSuperAdmin;
  const canCreate = !isFranchiseOnly;           // admin + employee can create
  const canSend   = !isFranchiseOnly;           // admin + employee can send
  const canMarkPaid = isAdmin || isSuperAdmin;  // only admin/super admin mark paid
  const [tab, setTab] = useState<InvoiceTab>("order");
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [employees, setEmployees] = useState<ReturnType<typeof getEmployees>>([]);
  const [orders, setOrders] = useState<OrderRef[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<"all" | LocalInvoice["status"]>("all");
  const [search, setSearch] = useState("");

  // Centres management
  const [newCentreForm, setNewCentreForm] = useState({ name: "", address: "", phone: "" });

  // Order invoice form
  const [orderForm, setOrderForm] = useState({ order_id: "", center_id: "", attended_by: "", notes: "", tax_rate: "18" });

  // Tuition form
  const [tuitionForm, setTuitionForm] = useState({ center_id: "", student_name: "", description: "Monthly Tuition Fee", amount: "5000", tax_rate: "18" });

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({ center_id: "", vendor_name: "", vendor_contact: "", purchase_date: new Date().toISOString().slice(0, 10), notes: "", tax_rate: "18" });
  const [purchaseItems, setPurchaseItems] = useState([{ description: "", qty: 1, unit: "pcs", unit_price: 0 }]);

  const reload = () => {
    const allInv = getInvoices();
    // Franchise sees only invoices linked to their own orders
    const myOrders = getOrders();
    const visibleInv = isFranchiseOnly
      ? allInv.filter((inv) => myOrders.some((o) => o.order_id === inv.order_id))
      : allInv;
    setInvoices(visibleInv);
    setCentres(getCentres());
    setEmployees(getEmployees());
    setOrders(myOrders);
  };

  useEffect(() => {
    reload();
    window.addEventListener("kv-store-update", reload);
    return () => window.removeEventListener("kv-store-update", reload);
  }, []);

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
  const today = new Date().toISOString().slice(0, 10);
  const getCentreName = (id: string) => centres.find((c) => c.id === id)?.name ?? "—";

  // ── Submit order invoice ───────────────────────────────────────────────────
  const submitOrderInvoice = () => {
    if (!orderForm.order_id || !orderForm.center_id) { alert("Select an order and a centre."); return; }
    const order = orders.find((o) => o.order_id === orderForm.order_id);
    if (!order) return;
    const lines = buildLinesFromOrder(orderForm.order_id);
    if (lines.length === 0) { alert("Order has no line items."); return; }
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const taxTotal = lines.reduce((s, l) => s + l.tax_amount, 0);
    addInvoice({
      invoice_type: "order", center_id: orderForm.center_id, center_name: getCentreName(orderForm.center_id),
      order_id: order.order_id, order_no: order.order_no,
      customer_name: order.customer_name, customer_phone: order.customer_phone,
      placed_by: order.placed_by, attended_by: orderForm.attended_by || undefined,
      lines, subtotal, tax_total: taxTotal, total: subtotal + taxTotal,
      tax_rate: Number(orderForm.tax_rate), notes: orderForm.notes || undefined,
      status: "draft", date: today, created_by: user?.full_name ?? "Admin",
    });
    setOrderForm({ order_id: "", center_id: centres[0]?.id ?? "", attended_by: "", notes: "", tax_rate: "18" });
    setShowForm(false);
  };

  // ── Submit tuition invoice ─────────────────────────────────────────────────
  const submitTuitionInvoice = () => {
    if (!tuitionForm.center_id || !tuitionForm.student_name) { alert("Enter student name and select centre."); return; }
    const amount = Number(tuitionForm.amount);
    const taxRate = Number(tuitionForm.tax_rate);
    const tax = (amount * taxRate) / 100;
    const line: InvoiceLine = { description: tuitionForm.description, qty: 1, unit: "month", unit_price: amount, tax_rate: taxRate, tax_amount: tax, line_total: amount + tax };
    addInvoice({
      invoice_type: "tuition", center_id: tuitionForm.center_id, center_name: getCentreName(tuitionForm.center_id),
      student_name: tuitionForm.student_name,
      lines: [line], subtotal: amount, tax_total: tax, total: amount + tax,
      tax_rate: taxRate, status: "draft", date: today, created_by: user?.full_name ?? "Admin",
    });
    setTuitionForm({ center_id: centres[0]?.id ?? "", student_name: "", description: "Monthly Tuition Fee", amount: "5000", tax_rate: "18" });
    setShowForm(false);
  };

  // ── Submit purchase invoice ────────────────────────────────────────────────
  const submitPurchaseInvoice = () => {
    if (!purchaseForm.center_id || !purchaseForm.vendor_name) { alert("Enter vendor name and select centre."); return; }
    const validItems = purchaseItems.filter((i) => i.description && i.unit_price > 0);
    if (validItems.length === 0) { alert("Add at least one material item."); return; }
    const taxRate = Number(purchaseForm.tax_rate);
    const lines: InvoiceLine[] = validItems.map((i) => {
      const lineTotal = i.qty * i.unit_price;
      const tax = (lineTotal * taxRate) / 100;
      return { description: i.description, qty: i.qty, unit: i.unit, unit_price: i.unit_price, tax_rate: taxRate, tax_amount: tax, line_total: lineTotal + tax };
    });
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const taxTotal = lines.reduce((s, l) => s + l.tax_amount, 0);
    addInvoice({
      invoice_type: "purchase", center_id: purchaseForm.center_id, center_name: getCentreName(purchaseForm.center_id),
      vendor_name: purchaseForm.vendor_name, vendor_contact: purchaseForm.vendor_contact || undefined,
      purchase_date: purchaseForm.purchase_date, notes: purchaseForm.notes || undefined,
      lines, subtotal, tax_total: taxTotal, total: subtotal + taxTotal,
      tax_rate: taxRate, status: "draft", date: today, created_by: user?.full_name ?? "Admin",
    });
    setPurchaseItems([{ description: "", qty: 1, unit: "pcs", unit_price: 0 }]);
    setShowForm(false);
  };

  // ── Centre management ──────────────────────────────────────────────────────
  const addNewCentre = () => {
    if (!newCentreForm.name.trim()) { alert("Centre name is required."); return; }
    addCentre(newCentreForm.name, newCentreForm.address, newCentreForm.phone);
    setNewCentreForm({ name: "", address: "", phone: "" });
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filterType !== "all" && inv.status !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoice_no.toLowerCase().includes(q) || (inv.customer_name ?? "").toLowerCase().includes(q) ||
        (inv.vendor_name ?? "").toLowerCase().includes(q) || (inv.student_name ?? "").toLowerCase().includes(q) ||
        (inv.order_no ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const summary = { total: invoices.length, paid: invoices.filter((i) => i.status === "paid").length, draft: invoices.filter((i) => i.status === "draft").length, revenue: invoices.filter((i) => i.status === "paid" && i.invoice_type !== "purchase").reduce((s, i) => s + i.total, 0), purchase: invoices.filter((i) => i.invoice_type === "purchase" && i.status === "paid").reduce((s, i) => s + i.total, 0) };

  const TABS: { key: InvoiceTab; label: string; icon: string }[] = [
    { key: "order", label: "Order Invoice", icon: "🛒" },
    { key: "tuition", label: "Tuition Fee", icon: "🎓" },
    { key: "purchase", label: "Material Purchase", icon: "📦" },
    { key: "centres", label: "Manage Centres", icon: "🏢" },
  ];

  return (
    <div className="space-y-6 p-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            {summary.total} invoices · {fmt(summary.revenue)} collected
            {isFranchiseOnly && <span className="ml-2 text-xs text-orange-600 font-semibold">(Your order invoices — read only)</span>}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => { setShowForm(true); setTab("order"); }}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90">
            + New Invoice
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: summary.total, icon: "🧾", color: "ring-slate-200" },
          { label: "Paid", value: summary.paid, icon: "✅", color: "ring-green-200" },
          { label: "Revenue Collected", value: fmt(summary.revenue), icon: "💰", color: "ring-emerald-200" },
          { label: "Purchases", value: fmt(summary.purchase), icon: "📦", color: "ring-amber-200" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl bg-white p-5 ring-1 ${c.color} shadow-sm`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <p className="text-xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Centres warning */}
      {centres.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
          <span>⚠️ No centres set up yet. Create a centre first before creating invoices.</span>
          <button type="button" onClick={() => { setShowForm(true); setTab("centres"); }} className="rounded-lg bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-300">
            + Add Centre
          </button>
        </div>
      )}

      {/* New Invoice Form */}
      {showForm && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b bg-slate-50">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-semibold transition ${tab === t.key ? "border-b-2 border-brand-purple text-brand-purple bg-white" : "text-slate-500 hover:text-slate-700"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {/* ORDER INVOICE */}
            {tab === "order" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                  Select a delivered/confirmed order → auto-fills items, price, customer name. Creates 3 print copies: Customer, Employee, Admin.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Order *</label>
                    <select required value={orderForm.order_id} onChange={(e) => setOrderForm({ ...orderForm, order_id: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm">
                      <option value="">— Select order —</option>
                      {orders.map((o) => <option key={o.order_id} value={o.order_id}>{o.order_no} · {o.customer_name} · {fmt(o.total)}</option>)}
                    </select>
                    {orders.length === 0 && <p className="mt-1 text-xs text-slate-400">No orders found. Place an order first.</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Centre *</label>
                    <CentreSelect centres={centres} value={orderForm.center_id} onChange={(v) => setOrderForm({ ...orderForm, center_id: v })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Attended by (Employee)</label>
                    <select value={orderForm.attended_by} onChange={(e) => setOrderForm({ ...orderForm, attended_by: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm">
                      <option value="">— Select employee —</option>
                      {employees.filter((e) => e.status === "active").map((e) => <option key={e.id} value={e.full_name}>{e.full_name} {e.designation ? `(${e.designation})` : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</label>
                    <input value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Any additional notes" />
                  </div>
                </div>
                {orderForm.order_id && (() => {
                  const lines = buildLinesFromOrder(orderForm.order_id);
                  const sub = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
                  const tax = lines.reduce((s, l) => s + l.tax_amount, 0);
                  const order = orders.find((o) => o.order_id === orderForm.order_id);
                  return (
                    <div className="rounded-xl border overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide flex justify-between">
                        <span>Preview: {order?.customer_name} · {order?.order_no}</span>
                        {order?.placed_by && <span>Placed by: {order.placed_by}</span>}
                      </div>
                      <table className="w-full text-sm">
                        <thead className="border-b"><tr className="text-xs text-slate-400"><th className="px-4 py-2 text-left">Item</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Unit Price</th><th className="text-right px-4 py-2">GST</th><th className="text-right px-4 py-2">Total</th></tr></thead>
                        <tbody>
                          {lines.map((l, i) => <tr key={i} className="border-b"><td className="px-4 py-2">{l.description}</td><td className="text-right px-4 py-2">{l.qty}</td><td className="text-right px-4 py-2">{fmt(l.unit_price)}</td><td className="text-right px-4 py-2 text-slate-400">{fmt(l.tax_amount)}</td><td className="text-right px-4 py-2 font-semibold">{fmt(l.line_total)}</td></tr>)}
                        </tbody>
                      </table>
                      <div className="bg-slate-50 px-4 py-2 text-sm text-right space-x-6">
                        <span>Subtotal: <strong>{fmt(sub)}</strong></span>
                        <span>GST: <strong>{fmt(tax)}</strong></span>
                        <span className="text-brand-purple font-bold">Total: {fmt(sub + tax)}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={submitOrderInvoice} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white">Create Invoice</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
                </div>
              </div>
            )}

            {/* TUITION INVOICE */}
            {tab === "tuition" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                  For monthly tuition, admission fees, or activity charges. Creates 3 print copies.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Centre *</label>
                    <CentreSelect centres={centres} value={tuitionForm.center_id} onChange={(v) => setTuitionForm({ ...tuitionForm, center_id: v })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Student Name *</label>
                    <input required value={tuitionForm.student_name} onChange={(e) => setTuitionForm({ ...tuitionForm, student_name: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g. Arjun Sharma" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                    <input required value={tuitionForm.description} onChange={(e) => setTuitionForm({ ...tuitionForm, description: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g. Monthly Tuition Fee – June 2026" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Amount (₹)</label>
                    <input type="number" min="1" value={tuitionForm.amount} onChange={(e) => setTuitionForm({ ...tuitionForm, amount: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">GST %</label>
                    <input type="number" min="0" max="100" value={tuitionForm.tax_rate} onChange={(e) => setTuitionForm({ ...tuitionForm, tax_rate: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={submitTuitionInvoice} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white">Create Invoice</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
                </div>
              </div>
            )}

            {/* PURCHASE INVOICE */}
            {tab === "purchase" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                  For materials/supplies purchased from vendors. Creates 2 print copies (Accounts + Vendor). Automatically records expense in Ledger.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Centre *</label>
                    <CentreSelect centres={centres} value={purchaseForm.center_id} onChange={(v) => setPurchaseForm({ ...purchaseForm, center_id: v })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Purchase Date</label>
                    <input type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Vendor / Supplier Name *</label>
                    <input required value={purchaseForm.vendor_name} onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_name: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g. ABC Supplies Pvt. Ltd." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Vendor Contact</label>
                    <input value={purchaseForm.vendor_contact} onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_contact: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Phone or email" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">GST %</label>
                    <input type="number" min="0" max="100" value={purchaseForm.tax_rate} onChange={(e) => setPurchaseForm({ ...purchaseForm, tax_rate: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                    <input value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" />
                  </div>
                </div>
                {/* Line items */}
                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Material Items</span>
                    <button type="button" onClick={() => setPurchaseItems([...purchaseItems, { description: "", qty: 1, unit: "pcs", unit_price: 0 }])}
                      className="text-xs font-semibold text-brand-purple hover:underline">+ Add Item</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b bg-white"><tr className="text-xs text-slate-400"><th className="px-3 py-2 text-left">Description *</th><th className="w-20 text-center px-3 py-2">Qty</th><th className="w-24 text-center px-3 py-2">Unit</th><th className="w-28 text-right px-3 py-2">Unit Price ₹</th><th className="w-24 text-right px-3 py-2">Total</th><th className="w-8" /></tr></thead>
                    <tbody className="divide-y">
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-2"><input required value={item.description} onChange={(e) => setPurchaseItems(purchaseItems.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))} className="w-full rounded-lg border px-2 py-1.5 text-sm" placeholder="e.g. Play Kit, Stationery..." /></td>
                          <td className="px-2 py-2"><input type="number" min="1" value={item.qty} onChange={(e) => setPurchaseItems(purchaseItems.map((it, i) => i === idx ? { ...it, qty: +e.target.value } : it))} className="w-full rounded-lg border px-2 py-1.5 text-sm text-center" /></td>
                          <td className="px-2 py-2"><select value={item.unit} onChange={(e) => setPurchaseItems(purchaseItems.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} className="w-full rounded-lg border px-2 py-1.5 text-sm">{["pcs","set","box","kg","litre","pack","roll","sheet","unit"].map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className="px-2 py-2"><input type="number" min="0" value={item.unit_price || ""} onChange={(e) => setPurchaseItems(purchaseItems.map((it, i) => i === idx ? { ...it, unit_price: +e.target.value } : it))} className="w-full rounded-lg border px-2 py-1.5 text-sm text-right" placeholder="0" /></td>
                          <td className="px-2 py-2 text-right text-sm font-medium text-slate-700">{fmt(item.qty * item.unit_price)}</td>
                          <td className="px-2 py-2"><button type="button" disabled={purchaseItems.length === 1} onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none disabled:opacity-30">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 text-sm font-semibold border-t">
                      {(() => { const sub = purchaseItems.reduce((s, i) => s + i.qty * i.unit_price, 0); const tax = (sub * Number(purchaseForm.tax_rate)) / 100; return (<><tr><td colSpan={4} className="px-4 py-2 text-right text-slate-500">Subtotal</td><td className="px-4 py-2 text-right">{fmt(sub)}</td><td /></tr><tr><td colSpan={4} className="px-4 py-2 text-right text-slate-500">GST ({purchaseForm.tax_rate}%)</td><td className="px-4 py-2 text-right">{fmt(tax)}</td><td /></tr><tr><td colSpan={4} className="px-4 py-2 text-right text-brand-purple font-bold">Total</td><td className="px-4 py-2 text-right text-brand-purple font-bold">{fmt(sub + tax)}</td><td /></tr></>); })()}
                    </tfoot>
                  </table>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={submitPurchaseInvoice} className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">Create Purchase Invoice</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
                </div>
              </div>
            )}

            {/* CENTRES MANAGEMENT */}
            {tab === "centres" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-700">
                  Centres are your physical KidzVenture locations. Add them here once; they'll appear in all invoice forms.
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Centre Name *</label>
                    <input value={newCentreForm.name} onChange={(e) => setNewCentreForm({ ...newCentreForm, name: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g. KidzVenture Anna Nagar" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Address (optional)</label>
                    <input value={newCentreForm.address} onChange={(e) => setNewCentreForm({ ...newCentreForm, address: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Street, City" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Phone (optional)</label>
                    <input value={newCentreForm.phone} onChange={(e) => setNewCentreForm({ ...newCentreForm, phone: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="+91 ..." />
                  </div>
                </div>
                <button type="button" onClick={addNewCentre} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white">Add Centre</button>
                {centres.length > 0 && (
                  <div className="mt-4 rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Address</th><th className="px-4 py-3 text-left">Phone</th></tr></thead>
                      <tbody className="divide-y">
                        {centres.map((c) => <tr key={c.id}><td className="px-4 py-3 font-medium">{c.name}</td><td className="px-4 py-3 text-slate-500">{c.address || "—"}</td><td className="px-4 py-3 text-slate-500">{c.phone || "—"}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["all","draft","sent","paid","cancelled"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilterType(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${filterType === s ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>{s === "all" ? "All" : s}</button>
        ))}
        <div className="ml-auto">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice / order / customer…" className="rounded-xl border px-3 py-2 text-sm w-64" />
        </div>
      </div>

      {/* Invoice list */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
            <tr><th className="px-4 py-3 text-left">Invoice #</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Party</th><th className="px-4 py-3 text-left">Centre</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No invoices yet. Click "+ New Invoice" to create one.</td></tr>
            ) : filteredInvoices.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{inv.invoice_no}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inv.invoice_type === "purchase" ? "bg-amber-100 text-amber-700" : inv.invoice_type === "order" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {inv.invoice_type === "purchase" ? "📦 Purchase" : inv.invoice_type === "order" ? "🛒 Order" : "🎓 Tuition"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{inv.customer_name || inv.vendor_name || inv.student_name || "—"}</p>
                  {inv.order_no && <p className="text-xs text-slate-400">{inv.order_no}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{inv.center_name || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(inv.total)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "draft" ? "bg-slate-100 text-slate-600" : inv.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => printInvoice(inv)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">🖨 Print</button>
                    {inv.status === "draft" && canSend && <button type="button" onClick={() => { updateInvoiceStatus(inv.id, "sent"); reload(); }} className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">Send</button>}
                    {inv.status === "sent" && canMarkPaid && <button type="button" onClick={() => { updateInvoiceStatus(inv.id, "paid"); reload(); }} className="rounded-lg bg-green-50 px-2 py-1 text-xs text-green-600 hover:bg-green-100">Mark Paid</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CentreSelect({ centres, value, onChange }: { centres: Centre[]; value: string; onChange: (v: string) => void }) {
  if (centres.length === 0) return (
    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      No centres yet — go to "Manage Centres" tab to add one first.
    </div>
  );
  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
      <option value="">— Select centre —</option>
      {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
