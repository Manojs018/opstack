import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Eye, CheckCircle2, XCircle, Receipt, Trash2, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function SalesChallans() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const role = user?.role || 'SALES';

  const isWarehouse = role === 'WAREHOUSE';
  const isAccounts = role === 'ACCOUNTS';
  const canCreate = role === 'ADMIN' || role === 'SALES';
  const canManageStatus = role === 'ADMIN' || role === 'SALES' || role === 'WAREHOUSE';

  // Modal / Selection states
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<any>(null);

  // Form States
  const [customerId, setCustomerId] = useState(0);
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialStatus, setInitialStatus] = useState<'DRAFT' | 'CONFIRMED'>('DRAFT');
  const [challanItems, setChallanItems] = useState<Array<{ productId: number; quantity: number; unitPrice: number }>>([
    { productId: 0, quantity: 1, unitPrice: 0 },
  ]);
  const [statusFilter, setStatusFilter] = useState('');
  const [formError, setFormError] = useState('');
  const [modalActionError, setModalActionError] = useState('');

  // Fetch Sales Challans
  const { data: challans = [], isLoading: isChallansLoading, error: challansError } = useQuery({
    queryKey: ['sales-challans'],
    queryFn: async () => {
      const res = await axios.get('/sales-challans');
      return res.data;
    },
  });

  // Fetch Customers to populate dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list-dropdown'],
    queryFn: async () => {
      const res = await axios.get('/customers', { params: { page: 1, limit: 100 } });
      return res.data.data;
    },
  });
  const customersList = customersData || [];

  // Fetch Products to populate dropdown & stock
  const { data: productsData } = useQuery({
    queryKey: ['products-list-dropdown'],
    queryFn: async () => {
      const res = await axios.get('/products', { params: { page: 1, limit: 100 } });
      return res.data.data;
    },
  });
  const productsList = productsData || [];

  // Create Challan Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const formattedItems = challanItems.map((item) => ({
        productId: item.productId,
        quantity: parseInt(String(item.quantity), 10),
        unitPrice: parseFloat(String(item.unitPrice)),
      }));

      return axios.post('/sales-challans', {
        customerId,
        challanDate: new Date(challanDate).toISOString(),
        status: initialStatus,
        items: formattedItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-challans'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to create sales challan.');
    },
  });

  // Update Status Mutation (Confirm / Cancel)
  const statusMutation = useMutation({
    mutationFn: async ({ challanId, status }: { challanId: number; status: string }) => {
      return axios.patch(`/sales-challans/${challanId}/status`, { status });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-challans'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedChallan(res.data);
      setModalActionError('');
    },
    onError: (err: any) => {
      setModalActionError(err.response?.data?.error?.message || 'Failed to update challan status.');
    },
  });

  // Convert to Invoice Mutation
  const convertMutation = useMutation({
    mutationFn: async (challanId: number) => {
      return axios.post(`/sales-challans/${challanId}/convert-to-invoice`);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales-challans'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDetailsOpen(false);
      alert(`Invoice created successfully! Number: ${res.data.invoiceNumber}`);
    },
    onError: (err: any) => {
      setModalActionError(err.response?.data?.error?.message || 'Failed to convert to invoice.');
    },
  });

  const resetForm = () => {
    setCustomerId(0);
    setChallanDate(new Date().toISOString().split('T')[0]);
    setInitialStatus('DRAFT');
    setChallanItems([{ productId: 0, quantity: 1, unitPrice: 0 }]);
    setFormError('');
  };

  const handleAddItemRow = () => {
    setChallanItems([...challanItems, { productId: 0, quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    const updated = [...challanItems];
    updated.splice(index, 1);
    setChallanItems(updated);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...challanItems];

    if (field === 'productId') {
      const selectedProd = productsList.find((p: any) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        unitPrice: selectedProd ? selectedProd.price : 0,
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }

    setChallanItems(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (customerId === 0 || !challanDate) {
      setFormError('Please select a Customer and Challan Date.');
      return;
    }

    const hasInvalidItem = challanItems.some(
      (item) => item.productId === 0 || item.quantity <= 0 || item.unitPrice <= 0
    );

    if (hasInvalidItem) {
      setFormError('Please select a valid product, quantity, and unit price for all items.');
      return;
    }

    // Check stock if user selects direct Confirmation
    if (initialStatus === 'CONFIRMED') {
      for (const item of challanItems) {
        const prod = productsList.find((p: any) => p.id === item.productId);
        if (prod && prod.currentStock < item.quantity) {
          setFormError(
            `Insufficient stock for "${prod.name}" (SKU: ${prod.sku}). Available: ${prod.currentStock}, Requested: ${item.quantity}`
          );
          return;
        }
      }
    }

    createMutation.mutate();
  };

  const calculateTotalQuantity = () => {
    return challanItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const calculateRunningTotal = () => {
    return challanItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  if (isChallansLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  if (challansError) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load Sales Challans.
      </div>
    );
  }

  const filteredChallans = challans.filter((ch: any) => !statusFilter || ch.status === statusFilter);
  const statusTabs = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Dispatched', value: 'DISPATCHED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];
  const activeTabIdx = statusTabs.findIndex((t) => t.value === statusFilter);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'info';
      case 'DISPATCHED':
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Sales Challans</h1>
          <p className="text-zinc-400 text-sm">Issue sales delivery notes, verify inventory stock, and track order dispatches</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2 shadow-lg shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" />
            <span>Create Sales Challan</span>
          </Button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="relative flex bg-zinc-900/60 p-1 border border-zinc-800 rounded-lg max-w-xl w-full">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`relative z-10 flex-1 py-1.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === tab.value ? 'text-indigo-400 font-bold bg-indigo-600/15 border border-indigo-500/30 rounded-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Challan Listing Table */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {filteredChallans.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">No Sales Challans found matching filter.</div>
          ) : (
            <div key={statusFilter} className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead>Challan #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Qty</TableHead>
                    <TableHead>Challan Date</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChallans.map((ch: any) => {
                    const challanNum = ch.challanNumber || `CH-${String(ch.id).padStart(4, '0')}`;
                    const totalQty = ch.totalQuantity || ch.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

                    return (
                      <TableRow
                        key={ch.id}
                        className="border-zinc-850 cursor-pointer hover:bg-zinc-800/40"
                        onClick={() => {
                          setSelectedChallan(ch);
                          setModalActionError('');
                          setDetailsOpen(true);
                        }}
                      >
                        <TableCell className="font-mono text-xs text-indigo-400 font-bold">
                          {challanNum}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-200">
                          {ch.customer?.name} <span className="text-xs text-slate-400">({ch.customer?.companyName})</span>
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">{totalQty}</TableCell>
                        <TableCell className="text-slate-400 text-xs">{formatDate(ch.challanDate)}</TableCell>
                        <TableCell className="text-slate-400 text-xs">{ch.createdBy?.name || 'System'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(ch.status)}>
                            {ch.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChallan(ch);
                              setModalActionError('');
                              setDetailsOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE CHALLAN MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <Card className="relative w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div>
                <CardTitle>Create Sales Challan</CardTitle>
                <CardDescription>Issue a new sales delivery note with automatic Challan #</CardDescription>
              </div>
              <button onClick={() => setCreateOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto flex-1 space-y-4">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-slate-300">Customer *</label>
                    <Select
                      value={customerId}
                      onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-indigo-500"
                    >
                      <option value={0}>-- Select Customer --</option>
                      {customersList.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.name})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-slate-300">Challan Date *</label>
                    <Input
                      type="date"
                      value={challanDate}
                      onChange={(e) => setChallanDate(e.target.value)}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-slate-300">Save Mode *</label>
                    <Select
                      value={initialStatus}
                      onChange={(e) => setInitialStatus(e.target.value as 'DRAFT' | 'CONFIRMED')}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-indigo-500"
                    >
                      <option value="DRAFT">Save as Draft (No stock change)</option>
                      <option value="CONFIRMED">Confirm Order (Deduct stock)</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm font-semibold text-slate-200">Products & Quantities</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItemRow}
                      className="border-slate-850 hover:bg-slate-850 h-7 text-xs px-2"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Item Row
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {challanItems.map((item, index) => {
                      const selectedProd = productsList.find((p: any) => p.id === item.productId);
                      const currentStock = selectedProd ? selectedProd.currentStock : 0;
                      const hasStockWarning = initialStatus === 'CONFIRMED' && item.productId > 0 && currentStock < item.quantity;

                      return (
                        <div key={index} className={`grid grid-cols-12 gap-2 items-end p-3 rounded-lg border ${hasStockWarning ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-950/40 border-slate-850'}`}>
                          {/* Product Selection */}
                          <div className="col-span-5 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Product SKU & Name *</label>
                            <Select
                              value={item.productId}
                              onChange={(e) => handleItemChange(index, 'productId', parseInt(e.target.value, 10))}
                              className="bg-slate-950 border-slate-850"
                            >
                              <option value={0}>-- Select Product --</option>
                              {productsList.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} | {p.name} (Available: {p.currentStock})
                                </option>
                              ))}
                            </Select>
                          </div>
                          {/* Quantity */}
                          <div className="col-span-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Quantity *</label>
                              {selectedProd && (
                                <span className={`text-[10px] font-mono font-semibold ${currentStock >= item.quantity ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  Stock: {currentStock}
                                </span>
                              )}
                            </div>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                              className="bg-slate-950 border-slate-850 font-mono"
                              placeholder="Qty"
                            />
                          </div>
                          {/* Price */}
                          <div className="col-span-3 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Price (INR) *</label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="bg-slate-950 border-slate-850 font-mono"
                              placeholder="Price"
                            />
                          </div>
                          {/* Action */}
                          <div className="col-span-1 flex justify-center pb-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={challanItems.length === 1}
                              onClick={() => handleRemoveItemRow(index)}
                              className="h-8 w-8 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-4 rounded-lg border border-slate-850">
                  <div>
                    <span className="text-xs text-slate-400 block uppercase tracking-wider">Total Quantity</span>
                    <span className="text-lg font-bold font-mono text-indigo-400">{calculateTotalQuantity()} units</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block uppercase tracking-wider">Total Amount</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {formatCurrency(calculateRunningTotal())}
                    </span>
                  </div>
                </div>

                {formError && (
                  <div className="flex items-center space-x-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end space-x-2 border-t border-slate-800 pt-4 shrink-0">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-850 hover:bg-slate-850">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Processing...' : initialStatus === 'CONFIRMED' ? 'Create & Confirm Challan' : 'Save Draft Challan'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CHALLAN DETAILS MODAL */}
      {detailsOpen && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDetailsOpen(false)} />
          <Card className="relative w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div>
                <CardTitle className="text-xl flex items-center space-x-3">
                  <span>Challan #{selectedChallan.challanNumber || `CH-${String(selectedChallan.id).padStart(4, '0')}`}</span>
                  <Badge variant={getStatusBadgeVariant(selectedChallan.status)}>
                    {selectedChallan.status}
                  </Badge>
                </CardTitle>
                <CardDescription>Customer: {selectedChallan.customer?.name} ({selectedChallan.customer?.companyName})</CardDescription>
              </div>
              <button onClick={() => setDetailsOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="pt-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-xs bg-slate-950 p-3 rounded-lg border border-slate-850">
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block">Challan Date</span>
                  <span className="text-slate-200 font-medium">{formatDate(selectedChallan.challanDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block">Created By</span>
                  <span className="text-slate-200 font-medium">{selectedChallan.createdBy?.name || 'Sales Desk'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block">Total Items / Qty</span>
                  <span className="text-indigo-400 font-mono font-bold">
                    {selectedChallan.items?.length} items ({selectedChallan.totalQuantity || selectedChallan.items?.reduce((s: number, i: any) => s + i.quantity, 0)} units)
                  </span>
                </div>
              </div>

              {/* Delivery Addresses */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-3 rounded-lg border border-slate-850">
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wide block mb-1">Billing Info</span>
                  <p className="text-slate-300 leading-relaxed">{selectedChallan.customer?.billingAddress || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wide block mb-1">Shipping Destination</span>
                  <p className="text-slate-300 leading-relaxed">{selectedChallan.customer?.shippingAddress || 'N/A'}</p>
                </div>
              </div>

              {/* Line Items Table with Snapshot Data */}
              <div className="border border-slate-850 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-850 hover:bg-transparent">
                      <TableHead>Product Snapshot</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedChallan.items?.map((item: any) => {
                      const sku = item.sku || item.product?.sku || 'N/A';
                      const name = item.productName || item.product?.name || 'Product';
                      const unit = item.unit || item.product?.unit || 'pcs';

                      return (
                        <TableRow key={item.id} className="border-slate-850 hover:bg-transparent">
                          <TableCell>
                            <div className="font-semibold text-slate-200">{name}</div>
                            <div className="text-[10px] font-mono text-indigo-400">SKU: {sku}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            {item.quantity} {unit}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-200">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {modalActionError && (
                <div className="flex items-center space-x-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{modalActionError}</span>
                </div>
              )}
            </CardContent>

            <div className="flex justify-between p-4 border-t border-slate-850 bg-slate-900/60 shrink-0 rounded-b-xl">
              <div className="flex space-x-2">
                {/* Confirm Action (Transition from Draft to Confirmed) */}
                {canManageStatus && selectedChallan.status === 'DRAFT' && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/15"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ challanId: selectedChallan.id, status: 'CONFIRMED' })}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Order</span>
                  </Button>
                )}

                {/* Cancel Action (Allowed for Draft or Confirmed) */}
                {canManageStatus && (selectedChallan.status === 'DRAFT' || selectedChallan.status === 'CONFIRMED' || selectedChallan.status === 'DISPATCHED') && (
                  <Button
                    variant="outline"
                    className="border-rose-500/30 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center space-x-1.5"
                    disabled={statusMutation.isPending}
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this Sales Challan? Stock will be restored if previously confirmed.')) {
                        statusMutation.mutate({ challanId: selectedChallan.id, status: 'CANCELLED' });
                      }
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel Challan</span>
                  </Button>
                )}
              </div>

              <div className="flex space-x-2">
                {/* Convert to Invoice (Allowed for Confirmed or Dispatched) */}
                {!isWarehouse && (selectedChallan.status === 'CONFIRMED' || selectedChallan.status === 'DISPATCHED') && (
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1.5 shadow-lg shadow-indigo-600/15"
                    disabled={convertMutation.isPending}
                    onClick={() => convertMutation.mutate(selectedChallan.id)}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Convert to Invoice</span>
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
