import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.AUTH_BACKEND_URL || "http://localhost:8000";

/**
 * Auth proxy route handler — forwards /api/auth/* to backend
 * and explicitly forwards Set-Cookie headers (Next.js rewrites
 * don't reliably do this for cross-origin Set-Cookie).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyAuthRequest(request, path);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyAuthRequest(request, path);
}

async function proxyAuthRequest(
  request: NextRequest,
  pathSegments: string[]
) {
  // Original rewrite was /api/:path* → backend/:path*
  // So /api/auth/register → /auth/register (strip /api, keep /auth)
  const backendPath = "auth/" + pathSegments.join("/");
  const backendUrl = `${BACKEND_URL}/${backendPath}`;

  // Forward browser cookies to backend
  const cookieHeader = request.headers.get("cookie") || "";

  // Build headers for backend request
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  };

  // Forward Authorization header if present
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  // Get request body for POST
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT") {
    body = await request.text();
  }

  const backendRes = await fetch(backendUrl, {
    method: request.method,
    headers,
    body,
  });

  // Build response headers, skipping set-cookie (we'll handle those separately)
  const resHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      resHeaders.set(key, value);
    }
  });

  const response = new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });

  // Explicitly forward Set-Cookie headers — critical for httpOnly Cookie auth
  const setCookieHeaders = backendRes.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
