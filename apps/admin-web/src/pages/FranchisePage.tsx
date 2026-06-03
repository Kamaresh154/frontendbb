import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import { api } from "../api/client";

interface Franchise {
  id: string;
  name: string;
  slug: string;
  plan: string;
  student_count: number;
  center_count: number;
  created_at: string;
}

interface FranchiseSummary {
  total_franchises: number;
  total_students: number;
  total_revenue: number;
}

interface FranchiseOrder {
  id: string;
  franchise_id: string;
  franchise_name: string;
  product: string;
  qty: number;
  unit_price: number;
  amount: number;
  status: "required" | "purchased" | "delivered";
  date: string;
}

interface FranchiseInvoice {
  id: string;
  franchise_id: string;
  franchise_name: string;
  invoice_no: string;
  date: string;
  items: { description: string; qty: number; amount: number }[];
  total: number;
  status: "draft" | "sent" | "paid";
}

const FR_ORDERS_KEY = "kv_franchise_orders";
const FR_INVOICES_KEY = "kv_franchise_invoices";

function getFrOrders(): FranchiseOrder[] {
  try { return JSON.parse(localStorage.getItem(FR_ORDERS_KEY) ?? "[]"); } catch { return []; }
}
function getFrInvoices(): FranchiseInvoice[] {
  try { return JSON.parse(localStorage.getItem(FR_INVOICES_KEY) ?? "[]"); } catch { return []; }
}

type Tab = "overview" | "products" | "invoices";

const FR_ORDER_NEXT: Partial<Record<FranchiseOrder["status"], FranchiseOrder["status"]>> = {
  required: "purchased",
  purchased: "delivered",
};
const FR_ORDER_NEXT_LABELS: Partial<Record<FranchiseOrder["status"], string>> = {
  required: "Mark Purchased",
  purchased: "Mark Delivered",
};

export default function FranchisePage() {
  const { user } = useAuth();
  const { isEmployee, isAdmin, isSuperAdmin: isSA } = useRole();
  const isSuperAdmin = user?.roles?.includes("super_admin") || user?.roles?.includes("admin");
  // Only employee, admin, super_admin can update franchise order status
  const canUpdateFrOrderStatus = isEmployee || isAdmin || isSA;
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [summary, setSummary] = useState<FranchiseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFr, setSelectedFr] = useState<Franchise | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [frOrders, setFrOrders] = useState<FranchiseOrder[]>(getFrOrders);
  const [frInvoices, setFrInvoices] = useState<FranchiseInvoice[]>(getFrInvoices);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ product: "", qty: 1, unit_price: 0, status: "required" as FranchiseOrder["status"] });
  const [invForm, setInvForm] = useState({ description: "", qty: 1, amount: 0 });
  const [invItems, setInvItems] = useState<{ description: string; qty: number; amount: number }[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    Promise.all([
      api.get<{ items: Franchise[] }>("/franchise/organizations"),
      api.get<FranchiseSummary>("/franchise/summary"),
    ]).then(([orgsRes, sumRes]) => {
      setFranchises(orgsRes.data.items);
      setSummary(sumRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const addOrder = () => {
    if (!selectedFr || !orderForm.product) return;
    const order: FranchiseOrder = {
      id: Date.now().toString(),
      franchise_id: selectedFr.id,
      franchise_name: selectedFr.name,
      product: orderForm.product,
      qty: orderForm.qty,
      unit_price: orderForm.unit_price,
      amount: orderForm.qty * orderForm.unit_price,
      status: orderForm.status,
      date: new Date().toLocaleDateString("en-IN"),
    };
    const updated = [...frOrders, order];
    setFrOrders(updated);
    localStorage.setItem(FR_ORDERS_KEY, JSON.stringify(updated));
    setOrderForm({ product: "", qty: 1, unit_price: 0, status: "required" });
    setShowOrderForm(false);
  };

  const generateInvoice = () => {
    if (!selectedFr || invItems.length === 0) return;
    const inv: FranchiseInvoice = {
      id: Date.now().toString(),
      franchise_id: selectedFr.id,
      franchise_name: selectedFr.name,
      invoice_no: "FI-" + String(frInvoices.length + 1).padStart(4, "0"),
      date: new Date().toLocaleDateString("en-IN"),
      items: invItems,
      total: invItems.reduce((s, i) => s + i.amount, 0),
      status: "draft",
    };
    const updated = [...frInvoices, inv];
    setFrInvoices(updated);
    localStorage.setItem(FR_INVOICES_KEY, JSON.stringify(updated));
    setInvItems([]);
    setShowInvoiceForm(false);
  };

  const updateInvStatus = (id: string, status: FranchiseInvoice["status"]) => {
    const updated = frInvoices.map((inv) => inv.id === id ? { ...inv, status } : inv);
    setFrInvoices(updated);
    localStorage.setItem(FR_INVOICES_KEY, JSON.stringify(updated));
  };

  const updateFrOrderStatus = (id: string, status: FranchiseOrder["status"]) => {
    if (!canUpdateFrOrderStatus) return;
    const updated = frOrders.map((o) => o.id === id ? { ...o, status } : o);
    setFrOrders(updated);
    localStorage.setItem(FR_ORDERS_KEY, JSON.stringify(updated));
  };

  const frOrdersForSelected = frOrders.filter((o) => o.franchise_id === selectedFr?.id);
  const frInvoicesForSelected = frInvoices.filter((inv) => inv.franchise_id === selectedFr?.id);
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-6 text-center">
          <p className="text-2xl mb-2">🏢</p>
          <h2 className="font-semibold text-yellow-800">Franchise Manager View</h2>
          <p className="text-yellow-600 text-sm mt-1">Your franchise details are managed by the admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Franchise list */}
      <div className="flex w-72 flex-col border-r bg-white shadow-sm">
        <div className="border-b p-4">
          <h1 className="text-lg font-bold text-slate-900">Franchise</h1>
          {summary && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-purple-50 p-2 text-center">
                <p className="text-lg font-bold text-brand-purple">{summary.total_franchises}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2 text-center">
                <p className="text-sm font-bold text-green-700">{fmt(summary.total_revenue)}</p>
                <p className="text-xs text-slate-500">Revenue</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {loading && <p className="p-4 text-sm text-slate-400">Loading…</p>}
          {franchises.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setSelectedFr(f); setTab("overview"); }}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${selectedFr?.id === f.id ? "bg-purple-50 border-r-2 border-brand-purple" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-sm font-bold text-brand-purple">
                  {f.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.plan} · {f.center_count} centers</p>
                </div>
              </div>
            </button>
          ))}
          {!loading && franchises.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">No franchises found</p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedFr ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          {/* Header */}
          <div className="border-b bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple text-lg font-bold text-white shadow">
                {selectedFr.name[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedFr.name}</h2>
                <p className="text-sm text-slate-500">/{selectedFr.slug} · {selectedFr.plan} plan · {selectedFr.student_count} students</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(["overview", "products", "invoices"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${
                    tab === t ? "bg-brand-purple text-white shadow" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t === "overview" ? "📊 Overview" : t === "products" ? "📦 Products" : "🧾 Invoices"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {tab === "overview" && (
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Plan", value: selectedFr.plan },
                  { label: "Centers", value: selectedFr.center_count },
                  { label: "Students", value: selectedFr.student_count },
                  { label: "Products Ordered", value: frOrdersForSelected.length },
                  { label: "Invoices Generated", value: frInvoicesForSelected.length },
                  { label: "Total Invoice Value", value: fmt(frInvoicesForSelected.reduce((s, i) => s + i.total, 0)) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "products" && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <p className="text-sm font-semibold text-slate-700">Products Purchased / Required</p>
                  <button type="button" onClick={() => setShowOrderForm(true)}
                    className="rounded-xl bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                    + Add Product Entry
                  </button>
                </div>
                {showOrderForm && (
                  <div className="mb-4 rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Product Name</label>
                        <input value={orderForm.product} onChange={(e) => setOrderForm({ ...orderForm, product: e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                        <select value={orderForm.status} onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as FranchiseOrder["status"] })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                          <option value="required">Required</option>
                          <option value="purchased">Purchased</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
                        <input type="number" value={orderForm.qty} onChange={(e) => setOrderForm({ ...orderForm, qty: +e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Unit Price (₹)</label>
                        <input type="number" value={orderForm.unit_price} onChange={(e) => setOrderForm({ ...orderForm, unit_price: +e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={addOrder} className="rounded-xl bg-brand-purple px-4 py-2 text-sm text-white">Save</button>
                      <button type="button" onClick={() => setShowOrderForm(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  {frOrdersForSelected.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">No product records yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Unit Price</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {frOrdersForSelected.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{o.product}</td>
                            <td className="px-4 py-3 text-right">{o.qty}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs">{fmt(o.unit_price)}</td>
                            <td className="px-4 py-3 text-right font-bold">{fmt(o.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                o.status === "delivered" ? "bg-green-100 text-green-700" :
                                o.status === "purchased" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                              }`}>{o.status}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{o.date}</td>
                            <td className="px-4 py-3">
                              {canUpdateFrOrderStatus && FR_ORDER_NEXT[o.status] ? (
                                <button
                                  type="button"
                                  onClick={() => updateFrOrderStatus(o.id, FR_ORDER_NEXT[o.status]!)}
                                  className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200 font-medium"
                                >
                                  {FR_ORDER_NEXT_LABELS[o.status]}
                                </button>
                              ) : !canUpdateFrOrderStatus && o.status !== "delivered" ? (
                                <span className="text-xs text-slate-400 italic">Employee/Admin only</span>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">✓ Complete</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === "invoices" && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <p className="text-sm font-semibold text-slate-700">Franchise Invoices</p>
                  <button type="button" onClick={() => setShowInvoiceForm(true)}
                    className="rounded-xl bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                    + Generate Invoice
                  </button>
                </div>

                {showInvoiceForm && (
                  <div className="mb-4 rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-3">New Invoice for {selectedFr.name}</h3>
                    <div className="grid gap-3 sm:grid-cols-3 mb-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                        <input value={invForm.description} onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
                        <input type="number" value={invForm.qty} onChange={(e) => setInvForm({ ...invForm, qty: +e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Amount (₹)</label>
                        <input type="number" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: +e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                      </div>
                    </div>
                    <button type="button" onClick={() => { if (invForm.description) { setInvItems([...invItems, invForm]); setInvForm({ description: "", qty: 1, amount: 0 }); }}}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 mb-3">
                      + Add Line Item
                    </button>
                    {invItems.length > 0 && (
                      <div className="mb-3 rounded-xl border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                          <tbody>{invItems.map((item, i) => (
                            <tr key={i} className="border-t"><td className="px-3 py-2">{item.description}</td><td className="px-3 py-2 text-right">{item.qty}</td><td className="px-3 py-2 text-right font-bold">{fmt(item.amount)}</td></tr>
                          ))}</tbody>
                        </table>
                        <div className="bg-slate-50 px-3 py-2 text-right text-sm font-bold">Total: {fmt(invItems.reduce((s, i) => s + i.amount, 0))}</div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={generateInvoice} className="rounded-xl bg-brand-purple px-4 py-2 text-sm text-white">Generate Invoice</button>
                      <button type="button" onClick={() => { setShowInvoiceForm(false); setInvItems([]); }} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {frInvoicesForSelected.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No invoices yet</p>}
                  {frInvoicesForSelected.map((inv) => (
                    <div key={inv.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-slate-800">{inv.invoice_no}</p>
                          <p className="text-xs text-slate-400">{inv.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xl font-bold text-slate-900">{fmt(inv.total)}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            inv.status === "paid" ? "bg-green-100 text-green-700" :
                            inv.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                          }`}>{inv.status}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mb-3 space-y-1">
                        {inv.items.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.description} ×{item.qty}</span>
                            <span>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {inv.status === "draft" && (
                          <button type="button" onClick={() => updateInvStatus(inv.id, "sent")} className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-200">Send</button>
                        )}
                        {inv.status === "sent" && (
                          <button type="button" onClick={() => updateInvStatus(inv.id, "paid")} className="rounded-lg bg-green-100 px-3 py-1.5 text-xs text-green-700 hover:bg-green-200">Mark Paid</button>
                        )}
                        <button type="button" className="rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">🖨 Print</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-slate-500 text-sm">Select a franchise to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
