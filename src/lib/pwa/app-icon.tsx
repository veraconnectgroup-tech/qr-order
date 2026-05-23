import { ImageResponse } from "next/og";
import { QrMark } from "@/lib/pwa/qr-mark";

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
