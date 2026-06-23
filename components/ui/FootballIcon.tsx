// Reusable SVG football icon — proper black/white pentagon/hexagon pattern
// Use this anywhere you need a football icon (badge, navbar, etc.)
export function FootballSVG({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="3"
      />
      {/* Central pentagon */}
      <polygon points="50,28 64,38 59,55 41,55 36,38" fill="#1a1a1a" />
      {/* Top pentagon */}
      <polygon points="50,4 62,12 58,26 42,26 38,12" fill="#1a1a1a" />
      {/* Top-right pentagon */}
      <polygon points="75,16 85,28 78,42 65,40 63,26" fill="#1a1a1a" />
      {/* Bottom-right pentagon */}
      <polygon points="82,56 82,72 68,78 60,66 67,52" fill="#1a1a1a" />
      {/* Bottom-left pentagon */}
      <polygon points="18,56 33,52 40,66 32,78 18,72" fill="#1a1a1a" />
      {/* Top-left pentagon */}
      <polygon points="25,16 37,26 35,40 22,42 15,28" fill="#1a1a1a" />
      {/* Bottom pentagon */}
      <polygon points="50,96 38,88 42,74 58,74 62,88" fill="#1a1a1a" />
      {/* Shine highlight */}
      <ellipse
        cx="35"
        cy="32"
        rx="8"
        ry="5"
        fill="rgba(255,255,255,0.35)"
        transform="rotate(-30 35 32)"
      />
    </svg>
  );
}
