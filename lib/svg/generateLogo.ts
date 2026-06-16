/**
 * Generates a deterministic procedural SVG club logo.
 * Shield shape with team initials and color scheme.
 * Fully deterministic: same team name always produces same logo.
 */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const SHIELD_PATTERNS = [
  // Horizontal split
  (c1: string, c2: string) =>
    `<path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z" fill="${c2}"/>
     <path d="M10,20 L90,20 L90,50 L10,50Z" fill="${c1}"/>`,
  // Diagonal
  (c1: string, c2: string) =>
    `<path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z" fill="${c2}"/>
     <path d="M10,20 L90,20 L10,110 Q10,90 10,60Z" fill="${c1}"/>`,
  // Vertical split
  (c1: string, c2: string) =>
    `<path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z" fill="${c2}"/>
     <path d="M10,20 L50,20 L50,110 Q10,90 10,60Z" fill="${c1}"/>`,
  // Quarters
  (c1: string, c2: string) =>
    `<path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z" fill="${c2}"/>
     <path d="M10,20 L50,20 L50,65 L10,65Z" fill="${c1}"/>
     <path d="M50,65 L90,65 L90,60 Q90,90 50,110Z" fill="${c1}"/>`,
];

const ACCENT_COLORS = ["#ffd700", "#ffffff", "#c0c0c0", "#ff9800", "#4fc3f7"];

export function generateClubLogo(params: {
  name: string;
  primaryColor: string;
}): string {
  const { name, primaryColor } = params;
  const seed = hashStr(name);

  // Derive secondary / accent colors
  const hue2 = (parseInt(primaryColor.slice(1), 16) >> 8) % 360;
  const accentIdx = seed % ACCENT_COLORS.length;
  const accent = ACCENT_COLORS[accentIdx];

  // Pattern selection
  const pattern = SHIELD_PATTERNS[seed % SHIELD_PATTERNS.length](primaryColor, darken(primaryColor));

  // Initials (up to 3 chars from significant words)
  const words = name.replace(/\b(FC|United|City|Town|Athletic|Rovers|Wanderers|Cove)\b/gi, "").trim().split(/\s+/);
  const initials = words
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
<defs>
  <filter id="sh${seed}"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/></filter>
  <filter id="glow${seed}"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="shield${seed}">
    <path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z"/>
  </clipPath>
</defs>
<!-- Shield base -->
<g filter="url(#sh${seed})">
  <g clip-path="url(#shield${seed})">
    ${pattern}
  </g>
  <!-- Shield outline -->
  <path d="M10,20 L90,20 L90,60 Q90,90 50,110 Q10,90 10,60Z" fill="none" stroke="${accent}" stroke-width="2.5"/>
</g>
<!-- Top banner -->
<rect x="10" y="8" width="80" height="14" rx="3" fill="${primaryColor}"/>
<path d="M10,8 L90,8 L90,20 L10,20Z" fill="${primaryColor}"/>
<!-- Team name abbreviated at top -->
<text x="50" y="18" text-anchor="middle" font-size="7" font-family="Oswald,sans-serif" font-weight="700" fill="${accent}" letter-spacing="1">${name.split(" ")[0].toUpperCase()}</text>
<!-- Large initials -->
<text x="50" y="75" text-anchor="middle" font-size="${initials.length > 2 ? 22 : 28}" font-family="Oswald,sans-serif" font-weight="700" fill="${accent}" opacity="0.95" letter-spacing="2" filter="url(#glow${seed})">${initials}</text>
<!-- Divider line -->
<line x1="25" y1="82" x2="75" y2="82" stroke="${accent}" stroke-width="0.8" opacity="0.5"/>
<!-- Star at bottom of shield -->
<polygon points="50,90 52,96 58,96 53,100 55,106 50,102 45,106 47,100 42,96 48,96" fill="${accent}" opacity="0.8"/>
</svg>`;
}

/** Darkens a hex color by ~25% for secondary shield fill */
function darken(hex: string): string {
  try {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - 50);
    const g = Math.max(0, ((n >> 8) & 0xff) - 50);
    const b = Math.max(0, (n & 0xff) - 50);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return "#111";
  }
}
