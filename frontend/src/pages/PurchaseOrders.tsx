import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Eye, CheckCircle2, AlertOctagon, Calendar, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const isReadOnly = user?.role === 'ACCOUNTS';

  // Modal / Selection states
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  // Raised PO Form State
  const [supplierName, setSupplierName] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poItems, setPoItems] = useState<Array<{ productId: number; quantity: number; unitCost: number }>>([
    { productId: 0, quantity: 1, unitCost: 0 },
  ]);
  const [statusFilter, setStatusFilter] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Purchase Orders
  const { data: orders = [], isLoading: isOrdersLoading, error: ordersError } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await axios.get('/purchase-orders');
      return res.data;
    },
  });

  // Fetch products to populate item selectors (limit: 100 to get list)
  const { data: productsData } = useQuery({
    queryKey: ['products-list-dropdown'],
    queryFn: async () => {
      const res = await axios.get('/products', { params: { page: 1, limit: 100 } });
      return res.data.data;
    },
  });
  const productsList = productsData || [];

  // Create PO Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const formattedItems = poItems.map((item) => ({
        productId: item.productId,
        quantity: parseInt(String(item.quantity), 10),
        unitCost: parseFloat(String(item.unitCost)),
      }));

      return axios.post('/purchase-orders', {
        supplierName,
        poDate: new Date(poDate).toISOString(),
        items: formattedItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to raise purchase order.');
    },
  });

  // Receive PO Mutation
  const receiveMutation = useMutation({
    mutationFn: async (poId: number) => {
      return axios.patch(`/purchase-orders/${poId}/receive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDetailsOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to receive stock.');
    },
  });

  // Cancel PO Mutation
  const cancelMutation = useMutation({
    mutationFn: async (poId: number) => {
      return axios.patch(`/purchase-orders/${poId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDetailsOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to cancel purchase order.');
    },
  });

  const resetForm = () => {
    setSupplierName('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setPoItems([{ productId: 0, quantity: 1, unitCost: 0 }]);
    setFormError('');
  };

  const handleAddItemRow = () => {
    setPoItems([...poItems, { productId: 0, quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    const updated = [...poItems];
    updated.splice(index, 1);
    setPoItems(updated);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...poItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setPoItems(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!supplierName || !poDate) {
      setFormError('Supplier Name and PO Date are required.');
      return;
    }

    const hasInvalidItem = poItems.some(
      (item) => item.productId === 0 || item.quantity <= 0 || item.unitCost <= 0
    );

    if (hasInvalidItem) {
      setFormError('Please select a valid product, quantity, and unit cost for all items.');
      return;
    }

    createMutation.mutate();
  };

  const calculateRunningTotal = () => {
    return poItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  };

  if (isOrdersLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-violet-600"></div>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load Purchase Orders.
      </div>
    );
  }

  const filteredOrders = orders.filter((po: any) => !statusFilter || po.status === statusFilter);
  const activeTabIdx = ["", "DRAFT", "ORDERED", "RECEIVED", "CANCELLED"].indexOf(statusFilter);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Purchase Orders (Stock In)</h1>
          <p className="text-zinc-400 text-sm">Raise procurement orders, verify supplier logs, and receive stock</p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2 shadow-lg shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" />
            <span>Raise PO</span>
          </Button>
        )}
      </div>

      {/* Sliding Sub-Navigation Status Tabs */}
      <div className="relative flex bg-zinc-900/60 p-1 border border-zinc-800 rounded-lg max-w-lg w-full">
        {/* Sliding background indicator */}
        <div
          className="absolute top-1 bottom-1 bg-indigo-600/15 border border-indigo-500/30 rounded-md transition-all duration-300 ease-out"
          style={{
            width: "calc(20% - 6px)",
            left: `calc(3px + ${activeTabIdx * 20}%)`
          }}
        />
        {[
          { label: "All", value: "" },
          { label: "Draft", value: "DRAFT" },
          { label: "Ordered", value: "ORDERED" },
          { label: "Received", value: "RECEIVED" },
          { label: "Cancelled", value: "CANCELLED" }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`relative z-10 flex-1 py-1.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === tab.value ? "text-indigo-400 font-bold" : "text-zinc-455 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PO Listing */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">No Purchase Orders found matching filter.</div>
          ) : (
            <div key={statusFilter} className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead>PO ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>PO Date</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((po: any) => (
                    <TableRow
                      key={po.id}
                      className="border-zinc-850 cursor-pointer hover:bg-zinc-800/40"
                      onClick={() => {
                        setSelectedPO(po);
                        setDetailsOpen(true);
                      }}
                    >
                    <TableCell className="font-mono text-xs text-violet-400 font-semibold">
                      PO-{String(po.id).padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">{po.supplierName}</TableCell>
                    <TableCell className="text-slate-450 text-xs">{formatDate(po.poDate)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-200">
                      {formatCurrency(po.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          po.status === 'RECEIVED'
                            ? 'success'
                            : po.status === 'ORDERED'
                              ? 'info'
                              : po.status === 'CANCELLED'
                                ? 'destructive'
                                : 'warning'
                        }
                      >
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPO(po);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RAISE PO MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <Card className="relative w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div>
                <CardTitle>Raise Purchase Order</CardTitle>
                <CardDescription>Specify supplier details and products to procure</CardDescription>
              </div>
              <button onClick={() => setCreateOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto flex-1 space-y-4">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Supplier Name *</label>
                    <Input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                      placeholder="e.g. Logitech Wholesale Inc"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">PO Date *</label>
                    <Input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm font-semibold text-slate-200">Line Items</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItemRow}
                      className="border-slate-850 hover:bg-slate-850 h-7 text-xs px-2"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {poItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                        {/* Product Dropdown */}
                        <div className="col-span-5 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Product SKU *</label>
                          <Select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', parseInt(e.target.value, 10))}
                            className="bg-slate-950 border-slate-850"
                          >
                            <option value={0}>-- Select Product SKU --</option>
                            {productsList.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.sku} | {p.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {/* Quantity */}
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Quantity *</label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            className="bg-slate-950 border-slate-850 font-mono"
                            placeholder="Qty"
                          />
                        </div>
                        {/* Cost */}
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Unit Cost (INR) *</label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={item.unitCost || ''}
                            onChange={(e) => handleItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="bg-slate-950 border-slate-850 font-mono"
                            placeholder="Cost"
                          />
                        </div>
                        {/* Action */}
                        <div className="col-span-1 flex justify-center pb-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={poItems.length === 1}
                            onClick={() => handleRemoveItemRow(index)}
                            className="h-8 w-8 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-4 rounded-lg border border-slate-850">
                  <span className="text-sm font-semibold text-slate-400">Total Procurement Amount:</span>
                  <span className="text-xl font-bold font-mono text-violet-400">
                    {formatCurrency(calculateRunningTotal())}
                  </span>
                </div>

                {formError && (
                  <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end space-x-2 border-t border-slate-800 pt-4 shrink-0">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-850 hover:bg-slate-850">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/15" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Raising...' : 'Raise Purchase Order'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PO DETAILS MODAL */}
      {detailsOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDetailsOpen(false)} />
          <Card className="relative w-full max-w-xl border-slate-800 bg-slate-900 shadow-2xl z-10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <CardTitle>PO ID: PO-{String(selectedPO.id).padStart(4, '0')}</CardTitle>
                <CardDescription>Supplier: {selectedPO.supplierName}</CardDescription>
              </div>
              <button onClick={() => setDetailsOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PO Date</span>
                  <span className="text-slate-200 font-medium">{formatDate(selectedPO.poDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Status</span>
                  <Badge
                    variant={
                      selectedPO.status === 'RECEIVED'
                        ? 'success'
                        : selectedPO.status === 'ORDERED'
                          ? 'info'
                          : selectedPO.status === 'CANCELLED'
                            ? 'destructive'
                            : 'warning'
                    }
                  >
                    {selectedPO.status}
                  </Badge>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-850 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-850 hover:bg-transparent">
                      <TableHead>Product SKU</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.items.map((item: any) => (
                      <TableRow key={item.id} className="border-slate-850 hover:bg-transparent">
                        <TableCell className="font-mono text-xs text-slate-300">
                          {item.product?.sku || 'UNKNOWN'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-400">
                          {formatCurrency(item.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {formatCurrency(item.quantity * item.unitCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-xs font-semibold text-slate-400">Total Purchase Value:</span>
                <span className="text-lg font-bold font-mono text-violet-400">
                  {formatCurrency(selectedPO.totalAmount)}
                </span>
              </div>
            </CardContent>

            <div className="flex justify-between p-4 border-t border-slate-850 bg-slate-900/60 rounded-b-xl">
              <div>
                {!isReadOnly && (selectedPO.status === 'DRAFT' || selectedPO.status === 'ORDERED') && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex items-center space-x-1.5"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedPO.id)}
                  >
                    <AlertOctagon className="w-4 h-4" />
                    <span>Cancel PO</span>
                  </Button>
                )}
              </div>
              <div className="flex space-x-2">
                {!isReadOnly && (selectedPO.status === 'DRAFT' || selectedPO.status === 'ORDERED') && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/15"
                    disabled={receiveMutation.isPending}
                    onClick={() => receiveMutation.mutate(selectedPO.id)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Received</span>
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailsOpen(false)} className="border-slate-850 hover:bg-slate-850">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
