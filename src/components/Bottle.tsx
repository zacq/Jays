const FLAVOUR: Record<string, string> = { Strawberry: "#ff4d6d", Ginger: "#e0a050", Pineapple: "#ffd23f", Honey: "#f5a300" };
const GLASS: Record<string, string> = { Vodka: "#9fc9ff", Gin: "#7fe0b0", Whisky: "#c9822a" };

export default function Bottle({ spirit, flavour, sizeMl, className = "h-40" }: { spirit: string; flavour: string; sizeMl: number; className?: string }) {
  const scale = sizeMl >= 750 ? 1 : sizeMl >= 200 ? 0.78 : 0.58;
  const glass = GLASS[spirit] ?? "#aaa";
  const accent = FLAVOUR[flavour] ?? "#f7b500";
  const id = `g-${spirit}-${flavour}-${sizeMl}`;
  return (
    <svg viewBox="0 0 120 200" className={className} role="img" aria-label={`${flavour} ${spirit} ${sizeMl}ml bottle`}>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor={glass} stopOpacity="0.35" />
          <stop offset="0.45" stopColor={glass} stopOpacity="0.85" />
          <stop offset="1" stopColor={glass} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="192" rx={34 * scale + 10} ry="5" fill="#000" opacity="0.4" />
      <g transform={`translate(60 190) scale(${scale}) translate(-60 -190)`}>
        <rect x="52" y="6" width="16" height="14" rx="3" fill="#222" stroke={accent} strokeWidth="1.5" />
        <path d="M54 20h12v28c0 10 22 18 22 40v96c0 4-3 6-6 6H38c-3 0-6-2-6-6V88c0-22 22-30 22-40z" fill={`url(#${id})`} stroke="#ffffff55" strokeWidth="1.5" />
        <rect x="34" y="104" width="52" height="60" rx="6" fill="#0d0d12" stroke={accent} strokeWidth="2" />
        <rect x="34" y="104" width="52" height="12" rx="6" fill={accent} />
        <text x="60" y="140" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="system-ui">
          {spirit.toUpperCase()}
        </text>
        <text x="60" y="154" textAnchor="middle" fontSize="8" fontWeight="700" fill={accent} fontFamily="system-ui">
          {flavour.toUpperCase()}
        </text>
        <text x="60" y="113" textAnchor="middle" fontSize="8" fontWeight="900" fill="#000" fontFamily="system-ui">
          {sizeMl}ML
        </text>
      </g>
    </svg>
  );
}
