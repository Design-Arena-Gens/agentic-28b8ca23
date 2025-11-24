import { NextResponse } from 'next/server';
import { readDatabase } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await readDatabase();
  const player = db.players.find((item) => item.id === session.userId);

  if (!player) {
    return NextResponse.json({ error: 'Account no longer exists' }, { status: 401 });
  }

  const attendance = db.attendance.filter((item) => item.playerId === player.id);
  const attendanceByEvent = new Map(attendance.map((record) => [record.eventId, record]));
  const present = attendance.filter((record) => record.status === 'present').length;
  const late = attendance.filter((record) => record.status === 'late').length;
  const absent = attendance.filter((record) => record.status === 'absent').length;

  const events = db.events
    .map((event) => {
      const record = attendanceByEvent.get(event.id);
      return {
        ...event,
        status: record?.status ?? null,
        recordedAt: record?.recordedAt ?? null,
      };
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return NextResponse.json({
    user: {
      id: player.id,
      fullName: player.fullName,
      email: player.email,
      position: player.position,
      isAdmin: player.isAdmin,
      username: player.username,
      createdAt: player.createdAt,
    },
    attendance: {
      present,
      absent,
      late,
    },
    events,
  });
}
