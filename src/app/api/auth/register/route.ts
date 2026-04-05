import { NextResponse } from 'next/server';

// Registration is disabled. Team management is handled by the admin dashboard.
export async function POST() {
  return NextResponse.json(
    { error: 'Registration is disabled. Contact your admin to get team credentials.' },
    { status: 403 }
  );
}
