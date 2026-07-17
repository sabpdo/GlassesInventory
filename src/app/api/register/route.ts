import { NextResponse } from "next/server";

// Public self-registration is disabled. Admins create accounts from Team →
// Manage access.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Self-registration is disabled. Ask your administrator for an account.",
    },
    { status: 403 }
  );
}
