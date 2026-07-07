"use client";

import { useState } from "react";
import type { HowToJoin, OnboardingStep } from "@/types/skills";

interface SkillsOnboardingProps {
  howToJoin: HowToJoin;
}

export function SkillsOnboarding({ howToJoin }: SkillsOnboardingProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showBridgeCode, setShowBridgeCode] = useState(false);

  return (
    <section className="glass-card p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg">🚀</span>
        如何接入
      </h2>
      <p className="text-gray-600 mb-4">{howToJoin.description}</p>
      <div className="space-y-3">
        {howToJoin.steps.map((step: OnboardingStep) => (
          <div key={step.step} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {/* Step header - clickable */}
            <button
              onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
              className="w-full p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{step.action}</h3>
                <div className="text-xs text-gray-500 truncate">{step.endpoint}</div>
              </div>
              {step.auth && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs shrink-0 whitespace-nowrap">
                  {step.auth}
                </span>
              )}
              <span className="text-gray-400 text-sm shrink-0">
                {expandedStep === step.step ? "▼" : "▶"}
              </span>
            </button>

            {/* Expanded detail */}
            {expandedStep === step.step && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-200 pt-3 space-y-3">
                {step.required_fields && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">必填字段:</span>
                    {step.required_fields.map((f) => (
                      <span key={f} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{f}</span>
                    ))}
                  </div>
                )}
                {step.required_endpoints && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">必实现端点:</span>
                    {step.required_endpoints.map((e) => (
                      <span key={e} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{e}</span>
                    ))}
                  </div>
                )}
                {step.output && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-medium text-green-600">输出:</span>
                    <p className="text-sm text-gray-700 mt-1">{step.output}</p>
                  </div>
                )}
                {step.relationship_to_step3 && (
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <span className="text-xs font-medium text-indigo-600">与Step3的关系:</span>
                    <p className="text-sm text-gray-700 mt-1">{step.relationship_to_step3}</p>
                  </div>
                )}
                {step.important_note && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <span className="text-xs font-medium text-amber-600">⚠️ 重要:</span>
                    <p className="text-sm text-gray-700 mt-1">{step.important_note}</p>
                  </div>
                )}
                {step.example_request && (
                  <div className="bg-slate-800 rounded-lg p-3 overflow-x-auto">
                    <span className="text-xs text-green-400 font-mono">请求示例:</span>
                    <pre className="text-xs text-gray-200 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(step.example_request, null, 2)}</pre>
                  </div>
                )}
                {step.example_response && (
                  <div className="bg-slate-800 rounded-lg p-3 overflow-x-auto">
                    <span className="text-xs text-blue-400 font-mono">响应示例:</span>
                    <pre className="text-xs text-gray-200 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(step.example_response, null, 2)}</pre>
                  </div>
                )}
                {step.minimal_bridge_code && (
                  <div>
                    <button
                      onClick={() => setShowBridgeCode(!showBridgeCode)}
                      className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded text-sm font-medium hover:bg-emerald-200 transition-colors"
                    >
                      {showBridgeCode ? "隐藏最小Bridge代码" : "📋 查看最小Bridge代码"}
                    </button>
                    {showBridgeCode && (
                      <div className="mt-2 bg-slate-800 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
                        <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{step.minimal_bridge_code}</pre>
                      </div>
                    )}
                    {step.generic_template_path && (
                      <p className="mt-2 text-xs text-gray-500 italic">💡 通用模板路径: <code className="bg-gray-100 px-1 rounded">{step.generic_template_path}</code></p>
                    )}
                  </div>
                )}
                {step.note && (
                  <p className="text-xs text-gray-500 italic">💡 {step.note}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 bg-indigo-50 rounded-lg p-4 border border-indigo-200">
        <p className="text-sm text-indigo-700">{howToJoin.note}</p>
      </div>
    </section>
  );
}
