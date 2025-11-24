import { NextResponse } from 'next/server';
import { readDatabase } from '@/lib/db';
import { setSessionCookie } from '@/lib/session';
import { verifyPassword } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = (body.identifier as string | undefined)?.trim();
    const password = body.password as string | undefined;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const db = await readDatabase();
    const player = db.players.find(
      (item) =>
        item.email.toLowerCase() === identifier.toLowerCase() ||
        item.username.toLowerCase() === identifier.toLowerCase(),
    );

    if (!player) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, player.passwordHash);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await setSessionCookie({
      userId: player.id,
      email: player.email,
      fullName: player.fullName,
      isAdmin: player.isAdmin,
    });

    return NextResponse.json({
      user: {
        id: player.id,
        fullName: player.fullName,
        email: player.email,
        isAdmin: player.isAdmin,
        position: player.position,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
