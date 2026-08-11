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
  Search, Plus, Edit2, X, ChevronLeft, ChevronRight,
  Phone, Mail, Building2, CalendarClock, FileText,
  TrendingUp, Package, Receipt, MessageSquarePlus, CheckCircle2, Eye
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';

interface Customer {
  id: number;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  billingAddress: string;
  shippingAddress: string;
  gstin?: string | null;
  notes?: string | null;
  customerType: CustomerType;
  status: CustomerStatus;
  followUpDate?: string | null;
  createdAt: string;
  _count?: { salesChallans: number; invoices: number; followups: number };
  followups?: any[];
}

interface FormData {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  billingAddress: string;
  shippingAddress: string;
  gstin: string;
  notes: string;
  customerType: CustomerType;
  status: CustomerStatus;
  followUpDate: string;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const statusVariant: Record<CustomerStatus, 'success' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  LEAD: 'warning',
  INACTIVE: 'destructive',
};

const typeVariant: Record<CustomerType, 'info' | 'default' | 'success'> = {
  WHOLESALE: 'info',
  RETAIL: 'default',
  DISTRIBUTOR: 'success',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Customers() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const isReadOnly = user?.role === 'ACCOUNTS';

  // ── Filters & Pagination ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Modal / Panel State ──
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ── Inline note editing ──
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // ── Form State ──
  const defaultForm: FormData = {
    name: '', companyName: '', phone: '', email: '',
    billingAddress: '', shippingAddress: '',
    gstin: '', notes: '', customerType: 'RETAIL',
    status: 'LEAD', followUpDate: '',
  };
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [formError, setFormError] = useState('');

  // ── Sliding status tab index ──
  const statusTabs: Array<{ label: string; value: CustomerStatus | '' }> = [
    { label: 'All', value: '' },
    { label: 'Lead', value: 'LEAD' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];
  const activeTabIdx = statusTabs.findIndex((t) => t.value === statusFilter);

  // ── Queries ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', page, search, statusFilter],
    queryFn: async () => {
      const res = await axios.get('/customers', {
        params: {
          page, limit,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return null;
      const res = await axios.get(`/customers/${selectedCustomer.id}`);
      return res.data as Customer;
    },
    enabled: detailOpen && !!selectedCustomer?.id,
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...formData,
        gstin: formData.gstin || null,
        notes: formData.notes || null,
        followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : null,
      };
      if (isEditing && selectedCustomer) {
        return axios.put(`/customers/${selectedCustomer.id}`, body);
      }
      return axios.post('/customers', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to save customer.');
    },
  });

  const notesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      return axios.patch(`/customers/${id}/notes`, { notes: notes || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      setEditingNotes(false);
    },
  });

  // ── Helpers ──
  const resetForm = () => {
    setFormData(defaultForm);
    setIsEditing(false);
    setSelectedCustomer(null);
    setFormError('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      companyName: customer.companyName,
      phone: customer.phone,
      email: customer.email,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      gstin: customer.gstin || '',
      notes: customer.notes || '',
      customerType: customer.customerType,
      status: customer.status,
      followUpDate: customer.followUpDate
        ? new Date(customer.followUpDate).toISOString().split('T')[0]
        : '',
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditingNotes(false);
    setDetailOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.companyName || !formData.phone || !formData.email
      || !formData.billingAddress || !formData.shippingAddress) {
      setFormError('All required fields must be filled.');
      return;
    }
    saveMutation.mutate();
  };

  const handleSaveNotes = () => {
    if (!selectedCustomer) return;
    notesMutation.mutate({ id: selectedCustomer.id, notes: notesDraft });
  };

  const startEditNotes = (currentNotes: string | null | undefined) => {
    setNotesDraft(currentNotes || '');
    setEditingNotes(true);
  };

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load customers.
      </div>
    );
  }

  const { data: customers = [], meta = { totalPages: 1, total: 0 } } = data || {};
  const detail = detailData || selectedCustomer;

  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Customer CRM</h1>
          <p className="text-zinc-400 text-sm">Manage contacts, status, type, follow-up dates, and notes</p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2 shadow-lg shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </Button>
        )}
      </div>

      {/* ── Search Bar ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 w-full max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <Input
              type="text"
              placeholder="Search by name, company, phone, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border-0 bg-transparent text-zinc-200 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Status Filter Tabs ── */}
      <div className="relative flex bg-zinc-900/60 p-1 border border-zinc-800 rounded-lg max-w-sm w-full">
        <div
          className="absolute top-1 bottom-1 bg-indigo-600/15 border border-indigo-500/30 rounded-md transition-all duration-300 ease-out"
          style={{ width: 'calc(25% - 6px)', left: `calc(3px + ${activeTabIdx * 25}%)` }}
        />
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`relative z-10 flex-1 py-1.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
              statusFilter === tab.value ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Customer Table ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">No customers found. Try adjusting search or filter.</div>
          ) : (
            <div key={`${statusFilter}-${search}-${page}`} className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c: Customer) => (
                    <TableRow
                      key={c.id}
                      className="border-zinc-800/60 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                      onClick={() => handleOpenDetail(c)}
                    >
                      <TableCell>
                        <div className="font-semibold text-zinc-100">{c.name}</div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          {c.companyName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-zinc-300 font-mono">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          {c.phone}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          {c.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeVariant[c.customerType]}>
                          {c.customerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[c.status]}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.followUpDate ? (
                          <div className="flex items-center gap-1 text-xs text-amber-300">
                            <CalendarClock className="w-3 h-3" />
                            {formatDate(c.followUpDate)}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                            onClick={(e) => { e.stopPropagation(); handleOpenDetail(c); }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!isReadOnly && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                              onClick={(e) => handleOpenEdit(c, e)}
                              title="Edit Customer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">
                  {meta.total} customer{meta.total !== 1 ? 's' : ''} total
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs font-medium text-zinc-300 px-2">
                    {page} / {meta.totalPages}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                    disabled={page === meta.totalPages}
                    className="border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  >
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
          <Card className="relative w-full max-w-2xl border-zinc-800 bg-zinc-900 shadow-2xl z-10 max-h-[92vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div>
                <CardTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</CardTitle>
                <CardDescription>Fill in contact information, type, status, and follow-up date</CardDescription>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="pt-6 overflow-y-auto flex-1">
              <form onSubmit={handleFormSubmit} className="space-y-5" id="customer-form">

                {/* Row 1: Name + Company */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Customer Name *</label>
                    <Input
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Business Name *</label>
                    <Input
                      placeholder="e.g. Sharma Enterprises"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Row 2: Mobile + Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Mobile Number *</label>
                    <Input
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Email Address *</label>
                    <Input
                      type="email"
                      placeholder="rahul@sharma.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Row 3: GST + Customer Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">GST Number <span className="text-zinc-500 font-normal">(optional)</span></label>
                    <Input
                      placeholder="22AAAAA0000A1Z5"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500 uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Customer Type *</label>
                    <Select
                      value={formData.customerType}
                      onChange={(e) => setFormData({ ...formData, customerType: e.target.value as CustomerType })}
                      className="bg-zinc-950 border-zinc-800"
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="WHOLESALE">Wholesale</option>
                      <option value="DISTRIBUTOR">Distributor</option>
                    </Select>
                  </div>
                </div>

                {/* Row 4: Status + Follow-up Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Status *</label>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
                      className="bg-zinc-950 border-zinc-800"
                    >
                      <option value="LEAD">Lead</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Follow-up Date</label>
                    <Input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Billing Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Billing Address *</label>
                  <textarea
                    rows={2}
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    placeholder="Street, City, State, PIN"
                    className="flex w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>

                {/* Shipping Address */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">Shipping Address *</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shippingAddress: formData.billingAddress })}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Copy from Billing
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    placeholder="Delivery address (warehouse / office)"
                    className="flex w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">CRM Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Prefers WhatsApp updates, bulk discount applicable..."
                    className="flex w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>

                {formError && (
                  <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    {formError}
                  </div>
                )}
              </form>
            </CardContent>

            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="border-zinc-800 hover:bg-zinc-800">
                Cancel
              </Button>
              <Button
                type="submit"
                form="customer-form"
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Customer' : 'Add Customer'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          CUSTOMER DETAIL PANEL
      ──────────────────────────────────────────────────────────────────────── */}
      {detailOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <Card className="relative w-full max-w-xl border-zinc-800 bg-zinc-900 shadow-2xl z-10 max-h-[90vh] flex flex-col">

            {/* Header */}
            <CardHeader className="flex flex-row items-start justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl text-zinc-100 truncate">{detail?.companyName}</CardTitle>
                  {detail && <Badge variant={statusVariant[detail.status]}>{detail.status}</Badge>}
                  {detail && <Badge variant={typeVariant[detail.customerType]}>{detail.customerType}</Badge>}
                </div>
                <CardDescription className="mt-1">Customer #{selectedCustomer.id} · {detail?.name}</CardDescription>
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

                  {/* Stats Row */}
                  {detail?._count && (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Challans', value: detail._count.salesChallans, icon: Package, color: 'text-indigo-400' },
                        { label: 'Invoices', value: detail._count.invoices, icon: Receipt, color: 'text-emerald-400' },
                        { label: 'Follow-ups', value: detail._count.followups, icon: TrendingUp, color: 'text-amber-400' },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 text-center">
                          <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                          <div className="text-xl font-bold text-zinc-100">{stat.value}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-4 space-y-3">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Contact Details</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="font-mono text-xs">{detail?.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-xs truncate">{detail?.email}</span>
                      </div>
                    </div>
                    {detail?.gstin && (
                      <div className="text-xs text-zinc-400">
                        <span className="text-zinc-500 font-semibold uppercase text-[10px] mr-2">GSTIN:</span>
                        <span className="font-mono uppercase tracking-widest text-zinc-300">{detail.gstin}</span>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Date */}
                  {detail?.followUpDate && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">Scheduled Follow-up</div>
                        <div className="text-sm text-amber-300 font-medium">{formatDate(detail.followUpDate)}</div>
                      </div>
                    </div>
                  )}

                  {/* Addresses */}
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Billing Address</div>
                      <p className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 leading-relaxed">
                        {detail?.billingAddress}
                      </p>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Shipping Address</div>
                      <p className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 leading-relaxed">
                        {detail?.shippingAddress}
                      </p>
                    </div>
                  </div>

                  {/* CRM Notes — Inline editable */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> CRM Notes
                      </div>
                      {!isReadOnly && !editingNotes && (
                        <button
                          onClick={() => startEditNotes(detail?.notes)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3 h-3" />
                          {detail?.notes ? 'Edit Notes' : 'Add Notes'}
                        </button>
                      )}
                    </div>

                    {editingNotes ? (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Add CRM notes, preferences, discount terms..."
                          className="flex w-full rounded-md border border-indigo-500/40 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white h-7 text-xs"
                            onClick={handleSaveNotes}
                            disabled={notesMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="border-zinc-800 hover:bg-zinc-800 h-7 text-xs"
                            onClick={() => setEditingNotes(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : detail?.notes ? (
                      <p className="text-xs text-amber-300 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap">
                        {detail.notes}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 italic">No notes added yet.</p>
                    )}
                  </div>

                  {/* Recent Follow-ups */}
                  {detail?.followups && detail.followups.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Recent Follow-ups</div>
                      <div className="space-y-2">
                        {detail.followups.slice(0, 5).map((fu: any) => (
                          <div key={fu.id} className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                            <Badge variant={fu.status === 'DONE' ? 'success' : 'warning'} className="shrink-0 text-[10px]">
                              {fu.status}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-zinc-300">{fu.type} · {formatDate(fu.dueDate)}</div>
                              {fu.notes && <div className="text-[10px] text-zinc-500 truncate">{fu.notes}</div>}
                            </div>
                            <div className="text-[10px] text-zinc-600 shrink-0">{fu.assignedTo?.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </CardContent>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
              {!isReadOnly && (
                <Button
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  onClick={() => {
                    setDetailOpen(false);
                    if (detail) handleOpenEdit(detail as Customer);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-1.5" /> Edit Customer
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetailOpen(false)} className="border-zinc-800 hover:bg-zinc-800">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
