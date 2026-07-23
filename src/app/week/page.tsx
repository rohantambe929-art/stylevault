'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { getWeatherForLocation } from '@/lib/weather';
import {
  OCCASION_FORMALITY, weatherToSeason, scoreOutfit, FORMALITY_LABELS
} from '@/lib/fashion/engine';
import type { WardrobeItem, ScheduleEvent, WeatherData, UserProfile, FormalityLevel } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import {
  CalendarDays, Plus, Loader2, Sparkles, Save, X,
  MapPin, Clock, Check
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export default function WeekPage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weekOutfits, setWeekOutfits] = useState<Record<string, WardrobeItem[]>>({});
  const [generating, setGenerating] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [loading, setLoading] = useState(true);

  // New event form
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    location: '',
    occasion_type: 'work',
    formality: 'business' as FormalityLevel,
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: items } = await supabase.from('wardrobe_items').select('*').eq('user_id', user.id);
    setWardrobe(items || []);

    // Load this week's events
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(weekStart, 7), 'yyyy-MM-dd');
    const { data: evts } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekStartStr)
      .lt('date', weekEndStr)
      .order('date');
    setEvents(evts || []);
    setLoading(false);
  };

  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('schedule_events')
      .insert({ ...newEvent, user_id: user.id })
      .select()
      .single();

    if (data) {
      setEvents(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setShowAddEvent(false);
      setNewEvent({ title: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '', location: '', occasion_type: 'work', formality: 'business' });
    }
  };

  const deleteEvent = async (id: string) => {
    const supabase = createClient();
    await supabase.from('schedule_events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const generateWeekOutfits = async () => {
    if (events.length === 0 || wardrobe.length < 2) return;
    setGenerating(true);

    const location = profile?.default_location || events[0]?.location || 'Mumbai';
    const weather = await getWeatherForLocation(location);

    const outfits: Record<string, WardrobeItem[]> = {};
    const usedItems = new Set<string>();

    for (const event of events) {
      const formalities = OCCASION_FORMALITY[event.occasion_type] || [event.formality];
      const seasons = weather ? weatherToSeason(weather) : ['all-season'];

      const eligible = wardrobe.filter(item =>
        formalities.includes(item.formality) &&
        item.condition !== 'worn' &&
        !usedItems.has(item.id) &&
        item.season.some(s => seasons.includes(s) || s === 'all-season')
      );

      // Build outfit for this event
      const combo = buildSingleOutfit(eligible, formalities[0]);
      if (combo.length > 0) {
        outfits[event.id] = combo;
        combo.forEach(i => usedItems.add(i.id));
      }
    }

    setWeekOutfits(outfits);
    setGenerating(false);
  };

  const buildSingleOutfit = (items: WardrobeItem[], formality: FormalityLevel): WardrobeItem[] => {
    const combo: WardrobeItem[] = [];
    const tops = items.filter(i => i.category === 'top');
    const bottoms = items.filter(i => i.category === 'bottom');
    const dresses = items.filter(i => i.category === 'dress');
    const footwear = items.filter(i => i.category === 'footwear');
    const formals = items.filter(i => i.category === 'formal');

    if (formality === 'formal' || formality === 'black-tie') {
      if (formals.length) combo.push(formals[0]);
      else if (tops.length && bottoms.length) { combo.push(tops[0], bottoms[0]); }
    } else if (dresses.length && Math.random() > 0.5) {
      combo.push(dresses[0]);
    } else {
      if (tops.length) combo.push(tops[0]);
      if (bottoms.length) combo.push(bottoms[0]);
    }
    if (footwear.length) combo.push(footwear[0]);

    return combo;
  };

  const saveWeekOutfit = async (eventId: string, items: WardrobeItem[]) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const event = events.find(e => e.id === eventId);
    await supabase.from('outfits').insert({
      user_id: user.id,
      name: `${event?.title || 'Event'} — ${format(new Date(event?.date || ''), 'EEE d MMM')}`,
      item_ids: items.map(i => i.id),
      occasion: event?.occasion_type || 'general',
      formality: event?.formality || 'casual',
      location: event?.location,
    });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-container">
          <div className="animate-pulse-soft space-y-4">
            <div className="h-8 w-40 bg-surface-200 rounded" />
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-surface-200 rounded-2xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Week Planner</h1>
            <p className="text-surface-500 text-sm mt-0.5">
              {format(weekStart, 'd MMM')} — {format(addDays(weekStart, 6), 'd MMM')}
            </p>
          </div>
          <button onClick={() => setShowAddEvent(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>

        {/* Add Event Modal */}
        {showAddEvent && (
          <div className="card p-5 mb-6 animate-fade-in border-brand-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">New Event</h3>
              <button onClick={() => setShowAddEvent(false)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input
                  value={newEvent.title}
                  onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))}
                  placeholder="Event name (e.g. Client meeting)"
                  className="input-field"
                />
              </div>
              <input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))}
                className="input-field"
              />
              <input
                type="time"
                value={newEvent.start_time}
                onChange={e => setNewEvent(f => ({ ...f, start_time: e.target.value }))}
                className="input-field"
              />
              <input
                value={newEvent.location}
                onChange={e => setNewEvent(f => ({ ...f, location: e.target.value }))}
                placeholder="Location"
                className="input-field"
              />
              <select
                value={newEvent.occasion_type}
                onChange={e => setNewEvent(f => ({ ...f, occasion_type: e.target.value }))}
                className="input-field capitalize"
              >
                {['work', 'casual-outing', 'meeting', 'date-night', 'party', 'wedding', 'gym', 'travel', 'dinner', 'festival', 'interview'].map(o => (
                  <option key={o} value={o}>{o.replace('-', ' ')}</option>
                ))}
              </select>
              <select
                value={newEvent.formality}
                onChange={e => setNewEvent(f => ({ ...f, formality: e.target.value as FormalityLevel }))}
                className="input-field capitalize"
              >
                {['casual', 'smart-casual', 'business', 'formal', 'black-tie'].map(f => (
                  <option key={f} value={f}>{f.replace('-', ' ')}</option>
                ))}
              </select>
            </div>
            <button onClick={addEvent} className="btn-primary w-full mt-4">
              Add to Schedule
            </button>
          </div>
        )}

        {/* Generate button */}
        {events.length > 0 && (
          <button
            onClick={generateWeekOutfits}
            disabled={generating || wardrobe.length < 2}
            className="btn-accent w-full py-3 mb-6"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {generating ? 'Planning your week...' : 'Generate Week Outfits'}
          </button>
        )}

        {/* Week view */}
        <div className="space-y-3">
          {weekDays.map(day => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isToday = isSameDay(day, new Date());

            return (
              <div key={day.toISOString()} className={cn('card p-4', isToday && 'ring-1 ring-brand-500/30')}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold',
                    isToday ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600'
                  )}>
                    <span className="text-[9px] font-medium uppercase">{format(day, 'EEE')}</span>
                    <span>{format(day, 'd')}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {isToday ? 'Today' : format(day, 'EEEE')}
                    </p>
                    {dayEvents.length === 0 && (
                      <p className="text-xs text-surface-400">No events</p>
                    )}
                  </div>
                </div>

                {/* Events for this day */}
                {dayEvents.map(event => (
                  <div key={event.id} className="ml-13 pl-4 border-l-2 border-surface-100 mt-2 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-sm font-medium">{event.title}</span>
                        <span className="badge bg-surface-100 text-surface-500 text-[10px] capitalize">
                          {event.occasion_type.replace('-', ' ')}
                        </span>
                      </div>
                      <button onClick={() => deleteEvent(event.id)} className="text-surface-300 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {event.location && (
                      <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </p>
                    )}

                    {/* Generated outfit for this event */}
                    {weekOutfits[event.id] && (
                      <div className="mt-3 p-3 bg-surface-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-brand-600 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Suggested outfit
                          </span>
                          <button
                            onClick={() => saveWeekOutfit(event.id, weekOutfits[event.id])}
                            className="text-xs text-surface-400 hover:text-brand-600 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" /> Save
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {weekOutfits[event.id].map(item => (
                            <div key={item.id} className="w-14 h-14 rounded-lg overflow-hidden bg-surface-100">
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-surface-400 mt-1.5">
                          {weekOutfits[event.id].map(i => i.name).join(' + ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-surface-200 mx-auto mb-3" />
            <p className="text-surface-500 mb-1">No events this week</p>
            <p className="text-sm text-surface-400">Add your schedule and I'll plan outfits for each day</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
