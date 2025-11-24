import { NextResponse } from 'next/server';
import { bulkRecordAttendance, readDatabase } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import type { AttendanceStatus } from '@/lib/types';

const VALID_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late'];

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const db = await readDatabase();
  const attendance = db.attendance.filter((record) => record.eventId === eventId);

  return NextResponse.json({ attendance });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const eventId = body.eventId as string | undefined;
    const records = (body.records ?? []) as { playerId: string; status: AttendanceStatus }[];

    if (!eventId || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Missing attendance data' }, { status: 400 });
    }

    const db = await readDatabase();
    const event = db.events.find((item) => item.id === eventId);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const playerIds = new Set(db.players.map((player) => player.id));
    const sanitized = records.filter(
      (record) => record.playerId && playerIds.has(record.playerId) && VALID_STATUSES.includes(record.status),
    );

    if (sanitized.length === 0) {
      return NextResponse.json({ error: 'No valid attendance records provided' }, { status: 400 });
    }

    await bulkRecordAttendance({
      eventId,
      recordedBy: session.userId,
      records: sanitized,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to record attendance' }, { status: 500 });
  }
}
