interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="InvoTrust logo"
      className={className}
    >
      <title>InvoTrust</title>
      <path d="M32 16 L52 23 V34 C52 47 43 55 32 59 C21 55 12 47 12 34 V23 Z" fill="#2563eb" />
      <path d="M23 38 L29.5 44.5 L41 30" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="22" y1="13" x2="32" y2="7" stroke="#7c3aed" strokeWidth="1.6" />
      <line x1="42" y1="13" x2="32" y2="7" stroke="#7c3aed" strokeWidth="1.6" />
      <line x1="22" y1="13" x2="42" y2="13" stroke="#7c3aed" strokeWidth="1.6" />
      <circle cx="32" cy="7" r="3.4" fill="#7c3aed" />
      <circle cx="22" cy="13" r="3.4" fill="#7c3aed" />
      <circle cx="42" cy="13" r="3.4" fill="#7c3aed" />
    </svg>
  );
}
