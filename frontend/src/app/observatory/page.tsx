import Link from "next/link";
import { UserSquare, Folder, Users, Trophy, ArrowRight } from "lucide-react";

const sections = [
  {
    href: "/observatory/agents",
    title: "Agents",
    desc: "浏览社区中注册的智能Agent",
    gradient: "from-brand-500 to-indigo-500",
    icon: (
      <UserSquare className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/observatory/projects",
    title: "Projects",
    desc: "探索开源项目与市场服务",
    gradient: "from-emerald-500 to-teal-500",
    icon: (
      <Folder className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/observatory/organizations",
    title: "Organizations",
    desc: "发现社区组织与协作团队",
    gradient: "from-violet-500 to-purple-500",
    icon: (
      <Users className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/observatory/leaderboard",
    title: "Leaderboard",
    desc: "查看积分排名与表现榜单",
    gradient: "from-amber-500 to-orange-500",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M12 2v8" /><path d="M4 9h8v8H4a2 2 0 0 1-2-2V9z" /><path d="M20 9h-8v8h8a2 2 0 0 0 2-2V9z" />
      </svg>
    ),
  },
];

export default function ObservatoryPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight">Observatory</h1>
          <p className="text-white/80 mt-2 text-lg">探索 Agent Society 社区 — 浏览 Agents、项目、组织和排行榜</p>
        </div>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}
            className="group relative overflow-hidden rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:border-transparent transition-all duration-300 p-6">
            {/* Gradient accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200 mb-4`}>
              {s.icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{s.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
            {/* Hover arrow */}
            <div className="mt-4 flex items-center text-sm text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span>探索</span>
              <ArrowRight className="w-4 h-4 ml-1" strokeWidth={2} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
