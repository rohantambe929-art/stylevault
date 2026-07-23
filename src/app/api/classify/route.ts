import { NextRequest, NextResponse } from 'next/server';
import { classifyClothingImage } from '@/lib/ai/classify';

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Limit image size (5MB base64 ≈ ~3.7MB raw)
    if (image.length > 5 * 1024 * 1024 * 1.37) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    const result = await classifyClothingImage(image);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Classification error:', error);
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }
}
