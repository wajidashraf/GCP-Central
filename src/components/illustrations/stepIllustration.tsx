export function StepsIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background glow */}
      <circle cx="160" cy="170" r="130" fill="var(--primary)" opacity="0.04" />

      {/* Connecting path */}
      <path
        d="M80 70v50c0 14 12 26 26 26h108c14 0 26 12 26 26v36c0 14-12 26-26 26H106c-14 0-26 12-26 26v50"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeDasharray="6 4"
        opacity="0.3"
      />

      {/* Step 1 circle */}
      <circle cx="80" cy="50" r="34" fill="var(--primary-light)" stroke="var(--primary)" strokeWidth="2.5" />
      <text x="80" y="44" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--primary)">Step</text>
      <text x="80" y="62" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--primary)">1</text>

      {/* Step 1 icon: clipboard */}
      <rect x="164" y="28" width="28" height="8" rx="4" fill="var(--accent)" opacity="0.4" />
      <rect x="164" y="40" width="42" height="6" rx="3" fill="var(--secondary)" opacity="0.25" />

      {/* Step 2 circle */}
      <circle cx="240" cy="170" r="34" fill="var(--accent-light)" stroke="var(--accent)" strokeWidth="2.5" />
      <text x="240" y="164" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--accent)">Step</text>
      <text x="240" y="182" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--accent)">2</text>

      {/* Step 2 icon: gear */}
      <circle cx="108" cy="156" r="8" fill="var(--primary)" opacity="0.12" />
      <circle cx="108" cy="156" r="4" fill="var(--primary)" opacity="0.25" />
      <circle cx="108" cy="184" r="5" fill="var(--accent)" opacity="0.2" />

      {/* Step 3 circle */}
      <circle cx="80" cy="290" r="34" fill="var(--secondary-light)" stroke="var(--secondary)" strokeWidth="2.5" />
      <text x="80" y="284" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--secondary)">Step</text>
      <text x="80" y="302" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--secondary)">3</text>

      {/* Checkmark at step 3 */}
      <path d="M152 282l8 8 16-18" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Decorative elements */}
      <circle cx="280" cy="60" r="5" fill="var(--accent)" opacity="0.35" />
      <circle cx="36" cy="170" r="4" fill="var(--primary)" opacity="0.25" />
      <circle cx="272" cy="270" r="6" fill="var(--secondary)" opacity="0.2" />

      {/* Sparkles */}
      <path d="M176 110h12M182 104v12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M200 240h10M205 235v10" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      {/* Graduation cap at top */}
      <path d="M268 104l-16-10-16 10 16 10 16-10Z" fill="var(--primary)" opacity="0.2" />
      <line x1="252" y1="104" x2="252" y2="120" stroke="var(--primary)" strokeWidth="1.5" opacity="0.2" />
    </svg>
  );
}
