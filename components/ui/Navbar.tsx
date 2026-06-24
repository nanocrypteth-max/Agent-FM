"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";
import WalletButton from "@/components/auth/WalletButton";
import { APP_TAGLINE } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/", label: "League", icon: "🏆" },
  { href: "/matchmaking", label: "Find League", icon: "🔍" },
  { href: "/squad", label: "Squad", icon: "⚽" },
  { href: "/train", label: "Train", icon: "💪" },
  { href: "/market", label: "Market", icon: "💰" },
  { href: "/topup", label: "Top Up", icon: "💵" },
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
        <Link
          href="/"
          className="ws-navbar-brand"
          style={{ textDecoration: "none" }}
        >
          <Image
            src="/logo.png"
            alt="Agent FM"
            width={150}
            height={64}
            priority
            style={{ height: 40, width: "auto", objectFit: "contain" }}
          />
          <span className="ws-navbar-badge">{APP_TAGLINE}</span>
        </Link>

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
