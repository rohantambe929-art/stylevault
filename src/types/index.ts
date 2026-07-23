// ============ Core Domain Types ============

export type ClothingCategory =
  | 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear'
  | 'accessory' | 'undergarment' | 'activewear' | 'formal' | 'other';

export type ClothingSubcategory =
  | 't-shirt' | 'shirt' | 'blouse' | 'sweater' | 'hoodie' | 'tank-top'
  | 'jeans' | 'trousers' | 'shorts' | 'skirt' | 'leggings'
  | 'dress-casual' | 'dress-formal' | 'dress-cocktail'
  | 'jacket' | 'coat' | 'blazer' | 'vest' | 'cardigan'
  | 'sneakers' | 'boots' | 'heels' | 'sandals' | 'loafers' | 'flats'
  | 'watch' | 'belt' | 'scarf' | 'hat' | 'bag' | 'jewelry' | 'sunglasses'
  | 'sports-top' | 'sports-bottom' | 'tracksuit'
  | 'suit' | 'tuxedo' | 'kurta' | 'saree' | 'sherwani'
  | 'other';

export type FormalityLevel = 'casual' | 'smart-casual' | 'business' | 'formal' | 'black-tie';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season';

export type StyleAesthetic =
  | 'minimalist' | 'streetwear' | 'classic' | 'bohemian' | 'sporty'
  | 'preppy' | 'grunge' | 'vintage' | 'ethnic' | 'avant-garde' | 'business';

export type ColorFamily =
  | 'black' | 'white' | 'gray' | 'navy' | 'blue' | 'light-blue'
  | 'red' | 'burgundy' | 'pink' | 'orange' | 'yellow' | 'green'
  | 'olive' | 'brown' | 'tan' | 'beige' | 'cream' | 'purple'
  | 'teal' | 'coral' | 'gold' | 'silver' | 'multicolor';

export type ItemCondition = 'new' | 'excellent' | 'good' | 'fair' | 'worn';

export type DurabilityRating = 1 | 2 | 3 | 4 | 5;

export interface WardrobeItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url?: string;
  name: string;
  category: ClothingCategory;
  subcategory: ClothingSubcategory;
  colors: ColorFamily[];
  primary_color: ColorFamily;
  formality: FormalityLevel;
  season: Season[];
  style: StyleAesthetic[];
  fabric?: string;
  brand?: string;
  size?: string;
  purchase_date?: string;
  purchase_price?: number;
  condition: ItemCondition;
  durability: DurabilityRating;
  wear_count: number;
  last_worn?: string;
  notes?: string;
  tags: string[];
  source: 'photo' | 'video' | 'order' | 'manual';
  order_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface OutfitCombination {
  id: string;
  user_id: string;
  name?: string;
  items: WardrobeItem[];
  item_ids: string[];
  occasion: string;
  formality: FormalityLevel;
  weather_summary?: string;
  temperature?: number;
  location?: string;
  tryon_image_url?: string;
  collage_image_url?: string;
  rating?: number;
  notes?: string;
  created_at: string;
}

export interface ScheduleEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  occasion_type: string;
  formality: FormalityLevel;
  outfit_id?: string;
  notes?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  body_photo_url?: string;
  default_location?: string;
  latitude?: number;
  longitude?: number;
  style_preferences: StyleAesthetic[];
  color_preferences: ColorFamily[];
  avoid_colors: ColorFamily[];
  size_info?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ============ API Types ============

export interface ClassificationResult {
  category: ClothingCategory;
  subcategory: ClothingSubcategory;
  colors: ColorFamily[];
  primary_color: ColorFamily;
  formality: FormalityLevel;
  season: Season[];
  style: StyleAesthetic[];
  fabric?: string;
  suggested_name: string;
  confidence: number;
}

export interface WeatherData {
  temperature: number;
  feels_like: number;
  condition: string;
  humidity: number;
  wind_speed: number;
  precipitation_probability: number;
  is_day: boolean;
  summary: string;
  recommendation: string;
}

export interface TryOnRequest {
  user_photo_url: string;
  outfit_items: { image_url: string; category: ClothingCategory }[];
  occasion: string;
}

export interface TryOnResult {
  image_url: string;
  mode: 'ai-generated' | 'collage';
}

// ============ UI Types ============

export type ViewMode = 'grid' | 'list';
export type AddMethod = 'photo' | 'video' | 'order' | 'manual';

export interface FilterState {
  category: ClothingCategory | 'all';
  color: ColorFamily | 'all';
  formality: FormalityLevel | 'all';
  season: Season | 'all';
  condition: ItemCondition | 'all';
  search: string;
}
