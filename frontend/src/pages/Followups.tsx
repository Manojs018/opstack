import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Phone, Mail, MapPin, CheckCircle, Calendar, Edit2, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function Followups() {
  const queryClient = useQueryClient();
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;

  // Filter States
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<any>(null);

  // Form States
  const [formData, setFormData] = useState({
    customerId: 0,
    type: 'CALL',
    dueDate: new Date().toISOString().split('T')[0],
    assignedToId: user?.id || 0,
    notes: '',
  });
  const [formError, setFormError] = useState('');

  // Fetch Followups Query
  const { data: followups = [], isLoading, error } = useQuery({
    queryKey: ['followups', statusFilter, assignedFilter],
    queryFn: async () => {
      const res = await axios.get('/followups', {
        params: {
          status: statusFilter || undefined,
          assignedTo: assignedFilter || undefined,
        },
      });
      return res.data;
    },
  });

  // Fetch Customers for form select
  const { data: customersData } = useQuery({
    queryKey: ['customers-list-dropdown-followups'],
    queryFn: async () => {
      const res = await axios.get('/customers', { params: { page: 1, limit: 100 } });
      return res.data.data;
    },
  });
  const customersList = customersData || [];

  // Fetch Users for form assignedTo select
  const { data: usersList = [] } = useQuery({
    queryKey: ['users-list-dropdown-followups'],
    queryFn: async () => {
      const res = await axios.get('/auth/users');
      return res.data;
    },
  });

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: parseInt(String(formData.customerId), 10),
        type: formData.type,
        dueDate: new Date(formData.dueDate).toISOString(),
        assignedToId: parseInt(String(formData.assignedToId), 10),
        notes: formData.notes || null,
      };

      if (isEditing && selectedFollowup) {
        return axios.patch(`/followups/${selectedFollowup.id}`, body);
      } else {
        return axios.post('/followups', body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to save follow-up task.');
    },
  });

  // Quick Mark Done Mutation
  const markDoneMutation = useMutation({
    mutationFn: async (id: number) => {
      return axios.patch(`/followups/${id}/mark-done`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: 0,
      type: 'CALL',
      dueDate: new Date().toISOString().split('T')[0],
      assignedToId: user?.id || 0,
      notes: '',
    });
    setIsEditing(false);
    setSelectedFollowup(null);
    setFormError('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (followup: any) => {
    setSelectedFollowup(followup);
    setFormData({
      customerId: followup.customerId,
      type: followup.type,
      dueDate: followup.dueDate.split('T')[0],
      assignedToId: followup.assignedToId,
      notes: followup.notes || '',
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.customerId === 0 || formData.assignedToId === 0 || !formData.dueDate) {
      setFormError('Customer, Assignee, and Due Date are required fields.');
      return;
    }

    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load follow-ups.
      </div>
    );
  }

  const pendingList = followups.filter((f: any) => f.status === 'PENDING');
  const completedList = followups.filter((f: any) => f.status === 'DONE');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CALL':
        return <Phone className="w-3.5 h-3.5" />;
      case 'EMAIL':
        return <Mail className="w-3.5 h-3.5" />;
      case 'VISIT':
        return <MapPin className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const isOverdue = (dueDateStr: string) => {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">CRM Follow-ups</h1>
          <p className="text-slate-400 text-sm">Schedule calls, emails, and visits, and log client interaction notes</p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-violet-600 hover:bg-violet-500 text-white flex items-center space-x-2 shadow-lg shadow-violet-600/15"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </Button>
      </div>

      {/* Filters Box */}
      <Card className="border-slate-800">
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Filter by Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border-slate-850"
            >
              <option value="">-- All Tasks --</option>
              <option value="PENDING">PENDING Only</option>
              <option value="DONE">DONE Only</option>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Filter by Assignee</label>
            <Select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="bg-slate-950 border-slate-850"
            >
              <option value="">-- All Agents --</option>
              {usersList
                .filter((u: any) => u.role === 'SALES' || u.role === 'ADMIN')
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter('');
                setAssignedFilter('');
              }}
              className="border-slate-850 hover:bg-slate-850 w-full"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CRM Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PENDING Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h2 className="font-semibold text-slate-200 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Pending Action ({pendingList.length})</span>
            </h2>
          </div>

          {pendingList.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-sm border border-dashed border-slate-850 rounded-xl bg-slate-900/10">
              No pending tasks. Good job!
            </div>
          ) : (
            <div className="space-y-3">
              {pendingList.map((f: any) => {
                const overdue = isOverdue(f.dueDate);
                return (
                  <Card
                    key={f.id}
                    className={`border-slate-850 transition-all ${overdue
                        ? 'border-l-4 border-l-rose-500 hover:border-slate-700 bg-rose-500/[0.02]'
                        : 'hover:border-slate-700'
                      }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-slate-200 text-sm">{f.customer.companyName}</h3>
                          <span className="text-xs text-slate-400">Contact: {f.customer.name}</span>
                        </div>
                        <Badge variant="warning" className="flex items-center space-x-1 uppercase text-[10px]">
                          {getTypeIcon(f.type)}
                          <span className="ml-1">{f.type}</span>
                        </Badge>
                      </div>

                      <p className="text-slate-300 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-850 leading-relaxed">
                        {f.notes || <span className="italic text-slate-600">No notes written.</span>}
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                        <span className="font-semibold text-violet-400">Assigned To: {f.assignedTo.name}</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className={overdue ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {formatDate(f.dueDate)} {overdue && '(OVERDUE)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-slate-850">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(f)}
                          className="h-7 text-xs border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markDoneMutation.mutate(f.id)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/10 flex items-center"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark Done
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* COMPLETED Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h2 className="font-semibold text-slate-200 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Completed Log ({completedList.length})</span>
            </h2>
          </div>

          {completedList.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-sm border border-dashed border-slate-850 rounded-xl bg-slate-900/10">
              No completed logs recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {completedList.map((f: any) => (
                <Card key={f.id} className="border-slate-850 hover:border-slate-700 opacity-70 hover:opacity-100 transition-opacity">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-slate-300 text-sm">{f.customer.companyName}</h3>
                        <span className="text-xs text-slate-500">Contact: {f.customer.name}</span>
                      </div>
                      <Badge variant="success" className="flex items-center space-x-1 uppercase text-[10px]">
                        {getTypeIcon(f.type)}
                        <span className="ml-1">{f.type}</span>
                      </Badge>
                    </div>

                    <p className="text-slate-400 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-850 leading-relaxed italic">
                      {f.notes || 'No notes written.'}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>Completed by: {f.assignedTo.name}</span>
                      <span className="text-slate-400 font-semibold flex items-center">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                        Done (Due: {formatDate(f.dueDate)})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATE/EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <Card className="relative w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl z-10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <CardTitle>{isEditing ? 'Modify Follow-up Task' : 'Schedule Follow-up Task'}</CardTitle>
                <CardDescription>Setup phone calls, follow-up emails, or corporate visits.</CardDescription>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Customer Account *</label>
                  <Select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value, 10) })}
                    className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                    disabled={isEditing}
                  >
                    <option value={0}>-- Select Customer Account --</option>
                    {customersList.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.name})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Action Type *</label>
                    <Select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                    >
                      <option value="CALL">📞 CALL</option>
                      <option value="EMAIL">📧 EMAIL</option>
                      <option value="VISIT">🚗 VISIT</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Due Date *</label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Assign To Sales Agent *</label>
                  <Select
                    value={formData.assignedToId}
                    onChange={(e) => setFormData({ ...formData, assignedToId: parseInt(e.target.value, 10) })}
                    className="bg-slate-950 border-slate-850 focus-visible:ring-violet-500"
                  >
                    <option value={0}>-- Select Sales Agent --</option>
                    {usersList
                      .filter((u: any) => u.role === 'SALES' || u.role === 'ADMIN')
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Task Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="flex w-full rounded-md border border-slate-850 bg-slate-950 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-slate-100"
                    placeholder="E.g. Pitch the wireless mouse bulk deal, follow up on their email..."
                  />
                </div>

                {formError && (
                  <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end space-x-2 border-t border-slate-800 pt-4">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-slate-855 hover:bg-slate-850">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/15" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Scheduling...' : 'Save Task'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
