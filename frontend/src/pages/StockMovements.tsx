import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle,
  Package2, User, Clock, FileText, FilterX,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockMovement {
  id: number;
  quantity: number;
  type: 'IN' | 'OUT';
  referenceType?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  product: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    category: string;
  };
  createdBy?: {
    id: number;
    name: string;
    role: string;
  } | null;
}

// ─── Role badge colour map ─────────────────────────────────────────────────────
const roleBadgeClass: Record<string, string> = {
  ADMIN: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  WAREHOUSE: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  SALES: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  ACCOUNTS: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
};

// ─── referenceType label map ───────────────────────────────────────────────────
const refLabel: Record<string, string> = {
  PO: 'Purchase Order',
  CHALLAN: 'Sales Challan',
  MANUAL: 'Manual Adjustment',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function StockMovements() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-movements', page, search, typeFilter],
    queryFn: async () => {
      const res = await axios.get('/stock-movements', {
        params: {
          page,
          limit,
          search: search || undefined,
          type: typeFilter !== 'ALL' ? typeFilter : undefined,
        },
      });
      return res.data;
    },
  });

  const { data: movements = [], meta = { totalPages: 1, total: 0 } } = data || {};

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setPage(1);
  };

  const hasFilters = search || typeFilter !== 'ALL';

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-400">
        Failed to load stock movement log.
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Stock Movement Log</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Full audit trail of every stock change — Purchase Orders, Sales Challans, and manual adjustments
        </p>
      </div>

      {/* ── Summary chips ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'All Movements', value: 'ALL', icon: Package2, colorOff: 'border-zinc-800 text-zinc-400', colorOn: 'border-indigo-500/50 bg-indigo-600/15 text-indigo-300' },
          { label: 'Stock IN', value: 'IN', icon: ArrowDownCircle, colorOff: 'border-zinc-800 text-zinc-400', colorOn: 'border-emerald-500/50 bg-emerald-600/15 text-emerald-300' },
          { label: 'Stock OUT', value: 'OUT', icon: ArrowUpCircle, colorOff: 'border-zinc-800 text-zinc-400', colorOn: 'border-rose-500/50 bg-rose-600/15 text-rose-300' },
        ].map(({ label, value, icon: Icon, colorOff, colorOn }) => (
          <button
            key={value}
            onClick={() => { setTypeFilter(value as typeof typeFilter); setPage(1); }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              typeFilter === value ? colorOn : colorOff + ' hover:bg-zinc-800/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-5 pb-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 w-full max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <Input
              type="text"
              placeholder="Search by product name or SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border-0 bg-transparent text-zinc-200 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              <FilterX className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}

          <div className="md:ml-auto text-xs text-zinc-500 shrink-0">
            {meta.total} movement{meta.total !== 1 ? 's' : ''} found
          </div>
        </CardContent>
      </Card>

      {/* ── Movement Log Table ── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
            </div>
          ) : movements.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Package2 className="w-10 h-10 text-zinc-700 mx-auto" />
              <p className="text-zinc-500">No stock movements found.</p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-12">Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reason / Reference</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mv: StockMovement) => (
                    <TableRow key={mv.id} className="border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">

                      {/* Type badge */}
                      <TableCell>
                        {mv.type === 'IN' ? (
                          <div className="flex items-center gap-1.5">
                            <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs font-bold text-emerald-400">IN</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <ArrowUpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span className="text-xs font-bold text-rose-400">OUT</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Product */}
                      <TableCell>
                        <div className="font-medium text-zinc-100 text-sm">{mv.product.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-indigo-400">{mv.product.sku}</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[11px] text-zinc-500">{mv.product.category}</span>
                        </div>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell className="text-right">
                        <span className={`font-mono font-bold text-base ${mv.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {mv.type === 'IN' ? '+' : '−'}{mv.quantity}
                        </span>
                        <span className="text-[10px] text-zinc-500 ml-1">{mv.product.unit}</span>
                      </TableCell>

                      {/* Reason / Reference */}
                      <TableCell className="max-w-[240px]">
                        {mv.referenceType && (
                          <Badge
                            variant="default"
                            className="text-[10px] font-mono mb-1 border border-zinc-700 bg-zinc-800 text-zinc-300"
                          >
                            {refLabel[mv.referenceType] || mv.referenceType}
                          </Badge>
                        )}
                        {mv.reason ? (
                          <p className="text-xs text-zinc-300 leading-relaxed flex items-start gap-1">
                            <FileText className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                            {mv.reason}
                          </p>
                        ) : mv.notes ? (
                          <p className="text-xs text-zinc-400 italic">{mv.notes}</p>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">—</span>
                        )}
                      </TableCell>

                      {/* Created By */}
                      <TableCell>
                        {mv.createdBy ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-zinc-500 shrink-0" />
                              <span className="text-sm text-zinc-200">{mv.createdBy.name}</span>
                            </div>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border mt-0.5 inline-block ${roleBadgeClass[mv.createdBy.role] || 'border-zinc-700 text-zinc-400'}`}>
                              {mv.createdBy.role}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">System</span>
                        )}
                      </TableCell>

                      {/* Timestamp */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          {formatDate(mv.createdAt)}
                        </div>
                      </TableCell>

                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} of {meta.total}
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
                  <span className="text-xs text-zinc-300 px-2">{page} / {meta.totalPages}</span>
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
    </div>
  );
}
