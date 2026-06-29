# Glasses Inventory

A simple internal app for tracking glasses frames and physical items by
barcode. Built with **Next.js 14 (App Router)**, **Prisma + Postgres (Neon)**,
**NextAuth**, **Tailwind CSS**, and **@zxing/browser** for camera-based
barcode scanning.

## Features

- Email + password login, plus Google sign-in (enabled when Google OAuth env vars are set)
- Inventory grid sortable by **Vendor (Manufacturer)** or **Description**, with case-insensitive search
- **Auto-refreshing** inventory grid (silently re-fetches every 5s while the tab is visible)
- Columns in the order: Manufacturer, Style, Color, Description, Cost, Retail Cost, Size, Inventory Quantity
- Add / edit / delete frames
- Attach physical items (each with a unique barcode) to a frame
- Scan a barcode on **this device** (camera or typed):
  - Unknown → attach it to an existing frame or create a new one
  - In stock → "Is this sold?" — marks sold, records timestamp + price, decreases inventory by 1
  - Already sold → shows the sale info
- **Pair phone** mode: open `/scan` on the computer, switch to "Pair phone", scan
  the QR code with your phone — the phone becomes a remote scanner that pushes
  barcodes to the computer's open page in real time. The phone doesn't have
  to be logged in.

## Quick start

You need a **Neon Postgres** project (or any other Postgres). The local app
and the deployed app both talk to Neon — use a separate Neon branch for
local dev so you don't trample prod.

```bash
# 1. Copy the example env and fill in your Neon connection string
cp .env.example .env
# edit .env — paste your Neon POOLED URL into DATABASE_URL,
# set NEXTAUTH_SECRET to `openssl rand -base64 32`, etc.

# 2. Install deps (this also runs `prisma generate`)
npm install

# 3. Create the tables and (optionally) seed demo data
npm run db:push
npm run db:seed

# 4. Run it
npm run dev
```

Open http://localhost:3000.

The seed creates a default user you can log in with:

- Email: `admin@example.com`
- Password: `admin123`

### Google sign-in

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` and the **Continue with Google** button on `/login` starts working. (Add a redirect URI of `<your-domain>/api/auth/callback/google` in Google Cloud Console.)

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server on port 3000 |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Run the production build |
| `npm run db:push` | Sync Prisma schema → database (no migration files) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio (a row-level GUI) |

## Using the pair-phone scanner

1. On your computer, sign in and open **Scan barcode** → switch the toggle to **Pair phone**.
2. A QR code and a 6-character pair code appear. The code is good for 30 minutes.
3. On your phone, point the phone camera at the QR (most camera apps will offer an "Open in browser" prompt) — or type the URL by hand (e.g. `https://your-domain.com/p/ABCDEF`).
4. The phone page loads with no login required. Point at a barcode.
5. Each scan pops up on your computer's Scan page within ~1.5 seconds. Finish the "Is this sold?" or "Attach to a frame" flow on the computer.
6. Tap **Ready for next scan** on the computer when done — the phone is still paired and ready to send the next barcode.

Pairing sessions auto-expire after 30 minutes so a forgotten phone link can't be used indefinitely.

## Deploying to Vercel

1. Push the repo to GitHub and import it on Vercel.
2. In **Project Settings → Environment Variables** add:
   - `DATABASE_URL` — your Neon **main** branch pooled URL (`…-pooler.<region>.aws.neon.tech/…?sslmode=require&channel_binding=require`)
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32` (different from your local one is fine)
   - `NEXTAUTH_URL` — your deployed URL (e.g. `https://your-app.vercel.app`)
   - (optional) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. Deploy. The build script runs `prisma generate && next build`, so the client is ready in the bundle.
4. The first deploy will have an empty schema on the main branch (unless you've already pushed to it). Run once locally pointed at prod:

   ```bash
   DATABASE_URL="postgresql://…main…-pooler.…neon.tech/…?sslmode=require" npx prisma db push
   # Optionally seed an initial admin user:
   DATABASE_URL="postgresql://…main…-pooler.…neon.tech/…?sslmode=require" npm run db:seed
   ```

### Neon tips

- **Always use the pooled URL** for both local and prod. The pooled connection
  multiplexes many client connections onto a small pool of Postgres backends
  so serverless functions don't exhaust Postgres's connection limit. You can
  spot it by the `-pooler` segment in the hostname.
- **Branches are free copies of your DB.** Make a `dev` branch for local
  development; reset it any time with `npm run db:push` after dropping all
  tables in the Neon console. Make a `staging` branch if you want a place
  to try migrations before pointing at prod.
- **Neon cold starts** are a few hundred milliseconds — fine for an internal
  app. Set Neon's "Always-on" if it ever feels noticeable.

### Other database options (for context)

- **Vercel Postgres** — same Neon under the hood, one-click setup from the Vercel dashboard. Smaller free tier than going direct.
- **Supabase** — Postgres + storage + auth in one product. Useful if you'll later want photos of frames; use the port `6543` (transaction-pooled) URL.
- **Railway / Render / Fly Postgres** — traditional always-on instances; ~$5/mo and up.

## Project layout

```
prisma/
  schema.prisma     # User, Frame, Item, PairingSession
  seed.ts           # admin + sample frames
src/
  app/
    page.tsx                       # Inventory grid (/) — auto-refreshing
    login/, register/              # auth pages
    frames/new/, frames/[id]/      # create + detail/edit
    scan/                          # "This device" + "Pair phone" tabs
    p/[code]/                      # public phone-scanner page
    api/
      auth/[...nextauth]/          # NextAuth handler
      register/                    # POST /api/register
      frames/, frames/[id]/        # CRUD
      items/                       # POST attach barcode
      items/by-barcode/[barcode]/  # lookup
      items/[id]/sell/             # mark sold
      pair/                        # POST create pair session
      pair/[code]/                 # GET poll
      pair/[code]/scan/            # POST phone-side scan
  components/
    Navbar.tsx
    InventoryGrid.tsx
    FrameForm.tsx
    FrameDetail.tsx
    BarcodeScanner.tsx
    PairingPanel.tsx
  lib/
    auth.ts, prisma.ts, utils.ts, pairing.ts
  middleware.ts                    # NextAuth route protection (allows /p/* and /api/pair/*)
```

## Notes

- The camera scanner uses `@zxing/browser` and works in modern browsers that allow camera access (HTTPS or localhost). Typed barcode entry is always available as a fallback.
- A "frame" represents a SKU (Manufacturer + Style + Color + Description). Each physical pair is an "item" with a unique barcode. Inventory quantity for a frame = number of its items where `status = "IN_STOCK"`.
- Pairing codes use an unambiguous alphabet (no `0/O`, `1/I`, etc.) and expire after 30 minutes. Expired rows are best-effort cleaned up whenever a new code is created.
- Search on Postgres uses `mode: "insensitive"` so case doesn't matter when searching by Manufacturer / Style / Color / Description.
