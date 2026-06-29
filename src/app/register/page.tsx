"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create account.");
      setSubmitting(false);
      return;
    }
    const signinRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setSubmitting(false);
    if (signinRes?.error) {
      router.push("/login");
      return;
    }
    window.location.assign(signinRes?.url ?? "/");
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set up an account to start tracking glasses.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="name" className="label">
              Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
            />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
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
            {submitting ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
