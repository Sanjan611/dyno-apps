import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware for route protection and session management.
 * Uses the publishable key (sb_publishable_...) for authentication checks.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/signup", "/api/waitlist"];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/auth/callback");

  // Set-password route (requires auth but is special case)
  const isSetPasswordRoute = pathname === "/set-password";

  // Protected routes
  const protectedRoutes = ["/builder", "/project-gallery", "/admin"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // This should be your publishable key
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user needs password setup (invited users only)
  const isInvitedUser = user?.user_metadata?.invited === true;
  const passwordSet = user?.user_metadata?.password_set === true;
  const needsPasswordSetup = isInvitedUser && !passwordSet;

  // Handle /set-password route
  if (isSetPasswordRoute) {
    if (!user) {
      // No user - redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!needsPasswordSetup) {
      // User doesn't need password setup - redirect to home
      return NextResponse.redirect(new URL("/", request.url));
    }
    // User needs password setup - allow access
    return supabaseResponse;
  }

  // If accessing a protected route and not authenticated, redirect to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated but needs password setup, redirect to set-password
  if (isProtectedRoute && user && needsPasswordSetup) {
    return NextResponse.redirect(new URL("/set-password", request.url));
  }

  // Admin route protection - check if user is in ADMIN_EMAILS
  if (pathname.startsWith("/admin") && user) {
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) =>
      e.trim().toLowerCase()
    );

    if (
      !adminEmails ||
      adminEmails.length === 0 ||
      !user.email ||
      !adminEmails.includes(user.email.toLowerCase())
    ) {
      // Not an admin - redirect to home
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // If authenticated user tries to access login/signup, redirect appropriately
  if ((pathname === "/login" || pathname === "/signup") && user) {
    // If user needs password setup, redirect to set-password
    if (needsPasswordSetup) {
      return NextResponse.redirect(new URL("/set-password", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

