'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import type { UserProfile, StyleAesthetic, ColorFamily } from '@/types';
import { compressImage, fileToBase64 } from '@/lib/utils';
import {
  User, Camera, MapPin, Palette, Shirt, Save, Loader2,
  LogOut, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLE_OPTIONS: StyleAesthetic[] = [
  'minimalist', 'streetwear', 'classic', 'bohemian', 'sporty',
  'preppy', 'grunge', 'vintage', 'ethnic', 'business'
];

const COLOR_OPTIONS: ColorFamily[] = [
  'black', 'white', 'gray', 'navy', 'blue', 'red', 'burgundy',
  'pink', 'green', 'olive', 'brown', 'beige', 'cream', 'purple', 'teal'
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const bodyPhotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: '',
    default_location: '',
    style_preferences: [] as StyleAesthetic[],
    color_preferences: [] as ColorFamily[],
    avoid_colors: [] as ColorFamily[],
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      setForm({
        display_name: data.display_name || '',
        default_location: data.default_location || '',
        style_preferences: data.style_preferences || [],
        color_preferences: data.color_preferences || [],
        avoid_colors: data.avoid_colors || [],
      });
    }
    setLoading(false);
  };

  const handleBodyPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const compressed = await compressImage(file, 1024);
    const fileName = `${user.id}/body-photo-${Date.now()}.jpg`;
    const { data: uploadData } = await supabase.storage
      .from('profiles')
      .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: true });

    if (uploadData) {
      const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(uploadData.path);
      await supabase.from('profiles').update({ body_photo_url: urlData.publicUrl }).eq('id', user.id);
      setProfile(p => p ? { ...p, body_photo_url: urlData.publicUrl } : p);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({
      display_name: form.display_name,
      default_location: form.default_location,
      style_preferences: form.style_preferences,
      color_preferences: form.color_preferences,
      avoid_colors: form.avoid_colors,
    }).eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const toggleStyle = (style: StyleAesthetic) => {
    setForm(f => ({
      ...f,
      style_preferences: f.style_preferences.includes(style)
        ? f.style_preferences.filter(s => s !== style)
        : [...f.style_preferences, style],
    }));
  };

  const toggleColor = (color: ColorFamily, field: 'color_preferences' | 'avoid_colors') => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(color)
        ? f[field].filter(c => c !== color)
        : [...f[field], color],
    }));
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-container max-w-2xl">
          <div className="animate-pulse-soft space-y-4">
            <div className="h-8 w-32 bg-surface-200 rounded" />
            <div className="h-64 bg-surface-200 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

        {/* Body Photo */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-24 rounded-xl overflow-hidden bg-surface-100 border border-surface-200 flex-shrink-0">
              {profile?.body_photo_url ? (
                <img src={profile.body_photo_url} alt="Your photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-surface-300" />
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-sm">Full-body Photo</p>
              <p className="text-xs text-surface-400 mb-2">Used for virtual try-on previews</p>
              <button onClick={() => bodyPhotoRef.current?.click()} className="btn-ghost text-sm border border-surface-200">
                <Camera className="w-4 h-4" />
                {profile?.body_photo_url ? 'Update Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>
          <input ref={bodyPhotoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleBodyPhotoUpload} />
        </div>

        {/* Basic Info */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-sm mb-4">Basic Info</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1 block">Display Name</label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="input-field"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1 block flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Default Location
              </label>
              <input
                value={form.default_location}
                onChange={e => setForm(f => ({ ...f, default_location: e.target.value }))}
                className="input-field"
                placeholder="e.g. Mumbai, India"
              />
              <p className="text-[11px] text-surface-400 mt-1">Used for weather-based outfit suggestions</p>
            </div>
          </div>
        </div>

        {/* Style Preferences */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shirt className="w-4 h-4" /> Style Preferences
          </h3>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map(style => (
              <button
                key={style}
                onClick={() => toggleStyle(style)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all',
                  form.style_preferences.includes(style)
                    ? 'bg-surface-900 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Color Preferences */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4" /> Favorite Colors
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {COLOR_OPTIONS.map(color => (
              <button
                key={color}
                onClick={() => toggleColor(color, 'color_preferences')}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  form.color_preferences.includes(color) ? 'border-brand-500 scale-110' : 'border-surface-200'
                )}
                style={{ backgroundColor: getColorHex(color) }}
                title={color}
              />
            ))}
          </div>

          <h3 className="font-semibold text-sm mb-3">Colors to Avoid</h3>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(color => (
              <button
                key={color}
                onClick={() => toggleColor(color, 'avoid_colors')}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all relative',
                  form.avoid_colors.includes(color) ? 'border-red-500 scale-110' : 'border-surface-200'
                )}
                style={{ backgroundColor: getColorHex(color) }}
                title={color}
              >
                {form.avoid_colors.includes(color) && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">✕</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 mb-4">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
        </button>

        {/* Logout */}
        <button onClick={handleLogout} className="btn-ghost w-full text-red-500">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <p className="text-center text-xs text-surface-300 mt-6">
          {profile?.email}
        </p>
      </div>
    </AppShell>
  );
}

function getColorHex(color: ColorFamily): string {
  const map: Record<string, string> = {
    black: '#171717', white: '#fafafa', gray: '#737373', navy: '#1e3a5f',
    blue: '#3b82f6', 'light-blue': '#93c5fd', red: '#ef4444', burgundy: '#7f1d1d',
    pink: '#ec4899', orange: '#f97316', yellow: '#eab308', green: '#22c55e',
    olive: '#6b7c3e', brown: '#92400e', tan: '#d2a679', beige: '#f5f0e8',
    cream: '#fffdd0', purple: '#a855f7', teal: '#14b8a6', coral: '#fb7185',
    gold: '#d4a843', silver: '#c0c0c0', multicolor: 'linear-gradient(135deg, #f00, #0f0, #00f)',
  };
  return map[color] || '#ccc';
}
