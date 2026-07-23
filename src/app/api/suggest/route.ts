import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  OCCASION_FORMALITY, weatherToSeason, scoreOutfit, getOutfitSlots
} from '@/lib/fashion/engine';
import { getWeatherForLocation } from '@/lib/weather';
import type { WardrobeItem, FormalityLevel } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { occasion, location, limit = 5 } = await request.json();

    if (!occasion) {
      return NextResponse.json({ error: 'Occasion required' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load wardrobe
    const { data: wardrobe } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id);

    if (!wardrobe || wardrobe.length < 2) {
      return NextResponse.json({ error: 'Not enough items in wardrobe' }, { status: 400 });
    }

    // Load profile for preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get weather
    const weather = location
      ? await getWeatherForLocation(location)
      : null;

    const targetFormalities = OCCASION_FORMALITY[occasion] || ['casual', 'smart-casual'];
    const seasons = weather ? weatherToSeason(weather) : ['all-season'];

    // Filter eligible items
    const eligible = wardrobe.filter((item: WardrobeItem) =>
      targetFormalities.includes(item.formality as FormalityLevel) &&
      item.condition !== 'worn' &&
      item.season.some((s: string) => seasons.includes(s as any) || s === 'all-season')
    );

    // Build combinations
    const combos = buildCombinations(eligible, targetFormalities);

    // Score and rank
    const scored = combos.map(combo => ({
      items: combo,
      score: scoreOutfit(
        combo,
        targetFormalities[0] as FormalityLevel,
        weather || { temperature: 25, feels_like: 25, condition: 'Clear', humidity: 50, wind_speed: 10, precipitation_probability: 0, is_day: true, summary: '', recommendation: '' },
        profile ? { style_preferences: profile.style_preferences, avoid_colors: profile.avoid_colors } : undefined
      ),
    }));

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      outfits: scored.slice(0, limit),
      weather,
      total_combinations: combos.length,
    });
  } catch (error) {
    console.error('Suggestion error:', error);
    return NextResponse.json({ error: 'Suggestion generation failed' }, { status: 500 });
  }
}

function buildCombinations(items: WardrobeItem[], formalities: FormalityLevel[]): WardrobeItem[][] {
  const combos: WardrobeItem[][] = [];
  const tops = items.filter(i => i.category === 'top');
  const bottoms = items.filter(i => i.category === 'bottom');
  const dresses = items.filter(i => i.category === 'dress');
  const outerwear = items.filter(i => i.category === 'outerwear');
  const footwear = items.filter(i => i.category === 'footwear');
  const accessories = items.filter(i => i.category === 'accessory');
  const formals = items.filter(i => i.category === 'formal');

  // Top + Bottom combos
  for (const top of tops.slice(0, 5)) {
    for (const bottom of bottoms.slice(0, 5)) {
      const combo: WardrobeItem[] = [top, bottom];
      if (footwear.length) combo.push(footwear[Math.floor(Math.random() * footwear.length)]);
      if (outerwear.length && Math.random() > 0.5) combo.push(outerwear[0]);
      if (accessories.length && Math.random() > 0.6) combo.push(accessories[0]);
      combos.push(combo);
    }
  }

  // Dress combos
  for (const dress of dresses.slice(0, 3)) {
    const combo: WardrobeItem[] = [dress];
    if (footwear.length) combo.push(footwear[0]);
    if (accessories.length) combo.push(accessories[0]);
    combos.push(combo);
  }

  // Formal combos
  for (const formal of formals.slice(0, 2)) {
    const combo: WardrobeItem[] = [formal];
    if (footwear.length) combo.push(footwear[0]);
    combos.push(combo);
  }

  return combos;
}
