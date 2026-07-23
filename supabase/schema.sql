-- ============================================================
-- StyleVault Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============ PROFILES ============
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  body_photo_url text,
  default_location text,
  latitude double precision,
  longitude double precision,
  style_preferences text[] default '{}',
  color_preferences text[] default '{}',
  avoid_colors text[] default '{}',
  size_info jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ WARDROBE ITEMS ============
create table public.wardrobe_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  thumbnail_url text,
  name text not null,
  category text not null check (category in (
    'top','bottom','dress','outerwear','footwear',
    'accessory','undergarment','activewear','formal','other'
  )),
  subcategory text not null default 'other',
  colors text[] default '{}',
  primary_color text not null default 'black',
  formality text not null default 'casual' check (formality in (
    'casual','smart-casual','business','formal','black-tie'
  )),
  season text[] default '{all-season}',
  style text[] default '{}',
  fabric text,
  brand text,
  size text,
  purchase_date date,
  purchase_price numeric(10,2),
  condition text not null default 'good' check (condition in (
    'new','excellent','good','fair','worn'
  )),
  durability integer not null default 3 check (durability between 1 and 5),
  wear_count integer not null default 0,
  last_worn date,
  notes text,
  tags text[] default '{}',
  source text not null default 'photo' check (source in ('photo','video','order','manual')),
  order_reference text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_wardrobe_user on public.wardrobe_items(user_id);
create index idx_wardrobe_category on public.wardrobe_items(user_id, category);
create index idx_wardrobe_formality on public.wardrobe_items(user_id, formality);

-- ============ OUTFITS ============
create table public.outfits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text,
  item_ids uuid[] not null default '{}',
  occasion text not null,
  formality text not null default 'casual',
  weather_summary text,
  temperature numeric(5,1),
  location text,
  tryon_image_url text,
  collage_image_url text,
  rating integer check (rating between 1 and 5),
  notes text,
  created_at timestamptz default now() not null
);

create index idx_outfits_user on public.outfits(user_id);
create index idx_outfits_occasion on public.outfits(user_id, occasion);

-- ============ SCHEDULE ============
create table public.schedule_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  location text,
  occasion_type text not null default 'general',
  formality text not null default 'casual',
  outfit_id uuid references public.outfits(id) on delete set null,
  notes text,
  created_at timestamptz default now() not null
);

create index idx_schedule_user_date on public.schedule_events(user_id, date);

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.outfits enable row level security;
alter table public.schedule_events enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Wardrobe: full CRUD for own items
create policy "Users can view own wardrobe"
  on public.wardrobe_items for select
  using (auth.uid() = user_id);

create policy "Users can add to own wardrobe"
  on public.wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own wardrobe"
  on public.wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own wardrobe"
  on public.wardrobe_items for delete
  using (auth.uid() = user_id);

-- Outfits: full CRUD for own
create policy "Users can view own outfits"
  on public.outfits for select
  using (auth.uid() = user_id);

create policy "Users can create own outfits"
  on public.outfits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outfits"
  on public.outfits for update
  using (auth.uid() = user_id);

create policy "Users can delete own outfits"
  on public.outfits for delete
  using (auth.uid() = user_id);

-- Schedule: full CRUD for own
create policy "Users can view own schedule"
  on public.schedule_events for select
  using (auth.uid() = user_id);

create policy "Users can create own schedule"
  on public.schedule_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own schedule"
  on public.schedule_events for update
  using (auth.uid() = user_id);

create policy "Users can delete own schedule"
  on public.schedule_events for delete
  using (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============
-- Create storage buckets for images
insert into storage.buckets (id, name, public) values ('wardrobe', 'wardrobe', true);
insert into storage.buckets (id, name, public) values ('profiles', 'profiles', true);
insert into storage.buckets (id, name, public) values ('outfits', 'outfits', true);

-- Storage policies
create policy "Users can upload wardrobe images"
  on storage.objects for insert
  with check (bucket_id = 'wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view wardrobe images"
  on storage.objects for select
  using (bucket_id = 'wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete wardrobe images"
  on storage.objects for delete
  using (bucket_id = 'wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload profile images"
  on storage.objects for insert
  with check (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view profile images"
  on storage.objects for select
  using (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload outfit images"
  on storage.objects for insert
  with check (bucket_id = 'outfits' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view outfit images"
  on storage.objects for select
  using (bucket_id = 'outfits' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ UPDATED_AT TRIGGER ============
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.wardrobe_items
  for each row execute procedure update_updated_at();

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute procedure update_updated_at();
