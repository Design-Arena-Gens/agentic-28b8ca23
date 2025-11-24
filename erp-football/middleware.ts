import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifySessionOnEdge } from "@/lib/edge-session";

const ADMIN_PATH = "/admin";
const PLAYER_PATH = "/dashboard";
const LOGIN_PATH = "/login";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const session = await verifySessionOnEdge(request.cookies.get("session")?.value);

  if (pathname === LOGIN_PATH) {
    if (session) {
      const redirectPath = session.isAdmin ? ADMIN_PATH : PLAYER_PATH;
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(ADMIN_PATH) && !session.isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = PLAYER_PATH;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(PLAYER_PATH) && session.isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/admin/:path*"],
};
