import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Edit2, ChevronLeft, ChevronRight, X,
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Package2,
  MapPin, Clock, User, ClipboardList, TrendingDown, TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  reorderLevel: number;
  currentStock: number;
  location?: string | null;
  createdAt: string;
  stockMovements?: StockMovement[];
}

interface StockMovement {
  id: number;
  quantity: number;
  type: 'IN' | 'OUT';
  referenceType?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: { name: string; role: string } | null;
}

interface FormData {
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  reorderLevel: number;
  location: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Products() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const isReadOnly = user?.role === 'SALES' || user?.role === 'ACCOUNTS';

  // ── Filters & Pagination ──
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Modal States ──
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ── Form State ──
  const defaultForm: FormData = {
    sku: '', name: '', category: '', unit: 'pcs', price: 0, reorderLevel: 0, location: '',
  };
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [formError, setFormError] = useState('');

  // ── Adjustment State ──
  const [adjQty, setAdjQty] = useState(1);
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');
  const [adjReason, setAdjReason] = useState('');
  const [adjError, setAdjError] = useState('');

  // ── Products Query ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', page, search, lowStock],
    queryFn: async () => {
      const res = await axios.get('/products', {
        params: { page, limit, search: search || undefined, lowStock: lowStock ? 'true' : undefined },
      });
      return res.data;
    },
  });

  // ── Product Detail Query ──
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['product-detail', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return null;
      const res = await axios.get(`/products/${selectedProduct.id}`);
      return res.data as Product;
    },
    enabled: detailOpen && !!selectedProduct?.id,
  });

  // ── Save Product Mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        sku: formData.sku,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        price: parseFloat(String(formData.price)),
        reorderLevel: parseInt(String(formData.reorderLevel), 10),
        location: formData.location || null,
      };
      if (isEditing && selectedProduct) {
        return axios.put(`/products/${selectedProduct.id}`, body);
      }
      return axios.post('/products', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to save product.');
    },
  });

  // ── Stock Adjustment Mutation ──
  const adjustMutation = useMutation({
    mutationFn: async () => {
      return axios.post(`/products/${selectedProduct!.id}/stock-adjustment`, {
        quantity: parseInt(String(adjQty), 10),
        type: adjType,
        reason: adjReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail', selectedProduct?.id] });
      setAdjOpen(false);
    },
    onError: (err: any) => {
      setAdjError(err.response?.data?.error?.message || 'Adjustment failed.');
    },
  });

  // helper to close adjust modal
  const setAdjOpen = (open: boolean) => {
    setAdjustOpen(open);
    if (!open) { setAdjQty(1); setAdjType('IN'); setAdjReason(''); setAdjError(''); }
  };

  // ── Helpers ──
  const resetForm = () => {
    setFormData(defaultForm);
    setIsEditing(false);
    setSelectedProduct(null);
    setFormError('');
  };

  const handleOpenCreate = () => { resetForm(); setModalOpen(true); };

  const handleOpenEdit = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedProduct(product);
    setFormData({
      sku: product.sku, name: product.name, category: product.category,
      unit: product.unit, price: product.price, reorderLevel: product.reorderLevel,
      location: product.location || '',
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleOpenDetail = (product: Product) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.sku || !formData.name || !formData.category || !formData.unit || formData.price <= 0 || formData.reorderLevel < 0) {
      setFormError('Please fill all required fields. Price must be > 0.');
      return;
    }
    saveMutation.mutate();
  };

  const handleAdjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError('');
    if (adjQty <= 0) { setAdjError('Quantity must be at least 1.'); return; }
    if (!adjReason.trim()) { setAdjError('Reason is required.'); return; }
    adjustMutation.mutate();
  };

  // ── Loading / Error ──
  if (isLoading) return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600" />
    </div>
  );

  if (error) return (
    <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
      Failed to load product stock.
    </div>
  );

  const { data: products = [], meta = { totalPages: 1, total: 0 } } = data || {};
  const detail = detailData || selectedProduct;

  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Products & Inventory</h1>
          <p className="text-zinc-400 text-sm">Track stock on hand, SKUs, reorder thresholds, pricing, and movement logs</p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-5 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 w-full max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <Input
              type="text"
              placeholder="Search SKU, name, category, location..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border-0 bg-transparent text-zinc-200 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(e) => { setLowStock(e.target.checked); setPage(1); }}
              className="rounded bg-zinc-900 border-zinc-800 text-indigo-600 h-4 w-4"
            />
            <span className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Low Stock Only
            </span>
          </label>
        </CardContent>
      </Card>

      {/* ── Products Table ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">No products found.</div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min. Alert</TableHead>
                    <TableHead>Status</TableHead>
                    {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p: Product) => {
                    const isLowStock = p.currentStock <= p.reorderLevel;
                    return (
                      <TableRow
                        key={p.id}
                        className="border-zinc-800/60 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                        onClick={() => handleOpenDetail(p)}
                      >
                        <TableCell className="font-mono text-xs text-indigo-400 font-semibold">{p.sku}</TableCell>
                        <TableCell className="font-medium text-zinc-100">{p.name}</TableCell>
                        <TableCell className="text-zinc-400 text-sm">{p.category}</TableCell>
                        <TableCell>
                          {p.location ? (
                            <div className="flex items-center gap-1 text-xs text-zinc-400">
                              <MapPin className="w-3 h-3 text-zinc-500" />{p.location}
                            </div>
                          ) : (
                            <span className="text-zinc-600 text-xs italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-300 text-sm">{formatCurrency(p.price)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-zinc-100">
                          {p.currentStock} <span className="text-[10px] font-normal text-zinc-400">{p.unit}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-500 text-sm">
                          {p.reorderLevel} <span className="text-[10px] text-zinc-600">{p.unit}</span>
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="success" className="w-fit">Healthy</Badge>
                          )}
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                              onClick={(e) => handleOpenEdit(p, e)}
                              title="Edit Product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">{meta.total} product{meta.total !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs text-zinc-300 px-2">{page} / {meta.totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))} disabled={page === meta.totalPages} className="border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────────────
          ADD / EDIT MODAL
      ──────────────────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <Card className="relative w-full max-w-lg border-zinc-800 bg-zinc-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div>
                <CardTitle>{isEditing ? 'Edit Product' : 'Register New Product'}</CardTitle>
                <CardDescription>
                  {isEditing ? 'Update product details. Stock can only be changed via adjustments.' : 'Stock starts at 0 and moves via Purchase Orders or manual adjustments.'}
                </CardDescription>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto flex-1">
              <form onSubmit={handleFormSubmit} id="product-form" className="space-y-4">

                {/* SKU + Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">SKU (Unique Code) *</label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500 uppercase font-mono"
                      placeholder="e.g. SKU-001"
                      disabled={isEditing}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Product Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                      placeholder="e.g. Widget A"
                    />
                  </div>
                </div>

                {/* Category + Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Category *</label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                      placeholder="e.g. Electronics"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Unit *</label>
                    <Select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="bg-zinc-950 border-zinc-800"
                    >
                      <option value="pcs">pcs (Pieces)</option>
                      <option value="kg">kg (Kilograms)</option>
                      <option value="box">box (Boxes)</option>
                      <option value="pack">pack (Packs)</option>
                      <option value="ltr">ltr (Litres)</option>
                      <option value="mtr">mtr (Metres)</option>
                    </Select>
                  </div>
                </div>

                {/* Price + Reorder Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Unit Price (INR) *</label>
                    <Input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500 font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Min. Alert Qty *</label>
                    <Input
                      type="number"
                      value={formData.reorderLevel || ''}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value, 10) || 0 })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500 font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Warehouse / Location <span className="text-zinc-500 font-normal">(optional)</span></label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    placeholder="e.g. Rack B-4, Warehouse 2"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">{formError}</div>
                )}
              </form>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="border-zinc-800 hover:bg-zinc-800">Cancel</Button>
              <Button type="submit" form="product-form" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          PRODUCT DETAIL PANEL (with Stock Movement Log)
      ──────────────────────────────────────────────────────────────────────── */}
      {detailOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <Card className="relative w-full max-w-2xl border-zinc-800 bg-zinc-900 shadow-2xl z-10 max-h-[92vh] flex flex-col">

            {/* Header */}
            <CardHeader className="flex flex-row items-start justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl">{detail?.name}</CardTitle>
                  {detail && detail.currentStock <= detail.reorderLevel ? (
                    <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Low Stock</Badge>
                  ) : (
                    <Badge variant="success">Healthy</Badge>
                  )}
                </div>
                <CardDescription className="mt-1 font-mono text-xs">{detail?.sku} · {detail?.category}</CardDescription>
              </div>
              <button onClick={() => setDetailOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <div className="overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
                </div>
              ) : (
                <CardContent className="pt-5 space-y-5">

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Current Stock', value: `${detail?.currentStock} ${detail?.unit}`, icon: Package2, color: 'text-indigo-400' },
                      { label: 'Min. Alert Qty', value: `${detail?.reorderLevel} ${detail?.unit}`, icon: AlertTriangle, color: 'text-amber-400' },
                      { label: 'Unit Price', value: detail ? formatCurrency(detail.price) : '—', icon: TrendingUp, color: 'text-emerald-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 text-center">
                        <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                        <div className="text-lg font-bold text-zinc-100 font-mono">{s.value}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Location */}
                  {detail?.location && (
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                      <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="text-sm text-zinc-300">{detail.location}</span>
                    </div>
                  )}

                  {/* Stock Movement Log */}
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ClipboardList className="w-3 h-3" /> Stock Movement Log
                    </div>
                    {detail?.stockMovements && detail.stockMovements.length > 0 ? (
                      <div className="space-y-2">
                        {detail.stockMovements.map((mv: StockMovement) => (
                          <div
                            key={mv.id}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                              mv.type === 'IN'
                                ? 'bg-emerald-500/5 border-emerald-500/15'
                                : 'bg-rose-500/5 border-rose-500/15'
                            }`}
                          >
                            {mv.type === 'IN' ? (
                              <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <ArrowUpCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold font-mono ${mv.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {mv.type === 'IN' ? '+' : '-'}{mv.quantity} {detail?.unit}
                                </span>
                                {mv.referenceType && (
                                  <Badge variant="default" className="text-[10px] font-mono py-0">
                                    {mv.referenceType}
                                  </Badge>
                                )}
                              </div>
                              {(mv.reason || mv.notes) && (
                                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{mv.reason || mv.notes}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(mv.createdAt)}
                                </div>
                                {mv.createdBy && (
                                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                    <User className="w-3 h-3" />
                                    {mv.createdBy.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600 italic py-4 text-center">No stock movements recorded yet.</p>
                    )}
                  </div>

                </CardContent>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
              {!isReadOnly && (
                <>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => { setAdjType('IN'); setAdjOpen(true); }}
                  >
                    <TrendingDown className="w-4 h-4 mr-1.5" /> Stock IN
                  </Button>
                  <Button
                    className="bg-rose-600 hover:bg-rose-500 text-white"
                    onClick={() => { setAdjType('OUT'); setAdjOpen(true); }}
                  >
                    <TrendingUp className="w-4 h-4 mr-1.5" /> Stock OUT
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setDetailOpen(false); if (detail) handleOpenEdit(detail as Product); }}
                    className="border-zinc-800 hover:bg-zinc-800"
                  >
                    <Edit2 className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setDetailOpen(false)} className="border-zinc-800 hover:bg-zinc-800">Close</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          STOCK ADJUSTMENT MODAL
      ──────────────────────────────────────────────────────────────────────── */}
      {adjustOpen && selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setAdjOpen(false)} />
          <Card className="relative w-full max-w-sm border-zinc-800 bg-zinc-900 shadow-2xl z-10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <CardTitle className={adjType === 'IN' ? 'text-emerald-400' : 'text-rose-400'}>
                  {adjType === 'IN' ? '↓ Stock IN' : '↑ Stock OUT'} — {selectedProduct.name}
                </CardTitle>
                <CardDescription>
                  Current stock: <span className="font-mono font-bold text-zinc-200">{selectedProduct.currentStock} {selectedProduct.unit}</span>
                </CardDescription>
              </div>
              <button onClick={() => setAdjOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleAdjSubmit} id="adj-form" className="space-y-4">
                {/* Type selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Movement Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['IN', 'OUT'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAdjType(t)}
                        className={`py-2 rounded-lg border text-sm font-semibold transition-colors ${
                          adjType === t
                            ? t === 'IN' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-rose-600/20 border-rose-500/50 text-rose-400'
                            : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                        }`}
                      >
                        {t === 'IN' ? '↓ IN' : '↑ OUT'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Quantity ({selectedProduct.unit}) *</label>
                  <Input
                    type="number"
                    min={1}
                    value={adjQty}
                    onChange={(e) => setAdjQty(parseInt(e.target.value, 10) || 1)}
                    className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Reason *</label>
                  <textarea
                    rows={2}
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder={adjType === 'IN' ? 'e.g. New stock received from supplier' : 'e.g. Damaged goods removed, sample dispatch'}
                    className="flex w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>

                {adjError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">{adjError}</div>
                )}
              </form>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
              <Button variant="outline" onClick={() => setAdjOpen(false)} className="border-zinc-800 hover:bg-zinc-800">Cancel</Button>
              <Button
                type="submit"
                form="adj-form"
                className={adjType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'}
                disabled={adjustMutation.isPending}
              >
                {adjustMutation.isPending ? 'Saving...' : `Confirm ${adjType === 'IN' ? 'Stock IN' : 'Stock OUT'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
