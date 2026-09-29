import React, { useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Wrench,
  FileCheck,
  Cpu,
  Layers,
  Clock,
  Sparkles,
  Info,
  Zap,
  BarChart3,
  Bot,
  Activity,
  Calculator,
} from 'lucide-react';
import { ValidationSummary } from '../utils/adkValidator';
import { VirtualFileTree, REQUIRED_BASE_MODEL } from '../types/agent';
import yaml from 'yaml';

interface LinterInspectorProps {
  validation: ValidationSummary;
  files: VirtualFileTree;
  onAutoFix: (fixAction?: string) => void;
  onFixAll: () => void;
}

export const LinterInspector: React.FC<LinterInspectorProps> = ({
  validation,
  files,
  onAutoFix,
  onFixAll,
}) => {
  // 1. Calculate projected token usage & 12-hour budget debits
  const tokenBreakdown = useMemo(() => {
    // Sampling config
    let maxTokens = 4096;
    try {
      const sampParsed = yaml.parse(files['configs/sampling.yaml'] || '') || {};
      if (sampParsed.max_output_tokens) maxTokens = Number(sampParsed.max_output_tokens);
    } catch {
      // fallback
    }

    // Eval config
    let maxIterations = 35;
    let perTaskTimeoutSec = 1800;
    try {
      const evalParsed = yaml.parse(files['eval_config.yaml'] || '') || {};
      if (evalParsed.max_iterations_per_task) maxIterations = Number(evalParsed.max_iterations_per_task);
      if (evalParsed.per_task_timeout_sec) perTaskTimeoutSec = Number(evalParsed.per_task_timeout_sec);
    } catch {
      // fallback
    }

    const agentsList: {
      name: string;
      role: 'Root Orchestrator' | 'AgentTool Subagent';
      promptFile: string;
      charLength: number;
      systemPromptTokens: number;
      turnTokens: number;
      fullTrajectoryTokens: number;
      estInferenceSec: number;
      toolsCount: number;
      adapter?: string;
    }[] = [];

    // Root Agent
    let rootPromptFile = 'prompts/system.md';
    let rootToolsCount = 0;
    let rootAdapter: string | undefined;
    try {
      const rootParsed = yaml.parse((files['agent.yaml'] || '').replace(/!include\s+([^\n]+)/g, '"!include $1"')) || {};
      rootToolsCount = (rootParsed.tools || []).length;
      rootAdapter = rootParsed.adapter;
      const sysMatch = (files['agent.yaml'] || '').match(/system_prompt:\s*!include\s+([^\s\n]+)/);
      if (sysMatch && sysMatch[1]) rootPromptFile = sysMatch[1];
    } catch {
      // fallback
    }

    const rootSysText = files.prompts[rootPromptFile.replace(/^prompts\//, '')] || files.prompts['system.md'] || '';
    const rootCharLen = rootSysText.length;
    const rootSysTokens = Math.max(1, Math.round(rootCharLen / 3.8));
    // Avg ReAct turn has ~1200 prompt context (history + observation) + ~350 response
    const rootTurnTokens = rootSysTokens + 1550;
    const rootFullTrajectoryTokens = rootTurnTokens * Math.min(maxIterations, 25);
    // Gemma 4 31B W4A16 inference rate ~32 tokens/sec
    const rootInferenceSec = Math.round(rootFullTrajectoryTokens / 32);

    agentsList.push({
      name: 'Root Orchestrator (agent.yaml)',
      role: 'Root Orchestrator',
      promptFile: rootPromptFile,
      charLength: rootCharLen,
      systemPromptTokens: rootSysTokens,
      turnTokens: rootTurnTokens,
      fullTrajectoryTokens: rootFullTrajectoryTokens,
      estInferenceSec: rootInferenceSec,
      toolsCount: rootToolsCount,
      adapter: rootAdapter,
    });

    // Sub-agents
    for (const [subFilename, subYaml] of Object.entries(files.sub_agents)) {
      let subPromptFile = 'prompts/analyzer.md';
      let subToolsCount = 0;
      let subAdapter: string | undefined;
      let subName = subFilename.replace(/\.ya?ml$/, '');

      try {
        const subParsed = yaml.parse(subYaml.replace(/!include\s+([^\n]+)/g, '"!include $1"')) || {};
        if (subParsed.name) subName = subParsed.name;
        subToolsCount = (subParsed.tools || []).length;
        subAdapter = subParsed.adapter;
        const pMatch = subYaml.match(/system_prompt:\s*!include\s+([^\s\n]+)/);
        if (pMatch && pMatch[1]) subPromptFile = pMatch[1];
      } catch {
        // fallback
      }

      const subSysText = files.prompts[subPromptFile.replace(/^prompts\//, '')] || '';
      const subCharLen = subSysText.length;
      const subSysTokens = Math.max(1, Math.round(subCharLen / 3.8));
      // Subagents typically run ~4-8 turns per task
      const subTurnTokens = subSysTokens + 850;
      const subFullTrajectoryTokens = subTurnTokens * 6;
      const subInferenceSec = Math.round(subFullTrajectoryTokens / 32);

      agentsList.push({
        name: `${subName} (sub_agents/${subFilename})`,
        role: 'AgentTool Subagent',
        promptFile: subPromptFile,
        charLength: subCharLen,
        systemPromptTokens: subSysTokens,
        turnTokens: subTurnTokens,
        fullTrajectoryTokens: subFullTrajectoryTokens,
        estInferenceSec: subInferenceSec,
        toolsCount: subToolsCount,
        adapter: subAdapter,
      });
    }

    const totalTaskTokens = agentsList.reduce((acc, a) => acc + a.fullTrajectoryTokens, 0);
    const totalTaskInferenceSec = agentsList.reduce((acc, a) => acc + a.estInferenceSec, 0);

    // If test suite/tool execution adds ~180s per task, total time per task
    const totalEstTimePerTaskSec = totalTaskInferenceSec + 240;
    // 12 hours = 43200 seconds
    const maxSolvableTasksIn12h = Math.floor(43200 / Math.max(60, totalEstTimePerTaskSec));
    const budgetUtilizationPct = Math.min(100, Math.round((totalEstTimePerTaskSec / perTaskTimeoutSec) * 100));

    return {
      agentsList,
      totalTaskTokens,
      totalTaskInferenceSec,
      totalEstTimePerTaskSec,
      maxSolvableTasksIn12h,
      budgetUtilizationPct,
      maxTokens,
      maxIterations,
      perTaskTimeoutSec,
    };
  }, [files]);

  const checkList = [
    {
      title: 'Root agent.yaml Archive Check',
      description: 'The root archive must contain agent.yaml to bootstrap the ADK harness.',
      status: files['agent.yaml'] ? 'pass' : 'fail',
      icon: FileCheck,
    },
    {
      title: 'Single Base Model Enforcement',
      description: `Every agent and subagent must select "${REQUIRED_BASE_MODEL}". No other variants permitted.`,
      status: !validation.issues.some((i) => i.category === 'model') ? 'pass' : 'fail',
      icon: Cpu,
    },
    {
      title: 'Allowed Tools Whitelist',
      description: 'Only official competition harness tools and registered sub_agents are permitted.',
      status: !validation.issues.some((i) => i.category === 'tools' && i.severity === 'error') ? 'pass' : 'fail',
      icon: Wrench,
    },
    {
      title: 'Sandboxing & !include Directives',
      description: 'All !include tags must resolve internally without directory traversal ("../" or symlinks).',
      status: !validation.issues.some((i) => i.category === 'files' && i.severity === 'error') ? 'pass' : 'fail',
      icon: Layers,
    },
    {
      title: 'LoRA Adapter Format & Manifests',
      description: 'LoRA directories under adapters/ must have valid adapter_config.json manifests.',
      status: !validation.issues.some((i) => i.category === 'lora' && i.severity === 'error') ? 'pass' : 'fail',
      icon: Layers,
    },
    {
      title: '12-Hour Evaluation Time Limit',
      description: 'Per-task and overall execution must respect the 12-hour evaluation ceiling.',
      status: !validation.issues.some((i) => i.category === 'budget') ? 'pass' : 'fail',
      icon: Clock,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
      {/* Top Banner & Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg ${
              validation.passed
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-950/40'
                : 'bg-rose-600/20 text-rose-400 border border-rose-500/40 shadow-rose-950/40'
            }`}
          >
            {validation.score}%
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Harness Compliance Audit & Rule Inspector
              </h2>
              {validation.passed ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  READY TO SUBMIT
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  ACTION REQUIRED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditing against the official Google Gemma 4 Developer Agent Kaggle Competition specification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {validation.issues.some((i) => i.autoFixAvailable) && (
            <button
              onClick={onFixAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-950/40 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Fix All Issues</span>
            </button>
          )}
        </div>
      </div>

      {/* Rules Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checkList.map((item, idx) => {
          const Icon = item.icon;
          const isPass = item.status === 'pass';
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border bg-slate-900/80 transition flex items-start gap-3 ${
                isPass ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/60 bg-rose-950/10'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  isPass ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                }`}
              >
                {isPass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white flex items-center justify-between">
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* NEW SECTION: Token Usage & 12-Hour Budget Optimizer Visualizer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Projected Token Consumption & 12-Hour Budget Profiler</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemma 4 W4A16
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Calculated from current prompt character lengths, sampling limits, and multi-turn ReAct trajectory heuristics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Est. Solvable Tasks in 12h:</span>
              <span className="text-emerald-400 font-bold">~{tokenBreakdown.maxSolvableTasksIn12h} tasks</span>
            </div>
          </div>
        </div>

        {/* Aggregate Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Per-Task Tokens</div>
            <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">
              {tokenBreakdown.totalTaskTokens.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Prompt + Tool Trajectory</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Inference Time / Task</div>
            <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
              ~{Math.round(tokenBreakdown.totalTaskInferenceSec)}s
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">@ ~32 tokens/sec (W4A16)</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Task Timeout Budget</div>
            <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">
              {tokenBreakdown.perTaskTimeoutSec}s max
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {tokenBreakdown.budgetUtilizationPct}% timeout headroom used
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Overall 12h Budget</div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
              43,200 sec limit
            </div>
            <div className="text-[10px] text-emerald-500 mt-0.5">Harness Safe Ceiling</div>
          </div>
        </div>

        {/* Agent & Sub-Agent Token Table & Visual Progress Bars */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              Per-Agent Token Allocation Breakdown ({tokenBreakdown.agentsList.length} Agents)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Prompt tokens = ~chars / 3.8
            </span>
          </div>

          <div className="space-y-2.5">
            {tokenBreakdown.agentsList.map((agent, idx) => {
              const tokenSharePct = Math.round(
                (agent.fullTrajectoryTokens / Math.max(1, tokenBreakdown.totalTaskTokens)) * 100
              );

              return (
                <div
                  key={idx}
                  className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white font-mono">{agent.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          agent.role === 'Root Orchestrator'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-purple-950 text-purple-300 border border-purple-800'
                        }`}
                      >
                        {agent.role}
                      </span>
                      {agent.adapter && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {agent.adapter}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                      <span>
                        Prompt:{' '}
                        <strong className="text-slate-200">{agent.systemPromptTokens} tokens</strong> ({agent.charLength} chars)
                      </span>
                      <span>
                        Trajectory:{' '}
                        <strong className="text-indigo-300">{agent.fullTrajectoryTokens.toLocaleString()} tokens</strong>
                      </span>
                      <span className="text-slate-300 font-semibold">{tokenSharePct}% share</span>
                    </div>
                  </div>

                  {/* Visual Proportion Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 ${
                        agent.role === 'Root Orchestrator'
                          ? 'bg-gradient-to-r from-indigo-500 to-cyan-500'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500'
                      }`}
                      style={{ width: `${Math.max(5, tokenSharePct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>
                      Prompt File: <code className="text-slate-400 font-mono">{agent.promptFile}</code> · Tools:{' '}
                      <span className="text-slate-300 font-mono">{agent.toolsCount} bound</span>
                    </span>
                    <span>Est. Inference Time: ~{agent.estInferenceSec}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget Optimization Advice */}
        <div className="p-3 bg-indigo-950/20 border border-indigo-900/50 rounded-lg flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
          <Calculator className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-indigo-300">12-Hour Optimization Tip:</strong> To maximize the number of SWE-Bench repositories solved within the competition's 12-hour budget, keep root agent system prompts concise (&lt;1,200 tokens) and utilize call-graph tools (<code className="text-cyan-300 font-mono">search_similar_code</code>, <code className="text-cyan-300 font-mono">get_code_subgraph</code>) rather than dumping large source files into the context window.
          </div>
        </div>
      </div>

      {/* Diagnostics List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white">
              Detected Diagnostics ({validation.issues.length})
            </h3>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span className="text-rose-400">{validation.errorsCount} Errors</span>
            <span className="text-amber-400">{validation.warningsCount} Warnings</span>
            <span className="text-cyan-400">{validation.infoCount} Recommendations</span>
          </div>
        </div>

        {validation.issues.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">
              Your submission structure is 100% compliant!
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All rules, model specifications, allowed harness tools, and !include paths are fully validated. You can safely export your <code className="text-emerald-300 font-mono">submission.zip</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {validation.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                  issue.severity === 'error'
                    ? 'bg-rose-950/20 border-rose-900/60'
                    : issue.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-900/60'
                    : 'bg-cyan-950/20 border-cyan-900/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {issue.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Info className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{issue.title}</span>
                      <span className="font-mono text-[10px] text-slate-500">[{issue.path}]</span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">{issue.message}</p>
                  </div>
                </div>

                {issue.autoFixAvailable && (
                  <button
                    onClick={() => onAutoFix(issue.fixAction)}
                    className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[11px] border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Wrench className="w-3 h-3 text-indigo-400" />
                    <span>Auto-Fix</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
