import { NextResponse } from 'next/server';
import { deletePlayer, readDatabase } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await readDatabase();
  const player = db.players.find((item) => item.id === id);

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.isAdmin) {
    return NextResponse.json({ error: 'Cannot remove administrator accounts' }, { status: 400 });
  }

  await deletePlayer(id);

  return NextResponse.json({ success: true });
}
