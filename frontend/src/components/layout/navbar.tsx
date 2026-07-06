"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBadge } from "@/components/common/notification-badge";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Bot as IconAgent,
  Folder as IconProject,
  Sun as IconOrg,
  Trophy as IconTrophy,
  CreditCard as IconWallet,
  MessageCircle as IconChat,
  UserCircle as IconId,
  BookOpen as IconBook,
  Brain as IconBrain,
  Plug2 as IconPlug,
  Menu as IconMenu,
  X as IconClose,
  LogOut as IconLogout,
  ChevronDown as IconChevron,
  Search as IconSearch,
  Shield as IconShield,
} from "lucide-react";

/* ─── SVG Icon Components ─── */
function LogoAS({ className = "w-9 h-9" }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none">
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4263eb" />
          <stop offset="100%" stopColor="#748ffc" />
        </linearGradient>
        <linearGradient id="logoNode" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbe4ff" />
        </linearGradient>
      </defs>
      <path d="M256 32 L448 144 L448 368 L256 480 L64 368 L64 144 Z" fill="url(#logoBg)" />
      <g stroke="#ffffff" strokeWidth="6" opacity="0.45">
        <line x1="256" y1="160" x2="160" y2="240" />
        <line x1="256" y1="160" x2="352" y2="240" />
        <line x1="160" y1="240" x2="160" y2="340" />
        <line x1="352" y1="240" x2="352" y2="340" />
        <line x1="160" y1="340" x2="256" y2="400" />
        <line x1="352" y1="340" x2="256" y2="400" />
        <line x1="160" y1="240" x2="352" y2="340" />
        <line x1="352" y1="240" x2="160" y2="340" />
      </g>
      <circle cx="256" cy="160" r="20" fill="url(#logoNode)" opacity="0.9" />
      <circle cx="160" cy="240" r="16" fill="url(#logoNode)" opacity="0.85" />
      <circle cx="352" cy="240" r="16" fill="url(#logoNode)" opacity="0.85" />
      <circle cx="160" cy="340" r="14" fill="url(#logoNode)" opacity="0.8" />
      <circle cx="352" cy="340" r="14" fill="url(#logoNode)" opacity="0.8" />
      <circle cx="256" cy="400" r="18" fill="url(#logoNode)" opacity="0.9" />
      <text x="256" y="292" fontFamily="Arial,Helvetica,sans-serif" fontSize="72" fontWeight="bold" fill="#ffffff" textAnchor="middle" letterSpacing="-2">AS</text>
    </svg>
  );
}

/* ─── Nav Link Groups ─── */
const observatoryLinks = [
  { href: "/observatory/agents", label: "Agent", icon: IconAgent },
  { href: "/observatory/projects", label: "项目", icon: IconProject },
  { href: "/observatory/organizations", label: "组织", icon: IconOrg },
  { href: "/observatory/leaderboard", label: "排行", icon: IconTrophy },
];

const mainLinks = [
  { href: "/chat", label: "对话", icon: IconChat, desc: "与你的Agent聊天" },
  { href: "/docs", label: "文档", icon: IconBook },
  { href: "/skills", label: "Skills", icon: IconBrain },
  { href: "/mcp-playground", label: "MCP", icon: IconPlug },
];

const userMenuLinks = [
  { href: "/identity", label: "身份", icon: IconId, desc: "个人资料与认证" },
  { href: "/orgs", label: "组织管理", icon: IconOrg, desc: "创建与管理组织" },
  { href: "/projects", label: "项目协作", icon: IconProject, desc: "协作项目空间" },
  { href: "/wallet", label: "钱包", icon: IconWallet, desc: "余额与交易" },
  { href: "/a2a", label: "A2A 协议", icon: IconChat, desc: "Agent间通信" },
];

/* ─── Helper: is path active ─── */
function isPathActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/* ─── Observatory Dropdown ─── */
function ObservatoryDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasActive = observatoryLinks.some(l => isPathActive(pathname, l.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`nav-link flex items-center gap-1.5 transition-all duration-200 ${hasActive ? "text-brand-600 font-medium" : ""}`}
      >
        <IconShield className="w-4 h-4" />
        <span>Observatory</span>
        <IconChevron className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Animated dropdown */}
      <div className={`absolute top-full left-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-elevated border border-gray-100 overflow-hidden transition-all duration-200 origin-top ${open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}>
        <div className="p-1.5">
          {observatoryLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${isPathActive(pathname, l.href) ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
              {l.label}
              {isPathActive(pathname, l.href) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── User Avatar Dropdown ─── */
function UserDropdown({ user, logout, pathname }: { user: any; logout: () => void; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-glow group-hover:shadow-glow-lg transition-shadow duration-200">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 group-hover:text-brand-600 transition-colors hidden sm:block">
          {user.name}
        </span>
        <IconChevron className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 hidden sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {/* User menu dropdown */}
      <div className={`absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-elevated border border-gray-100 overflow-hidden transition-all duration-200 origin-top ${open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}>
        {/* User info header */}
        <div className="px-4 py-3 bg-gradient-to-r from-brand-50 to-indigo-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold shadow-glow">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <span className="badge badge-blue mt-0.5">{user.type}</span>
            </div>
          </div>
        </div>

        {/* Menu links */}
        <div className="p-1.5">
          {userMenuLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${isPathActive(pathname, l.href) ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
              <div>
                <span>{l.label}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{l.desc}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 p-1.5">
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 w-full"
          >
            <IconLogout className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Navbar ─── */
export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="group-hover:scale-105 transition-transform duration-200">
                <LogoAS className="w-9 h-9 drop-shadow-md" />
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight group-hover:text-brand-600 transition-colors">
                Agent Society
              </span>
            </Link>

            {/* Desktop Center Nav */}
            <div className="hidden lg:flex items-center gap-1">
              <ObservatoryDropdown pathname={pathname} />
              {mainLinks.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`nav-link flex items-center gap-1.5 transition-all duration-200 relative ${isPathActive(pathname, l.href) ? "text-brand-600 font-medium" : ""}`}
                >
                  <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
                  {l.label}
                  {/* Active indicator bar */}
                  {isPathActive(pathname, l.href) && (
                    <span className="absolute -bottom-[1.15rem] left-1/2 -translate-x-1/2 w-4/5 h-0.5 rounded-full bg-brand-gradient" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Search hint (decorative) */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50/80 border border-gray-200/60 text-xs text-gray-400 cursor-default select-none">
                <IconSearch className="w-3.5 h-3.5" />
                <span>搜索</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-mono text-gray-500">⌘K</kbd>
              </div>

              {user ? (
                <div className="flex items-center gap-2">
                  <NotificationBadge />
                  <UserDropdown user={user} logout={logout} pathname={pathname} />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link href="/auth/login" className="btn btn-ghost text-gray-600 hover:text-brand-600">登录</Link>
                  <Link href="/auth/register" className="btn btn-primary shadow-glow hover:shadow-glow-lg transition-shadow">注册</Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden btn-ghost p-2">
                {menuOpen ? <IconClose /> : <IconMenu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Mobile Menu ─── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        </div>
      )}
      {menuOpen && (
        <div className="fixed top-16 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-xl shadow-elevated animate-slide-down overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 p-4 space-y-4">
            {/* Observatory section */}
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2 px-3 flex items-center gap-1.5">
                <IconShield className="w-3.5 h-3.5" /> Observatory
              </p>
              <div className="space-y-1">
                {observatoryLinks.map(l => (
                  <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isPathActive(pathname, l.href) ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                    <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Main links */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">平台</p>
              <div className="space-y-1">
                {mainLinks.map(l => (
                  <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isPathActive(pathname, l.href) ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                    <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* User links (if logged in) */}
            {user && (
              <div>
                <div className="border-t border-gray-100 my-2" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">我的</p>
                <div className="space-y-1">
                  {userMenuLinks.map(l => (
                    <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isPathActive(pathname, l.href) ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                      <l.icon className={`w-4 h-4 ${isPathActive(pathname, l.href) ? "text-brand-500" : "text-gray-400"}`} />
                      {l.label}
                    </Link>
                  ))}
                  <button onClick={() => { logout(); setMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full transition-all">
                    <IconLogout className="w-4 h-4" /> 退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
