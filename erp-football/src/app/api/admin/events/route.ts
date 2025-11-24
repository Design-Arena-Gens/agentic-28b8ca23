import { NextResponse } from 'next/server';
import { addEvent } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import type { EventCategory } from '@/lib/types';

const VALID_CATEGORIES: EventCategory[] = ['training', 'match', 'tournament', 'event'];

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);

  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = (body.title as string | undefined)?.trim();
    const category = body.category as EventCategory | undefined;
    const startTime = body.startTime as string | undefined;
    const location = (body.location as string | undefined)?.trim();
    const notes = (body.notes as string | undefined)?.trim();

    if (!title || !category || !startTime || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const event = await addEvent({
      title,
      category,
      startTime: new Date(startTime).toISOString(),
      location,
      notes,
    });

    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: 'Unable to create event' }, { status: 500 });
  }
}
