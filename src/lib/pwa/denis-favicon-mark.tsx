/**
 * Denis app icon — black squircle, white frame, Table D mark (ADR-007 spatial v4).
 * Same geometry as {@link DenisTableMark}; monochrome for favicon / PWA.
 */
export function DenisFaviconMark({ size }: { size: number }) {
  const inset = Math.round(size * 0.125);
  const inner = size - inset * 2;
  const outerRx = Math.round(size * 0.14);
  const frameRx = Math.round(size * 0.2);
  const stroke = Math.max(1.5, size * 0.0625);
  const markPx = Math.round(size * 0.44);
  const markOff = Math.round((size - markPx) / 2);
  const markStroke = (2.25 * markPx) / 24;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#000000" rx={outerRx} />
      <rect
        x={inset}
        y={inset}
        width={inner}
        height={inner}
        rx={frameRx}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={stroke}
      />
      <g transform={`translate(${markOff} ${markOff})`}>
        <svg width={markPx} height={markPx} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 4v16"
            stroke="#FFFFFF"
            strokeWidth={markStroke}
            strokeLinecap="round"
          />
          <path
            d="M6 4h10"
            stroke="#FFFFFF"
            strokeWidth={markStroke}
            strokeLinecap="round"
          />
          <path
            d="M16 4v9"
            stroke="#FFFFFF"
            strokeWidth={markStroke}
            strokeLinecap="round"
          />
          <path
            d="M16 13L6 20"
            stroke="#FFFFFF"
            strokeWidth={markStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </g>
    </svg>
  );
}
