import { ImageResponse } from "next/og";
import { DenisFaviconMark } from "@/lib/pwa/denis-favicon-mark";

export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
        }}
      >
        <DenisFaviconMark size={size} />
      </div>
    ),
    { width: size, height: size }
  );
}
