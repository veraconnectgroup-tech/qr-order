import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

function QrMark() {
  return (
    <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
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

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 128,
            height: 128,
            borderRadius: 28,
            backgroundColor: "#f97316",
          }}
        >
          <QrMark />
        </div>
      </div>
    ),
    { ...size }
  );
}
