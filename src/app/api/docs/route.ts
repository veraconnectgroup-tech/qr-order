import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaffRateLimit } from "@/lib/rate-limit";

async function canAccessDocs(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const staff = await getCurrentStaff();
  return staff !== null;
}

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Denis API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`;

export const GET = withErrorHandler("api-docs-swagger-get", async (req) => {
  const limited = await withStaffRateLimit(req);
  if (limited) return limited;

  if (!(await canAccessDocs())) {
    return apiError("Unauthorized.", 401);
  }
  return new Response(SWAGGER_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
