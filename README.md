# EazyHub

Installable marketplace and logistics PWA for multi-vendor ordering (Mineazy, Farmeazy), checkout with map-based delivery fees, Paynow payments, and an admin console.

## Stack

- React 19 + TypeScript + Vite (PWA)
- Supabase (Auth, Postgres, Storage, Edge Functions)
- TanStack Query, Zustand, Tailwind CSS

## Local development

1. Copy `.env.example` to `.env.local` and set Supabase keys.
2. `npm install`
3. `npm run dev`

## Supabase setup

1. Link your project and apply RLS policies:

   ```bash
   supabase db push
   ```

2. Deploy edge functions:

   ```bash
   supabase functions deploy create-order
   supabase functions deploy paynow-checkout
   supabase functions deploy paynow-webhook
   supabase functions deploy admin-action
   supabase functions deploy email-notifications
   ```

3. Set function secrets: `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `SITE_URL` (public app URL), optional `RESEND_API_KEY`, `HUB_LAT`, `HUB_LNG`.

4. Configure Paynow **result URL** to your `paynow-webhook` function URL (also set automatically when checkout runs).

## Install as an app

- **Android / Chrome:** open the site → “Add to Home Screen” (or use the in-app prompt).
- **iOS Safari:** Share → Add to Home Screen.

The PWA uses `vite-plugin-pwa` with auto-updating service worker caching.

## Security model

- Orders are created on the server (`create-order`) with DB prices and stock checks.
- Paynow amounts are computed server-side; webhooks validate Paynow SHA-512 hashes.
- Admin promotion and company creation go through `admin-action` (super admin only).
- Postgres RLS policies in `supabase/migrations/` restrict client access.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Dev server               |
| `npm run build`| Production build         |
| `npm run preview` | Preview production build |
