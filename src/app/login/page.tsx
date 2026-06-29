"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled] = useState<boolean>(
    // Server hint: rendered via NEXT_PUBLIC if you set it; otherwise we just
    // show the button and let NextAuth decide. Keeping it always-visible is
    // simpler and harmless; clicking it errors gracefully if not configured.
    true
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    // Full page load so the session cookie is definitely sent on the next
    // request (router.push alone can race middleware on Vercel).
    window.location.assign(res?.url ?? callbackUrl);
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back. Sign in to manage your inventory.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
            />
          </div>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {googleEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              OR
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="btn-secondary w-full"
            >
              Continue with Google
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              Google sign-in works once Google credentials are configured.
            </p>
          </>
        ) : null}

        <div className="mt-6 border-t border-slate-200 pt-5 text-center">
          <p className="text-sm text-slate-600">Don&apos;t have an account?</p>
          <Link href="/register" className="btn-secondary mt-2 w-full">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
