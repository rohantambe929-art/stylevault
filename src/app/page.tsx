'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { getWeatherForLocation } from '@/lib/weather';
import type { UserProfile, WeatherData, WardrobeItem } from '@/types';
import {
  Shirt, Sparkles, CalendarDays, Plus, CloudSun, MapPin,
  TrendingUp, ArrowRight
} from 'lucide-react';

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);
  const [recentItems, setRecentItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(prof);

    // Load counts
    const { count: wCount } = await supabase
      .from('wardrobe_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setItemCount(wCount || 0);

    const { count: oCount } = await supabase
      .from('outfits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setOutfitCount(oCount || 0);

    // Recent items
    const { data: recent } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4);
    setRecentItems(recent || []);

    // Weather
    const location = prof?.default_location || 'Mumbai';
    const w = await getWeatherForLocation(location);
    setWeather(w);

    setLoading(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-container">
          <div className="animate-pulse-soft space-y-6">
            <div className="h-8 w-48 bg-surface-200 rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-surface-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {profile?.display_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-surface-500 mt-1">
            {weather ? weather.summary : 'Loading weather...'}
            {profile?.default_location && (
              <span className="inline-flex items-center gap-1 ml-2 text-surface-400">
                <MapPin className="w-3 h-3" />{profile.default_location}
              </span>
            )}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 stagger-children">
          <QuickAction
            href="/wardrobe/add"
            icon={Plus}
            label="Add Item"
            sublabel="Photo, video, or order"
          />
          <QuickAction
            href="/style"
            icon={Sparkles}
            label="Style Me"
            sublabel="Occasion-based outfit"
          />
          <QuickAction
            href="/week"
            icon={CalendarDays}
            label="Plan Week"
            sublabel="7-day outfits"
          />
          <QuickAction
            href="/wardrobe"
            icon={Shirt}
            label="Wardrobe"
            sublabel={`${itemCount} items`}
          />
        </div>

        {/* Weather + Stats Row */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {weather && (
            <div className="card p-5">
              <div className="flex items-center gap-2 text-surface-500 text-sm mb-2">
                <CloudSun className="w-4 h-4" />
                Today's Weather
              </div>
              <p className="text-2xl font-semibold">{weather.temperature}°C</p>
              <p className="text-sm text-surface-500 mt-1">{weather.condition}</p>
              <p className="text-xs text-surface-400 mt-2">{weather.recommendation}</p>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center gap-2 text-surface-500 text-sm mb-2">
              <Shirt className="w-4 h-4" />
              Wardrobe
            </div>
            <p className="text-2xl font-semibold">{itemCount}</p>
            <p className="text-sm text-surface-500 mt-1">items catalogued</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 text-surface-500 text-sm mb-2">
              <TrendingUp className="w-4 h-4" />
              Saved Looks
            </div>
            <p className="text-2xl font-semibold">{outfitCount}</p>
            <p className="text-sm text-surface-500 mt-1">outfit combinations</p>
          </div>
        </div>

        {/* Recent Items */}
        {recentItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Recently Added</h2>
              <Link href="/wardrobe" className="text-sm text-brand-600 font-medium inline-flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recentItems.map(item => (
                <Link
                  key={item.id}
                  href={`/wardrobe/${item.id}`}
                  className="card overflow-hidden group"
                >
                  <div className="aspect-square bg-surface-100 relative overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-surface-400 capitalize">{item.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {itemCount === 0 && (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shirt className="w-8 h-8 text-brand-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Your wardrobe is empty</h3>
            <p className="text-surface-500 mb-6 max-w-sm mx-auto">
              Start by adding your clothes — snap a photo, record a video, or paste an order confirmation.
            </p>
            <Link href="/wardrobe/add" className="btn-accent">
              <Plus className="w-4 h-4" />
              Add your first item
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuickAction({ href, icon: Icon, label, sublabel }: {
  href: string;
  icon: React.ElementType;
  label: string;
  sublabel: string;
}) {
  return (
    <Link href={href} className="card p-4 hover:shadow-elevated transition-all group">
      <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
        <Icon className="w-5 h-5 text-surface-600 group-hover:text-brand-600 transition-colors" />
      </div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-surface-400 mt-0.5">{sublabel}</p>
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
