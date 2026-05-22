import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

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
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/dashboard/:path*"],
};
