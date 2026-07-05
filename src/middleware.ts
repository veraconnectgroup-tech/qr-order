import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { TRACE_HEADER, getTraceId } from "@/lib/resilience/trace-id";
import { isGuestQrPath } from "@/lib/pwa/guest-route";
import {
  loadMiddlewareStaffAccess,
  redirectToPrimarySurface,
} from "@/lib/auth/middleware-staff-access";
import {
  pathNeedsStaffAuth,
  pathnameToSurface,
} from "@/lib/auth/surface-routing";

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
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // microphone=(self) — guest voice input (concierge mic) and station voice
  // replies both use SpeechRecognition, which this header was blocking
  // outright (Web Speech API surfaces that as a silent "not-allowed" error,
  // not a permission prompt, since the policy denies it before the browser
  // ever asks the user).
  "Permissions-Policy":
    "camera=(), microphone=(self), geolocation=(), payment=(self)",
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

function withResponseHeaders(response: NextResponse, cors: boolean, pathname?: string) {
  if (cors) applyCorsHeaders(response);
  if (pathname && isGuestQrPath(pathname)) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
  }
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

function redirectTo(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  copyCookies(supabaseResponse, redirect);
  return withResponseHeaders(redirect, false);
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

  if (!pathNeedsStaffAuth(pathname)) {
    const response = withTraceHeaders(request);
    return withResponseHeaders(response, false, pathname);
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

  const isProtectedStaffPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/bar") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/fiscal");

  if (isProtectedStaffPath && !user && !pathname.startsWith("/waiter/login")) {
    const loginPath = pathname.startsWith("/waiter") ? "/waiter/login" : "/login";
    return redirectTo(request, supabaseResponse, loginPath);
  }

  if (pathname === "/waiter/login" && user) {
    const access = await loadMiddlewareStaffAccess(supabase, user.id);
    const target =
      access?.primarySurface === "waiter"
        ? "/waiter"
        : access
          ? redirectToPrimarySurface(access)
          : "/waiter";
    return redirectTo(request, supabaseResponse, target);
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const access = await loadMiddlewareStaffAccess(supabase, user.id);
    if (access) {
      return redirectTo(
        request,
        supabaseResponse,
        redirectToPrimarySurface(access)
      );
    }

    if (pathname === "/login") {
      return withResponseHeaders(supabaseResponse, false);
    }
  }

  if (user && !pathname.startsWith("/waiter/login")) {
    const targetSurface = pathnameToSurface(pathname);
    if (targetSurface) {
      const access = await loadMiddlewareStaffAccess(supabase, user.id);
      if (access && !access.allowedSurfaces.includes(targetSurface)) {
        return redirectTo(
          request,
          supabaseResponse,
          redirectToPrimarySurface(access)
        );
      }
    }
  }

  return withResponseHeaders(supabaseResponse, false);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|push-sw.js|workbox|manifest.webmanifest|icon-192|icon-512|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
