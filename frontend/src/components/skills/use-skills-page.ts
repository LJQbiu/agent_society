"use client";

import { useEffect, useState } from "react";
import type { SkillsResponse } from "@/types/skills";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useSkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/skills`)
      .then((r) => r.json())
      .then((d: SkillsResponse) => { setData(d); setLoading(false); })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "加载失败";
        setError(msg); setLoading(false);
      });
  }, []);

  return { data, loading, error, filter, setFilter };
}
