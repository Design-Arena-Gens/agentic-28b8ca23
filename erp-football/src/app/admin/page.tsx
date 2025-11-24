"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { AttendanceStatus, EventCategory } from "@/lib/types";

interface Player {
  id: string;
  fullName: string;
  email: string;
  position: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

interface EventItem {
  id: string;
  title: string;
  category: EventCategory;
  startTime: string;
  location: string;
  notes?: string;
  createdAt: string;
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
}

interface AttendanceRecord {
  id: string;
  playerId: string;
  eventId: string;
  status: AttendanceStatus;
}

const categories: { value: EventCategory; label: string }[] = [
  { value: "training", label: "Training" },
  { value: "match", label: "Match" },
  { value: "tournament", label: "Tournament" },
  { value: "event", label: "Club Event" },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function AdminConsole() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerPassword, setNewPlayerPassword] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const meResponse = await fetch("/api/auth/me");

        if (meResponse.status === 401) {
          router.replace("/login");
          return;
        }

        const mePayload = await meResponse.json();

        if (!mePayload.user.isAdmin) {
          router.replace("/dashboard");
          return;
        }

        const [playerRes, eventRes] = await Promise.all([fetch("/api/admin/players"), fetch("/api/events")]);

        if (!playerRes.ok) {
          throw new Error("Unable to load players");
        }

        if (!eventRes.ok) {
          throw new Error("Unable to load events");
        }

        const playerPayload = await playerRes.json();
        const eventPayload = await eventRes.json();

        if (!cancelled) {
          setPlayers(playerPayload.players);
          setEvents(eventPayload.events);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load admin console";
          setError(message);
          setIsLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedEventId) {
      setAttendanceMap({});
      return;
    }

    let cancelled = false;
    setAttendanceLoading(true);

    fetch(`/api/admin/attendance?eventId=${selectedEventId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load attendance");
        }
        return response.json();
      })
      .then((payload: { attendance: AttendanceRecord[] }) => {
        if (cancelled) return;
        const map: Record<string, AttendanceStatus> = {};
        payload.attendance.forEach((record) => {
          map[record.playerId] = record.status;
        });
        setAttendanceMap(map);
      })
      .catch(() => {
        if (!cancelled) {
          setAttendanceMap({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAttendanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  const nonAdminPlayers = useMemo(() => players.filter((player) => !player.isAdmin), [players]);

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const submission = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      position: formData.get("position") as string,
      username: formData.get("username"),
    };

    setNewPlayerPassword(null);

    const response = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to create player");
      return;
    }

    const payload = await response.json();
    setPlayers((prev) => [...prev, payload.player]);
    setNewPlayerPassword(`${payload.player.username} / ${payload.temporaryPassword}`);
    event.currentTarget.reset();
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const submission = {
      title: formData.get("title"),
      category: formData.get("category"),
      startTime: formData.get("startTime"),
      location: formData.get("location"),
      notes: formData.get("notes"),
    };

    const response = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to create event");
      return;
    }

    const payload = await response.json();
    setEvents((prev) => [...prev, payload.event]);
    event.currentTarget.reset();
  }

  async function handleRemovePlayer(playerId: string) {
    setError(null);
    const response = await fetch(`/api/admin/players/${playerId}`, { method: "DELETE" });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to remove player");
      return;
    }

    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    setSaveMessage("Player removed from roster.");
    setTimeout(() => setSaveMessage(null), 2500);
  }

  async function handleSubmitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedEventId) {
      setError("Select an event before saving attendance");
      return;
    }

    const records = Object.entries(attendanceMap)
      .filter(([, status]) => Boolean(status))
      .map(([playerId, status]) => ({
        playerId,
        status,
      }));

    if (records.length === 0) {
      setError("Assign at least one attendance status");
      return;
    }

    const response = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: selectedEventId, records }),
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to save attendance");
      return;
    }

    setSaveMessage("Attendance synced to player portals.");
    setTimeout(() => setSaveMessage(null), 2500);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function updateAttendance(playerId: string, status: string) {
    setAttendanceMap((previous) => {
      if (!status) {
        const next = { ...previous };
        delete next[playerId];
        return next;
      }
      return { ...previous, [playerId]: status as AttendanceStatus };
    });
  }

  if (isLoading) {
    return <LoadingOverlay message="Loading control center" />;
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center" }}>
        <h2 className="section-title" style={{ justifyContent: "center" }}>
          Something went wrong
        </h2>
        <p className="muted">{error}</p>
        <button className="button" type="button" onClick={() => router.refresh()} style={{ marginTop: "18px" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: "32px", position: "relative", zIndex: 1 }}>
      <header className="grid" style={{ gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <span className="badge" style={{ background: "rgba(56,189,248,0.22)", color: "#e0f2fe" }}>
            Administrator Console
          </span>
          <button className="button secondary" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
        <h1 className="section-title" style={{ fontSize: "2.4rem" }}>
          Squad Operations HQ
        </h1>
        <p className="muted" style={{ maxWidth: "720px" }}>
          Provision player access, orchestrate fixtures, and monitor engagement across every competition your club
          enters. Updates are instantly reflected in player dashboards without relying on local storage or external
          databases.
        </p>
      </header>

      {saveMessage && (
        <div className="badge success" style={{ alignSelf: "flex-start" }}>
          {saveMessage}
        </div>
      )}

      {newPlayerPassword && (
        <div className="card" style={{ borderColor: "rgba(56,189,248,0.3)" }}>
          <h2 className="section-title">New player credentials</h2>
          <p className="muted">Share the credentials below securely with the athlete.</p>
          <div className="list" style={{ marginTop: "12px" }}>
            <div className="list-item" style={{ justifyContent: "space-between" }}>
              <span>Username / Password</span>
              <strong>{newPlayerPassword}</strong>
            </div>
          </div>
        </div>
      )}

      <section className="grid two">
        <form className="card grid" style={{ gap: "16px" }} onSubmit={handleCreatePlayer}>
          <h2 className="section-title">Add player</h2>
          <label className="label">
            <span>Full name</span>
            <input className="input" name="fullName" placeholder="Player full name" required />
          </label>
          <label className="label">
            <span>Email</span>
            <input className="input" name="email" type="email" placeholder="player@club.com" required />
          </label>
          <label className="label">
            <span>Position</span>
            <input className="input" name="position" placeholder="e.g. Attacking Midfielder" required />
          </label>
          <label className="label">
            <span>Preferred username (optional)</span>
            <input className="input" name="username" placeholder="Automatically generated if empty" />
          </label>
          <button className="button" type="submit">
            Create profile
          </button>
        </form>

        <form className="card grid" style={{ gap: "16px" }} onSubmit={handleCreateEvent}>
          <h2 className="section-title">Schedule event</h2>
          <label className="label">
            <span>Title</span>
            <input className="input" name="title" placeholder="e.g. League Match vs Rivals FC" required />
          </label>
          <label className="label">
            <span>Category</span>
            <select className="input" name="category" defaultValue="match" required>
              {categories.map((category) => (
                <option value={category.value} key={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            <span>Start</span>
            <input className="input" name="startTime" type="datetime-local" required />
          </label>
          <label className="label">
            <span>Location</span>
            <input className="input" name="location" placeholder="Stadium or training ground" required />
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="input" name="notes" rows={3} placeholder="Scouting notes, kit colors, etc." />
          </label>
          <button className="button" type="submit">
            Publish to calendar
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="section-title">Roster overview</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Position</th>
              <th>Username</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No players registered yet.
                </td>
              </tr>
            )}
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <strong>{player.fullName}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {player.email}
                  </div>
                </td>
                <td>{player.position}</td>
                <td>{player.username}</td>
                <td>{formatDate(player.createdAt)}</td>
                <td>
                  {!player.isAdmin && (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => handleRemovePlayer(player.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card grid" style={{ gap: "16px" }}>
        <h2 className="section-title">Attendance control</h2>
        <label className="label">
          <span>Select event</span>
          <select
            className="input"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            <option value="">Choose a scheduled event</option>
            {events
              .slice()
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {formatDate(event.startTime)} &ndash; {event.title}
                </option>
              ))}
          </select>
        </label>

        {attendanceLoading && <p className="muted">Loading attendance sheet...</p>}

        {!attendanceLoading && selectedEventId && (
          <form className="grid" style={{ gap: "12px" }} onSubmit={handleSubmitAttendance}>
            <div className="grid" style={{ gap: "12px" }}>
              {nonAdminPlayers.map((player) => (
                <div key={player.id} className="list-item" style={{ alignItems: "center" }}>
                  <div className="grid" style={{ gap: "4px" }}>
                    <strong>{player.fullName}</strong>
                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                      {player.position}
                    </span>
                  </div>
                  <select
                    className="input"
                    style={{ maxWidth: "180px" }}
                    value={attendanceMap[player.id] ?? ""}
                    onChange={(event) => updateAttendance(player.id, event.target.value)}
                  >
                    <option value="">Not set</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              ))}
            </div>

            <button className="button" type="submit">
              Sync attendance
            </button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Fixture ledger</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Location</th>
              <th>Category</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No events scheduled yet.
                </td>
              </tr>
            )}
            {events
              .slice()
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.title}</strong>
                    {event.notes && (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {event.notes}
                      </div>
                    )}
                  </td>
                  <td>{formatDate(event.startTime)}</td>
                  <td>{event.location}</td>
                  <td style={{ textTransform: "capitalize" }}>{event.category}</td>
                  <td>
                    <div className="chips">
                      <span className="chip">Present {event.attendance.present}</span>
                      <span className="chip">Late {event.attendance.late}</span>
                      <span className="chip">Absent {event.attendance.absent}</span>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
