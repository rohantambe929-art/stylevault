'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { classifyClothingImage, parseOrderDetails } from '@/lib/ai/classify';
import { fileToBase64, compressImage, extractVideoFrames } from '@/lib/utils';
import type { ClassificationResult, AddMethod, WardrobeItem } from '@/types';
import {
  Camera, Video, ShoppingBag, PenLine, Upload, Loader2,
  ArrowLeft, ArrowRight, Check, X, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddItemPage() {
  const [method, setMethod] = useState<AddMethod | null>(null);
  const [step, setStep] = useState<'method' | 'capture' | 'classify' | 'details' | 'done'>('method');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderText, setOrderText] = useState('');
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: 'top' as string,
    subcategory: 'other',
    primary_color: 'black',
    colors: [] as string[],
    formality: 'casual',
    season: ['all-season'] as string[],
    style: [] as string[],
    fabric: '',
    brand: '',
    size: '',
    purchase_date: '',
    purchase_price: '',
    condition: 'good',
    durability: 3,
    notes: '',
    tags: [] as string[],
    order_reference: '',
  });

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file);
    const preview = URL.createObjectURL(compressed);
    setImagePreview(preview);

    const base64 = await fileToBase64(compressed);
    setImageBase64(base64);
    setStep('classify');
    await runClassification(base64);
  };

  // Handle video upload → extract frames → classify best frame
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClassifying(true);
    setStep('classify');

    try {
      const frames = await extractVideoFrames(file, 5);
      const framePreviews = frames.map(f => URL.createObjectURL(f));
      setVideoFrames(framePreviews);

      // Classify the middle frame (most likely to show the item clearly)
      const midIdx = Math.floor(frames.length / 2);
      setCurrentFrameIdx(midIdx);
      const base64 = await fileToBase64(frames[midIdx]);
      setImageBase64(base64);
      setImagePreview(framePreviews[midIdx]);
      await runClassification(base64);
    } catch (err) {
      console.error('Video processing error:', err);
      setStep('method');
      setClassifying(false);
    }
  };

  // Handle order text
  const handleOrderSubmit = async () => {
    if (!orderText.trim()) return;
    setClassifying(true);
    setStep('classify');

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
    setClassifying(false);
    setStep('details');
  };

  // Run AI classification
  const runClassification = async (base64: string) => {
    setClassifying(true);
    const result = await classifyClothingImage(base64);
    setClassification(result);
    applyClassification(result);
    setClassifying(false);
    setStep('details');
  };

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

  // Save item
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upload image to Supabase Storage
    let imageUrl = imagePreview || '';
    if (imageBase64) {
      const blob = base64ToBlob(imageBase64);
      const fileName = `${user.id}/${Date.now()}-${form.name.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      const { data: uploadData } = await supabase.storage
        .from('wardrobe')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('wardrobe')
          .getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
      }
    }

    // Insert wardrobe item
    const { data, error } = await supabase
      .from('wardrobe_items')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        name: form.name,
        category: form.category,
        subcategory: form.subcategory,
        colors: form.colors,
        primary_color: form.primary_color,
        formality: form.formality,
        season: form.season,
        style: form.style,
        fabric: form.fabric || null,
        brand: form.brand || null,
        size: form.size || null,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        condition: form.condition,
        durability: form.durability,
        notes: form.notes || null,
        tags: form.tags,
        source: method,
        order_reference: form.order_reference || null,
      })
      .select()
      .single();

    setSaving(false);
    if (!error) {
      setStep('done');
      setTimeout(() => router.push('/wardrobe'), 1500);
    }
  };

  return (
    <AppShell>
      <div className="page-container max-w-2xl">
        {/* Back button */}
        <button onClick={() => router.back()} className="btn-ghost mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Step: Choose Method */}
        {step === 'method' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold mb-2">Add to Wardrobe</h1>
            <p className="text-surface-500 mb-8">How would you like to add this item?</p>

            <div className="grid gap-4">
              <MethodCard
                icon={Camera}
                title="Take / Upload Photo"
                desc="Snap a pic or choose from gallery. AI will auto-classify it."
                onClick={() => { setMethod('photo'); fileInputRef.current?.click(); }}
              />
              <MethodCard
                icon={Video}
                title="Record / Upload Video"
                desc="Show your item on video. We'll extract frames and classify."
                onClick={() => { setMethod('video'); videoInputRef.current?.click(); }}
              />
              <MethodCard
                icon={ShoppingBag}
                title="Paste Order Details"
                desc="Copy-paste an online order confirmation. We'll extract the info."
                onClick={() => { setMethod('order'); setStep('capture'); }}
              />
              <MethodCard
                icon={PenLine}
                title="Add Manually"
                desc="Enter all details by hand."
                onClick={() => { setMethod('manual'); setStep('details'); }}
              />
            </div>
          </div>
        )}

        {/* Step: Order text input */}
        {step === 'capture' && method === 'order' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold mb-2">Paste Order Details</h1>
            <p className="text-surface-500 mb-6">
              Copy the order confirmation email or screenshot text. We'll extract item details automatically.
            </p>
            <textarea
              value={orderText}
              onChange={e => setOrderText(e.target.value)}
              placeholder={"Example:\nMyntra Order #12345\nRoadster Men Navy Blue Slim Fit Casual Shirt\nSize: L | Price: ₹1,299\nDelivery by 25 Jul"}
              className="input-field h-48 resize-none mb-4"
            />
            <button
              onClick={handleOrderSubmit}
              disabled={!orderText.trim() || classifying}
              className="btn-accent w-full"
            >
              {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Extract Details
            </button>
          </div>
        )}

        {/* Step: Classifying */}
        {step === 'classify' && (
          <div className="animate-slide-up text-center py-16">
            {imagePreview && (
              <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden mb-6 border-4 border-brand-200">
                <img src={imagePreview} alt="Classifying" className="w-full h-full object-cover" />
              </div>
            )}
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Analyzing your item...</p>
            <p className="text-surface-400 text-sm mt-1">AI is identifying category, colors, style & more</p>

            {/* Video frames preview */}
            {videoFrames.length > 0 && (
              <div className="flex gap-2 justify-center mt-6">
                {videoFrames.map((frame, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-12 h-12 rounded-lg overflow-hidden border-2',
                      i === currentFrameIdx ? 'border-brand-500' : 'border-transparent opacity-50'
                    )}
                  >
                    <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
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
                {classification && (
                  <p className="text-sm text-brand-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI classified ({Math.round(classification.confidence * 100)}% confidence)
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Item Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Navy Slim-Fit Blazer"
                />
              </div>

              {/* Category + Subcategory */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="input-field capitalize"
                  >
                    {['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory', 'activewear', 'formal', 'other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Formality</label>
                  <select
                    value={form.formality}
                    onChange={e => setForm(f => ({ ...f, formality: e.target.value }))}
                    className="input-field capitalize"
                  >
                    {['casual', 'smart-casual', 'business', 'formal', 'black-tie'].map(f => (
                      <option key={f} value={f}>{f.replace('-', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Primary Color</label>
                <select
                  value={form.primary_color}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="input-field capitalize"
                >
                  {['black', 'white', 'gray', 'navy', 'blue', 'light-blue', 'red', 'burgundy', 'pink', 'orange', 'yellow', 'green', 'olive', 'brown', 'tan', 'beige', 'cream', 'purple', 'teal', 'coral', 'gold', 'silver', 'multicolor'].map(c => (
                    <option key={c} value={c}>{c.replace('-', ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Season + Style */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Season</label>
                  <select
                    value={form.season[0]}
                    onChange={e => setForm(f => ({ ...f, season: [e.target.value] }))}
                    className="input-field capitalize"
                  >
                    {['all-season', 'spring', 'summer', 'autumn', 'winter'].map(s => (
                      <option key={s} value={s}>{s.replace('-', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Style</label>
                  <select
                    value={form.style[0] || 'classic'}
                    onChange={e => setForm(f => ({ ...f, style: [e.target.value] }))}
                    className="input-field capitalize"
                  >
                    {['minimalist', 'streetwear', 'classic', 'bohemian', 'sporty', 'preppy', 'grunge', 'vintage', 'ethnic', 'business'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Brand + Fabric */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Brand</label>
                  <input
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Zara, H&M"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Fabric</label>
                  <input
                    value={form.fabric}
                    onChange={e => setForm(f => ({ ...f, fabric: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Cotton, Denim"
                  />
                </div>
              </div>

              {/* Size + Purchase Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Size</label>
                  <input
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                    className="input-field"
                    placeholder="S / M / L / XL / 32"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Price + Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Price (₹)</label>
                  <input
                    type="number"
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="input-field"
                    placeholder="1999"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-1 block">Condition</label>
                  <select
                    value={form.condition}
                    onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    className="input-field capitalize"
                  >
                    {['new', 'excellent', 'good', 'fair', 'worn'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Durability */}
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">
                  Durability: {form.durability}/5
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.durability}
                  onChange={e => setForm(f => ({ ...f, durability: parseInt(e.target.value) }))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-surface-400">
                  <span>Delicate</span>
                  <span>Built to last</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="input-field h-20 resize-none"
                  placeholder="Any extra details — care instructions, pairing ideas..."
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="btn-primary w-full py-3"
              >
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
            <h2 className="text-xl font-semibold">Added to your wardrobe!</h2>
            <p className="text-surface-500 mt-1">Redirecting...</p>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={handleVideoUpload}
        />
      </div>
    </AppShell>
  );
}

function MethodCard({ icon: Icon, title, desc, onClick }: {
  icon: React.ElementType;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-5 flex items-start gap-4 text-left hover:shadow-elevated transition-all group w-full"
    >
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
