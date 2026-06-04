import { useState } from "react";
import { useRole } from "../context/RoleGuard";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  mrp: number;
  stock: number;
  active: boolean;
  image_url?: string;
}

const STORAGE_KEY = "kv_product_catalogue";

function getProducts(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default demo products
  return [
    { id: "p1", name: "Play Kit Pro", sku: "PK-001", category: "Kits", description: "Premium activity play kit for ages 3-7", unit: "kit", cost_price: 850, selling_price: 1200, mrp: 1500, stock: 45, active: true },
    { id: "p2", name: "Activity Booklet Set", sku: "AB-002", category: "Books", description: "Set of 5 activity booklets", unit: "set", cost_price: 120, selling_price: 199, mrp: 250, stock: 200, active: true },
    { id: "p3", name: "Learning Flash Cards", sku: "FC-003", category: "Cards", description: "Educational flash card collection", unit: "pack", cost_price: 180, selling_price: 299, mrp: 350, stock: 80, active: true },
    { id: "p4", name: "Franchise Starter Pack", sku: "FS-010", category: "Franchise", description: "Complete starter package for new franchise", unit: "pack", cost_price: 15000, selling_price: 25000, mrp: 30000, stock: 10, active: true },
  ];
}

const CATEGORIES = ["All", "Kits", "Books", "Cards", "Franchise", "Others"];

const BLANK: Omit<Product, "id"> = {
  name: "", sku: "", category: "Kits", description: "", unit: "pcs",
  cost_price: 0, selling_price: 0, mrp: 0, stock: 0, active: true,
};

export default function ProductCataloguePage() {
  const { isFranchiseManager, isSuperAdmin, isEmployee } = useRole();
  const canEdit = isSuperAdmin || isEmployee; // franchise managers get view-only
  const [products, setProducts] = useState<Product[]>(getProducts);
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Product, "id">>(BLANK);
  const [editId, setEditId] = useState<string | null>(null);

  const save = () => {
    if (!form.name) return;
    let updated: Product[];
    if (editId) {
      updated = products.map((p) => p.id === editId ? { ...form, id: editId } : p);
    } else {
      updated = [...products, { ...form, id: Date.now().toString() }];
    }
    setProducts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setForm(BLANK);
    setShowForm(false);
    setEditId(null);
  };

  const toggle = (id: string) => {
    const updated = products.map((p) => p.id === id ? { ...p, active: !p.active } : p);
    setProducts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const editProduct = (p: Product) => {
    const { id, ...rest } = p;
    setForm(rest);
    setEditId(id);
    setShowForm(true);
  };

  const filtered = products.filter((p) => {
    const matchCat = catFilter === "All" || p.category === catFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalogue</h1>
          <p className="mt-1 text-sm text-slate-500">{canEdit ? "Manage products, prices and availability" : "Browse available products"}</p>
        </div>
        {canEdit && (
        <button
          type="button"
          onClick={() => { setForm(BLANK); setEditId(null); setShowForm(true); }}
          className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 shadow-sm"
        >
          + Add Product
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-purple"
        />
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCatFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                catFilter === c ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && canEdit && (
        <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">{editId ? "Edit Product" : "Add New Product"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Product Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                {["Kits", "Books", "Cards", "Franchise", "Others"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                placeholder="pcs / kit / set" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Cost Price (₹)</label>
              <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: +e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Selling Price (₹)</label>
              <input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: +e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">MRP (₹)</label>
              <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: +e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Current Stock</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white">Save Product</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Product cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div key={p.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${!p.active ? "opacity-50" : ""}`}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{p.category}</span>
            </div>
            {p.description && <p className="text-xs text-slate-500 mb-3">{p.description}</p>}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs text-slate-400">Cost</p>
                <p className="text-sm font-bold text-slate-700">{fmt(p.cost_price)}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-2 text-center">
                <p className="text-xs text-slate-400">Sell</p>
                <p className="text-sm font-bold text-brand-purple">{fmt(p.selling_price)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs text-slate-400">MRP</p>
                <p className="text-sm font-bold text-slate-700">{fmt(p.mrp)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${p.stock > 10 ? "text-green-600" : p.stock > 0 ? "text-orange-500" : "text-red-600"}`}>
                  {p.stock} {p.unit} in stock
                </span>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <>
                <button type="button" onClick={() => editProduct(p)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">Edit</button>
                <button type="button" onClick={() => toggle(p.id)} className={`rounded-lg px-2 py-1 text-xs ${p.active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                  {p.active ? "Deactivate" : "Activate"}
                </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center text-slate-400">No products found</div>
        )}
      </div>
    </div>
  );
}
