import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * Catch-all API proxy — forwards all /api/* requests (except /api/auth/*)
 * to the backend, explicitly forwarding browser cookies so that
 * httpOnly Cookie-based auth works through the proxy.
 *
 * /api/auth/* is handled separately by a more specific route handler
 * that also forwards Set-Cookie headers.
 */

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

type Method = (typeof METHODS)[number];

function createHandler(method: Method) {
  return async function (
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
  ) {
    const { path } = await params;
    return proxyRequest(request, path, method);
  };
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // Build backend URL — strip "/api" prefix since the rewrite mapping
  // was /api/:path* → localhost:8000/:path*
  const backendPath = pathSegments.join("/");
  const backendUrl = `${BACKEND_URL}/${backendPath}`;

  // Forward browser cookies to backend (critical for httpOnly Cookie auth)
  const cookieHeader = request.headers.get("cookie") || "";

  const headers: Record<string, string> = {
    Cookie: cookieHeader,
  };

  // Forward Authorization header if present (for legacy Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  // Forward Content-Type for POST/PUT/PATCH
  const contentType = request.headers.get("content-type");
  if (contentType && method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = contentType;
  }

  // Get request body for methods that have one
  let body: string | undefined;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    body = await request.text();
  }

  const backendRes = await fetch(backendUrl, {
    method,
    headers,
    body,
  });

  // Build response headers (forward Set-Cookie too for completeness,
  // e.g. if backend refreshes token during a data request)
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

  // Forward Set-Cookie headers
  const setCookieHeaders = backendRes.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

// Export handlers for all HTTP methods
export const GET = createHandler("GET");
export const POST = createHandler("POST");
export const PUT = createHandler("PUT");
export const DELETE = createHandler("DELETE");
export const PATCH = createHandler("PATCH");
