"use client";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay" role="alert" aria-live="assertive">
      <div className="loading-spinner" />
      <p className="loading-text">{message ?? "Authorizing"}</p>
    </div>
  );
}
