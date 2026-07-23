import { NextRequest, NextResponse } from 'next/server';
import { generateTryOn } from '@/lib/ai/tryon';
import type { TryOnRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: TryOnRequest = await request.json();

    if (!body.user_photo_url || !body.outfit_items?.length) {
      return NextResponse.json(
        { error: 'Missing user photo or outfit items' },
        { status: 400 }
      );
    }

    const result = await generateTryOn(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Try-on error:', error);
    return NextResponse.json({ error: 'Try-on generation failed' }, { status: 500 });
  }
}
