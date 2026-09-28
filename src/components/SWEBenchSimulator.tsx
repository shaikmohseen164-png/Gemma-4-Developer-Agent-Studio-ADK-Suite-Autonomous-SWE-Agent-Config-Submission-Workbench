import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  FileDiff,
  Wrench,
  Bot,
  AlertCircle,
  Eye,
  Sliders,
} from 'lucide-react';
import { SAMPLE_SWE_TASKS } from '../data/defaultPresets';
import { SWEBenchTask } from '../types/agent';

export const SWEBenchSimulator: React.FC = () => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(SAMPLE_SWE_TASKS[0].id);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // ms per step
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(142); // 12-hour budget simulation
  const [showGoldDiff, setShowGoldDiff] = useState<boolean>(false);

  const currentTask: SWEBenchTask =
    SAMPLE_SWE_TASKS.find((t) => t.id === selectedTaskId) || SAMPLE_SWE_TASKS[0];

  const steps = currentTask.steps;
  const currentStep = steps[currentStepIndex];
  const isFinished = currentStepIndex >= steps.length - 1;

  // Auto-play effect
  useEffect(() => {
    let timer: any;
    if (isPlaying && !isFinished) {
      timer = setTimeout(() => {
        setCurrentStepIndex((prev) => {
          const next = prev + 1;
          setElapsedSeconds((sec) => sec + Math.round((currentTask.steps[next]?.durationMs || 1000) / 100));
          return next;
        });
      }, playbackSpeed);
    } else if (isFinished) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, isFinished, playbackSpeed, currentTask]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setElapsedSeconds(45);
  };

  const handleStepForward = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setElapsedSeconds((sec) => sec + 18);
    }
  };

  // 12-hour budget calculation (12 hours = 43200 seconds)
  const TOTAL_BUDGET_SECONDS = 12 * 3600;
  const remainingSeconds = Math.max(0, TOTAL_BUDGET_SECONDS - elapsedSeconds);
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
      {/* Top Banner: Task Selector, 12h Budget Clock & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Task picker */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Benchmark Task:</span>
              <span className="font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40 text-[11px]">
                {currentTask.repo}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                currentTask.difficulty === 'Easy' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                {currentTask.difficulty}
              </span>
            </div>
            <select
              aria-label="Select benchmark task"
              value={selectedTaskId}
              onChange={(e) => {
                setSelectedTaskId(e.target.value);
                setCurrentStepIndex(0);
              }}
              className="mt-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1 font-semibold focus:outline-none cursor-pointer"
            >
              {SAMPLE_SWE_TASKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.repo}: {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Middle: 12-Hour Budget Meter */}
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-xs">
            <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">
              12-Hour Competition Budget
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-emerald-400 font-semibold">{formatTime(remainingSeconds)}</span>
              <span className="text-slate-500">remaining</span>
            </div>
          </div>
        </div>

        {/* Right: Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium text-xs shadow transition cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : isFinished ? 'Replay' : 'Run Agent'}</span>
          </button>

          <button
            onClick={handleStepForward}
            disabled={isFinished}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded text-xs transition cursor-pointer"
            title="Step Forward"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Step</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer"
            title="Reset Trace"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-xs text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <select
              aria-label="Simulation speed"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value={2000} className="bg-slate-900">0.5x</option>
              <option value={1500} className="bg-slate-900">1.0x</option>
              <option value={800} className="bg-slate-900">2.0x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Agent Trace Execution vs Output & Diff */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: ReAct Execution Steps Trace */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-white">Gemma 4 ReAct Trace</h3>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>

          {/* Step Timeline Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIndex(idx)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono shrink-0 transition flex items-center gap-1 cursor-pointer border ${
                  idx === currentStepIndex
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                    : idx < currentStepIndex
                    ? 'bg-slate-950 text-emerald-400 border-slate-800'
                    : 'bg-slate-950 text-slate-400 border-slate-800/60'
                }`}
              >
                <span>#{idx + 1}</span>
                <span className="text-[10px] opacity-80">{s.toolCall?.name || s.phase}</span>
              </button>
            ))}
          </div>

          {/* Active Step Card */}
          <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800/80 p-4 space-y-3 overflow-y-auto max-h-[460px]">
            {/* Thought */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                <span>Gemma 4 Reasoning (Thought)</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                {currentStep.thought}
              </p>
            </div>

            {/* Action / Tool Call */}
            {currentStep.toolCall && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Action: {currentStep.toolCall.name}</span>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-cyan-200 overflow-x-auto">
                  <div className="text-slate-500 mb-1"># Invoking sandbox tool in /workspace</div>
                  <div>
                    {currentStep.toolCall.name}(
                    {Object.entries(currentStep.toolCall.args)
                      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                      .join(', ')}
                    )
                  </div>
                </div>
              </div>
            )}

            {/* Observation / Output */}
            {currentStep.toolResult && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Observation (Sandbox Result)</span>
                </div>
                <pre className="bg-slate-900/90 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {currentStep.toolResult}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Problem Statement & Unified Git Diff / Test Output */}
        <div className="lg:col-span-6 space-y-4">
          {/* Problem Statement Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Problem Statement
              </span>
              <span className="font-mono text-[10px] text-slate-400">SWE-Bench Issue</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap bg-slate-950 p-2.5 rounded border border-slate-800/80">
              {currentTask.problemStatement}
            </p>
          </div>

          {/* Unified Diff & Validation Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <FileDiff className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white">
                  {showGoldDiff ? 'Benchmark Gold Patch' : 'Agent Generated Git Diff'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGoldDiff(!showGoldDiff)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  {showGoldDiff ? 'Show Agent Patch' : 'View Gold Patch'}
                </button>
              </div>
            </div>

            {/* Diff content view */}
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 font-mono text-xs overflow-x-auto max-h-[220px]">
              {showGoldDiff ? (
                currentTask.goldenPatch.split('\n').map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith('+')
                        ? 'text-emerald-400 bg-emerald-950/30'
                        : line.startsWith('-')
                        ? 'text-rose-400 bg-rose-950/30'
                        : line.startsWith('@')
                        ? 'text-cyan-400'
                        : 'text-slate-400'
                    }
                  >
                    {line}
                  </div>
                ))
              ) : currentStepIndex >= 3 ? (
                currentTask.goldenPatch.split('\n').map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith('+')
                        ? 'text-emerald-400 bg-emerald-950/30'
                        : line.startsWith('-')
                        ? 'text-rose-400 bg-rose-950/30'
                        : line.startsWith('@')
                        ? 'text-cyan-400'
                        : 'text-slate-400'
                    }
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic py-6 text-center">
                  (Patch not generated yet. Agent is currently inspecting call-graph & files.)
                </div>
              )}
            </div>

            {/* Validation Test Status */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400 text-[11px]">Validation Command:</div>
                <div className="font-mono text-slate-200 text-[11px]">{currentTask.testCommand}</div>
              </div>

              <div>
                {isFinished ? (
                  <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-300 px-3 py-1.5 rounded border border-emerald-800 font-mono font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>PASS (100%)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-900 text-slate-400 px-3 py-1.5 rounded border border-slate-800 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>In Progress...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
