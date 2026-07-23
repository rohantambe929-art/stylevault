'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import type { OutfitCombination, WardrobeItem } from '@/types';
import { formatDate } from '@/lib/utils';
import { History, Trash2, Star, MapPin, CloudSun, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const [outfits, setOutfits] = useState<(OutfitCombination & { items?: WardrobeItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutfit, setSelectedOutfit] = useState<(OutfitCombination & { items?: WardrobeItem[] }) | null>(null);

  useEffect(() => {
    loadOutfits();
  }, []);

  const loadOutfits = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('outfits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Load items for each outfit
    const withItems = await Promise.all(
      (data || []).map(async (outfit) => {
        if (outfit.item_ids?.length) {
          const { data: items } = await supabase
            .from('wardrobe_items')
            .select('*')
            .in('id', outfit.item_ids);
          return { ...outfit, items: items || [] };
        }
        return outfit;
      })
    );

    setOutfits(withItems);
    setLoading(false);
  };

  const deleteOutfit = async (id: string) => {
    const supabase = createClient();
    await supabase.from('outfits').delete().eq('id', id);
    setOutfits(prev => prev.filter(o => o.id !== id));
    setSelectedOutfit(null);
  };

  const rateOutfit = async (id: string, rating: number) => {
    const supabase = createClient();
    await supabase.from('outfits').update({ rating }).eq('id', id);
    setOutfits(prev => prev.map(o => o.id === id ? { ...o, rating } : o));
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-container">
          <div className="animate-pulse-soft space-y-4">
            <div className="h-8 w-40 bg-surface-200 rounded" />
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-200 rounded-2xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Saved Looks</h1>
          <p className="text-surface-500 text-sm mt-0.5">{outfits.length} saved outfit{outfits.length !== 1 ? 's' : ''}</p>
        </div>

        {outfits.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-surface-300" />
            </div>
            <p className="text-surface-500 mb-1">No saved looks yet</p>
            <p className="text-sm text-surface-400 mb-6">Generate outfits in Style or Week Planner and save your favorites</p>
            <Link href="/style" className="btn-accent">Create a Look</Link>
          </div>
        ) : (
          <div className="grid gap-4 stagger-children">
            {outfits.map(outfit => (
              <div key={outfit.id} className="card p-4 hover:shadow-elevated transition-all cursor-pointer" onClick={() => setSelectedOutfit(outfit)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{outfit.name || 'Untitled Look'}</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {formatDate(outfit.created_at)}
                      {outfit.occasion && ` • ${outfit.occasion.replace('-', ' ')}`}
                      {outfit.location && ` • ${outfit.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {outfit.rating && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-xs">{outfit.rating}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Item thumbnails */}
                <div className="flex gap-2">
                  {(outfit.items || []).map(item => (
                    <div key={item.id} className="w-16 h-16 rounded-xl overflow-hidden bg-surface-100">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                {outfit.weather_summary && (
                  <p className="text-xs text-surface-400 flex items-center gap-1 mt-2">
                    <CloudSun className="w-3 h-3" /> {outfit.weather_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedOutfit && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedOutfit(null)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{selectedOutfit.name || 'Look'}</h3>
                <button onClick={() => setSelectedOutfit(null)} className="text-surface-400 hover:text-surface-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(selectedOutfit.items || []).map(item => (
                  <div key={item.id}>
                    <div className="aspect-square rounded-xl overflow-hidden bg-surface-100">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-surface-500 mt-1 truncate">{item.name}</p>
                  </div>
                ))}
              </div>

              {/* Meta */}
              <div className="space-y-2 text-sm text-surface-500 mb-4">
                {selectedOutfit.occasion && <p>Occasion: <span className="capitalize font-medium">{selectedOutfit.occasion.replace('-', ' ')}</span></p>}
                {selectedOutfit.location && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedOutfit.location}</p>}
                {selectedOutfit.weather_summary && <p className="flex items-center gap-1"><CloudSun className="w-3.5 h-3.5" /> {selectedOutfit.weather_summary}</p>}
                <p>Created: {formatDate(selectedOutfit.created_at)}</p>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-surface-500">Rate:</span>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => rateOutfit(selectedOutfit.id, star)}
                    className={cn('text-lg', star <= (selectedOutfit.rating || 0) ? 'text-amber-400' : 'text-surface-200')}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => deleteOutfit(selectedOutfit.id)}
                  className="btn-ghost text-red-500 flex-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
