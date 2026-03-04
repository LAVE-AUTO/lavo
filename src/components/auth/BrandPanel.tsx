/**
 * Left-side branding panel for auth pages on desktop.
 * Displays logo, animated tagline, feature list, and a premium background.
 */

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    label: 'Réservation en temps réel',
    sub: 'Choisissez votre créneau en quelques secondes',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    label: 'Paiement sécurisé',
    sub: 'Transactions chiffrées via Stripe Connect',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Stations certifiées',
    sub: 'Chaque partenaire est vérifié et noté',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: 'Avis certifiés',
    sub: 'Notations vérifiées après chaque lavage',
  },
];

/**
 * Large decorative car SVG illustration for the brand panel.
 */
function CarIllustration() {
  return (
    <svg
      viewBox="0 0 280 160"
      fill="none"
      className="w-full max-w-[280px] animate-float"
      aria-hidden="true"
    >
      {/* Car body */}
      <path
        d="M30 110 L50 70 Q60 55 80 55 L200 55 Q220 55 230 70 L250 110 Z"
        fill="#1E2A1A"
        stroke="#C49A1E"
        strokeWidth="2"
      />
      {/* Roof */}
      <path
        d="M80 55 L100 25 Q110 15 130 15 L160 15 Q175 15 185 25 L200 55 Z"
        fill="#243020"
        stroke="#C49A1E"
        strokeWidth="1.5"
      />
      {/* Windows */}
      <path
        d="M95 52 L110 25 Q116 18 128 18 L155 18 Q166 18 172 25 L184 52 Z"
        fill="#2C3828"
        stroke="#C49A1E"
        strokeWidth="1"
        opacity="0.8"
      />
      {/* Door line */}
      <line x1="140" y1="55" x2="140" y2="108" stroke="#C49A1E" strokeWidth="1" opacity="0.5" />
      {/* Wheels */}
      <circle cx="80" cy="115" r="22" fill="#1A2116" stroke="#C49A1E" strokeWidth="2.5" />
      <circle cx="80" cy="115" r="10" fill="#C49A1E" opacity="0.25" />
      <circle cx="80" cy="115" r="4" fill="#C49A1E" />
      <circle cx="200" cy="115" r="22" fill="#1A2116" stroke="#C49A1E" strokeWidth="2.5" />
      <circle cx="200" cy="115" r="10" fill="#C49A1E" opacity="0.25" />
      <circle cx="200" cy="115" r="4" fill="#C49A1E" />
      {/* Ground shadow */}
      <ellipse cx="140" cy="140" rx="120" ry="8" fill="#0D1A0D" opacity="0.5" />
      {/* Water droplets */}
      <ellipse cx="60" cy="40" rx="3" ry="5" fill="#C49A1E" opacity="0.4" className="animate-gold-shimmer" />
      <ellipse cx="130" cy="10" rx="2.5" ry="4" fill="#C49A1E" opacity="0.3" className="animate-gold-shimmer animation-delay-300" />
      <ellipse cx="220" cy="35" rx="2" ry="4" fill="#C49A1E" opacity="0.35" className="animate-gold-shimmer animation-delay-500" />
    </svg>
  );
}

export function BrandPanel() {
  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        background:
          'linear-gradient(160deg, #0D1A0D 0%, #1A2116 45%, #243020 100%)',
      }}
    >
      {/* Background image overlay — swap /images/auth-bg.jpg for a real photo */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C49A1E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold animate-gold-shimmer" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">

        {/* Logo + wordmark */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-gold/40 flex items-center justify-center">
              <svg viewBox="0 0 36 36" fill="none" width="22" height="22" aria-hidden="true">
                <path d="M5 20l3-8h20l3 8" stroke="#C49A1E" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="4" y="18" width="28" height="10" rx="3" fill="#1A2116" stroke="#C49A1E" strokeWidth="1.5" />
                <circle cx="10" cy="28" r="3" fill="#C49A1E" />
                <circle cx="26" cy="28" r="3" fill="#C49A1E" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-widest uppercase">
              LAVO
            </span>
          </div>
        </div>

        {/* Center: illustration + headline */}
        <div className="flex flex-col items-center text-center gap-8">
          <CarIllustration />

          <div>
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight animate-fade-in-up animation-delay-100">
              Votre lavage auto,{' '}
              <span className="text-gold">quand vous voulez</span>
            </h2>
            <p className="mt-3 text-[15px] text-lavo-muted leading-relaxed animate-fade-in-up animation-delay-200">
              Réservez, payez et suivez votre lavage en quelques clics.
              <br />
              Une expérience premium, chaque fois.
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, i) => (
            <div
              key={feature.label}
              className={`flex items-start gap-3 animate-slide-in-left animation-delay-${(i + 3) * 100}`}
            >
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shrink-0">
                {feature.icon}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">{feature.label}</p>
                <p className="text-[12px] text-lavo-muted leading-snug">{feature.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
