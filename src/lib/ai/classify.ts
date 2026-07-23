import type { ClassificationResult } from '@/types';

const CLASSIFICATION_PROMPT = `You are a professional fashion analyst. Analyze this clothing item image and classify it precisely.

Return ONLY a JSON object (no markdown, no code blocks) with exactly these fields:
{
  "category": one of ["top","bottom","dress","outerwear","footwear","accessory","undergarment","activewear","formal","other"],
  "subcategory": specific type like "t-shirt","shirt","blouse","sweater","hoodie","jeans","trousers","shorts","skirt","jacket","coat","blazer","sneakers","boots","heels","sandals","loafers","watch","belt","bag","kurta","saree","suit", etc.,
  "colors": array of color families from ["black","white","gray","navy","blue","light-blue","red","burgundy","pink","orange","yellow","green","olive","brown","tan","beige","cream","purple","teal","coral","gold","silver","multicolor"],
  "primary_color": the dominant single color from the same list,
  "formality": one of ["casual","smart-casual","business","formal","black-tie"],
  "season": array from ["spring","summer","autumn","winter","all-season"],
  "style": array from ["minimalist","streetwear","classic","bohemian","sporty","preppy","grunge","vintage","ethnic","avant-garde","business"],
  "fabric": guessed fabric (e.g. "cotton","denim","silk","wool","polyester","leather","linen","satin","knit"),
  "suggested_name": a short descriptive name like "Navy Slim-Fit Blazer" or "White Cotton T-Shirt",
  "confidence": 0.0 to 1.0
}`;

export async function classifyClothingImage(imageBase64: string): Promise<ClassificationResult> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    // Dev mode: return a reasonable default
    return getMockClassification();
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: CLASSIFICATION_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error('AI API error:', res.status, await res.text());
      return getMockClassification();
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      category: parsed.category || 'other',
      subcategory: parsed.subcategory || 'other',
      colors: parsed.colors || ['black'],
      primary_color: parsed.primary_color || 'black',
      formality: parsed.formality || 'casual',
      season: parsed.season || ['all-season'],
      style: parsed.style || ['classic'],
      fabric: parsed.fabric,
      suggested_name: parsed.suggested_name || 'Clothing Item',
      confidence: parsed.confidence || 0.7,
    };
  } catch (err) {
    console.error('Classification error:', err);
    return getMockClassification();
  }
}

function getMockClassification(): ClassificationResult {
  return {
    category: 'top',
    subcategory: 'shirt',
    colors: ['blue', 'white'],
    primary_color: 'blue',
    formality: 'smart-casual',
    season: ['spring', 'summer', 'autumn'],
    style: ['classic'],
    fabric: 'cotton',
    suggested_name: 'Blue Casual Shirt',
    confidence: 0.5,
  };
}

// Parse order text to extract clothing info
export async function parseOrderDetails(orderText: string): Promise<Partial<ClassificationResult> & { brand?: string; price?: number }> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return { suggested_name: 'Ordered Item', category: 'top', confidence: 0.3 };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Extract clothing item details from order confirmation text. Return JSON with: category, subcategory, colors, primary_color, formality, season, style, fabric, suggested_name, brand, price.',
          },
          { role: 'user', content: orderText },
        ],
        max_tokens: 400,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return { suggested_name: 'Ordered Item', category: 'top', confidence: 0.3 };

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { suggested_name: 'Ordered Item', category: 'top', confidence: 0.3 };
  }
}
