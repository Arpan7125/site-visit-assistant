import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, HEAD_ONLY, type StaffRole } from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * First line of defence for staff areas. Every admin page and API handler checks the role
 * again on the server (src/lib/authz.ts); this only gives a clean redirect or 401/403.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const role = (req.auth?.user as { role?: StaffRole } | undefined)?.role;

  if (!role) {
    if (isApi) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (role !== "SALES_HEAD" && HEAD_ONLY.some((re) => re.test(pathname))) {
    if (isApi) return NextResponse.json({ error: "Sales head only" }, { status: 403 });
    return NextResponse.redirect(new URL("/admin/leads?denied=1", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
