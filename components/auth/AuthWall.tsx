"use client";

import { useAuth } from "@/lib/auth/useAuth";
import LandingPage from "./LandingPage";

/**
 * Lightweight auth gate for any page.
 * Shows landing page if not connected, loading spinner while checking,
 * otherwise renders children.
 *
 * Usage:
 *   export default function MyPage() {
 *     return <AuthWall><MyContent /></AuthWall>;
 *   }
 */
export default function AuthWall({ children }: { children: React.ReactNode }) {
  const { ready, connected } = useAuth();

  // While Phantom is checking trusted connections — show nothing
  // (avoids flash of landing page on legit users who are already connected)
  if (!ready) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "80vh", flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 40, animation: "ws-float 1.5s ease-in-out infinite" }}>⚽</div>
        <div style={{
          fontFamily: "var(--display)", fontSize: "0.9rem",
          textTransform: "uppercase", letterSpacing: 2, color: "var(--ink-dim)",
        }}>
          Loading...
        </div>
        <style>{`@keyframes ws-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
      </div>
    );
  }

  if (!connected) return <LandingPage />;

  return <>{children}</>;
}
