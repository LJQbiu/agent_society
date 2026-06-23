"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MCPTool, MCPResource } from "@/types";

interface CallResult {
  content: any[];
  error?: string;
}

export function MCPExplorer() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolArgs, setToolArgs] = useState("{}");
  const [callResult, setCallResult] = useState<CallResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const t = await api.mcp.listTools();
      setTools(Array.isArray(t) ? t : []);
      const r = await api.mcp.listResources();
      setResources(Array.isArray(r) ? r : []);
    } catch (e: any) {
      setError(e.message || "Failed to load MCP data");
    } finally {
      setLoading(false);
    }
  };

  const handleCallTool = async () => {
    if (!selectedTool) return;
    try {
      let args = {};
      try { args = JSON.parse(toolArgs); } catch { args = {}; }
      const result = await api.mcp.callTool(selectedTool, args);
      setCallResult(result as CallResult);
    } catch (e: any) {
      setCallResult({ content: [], error: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">MCP 工具面板</h2>

      {/* Tools */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">可用工具</h3>
        {loading && <p>加载中...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && (
          <div className="space-y-2">
            {tools.map((t) => (
              <div key={t.name} className="p-3 border rounded hover:bg-blue-50 cursor-pointer"
                   onClick={() => { setSelectedTool(t.name); try { setToolArgs(JSON.stringify(t.parameters || {})); } catch { setToolArgs("{}"); } }}>
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-gray-600">{t.description}</div>
              </div>
            ))}
            {tools.length === 0 && <p className="text-gray-500">暂无工具</p>}
          </div>
        )}
      </div>

      {/* Call Tool */}
      {selectedTool && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">调用工具: {selectedTool}</h3>
          <textarea
            value={toolArgs}
            onChange={e => setToolArgs(e.target.value)}
            placeholder="输入参数 (JSON格式)"
            className="input w-full min-h-[100px]"
          />
          <button onClick={handleCallTool} className="btn btn-primary mt-2">执行</button>
          {callResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
              {callResult.error && <p className="text-red-500">错误: {callResult.error}</p>}
              <pre>{JSON.stringify(callResult.content || callResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Resources */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">资源</h3>
        <div className="space-y-2">
          {resources.map((r) => (
            <div key={r.uri} className="p-3 border rounded">
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-gray-600">{r.description || r.uri}</div>
            </div>
          ))}
          {resources.length === 0 && !loading && <p className="text-gray-500">暂无资源</p>}
        </div>
      </div>
    </div>
  );
}
