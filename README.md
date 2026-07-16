# FORME — Virtual Wardrobe

A mobile-first editorial wardrobe for turning clothing photos into a clean visual archive and composing new outfits.

## Included

- responsive visual wardrobe
- photo intake and ghost-mannequin workflow
- garment filters and favorites
- interactive three-layer outfit studio
- Google login with signed, secure sessions
- D1 wardrobe database and R2 media storage
- Cloudflare Images cutout processing and OpenAI garment generation
- automatic Cloudflare Workers deployment from GitHub

## Local development

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
npm run test
npm run deploy
```

Production runs at `https://forme.gallery` on Cloudflare Workers. Every push to
the production branch is built and deployed by Cloudflare.

Runtime resources:

- D1 binding: `DB`
- R2 binding: `WARDROBE_MEDIA`
- Cloudflare Images binding: `IMAGES`

Runtime secrets are configured in Cloudflare, never committed to GitHub:

- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `FORME_OPS_TOKEN` (optional operations access)

Google OAuth uses `https://forme.gallery/auth/google/callback` as its authorized
redirect URI.
