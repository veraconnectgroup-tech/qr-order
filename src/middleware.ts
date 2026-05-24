import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { TRACE_HEADER, getTraceId } from "@/lib/resilience/trace-id";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-session-token, X-API-Key, x-trace-id",
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.upstash.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(self)",
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
};

function applySecurityHeaders(response: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function applyCorsHeaders(response: NextResponse) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function withResponseHeaders(response: NextResponse, cors: boolean) {
  if (cors) applyCorsHeaders(response);
  return applySecurityHeaders(response);
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

function withTraceHeaders(request: NextRequest) {
  const traceId = getTraceId(request);
  Sentry.setTag("trace_id", traceId);
  Sentry.addBreadcrumb({
    category: "trace",
    message: `trace_id=${traceId}`,
    level: "info",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TRACE_HEADER, traceId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(TRACE_HEADER, traceId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  if (pathname.startsWith("/api/health")) {
    const response = withTraceHeaders(request);
    return withResponseHeaders(response, true);
  }

  if (isApiRoute) {
    if (request.method === "OPTIONS") {
      const traced = withTraceHeaders(request);
      return withResponseHeaders(
        new NextResponse(null, { status: 204, headers: traced.headers }),
        true
      );
    }

    const response = withTraceHeaders(request);
    return withResponseHeaders(response, true);
  }

  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/platform") ||
    pathname === "/login" ||
    pathname === "/signup";

  if (!needsAuth) {
    const response = withTraceHeaders(request);
    return withResponseHeaders(response, false);
  }

  let supabaseResponse = withTraceHeaders(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = withTraceHeaders(request);
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/waiter") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/platform")) &&
    !user &&
    !pathname.startsWith("/waiter/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/waiter") ? "/waiter/login" : "/login";
    const redirect = NextResponse.redirect(url);
    copyCookies(supabaseResponse, redirect);
    return withResponseHeaders(redirect, false);
  }

  if (pathname === "/waiter/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/waiter";
    const redirect = NextResponse.redirect(url);
    copyCookies(supabaseResponse, redirect);
    return withResponseHeaders(redirect, false);
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id, role")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (staff) {
      const url = request.nextUrl.clone();
      url.pathname =
        (staff as { role: string }).role === "waiter" ? "/waiter" : "/dashboard";
      const redirect = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirect);
      return withResponseHeaders(redirect, false);
    }

    if (pathname === "/login") {
      return withResponseHeaders(supabaseResponse, false);
    }
  }

  return withResponseHeaders(supabaseResponse, false);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|push-sw.js|workbox|manifest.webmanifest|icon-192|icon-512|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
