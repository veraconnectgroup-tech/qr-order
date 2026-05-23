import { ImageResponse } from "next/og";

export function QrMark({ scale }: { scale: number }) {
  const s = scale;
  return (
    <svg width={24 * s} height={24 * s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#09090b" />
      <rect x="14" y="3" width="7" height="7" rx="1" fill="#09090b" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="#09090b" />
      <rect x="5" y="5" width="3" height="3" fill="#f97316" />
      <rect x="16" y="5" width="3" height="3" fill="#f97316" />
      <rect x="5" y="16" width="3" height="3" fill="#f97316" />
      <rect x="14" y="14" width="3" height="3" fill="#09090b" />
      <rect x="18" y="14" width="3" height="3" fill="#09090b" />
      <rect x="14" y="18" width="3" height="3" fill="#09090b" />
      <rect x="18" y="18" width="3" height="3" fill="#f97316" />
    </svg>
  );
}

export function renderAppIcon(size: number) {
  const inner = Math.round(size * 0.55);
  const markScale = size / 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          borderRadius: size * 0.18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: inner,
            height: inner,
            borderRadius: size * 0.14,
            backgroundColor: "#f97316",
          }}
        >
          <QrMark scale={markScale * 0.75} />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
