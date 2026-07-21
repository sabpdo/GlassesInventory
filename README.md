# Glasses Inventory

A simple internal app for tracking glasses frames and physical items by
barcode. Built with **Next.js 14 (App Router)**, **Prisma + Postgres (Neon)**,
**NextAuth**, **Tailwind CSS**, and **@zxing/browser** for camera-based
barcode scanning.

## Features

- **Admin-only access** — public registration is disabled. The primary admin
  account is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the environment.
  Additional users are created on the **Team** page.
- Email, username, or Google sign-in (Google only works for accounts the admin
  has already created)
- Inventory grid sortable by **Vendor**, **Description**, **Cost**, or
  **Recently added**, with case-insensitive search, low-stock highlighting, and
  **auto-refresh** every 5s
- Add / edit / delete frames; **Add similar** copies fields into a new frame;
  creating a matching frame prompts to **add to existing inventory** instead
- Attach physical items (each with a unique barcode) to a frame; edit, delete,
  mark unsold, or update sold price per item
- **Scan barcode** (`/scan`) — pair phone (default) or use this device’s camera:
  - **Known barcode, in stock** → check out (mark as sold, optional price)
  - **Known barcode, already sold** → sale info only
  - **New barcode** → create a new frame (with optional mark-as-sold) or attach
    to an existing frame
- **Pair phone** anywhere you scan: the Scan page, or the 📷 button on barcode
  fields (New frame, frame detail). Phone scans push barcodes to the computer
  in real time. The phone page (`/p/[code]`) does not require login.
- **Team** page (admins): manage users, view activity, **export sales CSV** by
  date range
- Profile page with personal sales stats

## Quick start

You need a **Neon Postgres** project (or any other Postgres). The local app
and the deployed app both talk to Neon — use a separate Neon branch for
local dev so you don't trample prod.

```bash
# 1. Copy the example env and fill in your Neon connection string
cp .env.example .env
# edit .env — paste your Neon POOLED URL into DATABASE_URL,
# set NEXTAUTH_SECRET to `openssl rand -base64 32`,
# set ADMIN_EMAIL and ADMIN_PASSWORD for the shop owner, etc.

# 2. Install deps (this also runs `prisma generate`)
npm install

# 3. Create the tables and (optionally) seed demo data
npm run db:push
npm run db:seed

# 4. Run it
npm run dev
```

Open http://localhost:3000 and sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

The seed (optional) creates a demo user:

- Email: `admin@example.com`
- Password: `admin123`

### Google sign-in

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` and the **Continue
with Google** button on `/login` starts working. (Add a redirect URI of
`<your-domain>/api/auth/callback/google` in Google Cloud Console.) The Google
account must match a user row the admin has already created.

### Phone pairing URL

If the desktop browser hostname differs from what phones should use (e.g. local
dev vs production), set `NEXT_PUBLIC_APP_URL` to your public app URL so QR codes
point at the right place.

### Useful scripts

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Next dev server on port 3000                       |
| `npm run build`     | `prisma generate && prisma db push && next build`  |
| `npm run start`     | Run the production build                           |
| `npm run db:push`   | Sync Prisma schema → database (no migration files) |
| `npm run db:seed`   | Run `prisma/seed.ts`                               |
| `npm run db:studio` | Open Prisma Studio (a row-level GUI)               |

## Using the pair-phone scanner

1. On your computer, sign in and open **Scan Barcode** (defaults to **Pair phone**).
2. A QR code and a 6-character pair code appear. The code is good for 30 minutes.
3. On your phone, scan the QR — or open the link (e.g. `https://your-domain.com/p/ABCDEF`).
4. The phone page loads with no login required. Point at barcodes.
5. Each scan appears on the computer within ~1 second. For checkout, mark sold;
   for new inventory, fill in the frame form.
6. Tap **Ready for next scan** when done — the phone stays paired.

The same **Pair phone** tab is available in the 📷 scan dialog on New frame and
frame detail barcode fields.

Pairing sessions auto-expire after 30 minutes.

## Sales export

Admins: open **Team** → **Export sales (CSV)**. Pick a date range and download.
The file includes sold date, frame details, barcode, sold price, and who marked
it sold.

## Deploying to Vercel

1. Push the repo to GitHub and import it on Vercel.
2. In **Project Settings → Environment Variables** add:
   - `DATABASE_URL` — your Neon **main** branch pooled URL
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your deployed URL (e.g. `https://your-app.vercel.app`)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — primary shop admin
   - (optional) `ADMIN_EMAILS` — comma-separated extra admin logins
   - (optional) `NEXT_PUBLIC_APP_URL` — same as production URL for phone pairing
   - (optional) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. Deploy. The build script runs `prisma generate && prisma db push && next build`.
4. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first deploy to bootstrap
   the admin account.

### Neon tips

- **Always use the pooled URL** for both local and prod (`-pooler` in the hostname).
- **Branches are free copies of your DB.** Use a `dev` branch for local work.
- **Neon cold starts** are a few hundred milliseconds — fine for an internal app.

## Project layout

```
prisma/
  schema.prisma     # User, Frame, Item, PairingSession
  seed.ts           # optional demo data
src/
  app/
    page.tsx                       # Inventory grid (/) — auto-refreshing
    login/                         # auth (registration disabled)
    frames/new/, frames/[id]/      # create + detail/edit
    scan/                          # Pair phone + This device
    admin/users/                   # Team + sales export
    p/[code]/                      # public phone-scanner page
    api/
      auth/[...nextauth]/
      admin/users/                 # user management
      frames/, items/              # CRUD + barcode lookup + sell
      sales/export/                # CSV export (admin)
      pair/                        # phone pairing
  components/
    FrameForm.tsx, FrameDetail.tsx, ScanModal.tsx, PairingPanel.tsx, …
  lib/
    auth.ts, admin.ts, prisma.ts, csv.ts, …
  middleware.ts                    # auth + admin route protection
```

## Notes

- The camera scanner uses `@zxing/browser` and works in browsers that allow
  camera access (HTTPS or localhost). Typed barcode entry is always available.
- A **frame** is a SKU (manufacturer + style + color + optional description).
  Each physical pair is an **item** with a unique barcode. Inventory quantity =
  items where `status = "IN_STOCK"`.
- Pairing codes use an unambiguous alphabet and expire after 30 minutes.
- Search uses case-insensitive matching on manufacturer, style, color, and description.
