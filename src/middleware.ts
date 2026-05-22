import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function isProtectedPath(path: string) {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/api/dashboard")
  );
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const env = getSupabaseEnv();

  if (!env) {
    if (isProtectedPath(path)) {
      const login = new URL("/login", req.url);
      login.searchParams.set("error", "config");
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });

  try {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      const { data: staff } = await supabase
        .from("staff")
        .select("role, org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) {
        return NextResponse.redirect(
          new URL("/login?error=no_access", req.url)
        );
      }

      if (path.startsWith("/admin")) {
        const role = (staff as { role: string }).role;
        if (!["owner", "manager"].includes(role)) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      }
    }

    if (path.startsWith("/api/dashboard")) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return res;
  } catch {
    if (isProtectedPath(path)) {
      return NextResponse.redirect(new URL("/login?error=auth", req.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/dashboard/:path*",
    "/login",
    "/signup",
    "/auth/callback",
  ],
};
