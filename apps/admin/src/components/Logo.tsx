// Continue Leads mark — three ascending wave-bars (progressive publishing) with a
// rising continuation arrow (growth / "continue"). Amber on transparent.
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="clAmber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7C25E" />
          <stop offset="1" stopColor="#F5B23D" />
        </linearGradient>
      </defs>
      {/* ascending wave bars */}
      <rect x="4.5" y="19" width="5" height="9" rx="2.5" fill="url(#clAmber)" opacity="0.5" />
      <rect x="13.5" y="14" width="5" height="14" rx="2.5" fill="url(#clAmber)" opacity="0.72" />
      <rect x="22.5" y="8" width="5" height="20" rx="2.5" fill="url(#clAmber)" />
      {/* rising continuation trend line + arrowhead */}
      <path d="M5 20 L16 14 L25 6.5" stroke="#F7C25E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 6 L25.4 6.2 L25 11" stroke="#F7C25E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ size = 28, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className="inline-flex items-center justify-center rounded-[8px]"
        style={{ width: size + 12, height: size + 12, background: "#12181F", border: "1px solid var(--line)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <LogoMark size={size} />
      </span>
      {showWord && (
        <span className="font-display text-[17px] font-bold leading-none tracking-tight">
          <span style={{ color: "var(--ink)" }}>Continue</span>
          <span style={{ color: "var(--amber)" }}>Leads</span>
        </span>
      )}
    </span>
  );
}
