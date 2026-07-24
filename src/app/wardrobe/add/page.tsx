'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { classifyClothingImage, classifyVideoFrames, parseOrderDetails } from '@/lib/ai/classify';
import { fileToBase64, compressImage, extractVideoFrames } from '@/lib/utils';
import type { ClassificationResult, AddMethod } from '@/types';
import {
  Camera, Video, ShoppingBag, PenLine, Loader2,
  ArrowLeft, ArrowRight, Check, X, Sparkles, AlertTriangle,
  RefreshCw, Plus, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetectedItem {
  classification: ClassificationResult;
  framePreview: string;
  frameBase64: string;
  selected: boolean;
}

export default function AddItemPage() {
  const [method, setMethod] = useState<AddMethod | null>(null);
  const [step, setStep] = useState<'method' | 'capture' | 'classifying' | 'video-results' | 'details' | 'done'>('method');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderText, setOrderText] = useState('');
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      name: '', category: 'top', subcategory: 'other', primary_color: 'black',
      colors: [] as string[], formality: 'casual', season: ['all-season'] as string[],
      style: [] as string[], fabric: '', brand: '', size: '', purchase_date: '',
      purchase_price: '', condition: 'good', durability: 3, notes: '', tags: [] as string[],
      order_reference: '',
    };
  }

  // ============ PHOTO UPLOAD ============
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const compressed = await compressImage(file);
    const preview = URL.createObjectURL(compressed);
    setImagePreview(preview);

    const base64 = await fileToBase64(compressed);
    setImageBase64(base64);
    setStep('classifying');
    await runClassification(base64);
  };

  const runClassification = async (base64: string) => {
    setClassifying(true);
    setError(null);
    try {
      const result = await classifyClothingImage(base64);
      setClassification(result);
      applyClassification(result);
      setStep('details');
    } catch (err: any) {
      setError(err.message || 'Classification failed — check your API key');
      setStep('details'); // Still let them add manually
    } finally {
      setClassifying(false);
    }
  };

  // ============ VIDEO UPLOAD → MULTI-ITEM DETECTION ============
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setClassifying(true);
    setStep('classifying');

    try {
      // Extract frames from video
      const frames = await extractVideoFrames(file, 8);
      const framePreviews = frames.map(f => URL.createObjectURL(f));
      setVideoFrames(framePreviews);

      // Convert all frames to base64
      const framesBase64: string[] = [];
      for (const frame of frames) {
        framesBase64.push(await fileToBase64(frame));
      }

      // Classify all frames and detect unique items
      const { items, errors } = await classifyVideoFrames(framesBase64);

      if (errors.length > 0 && items.length === 0) {
        setError(errors[0]);
        setStep('method');
        setClassifying(false);
        return;
      }

      // Build detected items list with frame previews
      const detected: DetectedItem[] = items.map(item => ({
        classification: item,
        framePreview: framePreviews[item.frameIndex] || framePreviews[0],
        frameBase64: framesBase64[item.frameIndex] || framesBase64[0],
        selected: true, // All selected by default
      }));

      setDetectedItems(detected);
      setStep('video-results');
    } catch (err: any) {
      setError(err.message || 'Video processing failed');
      setStep('method');
    } finally {
      setClassifying(false);
    }
  };

  // Add selected video items
  const addSelectedVideoItems = async () => {
    const selected = detectedItems.filter(d => d.selected);
    if (selected.length === 0) return;

    setSaving(true);
    let count = 0;

    for (const item of selected) {
      const saved = await saveItem(item.classification, item.frameBase64, item.framePreview, 'video');
      if (saved) count++;
    }

    setAddedCount(count);
    setSaving(false);
    setStep('done');
  };

  // ============ ORDER TEXT ============
  const handleOrderSubmit = async () => {
    if (!orderText.trim()) return;
    setClassifying(true);
    setError(null);
    setStep('classifying');

    try {
      const result = await parseOrderDetails(orderText);
      const classification: ClassificationResult = {
        category: (result.category as any) || 'other',
        subcategory: (result.subcategory as any) || 'other',
        colors: (result.colors as any) || ['black'],
        primary_color: (result.primary_color as any) || 'black',
        formality: (result.formality as any) || 'casual',
        season: (result.season as any) || ['all-season'],
        style: (result.style as any) || [],
        fabric: result.fabric,
        suggested_name: result.suggested_name || 'Ordered Item',
        confidence: 0.6,
      };
      setClassification(classification);
      applyClassification(classification);
      if (result.brand) setForm(f => ({ ...f, brand: result.brand! }));
      if (result.price) setForm(f => ({ ...f, purchase_price: String(result.price) }));
      setForm(f => ({ ...f, order_reference: orderText.slice(0, 200) }));
      setStep('details');
    } catch (err: any) {
      setError(err.message || 'Order parsing failed');
      setStep('details');
    } finally {
      setClassifying(false);
    }
  };

  // ============ SHARED ============
  const applyClassification = (result: ClassificationResult) => {
    setForm(f => ({
      ...f,
      name: result.suggested_name,
      category: result.category,
      subcategory: result.subcategory,
      primary_color: result.primary_color,
      colors: result.colors,
      formality: result.formality,
      season: result.season,
      style: result.style,
      fabric: result.fabric || '',
    }));
  };

  const saveItem = async (
    classResult: ClassificationResult | null,
    base64: string | null,
    preview: string | null,
    source: AddMethod
  ): Promise<boolean> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Upload image
    let imageUrl = preview || '';
    if (base64) {
      const blob = base64ToBlob(base64);
      const fileName = `${user.id}/${Date.now()}-${(form.name || 'item').replace(/\s+/g, '-').toLowerCase()}.jpg`;
      const { data: uploadData } = await supabase.storage
        .from('wardrobe')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('wardrobe').getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('wardrobe_items').insert({
      user_id: user.id,
      image_url: imageUrl,
      name: form.name || classResult?.suggested_name || 'Item',
      category: form.category || classResult?.category || 'other',
      subcategory: form.subcategory || classResult?.subcategory || 'other',
      colors: form.colors.length ? form.colors : classResult?.colors || ['black'],
      primary_color: form.primary_color || classResult?.primary_color || 'black',
      formality: form.formality || classResult?.formality || 'casual',
      season: form.season.length ? form.season : classResult?.season || ['all-season'],
      style: form.style.length ? form.style : classResult?.style || [],
      fabric: form.fabric || classResult?.fabric || null,
      brand: form.brand || null,
      size: form.size || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      condition: form.condition,
      durability: form.durability,
      notes: form.notes || null,
      tags: form.tags,
      source,
      order_reference: form.order_reference || null,
    });

    return !error;
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await saveItem(classification, imageBase64, imagePreview, method || 'manual');
    setSaving(false);
    if (ok) {
      setAddedCount(1);
      setStep('done');
    }
  };

  // ============ RENDER ============
  return (
    <AppShell>
      <div className="page-container max-w-2xl">
        <button onClick={() => router.back()} className="btn-ghost mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">AI Classification Issue</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <p className="text-xs text-red-500 mt-1">You can still add the item manually below.</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Choose Method */}
        {step === 'method' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold mb-2">Add to Wardrobe</h1>
            <p className="text-surface-500 mb-8">How would you like to add?</p>
            <div className="grid gap-4">
              <MethodCard icon={Camera} title="Take / Upload Photo" desc="Snap a pic — AI classifies it automatically" onClick={() => { setMethod('photo'); fileInputRef.current?.click(); }} />
              <MethodCard icon={Video} title="Record / Upload Video" desc="Show multiple items — AI detects & lists each one" onClick={() => { setMethod('video'); videoInputRef.current?.click(); }} />
              <MethodCard icon={ShoppingBag} title="Paste Order Details" desc="Copy-paste an order confirmation email" onClick={() => { setMethod('order'); setStep('capture'); }} />
              <MethodCard icon={PenLine} title="Add Manually" desc="Enter all details by hand" onClick={() => { setMethod('manual'); setForm(getEmptyForm()); setStep('details'); }} />
            </div>
          </div>
        )}

        {/* Step: Order text */}
        {step === 'capture' && method === 'order' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold mb-2">Paste Order Details</h1>
            <p className="text-surface-500 mb-6">Copy the order confirmation. AI extracts item details.</p>
            <textarea value={orderText} onChange={e => setOrderText(e.target.value)}
              placeholder={"Example:\nMyntra Order #12345\nRoadster Men Navy Blue Slim Fit Casual Shirt\nSize: L | Price: ₹1,299"}
              className="input-field h-48 resize-none mb-4" />
            <button onClick={handleOrderSubmit} disabled={!orderText.trim() || classifying} className="btn-accent w-full">
              {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Extract Details
            </button>
          </div>
        )}

        {/* Step: Classifying */}
        {step === 'classifying' && (
          <div className="animate-slide-up text-center py-16">
            {imagePreview && (
              <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden mb-6 border-4 border-brand-200">
                <img src={imagePreview} alt="Analyzing" className="w-full h-full object-cover" />
              </div>
            )}
            {videoFrames.length > 0 && (
              <div className="flex gap-2 justify-center mb-6 flex-wrap">
                {videoFrames.map((frame, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-surface-200">
                    <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">
              {method === 'video' ? 'Detecting items in video...' : 'Analyzing your item...'}
            </p>
            <p className="text-surface-400 text-sm mt-1">
              {method === 'video' ? 'AI is identifying each clothing item separately' : 'Gemini AI is classifying category, colors, style & more'}
            </p>
          </div>
        )}

        {/* Step: Video Results — Multi-item selection */}
        {step === 'video-results' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold mb-2">Items Detected</h1>
            <p className="text-surface-500 mb-6">
              Found <span className="font-semibold text-brand-600">{detectedItems.length} item{detectedItems.length !== 1 ? 's' : ''}</span> in your video. Select which to add:
            </p>

            <div className="space-y-3 mb-6">
              {detectedItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setDetectedItems(prev => prev.map((d, i) => i === idx ? { ...d, selected: !d.selected } : d))}
                  className={cn(
                    'card p-4 flex items-center gap-4 cursor-pointer transition-all',
                    item.selected ? 'ring-2 ring-brand-500 bg-brand-50/50' : 'opacity-60'
                  )}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0">
                    <img src={item.framePreview} alt={item.classification.suggested_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.classification.suggested_name}</p>
                    <p className="text-xs text-surface-400 capitalize mt-0.5">
                      {item.classification.category} • {item.classification.primary_color} • {item.classification.formality.replace('-', ' ')}
                    </p>
                    <p className="text-xs text-surface-300 mt-0.5">
                      {Math.round(item.classification.confidence * 100)}% confidence
                    </p>
                  </div>
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    item.selected ? 'border-brand-500 bg-brand-500' : 'border-surface-300'
                  )}>
                    {item.selected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addSelectedVideoItems}
              disabled={saving || detectedItems.filter(d => d.selected).length === 0}
              className="btn-primary w-full py-3"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Adding...' : `Add ${detectedItems.filter(d => d.selected).length} item${detectedItems.filter(d => d.selected).length !== 1 ? 's' : ''} to Wardrobe`}
            </button>
          </div>
        )}

        {/* Step: Details Form */}
        {step === 'details' && (
          <div className="animate-slide-up">
            <div className="flex items-center gap-4 mb-6">
              {imagePreview && (
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0">
                  <img src={imagePreview} alt="Item" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-semibold">Item Details</h1>
                {classification && !error && (
                  <p className="text-sm text-brand-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI classified ({Math.round(classification.confidence * 100)}% confidence)
                  </p>
                )}
                {error && (
                  <p className="text-sm text-amber-600">Edit manually — AI couldn't classify</p>
                )}
              </div>
              {imageBase64 && error && (
                <button
                  onClick={() => { setStep('classifying'); runClassification(imageBase64); }}
                  className="ml-auto btn-ghost text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry AI
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Item Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g. Navy Slim-Fit Blazer" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field capitalize">
                    {['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory', 'activewear', 'formal', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Formality</label>
                  <select value={form.formality} onChange={e => setForm(f => ({ ...f, formality: e.target.value }))} className="input-field capitalize">
                    {['casual', 'smart-casual', 'business', 'formal', 'black-tie'].map(f => <option key={f} value={f}>{f.replace('-', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Primary Color</label>
                <select value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="input-field capitalize">
                  {['black', 'white', 'gray', 'navy', 'blue', 'light-blue', 'red', 'burgundy', 'pink', 'orange', 'yellow', 'green', 'olive', 'brown', 'tan', 'beige', 'cream', 'purple', 'teal', 'coral', 'gold', 'silver', 'multicolor'].map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Season</label>
                  <select value={form.season[0]} onChange={e => setForm(f => ({ ...f, season: [e.target.value] }))} className="input-field capitalize">
                    {['all-season', 'spring', 'summer', 'autumn', 'winter'].map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Style</label>
                  <select value={form.style[0] || 'classic'} onChange={e => setForm(f => ({ ...f, style: [e.target.value] }))} className="input-field capitalize">
                    {['minimalist', 'streetwear', 'classic', 'bohemian', 'sporty', 'preppy', 'grunge', 'vintage', 'ethnic', 'business'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Brand</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="input-field" placeholder="Zara, H&M..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Fabric</label>
                  <input value={form.fabric} onChange={e => setForm(f => ({ ...f, fabric: e.target.value }))} className="input-field" placeholder="Cotton, Denim..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Size</label>
                  <input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="input-field" placeholder="S / M / L / 32" />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="input-field" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Price (₹)</label>
                  <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} className="input-field" placeholder="1999" />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Condition</label>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="input-field capitalize">
                    {['new', 'excellent', 'good', 'fair', 'worn'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Durability: {form.durability}/5</label>
                <input type="range" min={1} max={5} value={form.durability} onChange={e => setForm(f => ({ ...f, durability: parseInt(e.target.value) }))} className="w-full accent-brand-600" />
                <div className="flex justify-between text-xs text-surface-400"><span>Delicate</span><span>Built to last</span></div>
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field h-20 resize-none" placeholder="Care instructions, pairing ideas..." />
              </div>

              <button onClick={handleSave} disabled={!form.name.trim() || saving} className="btn-primary w-full py-3">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Add to Wardrobe'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center py-20 animate-slide-up">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">
              {addedCount > 1 ? `${addedCount} items added!` : 'Added to your wardrobe!'}
            </h2>
            <p className="text-surface-500 mt-1 mb-6">
              {addedCount > 1 ? 'All selected items are now in your wardrobe' : 'Your item is catalogued and ready to style'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push('/wardrobe')} className="btn-primary">View Wardrobe</button>
              <button onClick={() => { setStep('method'); setForm(getEmptyForm()); setClassification(null); setImagePreview(null); setImageBase64(null); setDetectedItems([]); setVideoFrames([]); setError(null); }} className="btn-ghost">Add More</button>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
        <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleVideoUpload} />
      </div>
    </AppShell>
  );
}

function MethodCard({ icon: Icon, title, desc, onClick }: { icon: React.ElementType; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-5 flex items-start gap-4 text-left hover:shadow-elevated transition-all group w-full">
      <div className="w-12 h-12 bg-surface-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 transition-colors">
        <Icon className="w-6 h-6 text-surface-600 group-hover:text-brand-600 transition-colors" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-surface-400 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-surface-300 ml-auto mt-1 group-hover:text-brand-500 transition-colors" />
    </button>
  );
}

function base64ToBlob(base64: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'image/jpeg' });
}
