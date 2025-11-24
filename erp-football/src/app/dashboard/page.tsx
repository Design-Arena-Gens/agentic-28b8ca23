"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { AttendanceStatus } from "@/lib/types";

interface MeResponse {
  user: {
    id: string;
    fullName: string;
    email: string;
    position: string;
    isAdmin: boolean;
    username: string;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
  events: Array<{
    id: string;
    title: string;
    category: string;
    startTime: string;
    location: string;
    notes?: string;
    status: AttendanceStatus | null;
    recordedAt: string | null;
  }>;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function statusClass(status: AttendanceStatus | null) {
  if (status === "present") return "badge success";
  if (status === "late") return "badge warning";
  if (status === "absent") return "badge danger";
  return "badge";
}

export default function PlayerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/me");

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load dashboard");
        }

        const payload: MeResponse = await response.json();

        if (payload.user.isAdmin) {
          router.replace("/admin");
          return;
        }

        if (!cancelled) {
          setData(payload);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load dashboard";
          setError(message);
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const upcomingEvents = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return data.events.filter((event) => new Date(event.startTime) >= now).slice(0, 5);
  }, [data]);

  const recentEvents = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return data.events
      .filter((event) => new Date(event.startTime) < now)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 8);
  }, [data]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (isLoading) {
    return <LoadingOverlay message="Syncing fixtures" />;
  }

  if (error || !data) {
    return (
      <div className="card" style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center" }}>
        <h2 className="section-title" style={{ justifyContent: "center" }}>
          Unable to load
        </h2>
        <p className="muted">{error ?? "An unknown error occurred."}</p>
        <button className="button" type="button" onClick={() => router.refresh()} style={{ marginTop: "18px" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: "32px", position: "relative", zIndex: 1 }}>
      <header className="grid" style={{ gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div className="badge" style={{ background: "rgba(34,197,94,0.18)", color: "#bbf7d0" }}>
            Player Console
          </div>
          <button className="button secondary" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
        <h1 className="section-title" style={{ fontSize: "2.2rem" }}>
          {data.user.fullName}
        </h1>
        <p className="muted">
          Position: {data.user.position} &middot; Username: <strong>{data.user.username}</strong>
        </p>
      </header>

      <section className="grid two">
        <article className="card">
          <h2 className="section-title">Attendance Pulse</h2>
          <div className="chips">
            <span className="chip">Present: {data.attendance.present}</span>
            <span className="chip">Late: {data.attendance.late}</span>
            <span className="chip">Missed: {data.attendance.absent}</span>
          </div>
        </article>
        <article className="card">
          <h2 className="section-title">Next Fixtures</h2>
          <div className="list">
            {upcomingEvents.length === 0 && <p className="muted">No upcoming sessions scheduled.</p>}
            {upcomingEvents.map((event) => (
              <div key={event.id} className="list-item">
                <div className="grid" style={{ gap: "4px" }}>
                  <strong>{event.title}</strong>
                  <span className="muted">{formatDate(event.startTime)}</span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {event.location} &mdash; {event.category.toUpperCase()}
                  </span>
                </div>
                <span className={statusClass(event.status)}>{event.status ?? "Pending"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <h2 className="section-title">Recent Match & Training History</h2>
        {recentEvents.length === 0 ? (
          <p className="muted">Attendance history will appear here once sessions are tracked.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Date</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{formatDate(event.startTime)}</td>
                  <td>{event.location}</td>
                  <td>
                    <span className={statusClass(event.status)}>{event.status ?? "Pending"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
