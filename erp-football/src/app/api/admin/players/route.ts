import { NextResponse } from 'next/server';
import { addPlayer, readDatabase } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import { generateTempPassword, hashPassword } from '@/lib/security';

const USERNAME_MIN_LENGTH = 3;

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await readDatabase();
  const players = db.players.map((player) => ({
    id: player.id,
    fullName: player.fullName,
    email: player.email,
    position: player.position,
    username: player.username,
    isAdmin: player.isAdmin,
    createdAt: player.createdAt,
  }));

  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullName = (body.fullName as string | undefined)?.trim();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const position = (body.position as string | undefined)?.trim();
    const desiredUsername = (body.username as string | undefined)?.trim();
    const makeAdmin = Boolean(body.isAdmin);

    if (!fullName || !email || !position) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let usernameCandidate = desiredUsername || fullName.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (!usernameCandidate || usernameCandidate.length < USERNAME_MIN_LENGTH) {
      usernameCandidate = `player${Math.floor(Math.random() * 9999)}`;
    }

    const tempPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(tempPassword);

    const player = await addPlayer({
      fullName,
      email,
      position,
      username: usernameCandidate,
      passwordHash,
      isAdmin: makeAdmin,
    });

    return NextResponse.json({
      player: {
        id: player.id,
        fullName: player.fullName,
        email: player.email,
        position: player.position,
        username: player.username,
        isAdmin: player.isAdmin,
        createdAt: player.createdAt,
      },
      temporaryPassword: tempPassword,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Player already exists') {
      return NextResponse.json({ error: 'A player with that email or username already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unable to create player' }, { status: 500 });
  }
}
