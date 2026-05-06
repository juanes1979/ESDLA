/**
 * CampaignBanner — escudo de armas / estandarte auto-generado a partir de
 * un seed determinista (`bannerSeed`, normalmente los primeros 8 chars del
 * run id). Se compone de:
 *   - Tinte de fondo del escudo (3 colores temáticos rotando por seed)
 *   - Charge: símbolo central elegido del seed (espada, anillo, hoja,
 *     árbol, montaña, ojo, corona, estrella, lobo, dragón)
 *   - "Cinta dorada de COMPLETA" (overlay) cuando `full=true`
 *   - Animación de ondeo cuando `full=true` (`bannerWave` keyframe)
 *
 * Props:
 *   bannerSeed: string (8 chars hex)
 *   region: string opcional (matiza paleta)
 *   full: boolean (activa cinta + ondeo)
 *   size: number (px; default 80)
 *
 * Uso: <CampaignBanner bannerSeed={listing.banner_seed} full={...} />
 */
import { useMemo } from 'react';

// 5 paletas temáticas (norte, gris, mordor, lothlorien, rohan)
const PALETTES = [
  { bg: '#1a3a5c', stroke: '#7eb6e8', glow: '#3d7ab5', name: 'azur' },
  { bg: '#3a3a3a', stroke: '#c0c0c0', glow: '#6e6e6e', name: 'plata' },
  { bg: '#5a1818', stroke: '#e89a4a', glow: '#a83838', name: 'gules' },
  { bg: '#1d4321', stroke: '#a8d484', glow: '#4a7c47', name: 'sinople' },
  { bg: '#5a3a0c', stroke: '#f0c87a', glow: '#a87830', name: 'oro' },
];

// 10 charges (símbolos centrales) — pintados con paths SVG simples.
const CHARGES = [
  // sword
  (color) => (
    <g stroke={color} fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="50" y1="20" x2="50" y2="78" />
      <line x1="38" y1="32" x2="62" y2="32" />
      <line x1="46" y1="78" x2="54" y2="78" />
    </g>
  ),
  // ring
  (color) => (
    <circle cx="50" cy="50" r="18" fill="none" stroke={color} strokeWidth="4" />
  ),
  // leaf
  (color) => (
    <path d="M50,22 C30,40 30,60 50,80 C70,60 70,40 50,22 Z" fill={color} stroke={color} strokeWidth="1.5" opacity="0.85" />
  ),
  // tree
  (color) => (
    <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round">
      <line x1="50" y1="50" x2="50" y2="78" />
      <path d="M30,52 L50,22 L70,52 Z" fill={color} opacity="0.6" />
      <path d="M34,42 L50,18 L66,42 Z" fill={color} opacity="0.6" />
    </g>
  ),
  // mountain
  (color) => (
    <g stroke={color} strokeWidth="3" fill={color} fillOpacity="0.55">
      <path d="M22,72 L42,38 L52,52 L62,32 L78,72 Z" />
    </g>
  ),
  // eye
  (color) => (
    <g stroke={color} fill={color} strokeWidth="2">
      <ellipse cx="50" cy="50" rx="22" ry="10" fill="none" />
      <circle cx="50" cy="50" r="5" />
    </g>
  ),
  // crown
  (color) => (
    <g stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.7">
      <path d="M28,60 L36,38 L44,54 L50,32 L56,54 L64,38 L72,60 Z" />
      <line x1="28" y1="64" x2="72" y2="64" />
    </g>
  ),
  // star
  (color) => (
    <polygon
      points="50,22 56,42 78,42 60,55 66,76 50,62 34,76 40,55 22,42 44,42"
      fill={color}
      fillOpacity="0.7"
      stroke={color}
      strokeWidth="2"
    />
  ),
  // wolf head
  (color) => (
    <g stroke={color} strokeWidth="2.5" fill="none">
      <path d="M30,42 L26,30 L42,38 L50,32 L58,38 L74,30 L70,42 L70,62 L58,72 L42,72 L30,62 Z" fill={color} fillOpacity="0.5" />
      <circle cx="42" cy="50" r="2" fill={color} />
      <circle cx="58" cy="50" r="2" fill={color} />
    </g>
  ),
  // dragon (stylized chevron with wings)
  (color) => (
    <g stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.55">
      <path d="M50,28 L62,46 L78,42 L66,54 L72,72 L50,60 L28,72 L34,54 L22,42 L38,46 Z" />
    </g>
  ),
];

const seedInt = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
};

const CampaignBanner = ({ bannerSeed = 'default', region = null, full = false, size = 80 }) => {
  const { palette, charge, divisionType } = useMemo(() => {
    const h = seedInt(bannerSeed);
    return {
      palette: PALETTES[h % PALETTES.length],
      charge: CHARGES[(h >> 3) % CHARGES.length],
      divisionType: (h >> 6) % 4, // 0=plain, 1=horizontal, 2=diagonal, 3=cross
    };
  }, [bannerSeed]);

  return (
    <div
      className={`relative inline-block ${full ? 'banner-wave' : ''}`}
      style={{ width: size, height: size * 1.18 }}
      data-testid={`campaign-banner-${bannerSeed}`}
    >
      <svg viewBox="0 0 100 118" width={size} height={size * 1.18}>
        <defs>
          <linearGradient id={`grad-${bannerSeed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.glow} />
            <stop offset="100%" stopColor={palette.bg} />
          </linearGradient>
          <filter id={`glow-${bannerSeed}`}>
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Shield silhouette */}
        <path
          d="M10,8 L90,8 L90,60 Q90,90 50,108 Q10,90 10,60 Z"
          fill={`url(#grad-${bannerSeed})`}
          stroke={palette.stroke}
          strokeWidth="2.5"
        />
        {/* Heraldic divisions */}
        {divisionType === 1 && (
          <line x1="10" y1="58" x2="90" y2="58" stroke={palette.stroke} strokeWidth="1.5" />
        )}
        {divisionType === 2 && (
          <line x1="14" y1="12" x2="86" y2="100" stroke={palette.stroke} strokeWidth="1.5" />
        )}
        {divisionType === 3 && (
          <>
            <line x1="50" y1="8" x2="50" y2="108" stroke={palette.stroke} strokeWidth="1" />
            <line x1="10" y1="58" x2="90" y2="58" stroke={palette.stroke} strokeWidth="1" />
          </>
        )}
        {/* Charge */}
        <g filter={`url(#glow-${bannerSeed})`} transform="translate(0, 5)">{charge(palette.stroke)}</g>
        {/* Bottom rivets */}
        <circle cx="22" cy="14" r="2" fill={palette.stroke} opacity="0.7" />
        <circle cx="78" cy="14" r="2" fill={palette.stroke} opacity="0.7" />
      </svg>

      {full && (
        <div className="banner-full-ribbon" data-testid="banner-full-ribbon">
          COMPLETA
        </div>
      )}

      <style>{`
        @keyframes bannerWave {
          0%, 100% { transform: rotate(-1.2deg) translateY(0); }
          25%      { transform: rotate(0.8deg) translateY(-1px); }
          50%      { transform: rotate(1.5deg) translateY(0); }
          75%      { transform: rotate(-0.4deg) translateY(1px); }
        }
        .banner-wave { animation: bannerWave 3s ease-in-out infinite; transform-origin: 50% 5%; }
        .banner-full-ribbon {
          position: absolute;
          top: 38%;
          left: -8%;
          right: -8%;
          background: linear-gradient(90deg, #d4a050 0%, #f6d97a 50%, #d4a050 100%);
          color: #3a2008;
          font-family: var(--font-heading, 'Cinzel', serif);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-align: center;
          padding: 3px 0;
          transform: rotate(-8deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.45);
          border-top: 1px solid rgba(255,255,255,0.4);
          border-bottom: 1px solid rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default CampaignBanner;
