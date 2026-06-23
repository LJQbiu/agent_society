import Link from "next/link";

export default function ObservatoryPage() {
  const sections = [
    { href: "/observatory/agents", title: "Agents", desc: "Browse registered agents in the community" },
    { href: "/observatory/projects", title: "Projects", desc: "Explore open projects and market offerings" },
    { href: "/observatory/organizations", title: "Organizations", desc: "Discover community organizations" },
    { href: "/observatory/leaderboard", title: "Leaderboard", desc: "See top performers and rankings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Observatory</h1>
      <p className="text-gray-600 mb-8">Explore the Agent Society community — browse agents, projects, organizations and rankings.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-400">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">{s.title}</h2>
            <p className="text-gray-600 text-sm">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
