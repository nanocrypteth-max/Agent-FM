"use client";

import { useAuth } from "@/lib/auth/useAuth";
import LandingPage from "./LandingPage";

export default function AuthWall({ children }: { children: React.ReactNode }) {
  const { ready, connected } = useAuth();

  if (!ready) return <FootballLoader />;
  if (!connected) return <LandingPage />;
  return <>{children}</>;
}

function FootballLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Bouncing ball with shadow */}
      <div style={{ position: "relative", width: 64, height: 80 }}>
        <div style={{ animation: "fb-bounce 0.7s ease-in-out infinite" }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="white"
              stroke="#1a1a1a"
              strokeWidth="3"
            />
            <polygon points="50,28 64,38 59,55 41,55 36,38" fill="#1a1a1a" />
            <polygon points="50,4 62,12 58,26 42,26 38,12" fill="#1a1a1a" />
            <polygon points="75,16 85,28 78,42 65,40 63,26" fill="#1a1a1a" />
            <polygon points="82,56 82,72 68,78 60,66 67,52" fill="#1a1a1a" />
            <polygon points="18,56 33,52 40,66 32,78 18,72" fill="#1a1a1a" />
            <polygon points="25,16 37,26 35,40 22,42 15,28" fill="#1a1a1a" />
            <polygon points="50,96 38,88 42,74 58,74 62,88" fill="#1a1a1a" />
            <ellipse
              cx="35"
              cy="32"
              rx="8"
              ry="5"
              fill="rgba(255,255,255,0.4)"
              transform="rotate(-30 35 32)"
            />
          </svg>
        </div>
        {/* Ground shadow that squishes as ball rises */}
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: "50%",
            transform: "translateX(-50%)",
            animation: "fb-shadow 0.7s ease-in-out infinite",
            background: "rgba(0,0,0,0.25)",
            borderRadius: "50%",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "var(--display)",
          fontSize: "0.85rem",
          textTransform: "uppercase",
          letterSpacing: 3,
          color: "var(--ink-dim)",
        }}
      >
        Loading...
      </div>

      <style>{`
        @keyframes fb-bounce {
          0%, 100% { transform: translateY(0) scaleY(1) scaleX(1); }
          10%       { transform: translateY(2px) scaleY(0.88) scaleX(1.12); }
          40%       { transform: translateY(-28px) scaleY(1.05) scaleX(0.95) rotate(15deg); }
          60%       { transform: translateY(-28px) scaleY(1.05) scaleX(0.95) rotate(30deg); }
          90%       { transform: translateY(2px) scaleY(0.88) scaleX(1.12); }
        }
        @keyframes fb-shadow {
          0%, 100% { width: 36px; height: 8px; opacity: 0.4; }
          40%, 60%  { width: 20px; height: 5px; opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
