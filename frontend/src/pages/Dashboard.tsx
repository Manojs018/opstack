import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Users,
  AlertTriangle,
  FileClock,
  Coins,
  CalendarCheck,
  TrendingUp,
  PackageCheck
} from 'lucide-react';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await axios.get('/dashboard');
      return res.data;
    },
  });

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const role = user?.role || 'SALES';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-violet-600"></div>
        <p className="text-slate-400 text-sm">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center">
        <p className="text-rose-400 font-semibold mb-2">Failed to load dashboard metrics</p>
        <p className="text-sm text-slate-400">Please verify that the backend is active and your connection is established.</p>
      </div>
    );
  }

  const { counts, recentChallans, recentInvoices, lowStockProducts } = data;

  const cardConfig = [
    {
      title: 'Low Stock SKU',
      value: counts.lowStock,
      description: 'Items below reorder level',
      icon: AlertTriangle,
      color: 'text-amber-450 bg-amber-500/10 border-amber-500/20',
      link: '/products',
      allowedRoles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'],
    },
    {
      title: 'Customers',
      value: counts.customers,
      description: 'Active CRM Accounts',
      icon: Users,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      link: '/customers',
      allowedRoles: ['ADMIN', 'SALES', 'ACCOUNTS'],
    },
    {
      title: 'Pending POs',
      value: counts.pendingPOs,
      description: 'Awaiting warehouse receipt',
      icon: FileClock,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      link: '/purchase-orders',
      allowedRoles: ['ADMIN', 'WAREHOUSE', 'ACCOUNTS'],
    },
    {
      title: 'Unpaid Invoices',
      value: counts.unpaidInvoices,
      description: 'Pending payments',
      icon: Coins,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      link: '/invoices',
      allowedRoles: ['ADMIN', 'ACCOUNTS', 'SALES'],
    },
    {
      title: 'Pending Followups',
      value: counts.pendingFollowups,
      description: 'Awaiting sales agent action',
      icon: CalendarCheck,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      link: '/followups',
      allowedRoles: ['ADMIN', 'SALES'],
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Heading */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          Welcome back, {user?.name || 'User'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Here is a summary of today's wholesale and CRM operations.
        </p>
      </div>

      {/* KPI Cards Grid (Asymmetric Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4">
        {cardConfig
          .filter((card) => card.allowedRoles.includes(role))
          .map((card) => {
            const Icon = card.icon;
            const isHero = card.title === 'Low Stock SKU';
            return (
              <Link
                key={card.title}
                to={card.link}
                className={isHero ? 'md:col-span-2 md:row-span-2' : 'md:col-span-1 md:row-span-1'}
              >
                <Card className={`hover:border-indigo-500/50 transition-all cursor-pointer h-full border-zinc-800 bg-zinc-900/50 ${
                  isHero ? 'bg-gradient-to-br from-amber-500/5 via-zinc-900/50 to-zinc-900/50 border-amber-500/20' : ''
                }`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className={`text-sm font-medium ${isHero ? 'text-amber-450' : 'text-zinc-450'}`}>
                      {card.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg border ${card.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </CardHeader>
                  <CardContent className={isHero ? 'min-h-[140px] flex flex-col justify-between pt-4' : ''}>
                    <div>
                      <div className={`font-bold text-zinc-100 ${isHero ? 'text-5xl tracking-tight' : 'text-2xl'}`}>
                        {card.value}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </div>
                    {isHero && card.value > 0 && (
                      <div className="mt-4 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 font-medium animate-pulse">
                        Immediate inventory procurement recommended.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items widget */}
        <Card className="border-slate-800">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Low Stock Alerts</CardTitle>
                <CardDescription>Items that require immediate reorder</CardDescription>
              </div>
              <Link to="/products">
                <Button variant="outline" size="sm" className="border-slate-800 hover:bg-slate-800">
                  View All Products
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                <PackageCheck className="w-10 h-10 mb-2 text-emerald-500/40" />
                <p className="text-sm font-medium">All stock levels healthy</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead>SKU</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p: any) => (
                    <TableRow key={p.id} className="border-slate-850">
                      <TableCell className="font-mono text-xs text-slate-300">{p.sku}</TableCell>
                      <TableCell className="font-medium text-slate-200">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="font-mono">
                          {p.currentStock} {p.unit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-400">
                        {p.reorderLevel} {p.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Activity Widget based on role */}
        <Card className="border-slate-800">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {role === 'ACCOUNTS' ? 'Recent Invoices' : 'Recent Dispatches'}
                </CardTitle>
                <CardDescription>
                  {role === 'ACCOUNTS'
                    ? 'Latest invoices generated'
                    : 'Latest delivery notes dispatched'}
                </CardDescription>
              </div>
              <Link to={role === 'ACCOUNTS' ? '/invoices' : '/sales-challans'}>
                <Button variant="outline" size="sm" className="border-slate-800 hover:bg-slate-800">
                  {role === 'ACCOUNTS' ? 'View Invoices' : 'View Challans'}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {role === 'ACCOUNTS' ? (
              recentInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No invoices recorded</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentInvoices.map((inv: any) => (
                      <TableRow key={inv.id} className="border-slate-850">
                        <TableCell className="font-mono text-xs text-slate-300">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="font-medium text-slate-200">
                          {inv.customer.companyName}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-slate-300">
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : recentChallans.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No dispatches recorded</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead>Challan ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentChallans.map((ch: any) => (
                    <TableRow key={ch.id} className="border-slate-850">
                      <TableCell className="font-mono text-xs text-slate-300">
                        CH-{String(ch.id).padStart(4, '0')}
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {ch.customer.companyName}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {formatDate(ch.challanDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ch.status === 'DELIVERED'
                              ? 'success'
                              : ch.status === 'DISPATCHED'
                                ? 'info'
                                : 'warning'
                          }
                        >
                          {ch.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
