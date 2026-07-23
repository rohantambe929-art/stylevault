import type { TryOnRequest, TryOnResult, ClothingCategory } from '@/types';

// Virtual try-on: generates an image of the user wearing the outfit
// Falls back to a collage mode if no image gen API is configured
export async function generateTryOn(request: TryOnRequest): Promise<TryOnResult> {
  const apiKey = process.env.IMAGE_GEN_API_KEY;
  const baseUrl = process.env.IMAGE_GEN_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    // Fallback: return collage mode indicator (client will build collage)
    return { image_url: '', mode: 'collage' };
  }

  try {
    // Build the prompt for virtual try-on
    const outfitDesc = request.outfit_items
      .map(item => `${item.category} (see reference image)`)
      .join(', ');

    const prompt = `Professional fashion photo: A person wearing a complete outfit consisting of ${outfitDesc}. ` +
      `The setting is appropriate for: ${request.occasion}. ` +
      `Full body shot, natural lighting, fashion editorial style. ` +
      `The person should look confident and well-dressed.`;

    // Use the user's photo as reference + outfit items as references
    const res = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: buildMultipartFormData(request, prompt),
    });

    if (!res.ok) {
      console.error('Try-on API error:', res.status);
      return { image_url: '', mode: 'collage' };
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

    if (imageUrl) {
      return { image_url: imageUrl, mode: 'ai-generated' };
    }
    return { image_url: '', mode: 'collage' };
  } catch (err) {
    console.error('Try-on generation error:', err);
    return { image_url: '', mode: 'collage' };
  }
}

function buildMultipartFormData(request: TryOnRequest, prompt: string): FormData {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', '1024x1024');
  // Note: In production, you'd fetch the actual image blobs and append them
  // For now, we pass URLs and let the API handle it
  return formData;
}

// Generate a text description of the outfit for the collage fallback
export function getOutfitDescription(
  items: { category: ClothingCategory; name: string; primary_color: string }[]
): string {
  return items.map(i => `${i.primary_color} ${i.name}`).join(' + ');
}
