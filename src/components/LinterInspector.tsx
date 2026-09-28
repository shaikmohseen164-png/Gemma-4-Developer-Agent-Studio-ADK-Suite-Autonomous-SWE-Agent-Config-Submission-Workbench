import React from 'react';
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
} from 'lucide-react';
import { ValidationSummary } from '../utils/adkValidator';
import { VirtualFileTree, REQUIRED_BASE_MODEL } from '../types/agent';

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
