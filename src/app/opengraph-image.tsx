import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QR Order Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(249,115,22,0.18), transparent 42%), radial-gradient(circle at 80% 100%, rgba(249,115,22,0.12), transparent 40%)",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
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
          </div>
          <span
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: "#fafafa",
              letterSpacing: "-0.02em",
            }}
          >
            QR Order
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              color: "#fafafa",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: 900,
            }}
          >
            Enterprise ordering for hospitality
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#a1a1aa",
              lineHeight: 1.4,
              maxWidth: 820,
            }}
          >
            Scan. Order. Pay. Live kitchen ops and Stripe payments for
            restaurants, bars, and hotel F&B.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["KassenSichV", "DATEV", "Stripe Connect", "Made in Germany"].map(
            (badge) => (
              <div
                key={badge}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid #3f3f46",
                  backgroundColor: "rgba(24,24,27,0.8)",
                  color: "#e4e4e7",
                  fontSize: 18,
                  fontWeight: 500,
                }}
              >
                {badge}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
