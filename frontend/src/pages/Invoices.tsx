import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { X, Eye, FileSpreadsheet, Check, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Invoices() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const isReadOnly = user?.role === 'SALES'; // Sales can only view

  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 8;

  // Detail Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Fetch Invoices
  const { data: invoicesData, isLoading: isInvoicesLoading, error: invoicesError } = useQuery({
    queryKey: ['invoices', page, statusFilter, customerFilter],
    queryFn: async () => {
      const res = await axios.get('/invoices', {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
          customerId: customerFilter || undefined,
        },
      });
      return res.data;
    },
  });

  // Fetch Customers for filters dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list-dropdown-invoices'],
    queryFn: async () => {
      const res = await axios.get('/customers', { params: { page: 1, limit: 100 } });
      return res.data.data;
    },
  });
  const customersList = customersData || [];

  // Update Payment Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, paymentStatus }: { invoiceId: number; paymentStatus: string }) => {
      return axios.patch(`/invoices/${invoiceId}/payment-status`, { paymentStatus });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedInvoice((prev: any) => (prev ? { ...prev, paymentStatus: res.data.paymentStatus } : null));
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to update payment status.');
    },
  });

  const handleStatusUpdate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedInvoice) {
      updateStatusMutation.mutate({
        invoiceId: selectedInvoice.id,
        paymentStatus: e.target.value,
      });
    }
  };

  if (isInvoicesLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-violet-600"></div>
      </div>
    );
  }

  if (invoicesError) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load Invoices.
      </div>
    );
  }

  const { data: invoices = [], meta = { totalPages: 1, total: 0 } } = invoicesData || {};

  const activeTabIdx = ["", "UNPAID", "PARTIAL", "PAID"].indexOf(statusFilter);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Invoices & Billing</h1>
          <p className="text-zinc-400 text-sm">Track invoicing records, GST taxes, customer payment states, and due dates</p>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Filter by Customer</label>
            <Select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="bg-zinc-950 border-zinc-850"
            >
              <option value="">-- All Customers --</option>
              {customersList.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.name})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter('');
                setCustomerFilter('');
                setPage(1);
              }}
              className="border-zinc-850 hover:bg-zinc-850 w-full text-zinc-300"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sliding Sub-Navigation Status Tabs */}
      <div className="relative flex bg-zinc-900/60 p-1 border border-zinc-800 rounded-lg max-w-md w-full">
        {/* Sliding background indicator */}
        <div
          className="absolute top-1 bottom-1 bg-indigo-600/15 border border-indigo-500/30 rounded-md transition-all duration-300 ease-out"
          style={{
            width: "calc(25% - 6px)",
            left: `calc(3px + ${activeTabIdx * 25}%)`
          }}
        />
        {[
          { label: "All", value: "" },
          { label: "Unpaid", value: "UNPAID" },
          { label: "Partial", value: "PARTIAL" },
          { label: "Paid", value: "PAID" }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`relative z-10 flex-1 py-1.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === tab.value ? "text-indigo-400 font-bold" : "text-zinc-450 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">No invoices found matching filters.</div>
          ) : (
            <div key={statusFilter + customerFilter + page} className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Challan ID</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow
                      key={inv.id}
                      className="border-slate-855 cursor-pointer hover:bg-slate-900/30"
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setDetailsOpen(true);
                      }}
                    >
                      <TableCell className="font-mono text-xs text-violet-400 font-semibold">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {inv.customer.companyName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        {inv.challanId ? `CH-${String(inv.challanId).padStart(4, '0')}` : 'Standalone'}
                      </TableCell>
                      <TableCell className="text-slate-450 text-xs">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-200">
                        {formatCurrency(inv.total)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.paymentStatus === 'PAID'
                              ? 'success'
                              : inv.paymentStatus === 'PARTIAL'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {inv.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
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

      {/* INVOICE DETAILS MODAL */}
      {detailsOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDetailsOpen(false)} />
          <Card className="relative w-full max-w-xl border-slate-800 bg-slate-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Invoice: {selectedInvoice.invoiceNumber}</CardTitle>
                <CardDescription>Customer Account: {selectedInvoice.customer.companyName}</CardDescription>
              </div>
              <button onClick={() => setDetailsOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Billing Address</span>
                  <p className="text-slate-300 mt-1">{selectedInvoice.customer.billingAddress}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tax GSTIN</span>
                  <p className="text-slate-300 font-mono mt-1 uppercase">{selectedInvoice.customer.gstin || 'None provided'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-850">
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wide">Due Date</span>
                  <span className="text-slate-200">{formatDate(selectedInvoice.dueDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wide">Created Date</span>
                  <span className="text-slate-200">{formatDate(selectedInvoice.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wide">Challan Ref</span>
                  <span className="text-slate-200 font-mono">
                    {selectedInvoice.challanId ? `CH-${String(selectedInvoice.challanId).padStart(4, '0')}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-850 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-855 hover:bg-transparent">
                      <TableHead>Product SKU</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items?.map((item: any) => (
                      <TableRow key={item.id} className="border-slate-850 hover:bg-transparent">
                        <TableCell className="font-mono text-xs text-slate-300">
                          {item.product?.sku || 'UNKNOWN'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-400">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Tax Calculations */}
              <div className="space-y-1.5 border-t border-slate-800 pt-4 text-sm font-medium">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>GST Tax (18%):</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.tax)}</span>
                </div>
                <div className="flex justify-between text-slate-100 text-lg font-bold border-t border-slate-800 pt-2 bg-slate-950/40 p-2.5 rounded-lg">
                  <span>Grand Total:</span>
                  <span className="font-mono text-violet-400">{formatCurrency(selectedInvoice.total)}</span>
                </div>
              </div>

              {/* Payment Status Modification Block */}
              {!isReadOnly && (
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">Update Payment Status</label>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedInvoice.paymentStatus}
                      onChange={handleStatusUpdate}
                      disabled={updateStatusMutation.isPending}
                      className="bg-slate-900 border-slate-800 flex-1"
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="PARTIAL">PARTIAL</option>
                      <option value="PAID">PAID</option>
                    </Select>
                    {updateStatusMutation.isPending && (
                      <span className="animate-spin text-violet-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <div className="flex justify-end p-4 border-t border-slate-850 bg-slate-900/60 rounded-b-xl shrink-0">
              <Button variant="outline" onClick={() => setDetailsOpen(false)} className="border-slate-850 hover:bg-slate-850">
                Close Invoice
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
