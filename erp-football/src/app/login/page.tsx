"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface LoginResponse {
  user: {
    id: string;
    fullName: string;
    isAdmin: boolean;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("No session");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const destination = payload.user.isAdmin ? "/admin" : "/dashboard";
        router.replace(destination);
      })
      .catch(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to sign in");
      }

      const payload: LoginResponse = await response.json();
      const destination = payload.user.isAdmin ? "/admin" : "/dashboard";
      router.replace(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return <LoadingOverlay message="Preparing your workspace" />;
  }

  return (
    <div className="grid" style={{ gap: "32px", position: "relative", zIndex: 1 }}>
      {isLoading && <LoadingOverlay message="Signing you in..." />}
      <header className="grid" style={{ gap: "12px" }}>
        <span className="badge" style={{ alignSelf: "flex-start", background: "rgba(56,189,248,0.18)", color: "#bae6fd" }}>
          PitchVision ERP
        </span>
        <h1 className="section-title" style={{ fontSize: "2.4rem" }}>
          Elite Football Operations Portal
        </h1>
        <p className="muted" style={{ maxWidth: "540px" }}>
          Centralize player records, fixtures, and tournament logistics across your entire football organization.
          Administrators can enroll athletes, manage schedules, and monitor attendance in a single command center.
        </p>
      </header>

      <form className="card grid" style={{ gap: "18px" }} onSubmit={handleSubmit}>
        <div className="grid" style={{ gap: "8px" }}>
          <label className="label">
            <span>Username or email</span>
            <input
              className="input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="e.g. admin or coach@club.com"
              autoFocus
              required
            />
          </label>
          <label className="label">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter secure password"
              required
            />
          </label>
        </div>

        {error && (
          <div className="badge danger" role="alert" style={{ alignSelf: "flex-start" }}>
            {error}
          </div>
        )}

        <button className="button" type="submit" disabled={isLoading}>
          {isLoading ? "Authorizing..." : "Launch Control Room"}
        </button>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Accounts are provisioned by your club administrators. Reach out to your club operations lead if you require access.
        </p>
      </form>
    </div>
  );
}
