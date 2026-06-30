"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MCPTool, MCPResource, MCPCallResult, MCPRpcResponse } from "@/types";

type Tab = "tools" | "resources" | "rpc";

export function MCPPlayground() {
  const [tab, setTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [selectedTool, setSelectedTool] = useState("");
  const [selectedResource, setSelectedResource] = useState("");
  const [toolArgs, setToolArgs] = useState("{}");
  const [toolResult, setToolResult] = useState<any>(null);
  const [resourceContent, setResourceContent] = useState<any>(null);
  const [rpcMethod, setRpcMethod] = useState("tools/list");
  const [rpcParams, setRpcParams] = useState("{}");
  const [rpcResult, setRpcResult] = useState<MCPRpcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMCP();
  }, []);

  const loadMCP = async () => {
    try {
      const [t, r] = await Promise.all([api.mcp.listTools(), api.mcp.listResources()]);
      setTools(t as MCPTool[] || []);
      setResources(r as MCPResource[] || []);
      if ((t as MCPTool[]).length > 0) setSelectedTool((t as MCPTool[])[0].name);
      if ((r as MCPResource[]).length > 0) setSelectedResource((r as MCPResource[])[0].uri);
    } catch (e: any) { setError(e.message); }
  };

  const callTool = async () => {
    setLoading(true); setError(""); setToolResult(null);
    try {
      const args = JSON.parse(toolArgs);
      const result = await api.mcp.callTool(selectedTool, args);
      setToolResult(result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const readResource = async () => {
    setLoading(true); setError(""); setResourceContent(null);
    try {
      const data = await api.mcp.readResource(selectedResource);
      setResourceContent(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const callRpc = async () => {
    setLoading(true); setError(""); setRpcResult(null);
    try {
      const params = JSON.parse(rpcParams);
      const result = await api.mcp.rpc(rpcMethod, params);
      setRpcResult(result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const currentTool = tools.find(t => t.name === selectedTool);

  const renderResult = (data: any) => {
    const json = JSON.stringify(data, null, 2);
    return <pre className="bg-gray-900 text-green-300 p-4 rounded-xl overflow-auto max-h-64 text-sm font-mono leading-relaxed">{json}</pre>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">MCP Playground</h1>
        <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium">调试工具</span>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          {error}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-2">
        {(["tools", "resources", "rpc"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              tab === t
                ? "bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {t === "tools" ? "🛠 Tools" : t === "resources" ? "📄 Resources" : "⚡ JSON-RPC"}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Available Tools ({tools.length})</h2>
          <select value={selectedTool} onChange={e => setSelectedTool(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none bg-white">
            {tools.map(t => <option key={t.name} value={t.name}>{t.name} - {t.description}</option>)}
          </select>
          {currentTool && (
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
              <p className="text-sm text-gray-600 mb-2">{currentTool.description}</p>
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-brand-500 transition-colors">Parameters schema</summary>
                <pre className="text-xs mt-2 font-mono text-gray-700">{JSON.stringify(currentTool.parameters, null, 2)}</pre>
              </details>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Arguments (JSON)</label>
            <textarea value={toolArgs} onChange={e => setToolArgs(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none font-mono text-sm resize-none" rows={4} />
          </div>
          <button onClick={callTool} disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50">
            {loading ? "Calling..." : "Call Tool"}
          </button>
          {toolResult && renderResult(toolResult)}
        </div>
      )}

      {tab === "resources" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Available Resources ({resources.length})</h2>
          <select value={selectedResource} onChange={e => setSelectedResource(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none bg-white">
            {resources.map(r => <option key={r.uri} value={r.uri}>{r.name} ({r.uri})</option>)}
          </select>
          {resources.find(r => r.uri === selectedResource) && (
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
              <p className="text-sm text-gray-600">{resources.find(r => r.uri === selectedResource)?.description}</p>
              {resources.find(r => r.uri === selectedResource)?.mime_type && (
                <p className="text-xs text-gray-400 mt-1">MIME: {resources.find(r => r.uri === selectedResource)?.mime_type}</p>
              )}
            </div>
          )}
          <button onClick={readResource} disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50">
            {loading ? "Reading..." : "Read Resource"}
          </button>
          {resourceContent && renderResult(resourceContent)}
        </div>
      )}

      {tab === "rpc" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Method</label>
            <input value={rpcMethod} onChange={e => setRpcMethod(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none font-mono" placeholder="tools/list" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Params (JSON)</label>
            <textarea value={rpcParams} onChange={e => setRpcParams(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none font-mono text-sm resize-none" rows={4} />
          </div>
          <button onClick={callRpc} disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50">
            {loading ? "Sending..." : "Send RPC"}
          </button>
          {rpcResult && (
            <div>
              {rpcResult.error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm mb-3">
                  Error {rpcResult.error.code}: {rpcResult.error.message}
                </div>
              )}
              {rpcResult.result && renderResult(rpcResult.result)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
