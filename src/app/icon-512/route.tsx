import { renderAppIcon } from "@/lib/pwa/app-icon";

export const runtime = "edge";

export async function GET() {
  return renderAppIcon(512);
}
