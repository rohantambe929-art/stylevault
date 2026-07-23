'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { getWeatherForLocation } from '@/lib/weather';
import {
  OCCASION_FORMALITY, weatherToSeason, weatherGuidance,
  getOutfitSlots, scoreOutfit, FORMALITY_LABELS
} from '@/lib/fashion/engine';
import type { WardrobeItem, WeatherData, OutfitCombination, UserProfile, FormalityLevel } from '@/types';
import { cn } from '@/lib/utils';
import {
  Sparkles, MapPin, CloudSun, Loader2, Save, RefreshCw,
  User, Shirt, Check, Star
} from 'lucide-react';

const OCCASIONS = [
  { id: 'casual-outing', label: 'Casual Outing', emoji: '☕' },
  { id: 'work', label: 'Work / Office', emoji: '💼' },
  { id: 'meeting', label: 'Important Meeting', emoji: '🤝' },
  { id: 'date-night', label: 'Date Night', emoji: '🌙' },
  { id: 'party', label: 'Party', emoji: '🎉' },
  { id: 'wedding', label: 'Wedding', emoji: '💒' },
  { id: 'gym', label: 'Gym / Sports', emoji: '🏋️' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'dinner', label: 'Dinner Out', emoji: '🍽️' },
  { id: 'festival', label: 'Festival', emoji: '🪔' },
  { id: 'interview', label: 'Interview', emoji: '📋' },
  { id: 'brunch', label: 'Brunch', emoji: '🥐' },
];

export default function StylePage() {
  const [occasion, setOccasion] = useState('');
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [outfits, setOutfits] = useState<WardrobeItem[][]>([]);
  const [generating, setGenerating] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);
    if (prof?.default_location) setLocation(prof.default_location);

    const { data: items } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id);
    setWardrobe(items || []);
  };

  const fetchWeather = async (loc: string) => {
    if (!loc.trim()) return;
    setLoadingWeather(true);
    const w = await getWeatherForLocation(loc);
    setWeather(w);
    setLoadingWeather(false);
  };

  const generateOutfits = async () => {
    if (!occasion || wardrobe.length < 2) return;
    setGenerating(true);

    // Get weather if location provided
    let w = weather;
    if (location && !w) {
      w = await getWeatherForLocation(location);
      setWeather(w);
    }

    const targetFormalities = OCCASION_FORMALITY[occasion] || ['casual', 'smart-casual'];
    const seasons = w ? weatherToSeason(w) : ['all-season'];
    const guidance = w ? weatherGuidance(w) : null;

    // Filter wardrobe by formality
    const eligible = wardrobe.filter(item =>
      targetFormalities.includes(item.formality) &&
      item.condition !== 'worn' &&
      (item.season.some(s => seasons.includes(s) || s === 'all-season'))
    );

    // Generate outfit combinations
    const combos = buildOutfitCombinations(eligible, targetFormalities, w, profile);
    setOutfits(combos);
    setGenerating(false);
  };

  const buildOutfitCombinations = (
    items: WardrobeItem[],
    formalities: FormalityLevel[],
    weather: WeatherData | null,
    profile: UserProfile | null
  ): WardrobeItem[][] => {
    const combos: WardrobeItem[][] = [];
    const tops = items.filter(i => i.category === 'top');
    const bottoms = items.filter(i => i.category === 'bottom');
    const dresses = items.filter(i => i.category === 'dress');
    const outerwear = items.filter(i => i.category === 'outerwear');
    const footwear = items.filter(i => i.category === 'footwear');
    const accessories = items.filter(i => i.category === 'accessory');
    const formals = items.filter(i => i.category === 'formal');

    // Strategy 1: Top + Bottom + Footwear
    for (const top of tops.slice(0, 3)) {
      for (const bottom of bottoms.slice(0, 3)) {
        const combo = [top, bottom];
        if (footwear.length) combo.push(footwear[combos.length % footwear.length]);
        if (weather && weather.temperature < 18 && outerwear.length) {
          combo.push(outerwear[combos.length % outerwear.length]);
        }
        if (accessories.length && combos.length % 2 === 0) {
          combo.push(accessories[combos.length % accessories.length]);
        }
        combos.push(combo);
        if (combos.length >= 6) break;
      }
      if (combos.length >= 6) break;
    }

    // Strategy 2: Dress + Footwear
    for (const dress of dresses.slice(0, 2)) {
      const combo = [dress];
      if (footwear.length) combo.push(footwear[0]);
      if (accessories.length) combo.push(accessories[0]);
      combos.push(combo);
    }

    // Strategy 3: Formal wear
    for (const formal of formals.slice(0, 2)) {
      const combo = [formal];
      if (footwear.length) combo.push(footwear[0]);
      combos.push(combo);
    }

    // Score and sort
    const scored = combos.map(combo => ({
      combo,
      score: scoreOutfit(combo, formalities[0], weather || {
        temperature: 25, feels_like: 25, condition: 'Clear', humidity: 50,
        wind_speed: 10, precipitation_probability: 0, is_day: true, summary: '', recommendation: ''
      }, profile ? { style_preferences: profile.style_preferences, avoid_colors: profile.avoid_colors } : undefined),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map(s => s.combo);
  };

  const saveOutfit = async (items: WardrobeItem[], idx: number) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('outfits').insert({
      user_id: user.id,
      name: `${OCCASIONS.find(o => o.id === occasion)?.label || 'Custom'} Look #${idx + 1}`,
      item_ids: items.map(i => i.id),
      occasion,
      formality: OCCASION_FORMALITY[occasion]?.[0] || 'casual',
      weather_summary: weather?.summary,
      temperature: weather?.temperature,
      location: location || null,
    });

    setSavedIdx(idx);
    setTimeout(() => setSavedIdx(null), 2000);
  };

  return (
    <AppShell>
      <div className="page-container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Style Me</h1>
          <p className="text-surface-500 text-sm mt-0.5">
            Tell me the occasion — I'll build outfits from your wardrobe
          </p>
        </div>

        {/* Occasion Selection */}
        <div className="mb-6">
          <label className="text-sm font-medium text-surface-700 mb-3 block">What's the occasion?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {OCCASIONS.map(occ => (
              <button
                key={occ.id}
                onClick={() => setOccasion(occ.id)}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  occasion === occ.id
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                <span className="text-lg">{occ.emoji}</span>
                <p className="text-xs font-medium mt-1">{occ.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Location + Weather */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location (e.g. Mumbai, London)"
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => fetchWeather(location)}
            disabled={loadingWeather}
            className="btn-ghost border border-surface-200"
          >
            {loadingWeather ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudSun className="w-4 h-4" />}
          </button>
        </div>

        {/* Weather info */}
        {weather && (
          <div className="card p-4 mb-6 flex items-center gap-4 animate-fade-in">
            <CloudSun className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-sm font-medium">{weather.summary}</p>
              <p className="text-xs text-surface-400">{weather.recommendation}</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={generateOutfits}
          disabled={!occasion || generating || wardrobe.length < 2}
          className="btn-accent w-full py-3 mb-8"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {generating ? 'Styling...' : 'Generate Outfits'}
        </button>

        {wardrobe.length < 2 && (
          <p className="text-center text-surface-400 text-sm -mt-4 mb-8">
            Add at least 2 items to your wardrobe first
          </p>
        )}

        {/* Results */}
        {outfits.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                {outfits.length} outfit{outfits.length > 1 ? 's' : ''} for you
              </h2>
              <button onClick={generateOutfits} className="btn-ghost text-sm">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>

            <div className="grid gap-6 stagger-children">
              {outfits.map((combo, idx) => (
                <OutfitCard
                  key={idx}
                  items={combo}
                  index={idx}
                  saved={savedIdx === idx}
                  onSave={() => saveOutfit(combo, idx)}
                  userPhoto={profile?.body_photo_url}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function OutfitCard({ items, index, saved, onSave, userPhoto }: {
  items: WardrobeItem[];
  index: number;
  saved: boolean;
  onSave: () => void;
  userPhoto?: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-surface-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {index + 1}
            </span>
            <span className="text-sm font-medium">
              {items.map(i => i.primary_color).join(' + ')} combo
            </span>
          </div>
          <button
            onClick={onSave}
            className={cn('btn-ghost text-sm', saved && 'text-green-600')}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {/* Outfit visualization */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {userPhoto && (
            <div className="w-24 h-32 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0 border-2 border-brand-200 relative">
              <img src={userPhoto} alt="You" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] bg-white/80 rounded py-0.5">You</span>
            </div>
          )}
          {items.map(item => (
            <div key={item.id} className="w-24 h-32 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0 relative group">
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] bg-white/80 rounded py-0.5 truncate">
                {item.name}
              </span>
            </div>
          ))}
        </div>

        {/* Item details */}
        <div className="flex flex-wrap gap-2 mt-3">
          {items.map(item => (
            <span key={item.id} className="badge bg-surface-100 text-surface-600 capitalize text-[11px]">
              {item.category}: {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
