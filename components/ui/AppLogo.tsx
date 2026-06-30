"use client";

import Image from "next/image";

/**
 * Centralized app logo. To rebrand the logo, replace /public/logo.png
 * with a new 1:1 square image — every place that renders <AppLogo />
 * updates automatically. No other file needs to change.
 */
export default function AppLogo({
  size = 48,
  priority = false,
}: {
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="App Logo"
      width={size}
      height={size}
      priority={priority}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
