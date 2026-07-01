import { discoverApiRoutes, type ApiRouteCategory } from "@/lib/api-docs/discover-routes";
import {
  apiErrorSchema,
  chatTurnRequestSchema,
  chatTurnResponseSchema,
  denisSenseRequestSchema,
  deliverectWebhookExampleSchema,
  schemaToOpenApi,
  stripeWebhookExampleSchema,
} from "@/lib/api-docs/schemas";

type OpenApiDoc = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string }>;
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
};

const CATEGORY_TAGS: Record<ApiRouteCategory, string> = {
  public: "Public (Guest)",
  authenticated: "Authenticated (Dashboard / Staff)",
  webhook: "Webhooks (Server-to-Server)",
  operator: "Operator API (External Integrations)",
  cron: "Cron (Internal)",
  jobs: "Jobs (QStash)",
  internal: "Internal",
};

const DOCUMENTED_PATHS: Record<string, Record<string, unknown>> = {
  "/api/ai/chat": {
    post: {
      summary: "Denis legacy chat turn",
      tags: ["Public (Guest)"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ChatTurnRequest" },
          },
        },
      },
      responses: {
        "200": {
          description: "Chat response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatTurnResponse" },
            },
          },
        },
        "429": { $ref: "#/components/responses/RateLimited" },
        "503": { $ref: "#/components/responses/CircuitOpen" },
      },
    },
  },
  "/api/denis/sense": {
    post: {
      summary: "Denis signal ingress (guest turn)",
      tags: ["Public (Guest)"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DenisSenseRequest" },
          },
        },
      },
      responses: {
        "200": { description: "Turn accepted" },
        "429": { $ref: "#/components/responses/RateLimited" },
      },
    },
  },
  "/api/denis/view": {
    get: {
      summary: "Denis view snapshot (poll)",
      tags: ["Public (Guest)"],
      parameters: [
        { name: "sessionToken", in: "query", required: true, schema: { type: "string" } },
      ],
      responses: { "200": { description: "View payload" } },
    },
  },
  "/api/stripe/webhook": {
    post: {
      summary: "Stripe Connect webhook",
      tags: ["Webhooks (Server-to-Server)"],
      description:
        "Receives Stripe events. Requires `Stripe-Signature` header. Raw body — not JSON middleware.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/StripeWebhookExample" },
            example: {
              id: "evt_123",
              type: "payment_intent.succeeded",
              data: { object: { id: "pi_123", amount: 1250, currency: "eur" } },
            },
          },
        },
      },
      responses: {
        "200": { description: "Event processed" },
        "400": { description: "Invalid signature" },
      },
    },
  },
  "/api/pos/deliverect/webhook": {
    post: {
      summary: "Deliverect POS webhook",
      tags: ["Webhooks (Server-to-Server)"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DeliverectWebhookExample" },
            example: { orderId: "ord_abc", status: "accepted", locationId: "loc_xyz" },
          },
        },
      },
      responses: { "200": { description: "Acknowledged" } },
    },
  },
  "/api/admin/health": {
    get: {
      summary: "Denis + platform health (staff auth)",
      tags: ["Authenticated (Dashboard / Staff)"],
      responses: { "200": { description: "Health snapshot" } },
    },
  },
};

function buildAutoPath(route: ReturnType<typeof discoverApiRoutes>[number]) {
  const tag = CATEGORY_TAGS[route.category];
  const item: Record<string, unknown> = {};
  for (const method of route.methods) {
    item[method.toLowerCase()] = {
      summary: `${method} ${route.path}`,
      tags: [tag],
      responses: {
        "200": { description: "Success" },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "500": { $ref: "#/components/responses/InternalError" },
      },
    };
  }
  return item;
}

/** Build OpenAPI 3.1 spec — Zod schemas are source of truth for documented bodies. */
export function buildOpenApiSpec(): OpenApiDoc {
  const routes = discoverApiRoutes();
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    paths[route.path] = DOCUMENTED_PATHS[route.path] ?? buildAutoPath(route);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Denis / QR Order API",
      version: "1.0.0",
      description:
        "API for guest ordering, Denis AI, staff dashboard, webhooks, and operator integrations. " +
        "Undocumented paths are auto-discovered from route files; key guest and webhook routes have full schemas.",
    },
    servers: [{ url: "/", description: "Current host" }],
    tags: Object.values(CATEGORY_TAGS).map((name) => ({ name })),
    paths,
    components: {
      schemas: {
        ApiError: schemaToOpenApi(apiErrorSchema, "ApiError"),
        ChatTurnRequest: schemaToOpenApi(chatTurnRequestSchema, "ChatTurnRequest"),
        ChatTurnResponse: schemaToOpenApi(chatTurnResponseSchema, "ChatTurnResponse"),
        DenisSenseRequest: schemaToOpenApi(denisSenseRequestSchema, "DenisSenseRequest"),
        StripeWebhookExample: schemaToOpenApi(stripeWebhookExampleSchema, "StripeWebhookExample"),
        DeliverectWebhookExample: schemaToOpenApi(
          deliverectWebhookExampleSchema,
          "DeliverectWebhookExample"
        ),
      },
      responses: {
        BadRequest: {
          description: "Invalid input",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                ok: false,
                error: {
                  code: "invalid_input",
                  message: "Invalid input.",
                  retryable: false,
                },
              },
            },
          },
        },
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        RateLimited: {
          description: "Too many requests",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                ok: false,
                error: {
                  code: "rate_limited",
                  message: "Too many requests.",
                  retryable: true,
                },
              },
            },
          },
        },
        CircuitOpen: {
          description: "AI circuit breaker open",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                ok: false,
                error: {
                  code: "circuit_open",
                  message: "AI temporarily unavailable.",
                  retryable: true,
                },
              },
            },
          },
        },
        InternalError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "sb-access-token",
          description: "Supabase staff session",
        },
        cronSecret: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Bearer CRON_SECRET",
        },
        qstashSignature: {
          type: "apiKey",
          in: "header",
          name: "Upstash-Signature",
          description: "QStash request signature",
        },
      },
    },
  };
}
