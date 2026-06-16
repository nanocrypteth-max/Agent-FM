/**
 * Generates a deterministic procedural SVG avatar for a player.
 * No external API needed — output is a compact inline SVG string.
 * Style: dApp-style hexagon with position color coding + star rating.
 */

const POSITION_COLORS: Record<string, { bg: string; accent: string }> = {
  GK: { bg: "#1a472a", accent: "#ffd700" },
  DF: { bg: "#1a2a47", accent: "#4fc3f7" },
  MF: { bg: "#2d1b47", accent: "#ce93d8" },
  FW: { bg: "#471a1a", accent: "#ff5252" },
};

const SKIN_TONES = ["#FDDBB4", "#F5C89A", "#E8A87C", "#C68642", "#8D5524", "#4A2912"];
const HAIR_COLORS = ["#1a1a1a", "#4a3728", "#8B6914", "#C4932F", "#D44000", "#E8C96D"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function stars(count: number, total = 5): string {
  return Array.from({ length: total }, (_, i) => {
    const x = 8 + i * 14;
    return i < count
      ? `<polygon points="${x},4 ${x+2},9 ${x+7},9 ${x+3},12 ${x+4.5},17 ${x},14 ${x-4.5},17 ${x-3},12 ${x-7},9 ${x-2},9" fill="#ffd700"/>`
      : `<polygon points="${x},4 ${x+2},9 ${x+7},9 ${x+3},12 ${x+4.5},17 ${x},14 ${x-4.5},17 ${x-3},12 ${x-7},9 ${x-2},9" fill="none" stroke="#555" stroke-width="0.8"/>`;
  }).join("");
}

export function generatePlayerAvatar(params: {
  name: string;
  position: string;
  jerseyColor: string;
  starRating: number;
}): string {
  const { name, position, jerseyColor, starRating } = params;
  const seed = hashStr(name + position);
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = HAIR_COLORS[(seed >> 3) % HAIR_COLORS.length];
  const pc = POSITION_COLORS[position] ?? POSITION_COLORS.MF;
  const lastName = name.split(" ").pop()?.toUpperCase().slice(0, 10) ?? name;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130">
<defs>
  <linearGradient id="g${seed}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${pc.bg}"/>
    <stop offset="100%" stop-color="#070a0f"/>
  </linearGradient>
  <filter id="gf${seed}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="100" height="130" fill="#0d1117" rx="10"/>
<polygon points="50,6 88,28 88,82 50,104 12,82 12,28" fill="url(#g${seed})"/>
<polygon points="50,6 88,28 88,82 50,104 12,28 12,82" fill="none" stroke="${pc.accent}" stroke-width="1.5" opacity="0.6" filter="url(#gf${seed})"/>
<ellipse cx="50" cy="64" rx="22" ry="24" fill="${jerseyColor}" opacity="0.9"/>
<rect x="28" y="64" width="44" height="32" fill="${jerseyColor}" rx="3"/>
<rect x="44" y="64" width="12" height="32" fill="rgba(255,255,255,0.1)"/>
<ellipse cx="50" cy="48" rx="14" ry="16" fill="${skin}"/>
<ellipse cx="50" cy="34" rx="15" ry="9" fill="${hair}"/>
<rect x="35" y="34" width="30" height="9" fill="${hair}"/>
<circle cx="44" cy="46" r="2" fill="#111"/>
<circle cx="56" cy="46" r="2" fill="#111"/>
<circle cx="44.8" cy="45.2" r="0.7" fill="white"/>
<circle cx="56.8" cy="45.2" r="0.7" fill="white"/>
<path d="M45,55 Q50,59 55,55" fill="none" stroke="#a0785a" stroke-width="1" stroke-linecap="round"/>
<rect x="0" y="105" width="100" height="16" fill="rgba(0,0,0,0.75)" rx="0"/>
<text x="50" y="116.5" text-anchor="middle" font-size="7.5" font-family="Oswald,sans-serif" fill="#e8ecf1" letter-spacing="0.8">${lastName}</text>
<rect x="2" y="89" width="20" height="11" rx="3" fill="${pc.accent}"/>
<text x="12" y="97.5" text-anchor="middle" font-size="6.5" font-family="Oswald,sans-serif" font-weight="700" fill="#0a0d12">${position}</text>
<g transform="translate(20,109)">${stars(starRating)}</g>
</svg>`;
}
