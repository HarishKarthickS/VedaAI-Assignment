import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const signedIn = request.cookies.has("veda_access");
  if (!signedIn) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/assignments/:path*", "/workspace/:path*", "/settings/:path*"],
};
