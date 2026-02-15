interface RQuotasLogoProps {
  size?: number;
  className?: string;
  variant?: "dark" | "light";
}

export function RQuotasLogo({ size = 36, className = "", variant = "dark" }: RQuotasLogoProps) {
  const bgColor = variant === "dark" ? "#1a1f2b" : "#ffffff";
  const accentColor = "#2d7a4f";
  const textColor = variant === "dark" ? "#ffffff" : "#1a1f2b";
  const subtleColor = variant === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-testid="img-rquotas-logo"
    >
      <rect x="0.5" y="0.5" width="43" height="43" rx="10" fill={bgColor} stroke={accentColor} strokeWidth="1" />

      <rect x="4" y="28" width="36" height="2.5" rx="1.25" fill={subtleColor} />

      <path
        d="M10 28 L22 14 L34 28"
        stroke={accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <line x1="22" y1="14" x2="22" y2="28" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

      <text
        x="22"
        y="40"
        fill={textColor}
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="8.5"
        letterSpacing="1.5"
        textAnchor="middle"
      >
        RQ
      </text>
    </svg>
  );
}
