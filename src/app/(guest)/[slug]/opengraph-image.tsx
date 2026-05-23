import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";
import { DEMO_GUEST_SLUG } from "@/lib/demo-guest";

export const runtime = "edge";
export const alt = "Venue menu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function GuestVenueOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let orgName = "Restaurant";
  let tagline = "Scan · Order · Pay";

  if (slug === DEMO_GUEST_SLUG) {
    orgName = "Skyline Lounge";
    tagline = "Live demo menu";
  } else {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("slug", slug)
        .maybeSingle();
      if (data) orgName = (data as { name: string }).name;
    } catch {
      // keep defaults
    }
  }

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
            "radial-gradient(circle at 15% 0%, rgba(249,115,22,0.22), transparent 45%), radial-gradient(circle at 85% 100%, rgba(249,115,22,0.14), transparent 42%)",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#09090b",
            }}
          >
            {orgName.charAt(0).toUpperCase()}
          </div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#a1a1aa",
              letterSpacing: "-0.02em",
            }}
          >
            QR Order
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#fafafa",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            {orgName}
          </div>
          <div style={{ fontSize: 32, color: "#f97316", fontWeight: 600 }}>
            Menu
          </div>
          <div style={{ fontSize: 22, color: "#a1a1aa", maxWidth: 720 }}>
            {tagline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 22px",
            borderRadius: 999,
            border: "1px solid #3f3f46",
            backgroundColor: "rgba(24,24,27,0.85)",
            color: "#e4e4e7",
            fontSize: 18,
            fontWeight: 500,
            alignSelf: "flex-start",
          }}
        >
          No app · No registration
        </div>
      </div>
    ),
    { ...size }
  );
}
