import { NextRequest, NextResponse } from 'next/server';
import { getWeatherForLocation, getWeather, geocode } from '@/lib/weather';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  try {
    if (lat && lon) {
      const weather = await getWeather(parseFloat(lat), parseFloat(lon));
      return NextResponse.json(weather);
    }

    if (location) {
      const weather = await getWeatherForLocation(location);
      if (!weather) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      return NextResponse.json(weather);
    }

    return NextResponse.json({ error: 'Provide location or lat/lon' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 500 });
  }
}
