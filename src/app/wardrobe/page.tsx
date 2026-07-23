'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import type { WardrobeItem, FilterState, ClothingCategory } from '@/types';
import { CATEGORY_LABELS } from '@/lib/fashion/engine';
import { cn, debounce } from '@/lib/utils';
import {
  Plus, Search, SlidersHorizontal, Grid3X3, List,
  Shirt, X
} from 'lucide-react';

const CATEGORIES: (ClothingCategory | 'all')[] = [
  'all', 'top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory', 'activewear', 'formal'
];

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: 'all', color: 'all', formality: 'all',
    season: 'all', condition: 'all', search: '',
  });

  const loadItems = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.formality !== 'all') {
      query = query.eq('formality', filters.formality);
    }
    if (filters.condition !== 'all') {
      query = query.eq('condition', filters.condition);
    }
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data } = await query;
    setItems(data || []);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const activeFilterCount = [
    filters.category !== 'all',
    filters.color !== 'all',
    filters.formality !== 'all',
    filters.season !== 'all',
    filters.condition !== 'all',
  ].filter(Boolean).length;

  return (
    <AppShell>
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wardrobe</h1>
            <p className="text-surface-500 text-sm mt-0.5">{items.length} items</p>
          </div>
          <Link href="/wardrobe/add" className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Item</span>
          </Link>
        </div>

        {/* Search + Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search your wardrobe..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'p-2.5 rounded-xl border transition-all relative',
              showFilters ? 'bg-surface-900 text-white border-surface-900' : 'border-surface-200 text-surface-500 hover:border-surface-300'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="hidden sm:flex items-center border border-surface-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={cn('p-2.5', view === 'grid' ? 'bg-surface-900 text-white' : 'text-surface-400')}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('p-2.5', view === 'list' ? 'bg-surface-900 text-white' : 'text-surface-400')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilters(f => ({ ...f, category: cat }))}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                filters.category === cat
                  ? 'bg-surface-900 text-white'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="card p-4 mb-4 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FilterSelect
                label="Formality"
                value={filters.formality}
                onChange={v => setFilters(f => ({ ...f, formality: v as any }))}
                options={['all', 'casual', 'smart-casual', 'business', 'formal', 'black-tie']}
              />
              <FilterSelect
                label="Season"
                value={filters.season}
                onChange={v => setFilters(f => ({ ...f, season: v as any }))}
                options={['all', 'spring', 'summer', 'autumn', 'winter', 'all-season']}
              />
              <FilterSelect
                label="Condition"
                value={filters.condition}
                onChange={v => setFilters(f => ({ ...f, condition: v as any }))}
                options={['all', 'new', 'excellent', 'good', 'fair', 'worn']}
              />
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ category: 'all', color: 'all', formality: 'all', season: 'all', condition: 'all', search: '' })}
                  className="btn-ghost text-red-500"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="animate-pulse-soft">
                <div className="aspect-square bg-surface-200 rounded-2xl" />
                <div className="h-4 bg-surface-200 rounded mt-2 w-3/4" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shirt className="w-8 h-8 text-surface-300" />
            </div>
            <p className="text-surface-500 mb-4">
              {filters.category !== 'all' || filters.search
                ? 'No items match your filters'
                : 'No items yet — add your first piece!'}
            </p>
            <Link href="/wardrobe/add" className="btn-accent">
              <Plus className="w-4 h-4" /> Add Item
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {items.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 stagger-children">
            {items.map(item => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ItemCard({ item }: { item: WardrobeItem }) {
  return (
    <Link href={`/wardrobe/${item.id}`} className="card overflow-hidden group">
      <div className="aspect-square bg-surface-100 relative overflow-hidden">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2">
          <span className="badge bg-white/90 backdrop-blur text-surface-600 capitalize">
            {item.category}
          </span>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-surface-400 capitalize">{item.formality.replace('-', ' ')}</span>
          <span className="text-xs text-surface-300">•</span>
          <span className="text-xs text-surface-400 capitalize">{item.primary_color}</span>
        </div>
      </div>
    </Link>
  );
}

function ItemRow({ item }: { item: WardrobeItem }) {
  return (
    <Link href={`/wardrobe/${item.id}`} className="card p-3 flex items-center gap-4 hover:shadow-elevated transition-all">
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-surface-400 capitalize">
          {item.category} • {item.formality.replace('-', ' ')} • {item.primary_color}
        </p>
      </div>
      <span className={cn(
        'badge',
        item.condition === 'new' || item.condition === 'excellent' ? 'bg-green-100 text-green-700' :
        item.condition === 'good' ? 'bg-blue-100 text-blue-700' :
        'bg-amber-100 text-amber-700'
      )}>
        {item.condition}
      </span>
    </Link>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-surface-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-field text-sm capitalize"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt === 'all' ? `All ${label}s` : opt.replace('-', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}
