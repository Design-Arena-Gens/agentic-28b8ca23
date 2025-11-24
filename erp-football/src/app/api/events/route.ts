import { NextResponse } from 'next/server';
import { readDatabase } from '@/lib/db';

export async function GET() {
  const db = await readDatabase();
  const events = db.events
    .map((event) => {
      const attendance = db.attendance.filter((record) => record.eventId === event.id);
      const counts = {
        present: attendance.filter((record) => record.status === 'present').length,
        absent: attendance.filter((record) => record.status === 'absent').length,
        late: attendance.filter((record) => record.status === 'late').length,
      };
      return { ...event, attendance: counts };
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return NextResponse.json({ events });
}
