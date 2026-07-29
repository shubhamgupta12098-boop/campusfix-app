import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState, StatCard } from '@/components/ui';
import type { InventoryItem } from '@/lib/supabase';
import { Package, Plus, AlertTriangle, Boxes, TrendingDown, X, Search } from 'lucide-react';

export function InventoryScreen() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff';

  const [form, setForm] = useState({ name: '', category: '', unit: 'pcs', current_stock: 0, min_stock: 5, max_stock: 100, unit_cost: 0, supplier: '' });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name');
    setItems((data || []) as InventoryItem[]);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('inventory_items').insert(form);
    setShowAdd(false);
    setForm({ name: '', category: '', unit: 'pcs', current_stock: 0, min_stock: 5, max_stock: 100, unit_cost: 0, supplier: '' });
    void load();
  };

  const updateStock = async (item: InventoryItem, delta: number) => {
    const newStock = Math.max(0, item.current_stock + delta);
    await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', item.id);
    await supabase.from('inventory_transactions').insert({
      item_id: item.id,
      transaction_type: delta > 0 ? 'in' : 'out',
      quantity: Math.abs(delta),
      created_by: profile?.id,
      notes: delta > 0 ? 'Stock added' : 'Stock removed',
    });
    void load();
  };

  const filtered = items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));
  const lowStock = items.filter((i) => i.current_stock <= i.min_stock);
  const totalValue = items.reduce((sum, i) => sum + i.current_stock * i.unit_cost, 0);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Inventory Management"
        subtitle="Track maintenance supplies and spare parts"
        action={canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all">
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Items" value={items.length} icon={Boxes} color="blue" />
        <StatCard label="Low Stock" value={lowStock.length} icon={AlertTriangle} color="amber" />
        <StatCard label="Categories" value={new Set(items.map((i) => i.category)).size} icon={Package} color="violet" />
        <StatCard label="Stock Value" value={`₹${totalValue.toFixed(0)}`} icon={TrendingDown} color="emerald" />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 bg-white" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-0"><EmptyState icon={Package} title="No items" description="Add inventory items to track stock." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isLow = item.current_stock <= item.min_stock;
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLow ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      <Package className={`w-5 h-5 ${isLow ? 'text-amber-600' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                    </div>
                  </div>
                  {isLow && <Badge className="bg-amber-50 text-amber-700">Low</Badge>}
                </div>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{item.current_stock}<span className="text-sm text-slate-400 font-normal ml-1">{item.unit}</span></p>
                    <p className="text-xs text-slate-500">Min: {item.min_stock} · Max: {item.max_stock}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">₹{item.unit_cost}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateStock(item, -1)} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">−</button>
                    <button onClick={() => updateStock(item, 1)} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">+</button>
                    <button onClick={() => updateStock(item, 10)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100">+10</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <Card className="p-6 w-full max-w-md" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add Inventory Item</h3>
                <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Item name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required placeholder="Category"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (pcs)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: +e.target.value })} placeholder="Stock"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                  <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} placeholder="Min"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                  <input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: +e.target.value })} placeholder="Cost"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                </div>
                <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Add Item</button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
