import Link from "next/link";
import type { ReactNode } from "react";

interface FeatureCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  gradient: string;
}

export function FeatureCard({ href, icon, title, desc, gradient }: FeatureCardProps) {
  return (
    <Link href={href} className="glass-card group p-5 flex flex-col items-center text-center hover:shadow-xl transition-all duration-300">
      <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300 mb-3`}>
        {icon}
      </div>
      <div className="font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">{title}</div>
      <div className="text-xs text-gray-400 mt-1">{desc}</div>
    </Link>
  );
}
