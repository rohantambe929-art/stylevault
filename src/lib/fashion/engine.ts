import type {
  ClothingCategory, FormalityLevel, Season, StyleAesthetic,
  ColorFamily, WeatherData, WardrobeItem
} from '@/types';

// ============ Occasion → Formality Mapping ============
export const OCCASION_FORMALITY: Record<string, FormalityLevel[]> = {
  'casual-outing': ['casual', 'smart-casual'],
  'work': ['business', 'smart-casual'],
  'office': ['business', 'smart-casual'],
  'meeting': ['business', 'formal'],
  'interview': ['business', 'formal'],
  'date-night': ['smart-casual', 'formal'],
  'party': ['smart-casual', 'formal'],
  'wedding': ['formal', 'black-tie'],
  'wedding-guest': ['formal', 'black-tie'],
  'funeral': ['formal', 'business'],
  'gym': ['casual'],
  'sports': ['casual'],
  'beach': ['casual'],
  'travel': ['casual', 'smart-casual'],
  'dinner': ['smart-casual', 'formal'],
  'brunch': ['casual', 'smart-casual'],
  'festival': ['casual', 'smart-casual'],
  'religious': ['smart-casual', 'formal'],
  'presentation': ['business', 'formal'],
  'conference': ['business', 'smart-casual'],
  'general': ['casual', 'smart-casual', 'business'],
};

// ============ Weather → Season Mapping ============
export function weatherToSeason(weather: WeatherData): Season[] {
  const temp = weather.temperature;
  if (temp >= 30) return ['summer'];
  if (temp >= 20) return ['summer', 'spring'];
  if (temp >= 12) return ['spring', 'autumn'];
  if (temp >= 5) return ['autumn', 'winter'];
  return ['winter'];
}

// ============ Weather → Clothing Guidance ============
export function weatherGuidance(weather: WeatherData): {
  layers: string;
  avoid: ClothingCategory[];
  prefer: ClothingCategory[];
  notes: string;
} {
  const temp = weather.temperature;
  const rain = weather.precipitation_probability;

  let layers = 'light';
  let avoid: ClothingCategory[] = [];
  let prefer: ClothingCategory[] = [];
  let notes = '';

  if (temp >= 30) {
    layers = 'minimal';
    avoid = ['outerwear'];
    prefer = ['top', 'bottom'];
    notes = 'Hot — breathable fabrics, light colors preferred';
  } else if (temp >= 20) {
    layers = 'light';
    notes = 'Pleasant — light layers work well';
  } else if (temp >= 12) {
    layers = 'medium';
    prefer = ['outerwear'];
    notes = 'Mild — a light jacket or layer recommended';
  } else if (temp >= 5) {
    layers = 'warm';
    prefer = ['outerwear'];
    notes = 'Cool — warm layers needed';
  } else {
    layers = 'heavy';
    prefer = ['outerwear'];
    notes = 'Cold — heavy outerwear essential';
  }

  if (rain > 50) {
    avoid.push('footwear'); // avoid suede/open shoes
    notes += '. High rain chance — water-resistant footwear advised';
  }

  return { layers, avoid, prefer, notes };
}

// ============ Color Harmony ============
const COMPLEMENTARY: Record<ColorFamily, ColorFamily[]> = {
  black: ['white', 'gray', 'red', 'gold', 'cream', 'beige'],
  white: ['black', 'navy', 'blue', 'red', 'green', 'brown'],
  gray: ['black', 'white', 'navy', 'pink', 'purple', 'teal'],
  navy: ['white', 'beige', 'cream', 'gold', 'light-blue', 'coral'],
  blue: ['white', 'beige', 'brown', 'orange', 'cream'],
  'light-blue': ['navy', 'white', 'beige', 'brown', 'gray'],
  red: ['black', 'white', 'navy', 'gray', 'beige'],
  burgundy: ['black', 'gray', 'cream', 'navy', 'beige'],
  pink: ['gray', 'navy', 'white', 'black', 'beige'],
  orange: ['navy', 'white', 'brown', 'cream', 'black'],
  yellow: ['navy', 'gray', 'white', 'black', 'brown'],
  green: ['white', 'beige', 'brown', 'cream', 'navy'],
  olive: ['white', 'cream', 'brown', 'tan', 'black'],
  brown: ['white', 'cream', 'beige', 'green', 'orange', 'tan'],
  tan: ['white', 'brown', 'navy', 'green', 'cream'],
  beige: ['white', 'brown', 'navy', 'black', 'olive'],
  cream: ['brown', 'navy', 'olive', 'beige', 'burgundy'],
  purple: ['white', 'gray', 'black', 'cream', 'silver'],
  teal: ['white', 'gray', 'cream', 'coral', 'black'],
  coral: ['white', 'navy', 'teal', 'beige', 'gray'],
  gold: ['black', 'navy', 'white', 'cream', 'burgundy'],
  silver: ['black', 'navy', 'white', 'gray', 'purple'],
  multicolor: ['black', 'white', 'gray', 'beige'],
};

export function colorsHarmonize(colorA: ColorFamily, colorB: ColorFamily): boolean {
  if (colorA === colorB) return true;
  return COMPLEMENTARY[colorA]?.includes(colorB) ?? false;
}

export function outfitColorScore(items: WardrobeItem[]): number {
  if (items.length < 2) return 1;
  const colors = items.map(i => i.primary_color);
  let score = 0;
  let pairs = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      pairs++;
      if (colorsHarmonize(colors[i], colors[j])) score++;
    }
  }
  return pairs > 0 ? score / pairs : 0.5;
}

// ============ Outfit Assembly Rules ============
export interface OutfitSlot {
  category: ClothingCategory;
  required: boolean;
}

export function getOutfitSlots(formality: FormalityLevel, weather: WeatherData): OutfitSlot[] {
  const slots: OutfitSlot[] = [];
  const temp = weather.temperature;

  if (formality === 'formal' || formality === 'black-tie') {
    slots.push({ category: 'formal', required: true });
    slots.push({ category: 'footwear', required: true });
    if (temp < 20) slots.push({ category: 'outerwear', required: false });
    slots.push({ category: 'accessory', required: false });
  } else if (formality === 'business') {
    slots.push({ category: 'top', required: true });
    slots.push({ category: 'bottom', required: true });
    slots.push({ category: 'footwear', required: true });
    if (temp < 20) slots.push({ category: 'outerwear', required: false });
    slots.push({ category: 'accessory', required: false });
  } else {
    // casual / smart-casual
    if (temp >= 25) {
      slots.push({ category: 'top', required: true });
      slots.push({ category: 'bottom', required: true });
    } else {
      slots.push({ category: 'top', required: true });
      slots.push({ category: 'bottom', required: true });
      slots.push({ category: 'outerwear', required: temp < 15 });
    }
    slots.push({ category: 'footwear', required: true });
    slots.push({ category: 'accessory', required: false });
  }

  // Allow dress as alternative to top+bottom for women's fashion
  slots.push({ category: 'dress', required: false });

  return slots;
}

// ============ Scoring Engine ============
export function scoreOutfit(
  items: WardrobeItem[],
  formality: FormalityLevel,
  weather: WeatherData,
  userPreferences?: { style_preferences: StyleAesthetic[]; avoid_colors: ColorFamily[] }
): number {
  let score = 0;

  // 1. Formality match (30%)
  const formalityMatch = items.filter(i => i.formality === formality).length / items.length;
  score += formalityMatch * 0.3;

  // 2. Weather appropriateness (25%)
  const seasons = weatherToSeason(weather);
  const seasonMatch = items.filter(i =>
    i.season.some(s => seasons.includes(s) || s === 'all-season')
  ).length / items.length;
  score += seasonMatch * 0.25;

  // 3. Color harmony (25%)
  score += outfitColorScore(items) * 0.25;

  // 4. Style consistency + user prefs (20%)
  if (userPreferences?.style_preferences.length) {
    const styleMatch = items.filter(i =>
      i.style.some(s => userPreferences.style_preferences.includes(s))
    ).length / items.length;
    score += styleMatch * 0.2;
  } else {
    // Style consistency among items
    const allStyles = items.flatMap(i => i.style);
    const uniqueStyles = new Set(allStyles);
    const consistency = allStyles.length > 0 ? 1 - (uniqueStyles.size / allStyles.length) * 0.5 : 0.5;
    score += consistency * 0.2;
  }

  // Penalty: avoid colors
  if (userPreferences?.avoid_colors.length) {
    const hasAvoided = items.some(i =>
      i.colors.some(c => userPreferences.avoid_colors.includes(c))
    );
    if (hasAvoided) score *= 0.6;
  }

  // Penalty: worn condition
  const wornItems = items.filter(i => i.condition === 'worn').length;
  if (wornItems > 0) score *= (1 - wornItems * 0.15);

  return Math.min(1, Math.max(0, score));
}

// ============ Fashion Vocabulary (for display) ============
export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  outerwear: 'Outerwear',
  footwear: 'Footwear',
  accessory: 'Accessories',
  undergarment: 'Essentials',
  activewear: 'Activewear',
  formal: 'Formal Wear',
  other: 'Other',
};

export const FORMALITY_LABELS: Record<FormalityLevel, string> = {
  casual: 'Casual',
  'smart-casual': 'Smart Casual',
  business: 'Business',
  formal: 'Formal',
  'black-tie': 'Black Tie',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  'all-season': 'All Season',
};

export const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
};
