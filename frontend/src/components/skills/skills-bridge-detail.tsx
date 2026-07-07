"use client";

import type { BridgeDetail, Platform } from "@/types/skills";

interface SkillsBridgeDetailProps {
  bridgeDetail: BridgeDetail;
  bridgeInfo: Platform["protocols"]["bridge"];
}

export function SkillsBridgeDetail({ bridgeDetail, bridgeInfo }: SkillsBridgeDetailProps) {
  return (
    <section className="glass-card p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">🔗</span>
        {bridgeDetail.title}
        <span className="text-sm text-gray-400 font-normal ml-2">v{bridgeInfo.version}</span>
      </h2>

      {/* Architecture */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 mb-4">
        <h3 className="font-semibold text-indigo-600 mb-2">🏗 核心原则</h3>
        <p className="text-gray-700 leading-relaxed">{bridgeDetail.overview}</p>
      </div>

      {/* Message Flow */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">📡 消息流转路径</h3>
        <div className="space-y-2">
          {bridgeDetail.message_flow.map((step, i) => (
            <div key={i} className="flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <div className="text-gray-700 text-sm pt-0.5">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Session Management */}
      <div className="mb-4 bg-violet-50 rounded-xl p-4 sm:p-6 border border-violet-200">
        <h3 className="font-semibold text-violet-700 mb-3">🧠 Session记忆管理</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium text-violet-600">分组键:</span> <code className="bg-white px-1 rounded">{bridgeDetail.session_management.key}</code></div>
          <div><span className="font-medium text-violet-600">行为:</span> {bridgeDetail.session_management.behavior}</div>
          <div><span className="font-medium text-violet-600">过期:</span> {bridgeDetail.session_management.cleanup}</div>
          <div><span className="font-medium text-violet-600">最佳实践:</span> {bridgeDetail.session_management.best_practice}</div>
        </div>
      </div>

      {/* Incremental Messages */}
      <div className="mb-4 bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-700 mb-3">📨 增量消息机制</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium text-blue-600">定义:</span> {bridgeDetail.incremental_messages.definition}</div>
          <div className="flex flex-wrap gap-1">
            <span className="font-medium text-blue-600">包含:</span>
            {bridgeDetail.incremental_messages.includes.map((inc, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{inc}</span>
            ))}
          </div>
          <div><span className="font-medium text-blue-600">排除:</span> {bridgeDetail.incremental_messages.excludes}</div>
          <div><span className="font-medium text-blue-600">格式:</span> {bridgeDetail.incremental_messages.format}</div>
          <div className="mt-2 bg-white rounded-lg p-3">
            <span className="text-xs font-medium text-gray-600">role取值:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
              {Object.entries(bridgeDetail.incremental_messages.role_values).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <code className="bg-gray-100 px-1 rounded text-indigo-600">{k}</code>: {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History Query */}
      <div className="mb-4 bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
        <h3 className="font-semibold text-green-700 mb-3">📚 历史查询API</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium text-green-600">描述:</span> {bridgeDetail.history_query.description}</div>
          <div><span className="font-medium text-green-600">端点:</span> <code className="bg-white px-1 rounded break-all">{bridgeDetail.history_query.endpoint}</code></div>
          <div><span className="font-medium text-green-600">认证:</span> {bridgeDetail.history_query.auth}</div>
          <div><span className="font-medium text-green-600">用途:</span> {bridgeDetail.history_query.use_case}</div>
        </div>
      </div>

      {/* Request/Response Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-green-400 mb-2">📤 请求示例</h3>
          <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{JSON.stringify(bridgeInfo.request_example, null, 2)}</pre>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">📥 响应示例</h3>
          <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{JSON.stringify(bridgeInfo.response_example, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
