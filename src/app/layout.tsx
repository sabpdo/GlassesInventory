import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Glasses Inventory",
  description: "Track frames, items, and sales with barcode scanning.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <Providers>
          {session ? (
            <Navbar
              userEmail={session.user?.email ?? ""}
              userName={session.user?.name ?? undefined}
              isAdmin={Boolean(
                (session.user as { isAdmin?: boolean } | undefined)?.isAdmin
              )}
            />
          ) : null}
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
