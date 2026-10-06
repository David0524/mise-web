/* Mise herself, in her "happy" expression — the same artwork the app uses, not
   a redrawn approximation, so the character a visitor meets here is exactly the
   one they'll be cooking with. Inlined rather than imported because MiseApp is
   a client component and this page is static: pulling it in would drag the
   whole app bundle onto a page that needs none of it. */
export default function MiseHello({ size = 132, label = "Mise, your sous chef" }) {
  const CARD = "#FFFFFF";
  const INK = "#221A15";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}
      style={{ color: INK, filter: "drop-shadow(0 12px 24px rgba(34,26,21,.18))" }}>
      <path d="M17 24c-3.4 0-5.6-2.6-4.8-5.6.6-2.3 3-3.4 5-2.7.2-3.2 2.9-5.5 6.2-5.2 1.3-2.9 4.6-4.3 7.8-3.3 2.4-2.2 6.3-1.9 8.3.7 2.6-.8 5.4.6 6.3 3.1 2.2-.4 4.3 1 4.7 3.2.5 2.8-1.7 5.4-4.9 5.4z"
        fill={CARD} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M17 24h28.6v4.2H17z" fill={CARD} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M20 28.4h23c0 8.6-.9 13.4-4.2 16.2-2 1.7-4.3 2.3-7.3 2.3s-5.3-.6-7.3-2.3C20.9 41.8 20 37 20 28.4z"
        fill={CARD} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <g fill="currentColor">
        <circle cx="27.1" cy="37.4" r="1.85" />
        <circle cx="36.3" cy="37.4" r="1.85" />
      </g>
      <path d="M28 41.8c1.6 2.1 5.5 2.1 7.1 0" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M25.6 46.8l6.4 5.2 6.4-5.2 3.1 1.5-9.5 7.4-9.5-7.4z" fill="#B44722" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13 64c1.4-6.6 7-10.6 13.6-11.9L32 56l5.4-3.9C44 53.4 49.6 57.4 51 64z"
        fill={CARD} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M37.2 57.6l10.2 1.1-.5 4.1-10.2-1z" fill="#F0D9D5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

