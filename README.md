# StyleVault — AI Fashion Stylist

A full-stack progressive web app that digitizes your wardrobe, auto-classifies clothing via AI, and generates outfit suggestions based on occasion, weather, and your personal style.

## Features

- **Wardrobe Inventory** — Add clothes via photo, video (auto frame extraction), or paste online order details
- **AI Classification** — Vision AI auto-tags category, color, formality, season, style, fabric
- **Occasion Stylist** — Pick an occasion + location → weather-aware outfit combos from your wardrobe
- **Week Planner** — Add your schedule → 7 days of outfits generated automatically
- **Virtual Try-On** — See outfits rendered on your photo (when image gen API is configured)
- **Saved Looks** — History of every generated outfit, rated and reusable
- **Email Auth** — Passwordless magic link login via Supabase
- **PWA** — Installable on mobile, works offline for cached pages
- **Secure** — Row-level security, no passwords stored, HTTPS everywhere

## Tech Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | Next.js 14 + Tailwind CSS | Free (Vercel) |
| Backend/DB | Supabase (Postgres + Auth + Storage) | Free tier |
| Weather | Open-Meteo API | Free, no key |
| AI Vision | Any OpenAI-compatible API | Pay-per-use |
| AI Image Gen | OpenAI Images API (optional) | Pay-per-use |
| Hosting | Vercel | Free tier |

---

## 🚀 Setup (5 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → Sign up (free) → New Project
2. Name it `stylevault`, set a database password, pick closest region
3. Wait for it to provision (~30s)

### Step 2: Run the Database Schema

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste → Click **Run**
4. You should see "Success" — this creates all tables, RLS policies, storage buckets, and triggers

### Step 3: Get Your Supabase Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public key** (the long JWT string)

### Step 4: Configure Environment

```bash
cd stylevault
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# AI (optional but recommended — without this, classification uses mock data)
AI_API_KEY=sk-your-openai-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Image gen for try-on (optional — falls back to collage mode)
IMAGE_GEN_API_KEY=sk-your-openai-key
IMAGE_GEN_BASE_URL=https://api.openai.com/v1
```

**AI API options** (any OpenAI-compatible endpoint works):
- OpenAI: `https://api.openai.com/v1` with `gpt-4o-mini`
- Groq (free tier): `https://api.groq.com/openai/v1` with `llama-3.2-90b-vision-preview`
- Together AI: `https://api.together.xyz/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

### Step 5: Run Locally (test)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should see the login page.

### Step 6: Configure Auth Redirect

1. In Supabase dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**: `http://localhost:3000/auth/callback`
3. For production, also add: `https://your-vercel-app.vercel.app/auth/callback`

### Step 7: Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo to Vercel:
1. Push to GitHub
2. [vercel.com](https://vercel.com) → Import Project → select repo
3. Add environment variables (same as `.env.local`)
4. Deploy

After deploy, add the production URL to Supabase redirect URLs (Step 6).

---

## 📱 Mobile Access

Once deployed, open the URL on your phone:
- **iOS**: Safari → Share → "Add to Home Screen"
- **Android**: Chrome → Menu → "Add to Home Screen"

It installs as a native-looking app with its own icon.

---

## Project Structure

```
stylevault/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (offline cache)
│   └── icons/                 # App icons
├── supabase/
│   └── schema.sql             # Complete DB schema (run once)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── auth/              # Login (magic link)
│   │   ├── wardrobe/          # Inventory CRUD
│   │   │   ├── add/           # Add via photo/video/order
│   │   │   └── [id]/          # Item detail
│   │   ├── style/             # Occasion-based outfit generator
│   │   ├── week/              # Weekly planner
│   │   ├── history/           # Saved looks
│   │   ├── profile/           # User settings + body photo
│   │   └── api/               # Server-side AI routes
│   ├── components/
│   │   └── layout/            # AppShell (nav, sidebar)
│   ├── lib/
│   │   ├── supabase/          # Client, server, middleware
│   │   ├── ai/                # Classification + try-on
│   │   ├── fashion/           # Matching engine, color harmony
│   │   └── weather.ts         # Open-Meteo integration
│   └── types/                 # TypeScript types
├── middleware.ts              # Auth route protection
└── .env.example               # Environment template
```

---

## Security

- **Row-Level Security (RLS)** on every table — users can only access their own data
- **No passwords** — email magic link auth only
- **Storage policies** — users can only upload/read their own files
- **Security headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **API keys server-side only** — never exposed to the browser
- **HTTPS enforced** via Vercel

---

## How the AI Works

### Clothing Classification
When you add an item via photo/video:
1. Image is compressed client-side (max 800px)
2. Sent to the AI vision API with a structured prompt
3. Returns: category, subcategory, colors, formality, season, style, fabric, name
4. You can edit any field before saving

### Outfit Suggestions
The matching engine considers:
1. **Formality match** (30%) — does the item match the occasion's dress code?
2. **Weather appropriateness** (25%) — season + temperature suitability
3. **Color harmony** (25%) — complementary color pairing rules
4. **Style consistency** (20%) — your preferred aesthetics + item coherence
5. **Penalties** — avoided colors, worn condition

### Virtual Try-On
- If `IMAGE_GEN_API_KEY` is set: generates an AI image of you wearing the outfit
- Fallback: shows a styled collage of your photo + outfit items side by side

---

## Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| Supabase | 500MB DB, 1GB storage, 50K auth users |
| Vercel | 100GB bandwidth, unlimited deploys |
| Open-Meteo | Unlimited (no key needed) |
| GPT-4o-mini | ~$0.15/1M tokens (pennies per classification) |

You could run this for hundreds of users before hitting any paid tier.
