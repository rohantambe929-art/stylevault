'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import type { WardrobeItem } from '@/types';
import { CATEGORY_LABELS, FORMALITY_LABELS, SEASON_LABELS, CONDITION_LABELS } from '@/lib/fashion/engine';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft, Trash2, Edit3, Shirt, Calendar, Tag, Droplets,
  Star, Clock, MapPin, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadItem();
  }, [params.id]);

  const loadItem = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('id', params.id)
      .single();
    setItem(data);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('wardrobe_items').delete().eq('id', params.id);
    router.push('/wardrobe');
  };

  const markWorn = async () => {
    const supabase = createClient();
    await supabase
      .from('wardrobe_items')
      .update({
        wear_count: (item?.wear_count || 0) + 1,
        last_worn: new Date().toISOString().split('T')[0],
      })
      .eq('id', params.id);
    loadItem();
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-container max-w-3xl">
          <div className="animate-pulse-soft space-y-4">
            <div className="h-8 w-32 bg-surface-200 rounded" />
            <div className="h-96 bg-surface-200 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <div className="page-container text-center py-20">
          <p className="text-surface-500">Item not found</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container max-w-3xl">
        <button onClick={() => router.back()} className="btn-ghost mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-surface-100 border border-surface-200/60">
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={markWorn} className="btn-ghost flex-1 text-sm">
                <Clock className="w-4 h-4" /> Mark Worn
              </button>
              <button
                onClick={handleDelete}
                className={cn('btn-ghost flex-1 text-sm', confirmDelete ? 'text-red-600 bg-red-50' : 'text-surface-400')}
              >
                <Trash2 className="w-4 h-4" />
                {confirmDelete ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 className="text-2xl font-semibold mb-1">{item.name}</h1>
            <div className="flex items-center gap-2 mb-6">
              <span className="badge bg-surface-100 text-surface-600 capitalize">{CATEGORY_LABELS[item.category]}</span>
              <span className="badge bg-brand-100 text-brand-700">{FORMALITY_LABELS[item.formality]}</span>
            </div>

            <div className="space-y-4">
              <DetailRow icon={Tag} label="Colors" value={item.colors.map(c => c.replace('-', ' ')).join(', ')} />
              <DetailRow icon={Shirt} label="Style" value={item.style.join(', ') || '—'} />
              <DetailRow icon={Droplets} label="Fabric" value={item.fabric || '—'} />
              <DetailRow
                icon={Calendar}
                label="Season"
                value={item.season.map(s => SEASON_LABELS[s as keyof typeof SEASON_LABELS] || s).join(', ')}
              />
              <DetailRow icon={Package} label="Brand" value={item.brand || '—'} />
              <DetailRow icon={Star} label="Size" value={item.size || '—'} />

              <div className="border-t border-surface-100 pt-4">
                <h3 className="text-sm font-semibold text-surface-700 mb-3">Purchase & Condition</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard label="Purchase Date" value={item.purchase_date ? formatDate(item.purchase_date) : '—'} />
                  <InfoCard label="Price" value={item.purchase_price ? `₹${item.purchase_price.toLocaleString('en-IN')}` : '—'} />
                  <InfoCard label="Condition" value={CONDITION_LABELS[item.condition] || item.condition} />
                  <InfoCard label="Durability" value={`${'★'.repeat(item.durability)}${'☆'.repeat(5 - item.durability)}`} />
                  <InfoCard label="Times Worn" value={String(item.wear_count)} />
                  <InfoCard label="Last Worn" value={item.last_worn ? formatDate(item.last_worn) : 'Never'} />
                </div>
              </div>

              {item.notes && (
                <div className="border-t border-surface-100 pt-4">
                  <h3 className="text-sm font-semibold text-surface-700 mb-2">Notes</h3>
                  <p className="text-sm text-surface-500">{item.notes}</p>
                </div>
              )}

              <div className="border-t border-surface-100 pt-4">
                <p className="text-xs text-surface-400">
                  Added {formatDate(item.created_at)} via {item.source}
                  {item.order_reference && ` • Ref: ${item.order_reference.slice(0, 50)}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-surface-400 flex-shrink-0" />
      <span className="text-sm text-surface-500 w-20">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-50 rounded-xl p-3">
      <p className="text-xs text-surface-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
