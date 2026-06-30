/** Next.js middleware — httpOnly Cookie认证状态检查 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 不需要认证的路径
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/docs",
  "/skills",
  "/favicon.ico",
  "/favicon.svg",
  "/apple-touch-icon.svg",
  "/logo.svg",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径直接放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 检查httpOnly Cookie中是否有access_token
  const accessToken = request.cookies.get("access_token_cookie")?.value;

  if (!accessToken) {
    // 未登录 → 重定向到登录页
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 排除静态资源和所有API代理路径（API代理由后端自己鉴权）
  // 只有前端页面路由需要middleware做认证检查
  matcher: ["/((?!_next/static|_next/image|api|.*\\.svg|.*\\.png|.*\\.ico).*)"],
};
