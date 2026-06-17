"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";
import WalletButton from "@/components/auth/WalletButton";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/", label: "League", icon: "🏆" },
  { href: "/squad", label: "Squad", icon: "⚽" },
  { href: "/train", label: "Train", icon: "💪" },
  { href: "/market", label: "Market", icon: "💰" },
  { href: "/friendly", label: "Friendly", icon: "🤝" },
  { href: "/portal", label: "Portal", icon: "📨" },
  { href: "/gacha", label: "Spin", icon: "🎰" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { connected } = useAuth();
  const subtleHover = useHoverSound("subtle");

  return (
    <nav className="ws-navbar">
      <div className="ws-navbar-inner">
        <div className="ws-navbar-brand">
          <span className="ws-navbar-logo">⚽</span>
          <span className="ws-navbar-title">{APP_NAME}</span>
          <span className="ws-navbar-badge">{APP_TAGLINE}</span>
        </div>

        {connected && (
          <div className="ws-navbar-links">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`ws-nav-link ${pathname === item.href ? "active" : ""}`}
                {...subtleHover}
              >
                <span className="ws-nav-icon">{item.icon}</span>
                <span className="ws-nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto" }}>
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
