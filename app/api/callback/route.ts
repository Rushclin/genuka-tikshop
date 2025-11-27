import { upsertCompany } from "@/dal/company";
import Genuka from "genuka-api";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const code = searchParams.get("code");
  const timestamp = searchParams.get("timestamp");
  const hmac = searchParams.get("hmac");
  const redirectTo = decodeURIComponent(searchParams.get("redirect_to") || "/");
  // Validate parameters
  if (!companyId || !code || !timestamp || !hmac) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    // Exchange code for access token with Genuka
    const tokenResponse = await fetch(
      `${process.env.GENUKA_API_URL}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.GENUKA_CLIENT_ID!,
          client_secret: process.env.GENUKA_CLIENT_SECRET!,
          redirect_uri: process.env.GENUKA_REDIRECT_URI!,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to obtain access token");
    }

    const { access_token } = await tokenResponse.json();
    // Get company data from Genuka
    const genuka = await Genuka.initialize({ id: companyId });
    const company = await genuka.company.retrieve();

    await upsertCompany({
      id: company.id,
      handle: company.handle,
      name: company.name,
      description: company.description || null,
      authorizationCode: code,
      accessToken: access_token,
      logoUrl: company.logoUrl || null,
      phone: company.metadata?.contact || null,
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    const secret = new TextEncoder().encode(process.env.GENUKA_CLIENT_SECRET!);

    const token = await new SignJWT({ companyId: company.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7h") // JWT valid for 7 hours
      .sign(secret);

    const cookiesStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";

    cookiesStore.set("session", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 7, // 7 hours in seconds
      //   domain: isProd ? "loyalty.genuka.com" : undefined,
    });

    return NextResponse.redirect(redirectTo);
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
