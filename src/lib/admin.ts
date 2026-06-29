// Single source of truth for "ultra admin" privileges.
//
// Admins are configured by email via the ADMIN_EMAILS environment variable
// (comma-separated). The owner email defaults in so the app is usable
// out of the box, but ADMIN_EMAILS in .env / Vercel overrides it.
//
//   ADMIN_EMAILS="paceyecare@yahoo.com,other-owner@example.com"

const FALLBACK_ADMIN_EMAILS = ["paceyecare@yahoo.com"];

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !raw.trim()) {
    return FALLBACK_ADMIN_EMAILS.map((e) => e.toLowerCase());
  }
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
