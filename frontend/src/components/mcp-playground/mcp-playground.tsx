"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MCPTool, MCPResource, MCPCallResult, MCPRpcResponse } from "@/types";

type Tab = "tools" | "resources" | "rpc";

export function MCPPlayground() {
  const [tab, setTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [toolResult, setToolResult] = useState<MCPCallResult | null>(null);
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [resourceContent, setResourceContent] = useState<any>(null);
  const [rpcMethod, setRpcMethod] = useState<string>("tools/list");
  const [rpcParams, setRpcParams] = useState<string>("{}");
  const [rpcResult, setRpcResult] = useState<MCPRpcResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTools();
    loadResources();
  }, []);

  const loadTools = async () => {
    try {
      const data = await api.mcp.listTools();
      setTools(data);
      if (data.length > 0) setSelectedTool(data[0].name);
    } catch (e: any) { setError(e.message); }
  };

  const loadResources = async () => {
    try {
      const data = await api.mcp.listResources();
      setResources(data);
      if (data.length > 0) setSelectedResource(data[0].uri);
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
    return <pre className="bg-gray-800 text-green-300 p-3 rounded overflow-auto max-h-64 text-sm">{json}</pre>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔧 MCP Playground</h1>

      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}

      <div className="flex gap-2 mb-4">
        {(["tools", "resources", "rpc"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded ${tab === t ? "bg-indigo-600 text-white" : "bg-gray-200"}`}>
            {t === "tools" ? "🛠 Tools" : t === "resources" ? "📄 Resources" : "⚡ JSON-RPC"}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Available Tools ({tools.length})</h2>
            <select value={selectedTool} onChange={e => setSelectedTool(e.target.value)}
              className="border p-2 rounded w-full mb-2">
              {tools.map(t => <option key={t.name} value={t.name}>{t.name} - {t.description}</option>)}
            </select>
          </div>
          {currentTool && (
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600 mb-2">{currentTool.description}</p>
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer">Parameters schema</summary>
                <pre className="text-xs mt-1">{JSON.stringify(currentTool.parameters, null, 2)}</pre>
              </details>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Arguments (JSON)</label>
            <textarea value={toolArgs} onChange={e => setToolArgs(e.target.value)}
              className="border p-2 rounded w-full font-mono text-sm" rows={4} />
          </div>
          <button onClick={callTool} disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Calling..." : "Call Tool"}
          </button>
          {toolResult && renderResult(toolResult)}
        </div>
      )}

      {tab === "resources" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Available Resources ({resources.length})</h2>
            <select value={selectedResource} onChange={e => setSelectedResource(e.target.value)}
              className="border p-2 rounded w-full mb-2">
              {resources.map(r => <option key={r.uri} value={r.uri}>{r.name} ({r.uri})</option>)}
            </select>
          </div>
          {resources.find(r => r.uri === selectedResource) && (
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">
                {resources.find(r => r.uri === selectedResource)?.description}
              </p>
              {resources.find(r => r.uri === selectedResource)?.mime_type && (
                <p className="text-xs text-gray-400">MIME: {resources.find(r => r.uri === selectedResource)?.mime_type}</p>
              )}
            </div>
          )}
          <button onClick={readResource} disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Reading..." : "Read Resource"}
          </button>
          {resourceContent && renderResult(resourceContent)}
        </div>
      )}

      {tab === "rpc" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <input value={rpcMethod} onChange={e => setRpcMethod(e.target.value)}
              className="border p-2 rounded w-full" placeholder="tools/list" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Params (JSON)</label>
            <textarea value={rpcParams} onChange={e => setRpcParams(e.target.value)}
              className="border p-2 rounded w-full font-mono text-sm" rows={4} />
          </div>
          <button onClick={callRpc} disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Sending..." : "Send RPC"}
          </button>
          {rpcResult && (
            <div>
              {rpcResult.error && (
                <div className="bg-red-50 text-red-700 p-2 rounded mb-2">
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
