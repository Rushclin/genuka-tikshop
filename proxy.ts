import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifyJwt } from "./lib/auth";
import { SignJWT } from "jose";
import { generateHmac } from "./lib/hmac";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const url = new URL(request.url);
  const hasHmacParams =
    url.searchParams.has("company_id") &&
    url.searchParams.has("timestamp") &&
    url.searchParams.has("hmac");

  if (hasHmacParams) {
    const companyId = url.searchParams.get("company_id")!;
    const timestamp = url.searchParams.get("timestamp")!;
    const hmac = url.searchParams.get("hmac")!;

    try {
      const timestampAge = Date.now() - parseInt(timestamp) * 1000;
      if (timestampAge > 5 * 60 * 1000) {
        console.error("HMAC verification error: Request expired");
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      const expectedHmac = await generateHmac(companyId, timestamp);

      if (hmac !== expectedHmac) {
        console.error("HMAC verification error: Invalid HMAC");
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      const secret = new TextEncoder().encode(
        process.env.GENUKA_CLIENT_SECRET!
      );
      const token = await new SignJWT({ companyId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7h")
        .sign(secret);

      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete("company_id");
      cleanUrl.searchParams.delete("timestamp");
      cleanUrl.searchParams.delete("hmac");

      const response = NextResponse.redirect(cleanUrl);
      const isProd = process.env.NODE_ENV === "production";

      response.cookies.set("session", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 7, // 7 heures
        // domain: isProd ? 'app-templates.genuka.com' : undefined,
      });

      return response;
    } catch (error) {
      console.error("HMAC verification error:", error);
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  const protectedRoutes = ["/dashboard"];

  const publicRoutes = ["/feedback", "/support"];

  const isMissingLocaleOnPathname = routing.locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Verify authentication for root paths without/with locale
  if (!isMissingLocaleOnPathname) {
    const pathWithoutLocale = pathname.replace(/^\/[^\/]+/, "") || "/";
    const locale = pathname.split("/")[1];

    if (publicRoutes.some((route) => pathWithoutLocale.startsWith(route))) {
      return intlMiddleware(request);
    }

    // Check authentication for protected routes
    if (protectedRoutes.some((route) => pathWithoutLocale.startsWith(route))) {
      const token = request.cookies.get("session")?.value;

      if (!token) {
        return NextResponse.redirect(
          new URL(`/${locale}/unauthorized`, request.url)
        );
      }

      const payload = await verifyJwt(token);

      if (!payload) {
        return NextResponse.redirect(
          new URL(`/${locale}/unauthorized`, request.url)
        );
      }
    }
  } else {
    // Redirect to include default locale in URL
    return NextResponse.redirect(
      new URL(`/${routing.defaultLocale}${pathname}`, request.url)
    );
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
