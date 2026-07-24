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

const MULTI_ITEM_PROMPT = `You are a professional fashion analyst. This image may contain one or more clothing items.

Identify ALL distinct clothing/fashion items visible in this image. For EACH item, return a JSON object.

Return ONLY a JSON array (no markdown, no code blocks) like:
[
  {
    "category": one of ["top","bottom","dress","outerwear","footwear","accessory","undergarment","activewear","formal","other"],
    "subcategory": specific type,
    "colors": array of color families,
    "primary_color": dominant color,
    "formality": one of ["casual","smart-casual","business","formal","black-tie"],
    "season": array from ["spring","summer","autumn","winter","all-season"],
    "style": array of style aesthetics,
    "fabric": guessed fabric,
    "suggested_name": short descriptive name,
    "confidence": 0.0 to 1.0
  }
]

If only one item is visible, return an array with one element. Color families: ["black","white","gray","navy","blue","light-blue","red","burgundy","pink","orange","yellow","green","olive","brown","tan","beige","cream","purple","teal","coral","gold","silver","multicolor"]. Style aesthetics: ["minimalist","streetwear","classic","bohemian","sporty","preppy","grunge","vintage","ethnic","avant-garde","business"].`;

function getApiConfig() {
  const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY || process.env.AI_API_KEY || '';
  const baseUrl = process.env.NEXT_PUBLIC_AI_BASE_URL || process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
  const model = process.env.NEXT_PUBLIC_AI_MODEL || process.env.AI_MODEL || 'gemini-2.0-flash';
  return { apiKey, baseUrl, model };
}

async function callVisionApi(prompt: string, imageBase64: string): Promise<string> {
  const { apiKey, baseUrl, model } = getApiConfig();

  if (!apiKey) {
    throw new Error('NO_API_KEY: Add your free Gemini API key in settings');
  }

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
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API_ERROR_${res.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

function parseClassification(raw: string): ClassificationResult {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Handle case where response might have extra text before/after JSON
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  const parsed = JSON.parse(jsonStr);

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
}

function parseMultiClassification(raw: string): ClassificationResult[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonStart = cleaned.indexOf('[');
  const jsonEnd = cleaned.lastIndexOf(']');
  const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    // Single object returned instead of array
    return [parseClassification(raw)];
  }

  return parsed.map((item: any) => ({
    category: item.category || 'other',
    subcategory: item.subcategory || 'other',
    colors: item.colors || ['black'],
    primary_color: item.primary_color || 'black',
    formality: item.formality || 'casual',
    season: item.season || ['all-season'],
    style: item.style || ['classic'],
    fabric: item.fabric,
    suggested_name: item.suggested_name || 'Clothing Item',
    confidence: item.confidence || 0.7,
  }));
}

// Classify a single clothing image — THROWS on error (no silent fallback)
export async function classifyClothingImage(imageBase64: string): Promise<ClassificationResult> {
  const raw = await callVisionApi(CLASSIFICATION_PROMPT, imageBase64);
  return parseClassification(raw);
}

// Classify multiple items from a single image (for video frames)
export async function classifyMultipleItems(imageBase64: string): Promise<ClassificationResult[]> {
  const raw = await callVisionApi(MULTI_ITEM_PROMPT, imageBase64);
  return parseMultiClassification(raw);
}

// Classify multiple video frames and deduplicate into unique items
export async function classifyVideoFrames(framesBase64: string[]): Promise<{
  items: (ClassificationResult & { frameIndex: number })[];
  errors: string[];
}> {
  const allItems: (ClassificationResult & { frameIndex: number })[] = [];
  const errors: string[] = [];

  for (let i = 0; i < framesBase64.length; i++) {
    try {
      const items = await classifyMultipleItems(framesBase64[i]);
      items.forEach(item => allItems.push({ ...item, frameIndex: i }));
    } catch (err: any) {
      errors.push(`Frame ${i + 1}: ${err.message}`);
    }
  }

  // Deduplicate: group by subcategory + primary_color
  const seen = new Map<string, ClassificationResult & { frameIndex: number }>();
  for (const item of allItems) {
    const key = `${item.subcategory}-${item.primary_color}`;
    const existing = seen.get(key);
    if (!existing || item.confidence > existing.confidence) {
      seen.set(key, item);
    }
  }

  return {
    items: Array.from(seen.values()),
    errors,
  };
}

// Parse order text to extract clothing info
export async function parseOrderDetails(orderText: string): Promise<Partial<ClassificationResult> & { brand?: string; price?: number }> {
  const { apiKey, baseUrl, model } = getApiConfig();

  if (!apiKey) {
    throw new Error('NO_API_KEY: Add your free Gemini API key');
  }

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
          content: 'Extract clothing item details from order confirmation text. Return ONLY JSON with: category, subcategory, colors, primary_color, formality, season, style, fabric, suggested_name, brand, price.',
        },
        { role: 'user', content: orderText },
      ],
      max_tokens: 400,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    throw new Error(`API_ERROR_${res.status}: Order parsing failed`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  return JSON.parse(jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned);
}
