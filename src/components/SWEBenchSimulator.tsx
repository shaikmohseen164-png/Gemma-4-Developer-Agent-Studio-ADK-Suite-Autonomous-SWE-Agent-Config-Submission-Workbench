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
  CheckCheck,
  Code2,
  ShieldAlert,
  FileCode,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { SAMPLE_SWE_TASKS } from '../data/defaultPresets';
import { SWEBenchTask, VirtualFileTree } from '../types/agent';

interface SWEBenchSimulatorProps {
  files?: VirtualFileTree;
}

export const SWEBenchSimulator: React.FC<SWEBenchSimulatorProps> = ({ files }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(SAMPLE_SWE_TASKS[0].id);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // ms per step
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(142); // 12-hour budget simulation
  const [showGoldDiff, setShowGoldDiff] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'test_runner'>('diff');
  const [selectedTestTemplate, setSelectedTestTemplate] = useState<string>('validate_patch.py');
  const [testRunnerView, setTestRunnerView] = useState<'console' | 'source'>('console');
  const [testExecutionLog, setTestExecutionLog] = useState<string | null>(null);
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testResultStatus, setTestResultStatus] = useState<'passed' | 'failed' | null>(null);
  const [copiedTestScript, setCopiedTestScript] = useState<boolean>(false);

  const currentTask: SWEBenchTask =
    SAMPLE_SWE_TASKS.find((t) => t.id === selectedTaskId) || SAMPLE_SWE_TASKS[0];

  const steps = currentTask.steps;
  const currentStep = steps[currentStepIndex];
  const isFinished = currentStepIndex >= steps.length - 1;
  const hasStagedPatch = currentStepIndex >= 3;

  // Retrieve test templates from files?.tests
  const testFilesAvailable = Object.keys(files?.tests || {});
  const availableTestTemplates = testFilesAvailable.length > 0
    ? testFilesAvailable
    : ['validate_patch.py', 'test_reproducer.py'];

  // Current selected test script code
  const currentTestCode = files?.tests?.[selectedTestTemplate] ||
    (selectedTestTemplate === 'test_reproducer.py'
      ? `#!/usr/bin/env python3
"""
Stand-alone Bug Reproduction Template.
The agent scripts this to verify that the bug is reproduced before drafting fixes.
"""
import sys

def test_problem_statement():
    print(f"Verifying {currentTask.repo} problem statement...")
    # Assertion matching current task
    assert True, "Assertion reproduced"
    print("Reproduction test passed: issue successfully fixed!")

if __name__ == "__main__":
    test_problem_statement()
    sys.exit(0)
`
      : `#!/usr/bin/env python3
"""
Validation Test Runner for Gemma 4 Autonomous SWE Agent.
Executes before 'submit_patch()' to ensure zero regressions in /workspace.
"""
import subprocess
import sys
import os

def check_staged_diff():
    print("[1/3] Checking git diff HEAD staged modifications...")
    res = subprocess.run(["git", "diff", "HEAD"], capture_output=True, text=True)
    if not res.stdout.strip():
        print("ERROR: No staged patch modifications found. Agent must modify files before submitting.")
        return False
    print(f"OK: Staged diff contains valid patch lines.")
    return True

def run_regression_tests():
    print("[2/3] Executing repository test suite...")
    cmd = ["pytest", "-q", "${currentTask.filesInvolved[0]}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode == 0

def audit_syntax():
    print("[3/3] Auditing modified files for syntax compilation...")
    res = subprocess.run(["python3", "-m", "compileall", "-q", "."], capture_output=True)
    return res.returncode == 0

if __name__ == "__main__":
    if check_staged_diff() and audit_syntax() and run_regression_tests():
        print("\\n>>> VERIFICATION SUCCESS: Safe to invoke submit_patch()")
        sys.exit(0)
    else:
        print("\\n>>> VERIFICATION FAILURE: Do NOT submit patch yet.")
        sys.exit(1)
`);

  // Handle run validation test execution simulation
  const handleRunValidationTest = () => {
    setIsRunningTest(true);
    setTestExecutionLog(null);
    setTestResultStatus(null);
    setActiveTab('test_runner');
    setTestRunnerView('console');

    const isReproducer = selectedTestTemplate.includes('reproducer');

    setTimeout(() => {
      setIsRunningTest(false);
      if (isReproducer) {
        if (!hasStagedPatch) {
          setTestResultStatus('failed');
          setTestExecutionLog(`$ python3 tests/${selectedTestTemplate}
[STANDALONE BUG REPRODUCTION HARNESS]
Repository: ${currentTask.repo}
Target File: ${currentTask.filesInvolved[0]}
Testing problem statement assertion:
> ${currentTask.problemStatement.split('\n')[0]}

Traceback (most recent call last):
  File "tests/${selectedTestTemplate}", line 15, in test_problem_statement
    assert res == expected, f"Expected {expected}, got {res}"
AssertionError: Bug reproduced! Unreduced expression or domain mismatch.

============================= 1 failed in 0.38s =============================
>>> BUG CONFIRMED REPRODUCED (Exit status 1).
>>> Baseline failure established in test_reproducer.py prior to patch.`);
        } else {
          setTestResultStatus('passed');
          setTestExecutionLog(`$ python3 tests/${selectedTestTemplate}
[STANDALONE BUG REPRODUCTION HARNESS]
Repository: ${currentTask.repo}
Target File: ${currentTask.filesInvolved[0]}
Applying staged modifications from /workspace...
Testing problem statement assertion:
> ${currentTask.problemStatement.split('\n')[0]}

Reproduction test passed: issue successfully fixed without side effects!
============================= 1 passed in 0.42s =============================
>>> VERIFICATION SUCCESS (Exit status 0): Standalone reproducer confirms patch resolves the issue!`);
        }
      } else {
        if (!hasStagedPatch) {
          setTestResultStatus('failed');
          setTestExecutionLog(`$ python3 tests/${selectedTestTemplate}
================================================================================
SWE-BENCH PRE-SUBMISSION VALIDATION HARNESS (Gemma 4 Developer Agent)
Target: ${currentTask.repo} (${currentTask.id})
================================================================================
[1/3] Checking git diff HEAD staged modifications in /workspace...
ERROR: No staged patch modifications found.
       Agent must modify files and stage changes before invoking submit_patch()!
Checked paths:
  - ${currentTask.filesInvolved.join('\n  - ')}

============================== VALIDATION FAILED ==============================
>>> VERIFICATION FAILURE (Exit code 1): Do NOT call submit_patch() yet.
>>> REASON: Empty git diff. The agent has not yet generated a fix in the current step.`);
        } else {
          setTestResultStatus('passed');
          setTestExecutionLog(`$ python3 tests/${selectedTestTemplate}
================================================================================
SWE-BENCH PRE-SUBMISSION VALIDATION HARNESS (Gemma 4 Developer Agent)
Target: ${currentTask.repo} (${currentTask.id})
================================================================================
[1/3] Checking git diff HEAD staged modifications in /workspace...
OK: Staged diff detected:
    M ${currentTask.filesInvolved[0]}
    >>> 8 insertions(+), 2 deletions(-) recorded in git staging.

[2/3] Auditing modified files for syntax compilation (python3 -m compileall)...
Listing /workspace ...
Compiling /workspace/${currentTask.filesInvolved[0]} ...
OK: AST parsing and bytecode compilation successful. 0 syntax errors detected.

[3/3] Executing repository test suite:
$ ${currentTask.testCommand}
============================= test session starts ==============================
platform linux -- Python 3.11.8, pytest-7.4.4, pluggy-1.4.0
rootdir: /workspace, configfile: pytest.ini
plugins: cov-4.1.0, timeout-2.2.0
collected 3 items / 0 deselected / 3 selected

${currentTask.filesInvolved[0]}::test_factor_algebraic_multivariate PASSED [ 33%]
${currentTask.filesInvolved[0]}::test_factor_algebraic_composite PASSED    [ 66%]
${currentTask.filesInvolved[0]}::test_dup_factor_list_dispatch PASSED     [100%]

============================== 3 passed in 1.48s ===============================
>>> VERIFICATION SUCCESS: All regression tests passed with returncode 0.
>>> SAFE TO INVOKE 'submit_patch()' AND PACKAGE INTO submission.zip!`);
        }
      }
    }, 850);
  };

  const handleFastForwardAndVerify = () => {
    setCurrentStepIndex(steps.length - 1);
    setElapsedSeconds(210);
    setTimeout(() => {
      handleRunValidationTest();
    }, 100);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(currentTestCode);
    setCopiedTestScript(true);
    setTimeout(() => setCopiedTestScript(false), 2000);
  };

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

          {/* Dual Tab Card: Unified Diff & Validation Test Runner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Tab Navigation Bar */}
            <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('diff')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition cursor-pointer ${
                    activeTab === 'diff'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileDiff className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Unified Git Diff</span>
                </button>
                <button
                  onClick={() => setActiveTab('test_runner')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition cursor-pointer ${
                    activeTab === 'test_runner'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Validation Test Runner</span>
                  {testResultStatus === 'passed' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {testResultStatus === 'failed' && (
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                  )}
                </button>
              </div>

              {activeTab === 'diff' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGoldDiff(!showGoldDiff)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
                  >
                    {showGoldDiff ? 'Show Agent Patch' : 'View Gold Patch'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">Sandbox:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Isolated Safe Mode
                  </span>
                </div>
              )}
            </div>

            {/* TAB CONTENT: Unified Git Diff */}
            {activeTab === 'diff' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-1">
                  <div className="flex items-center gap-2">
                    <FileDiff className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-white">
                      {showGoldDiff ? 'Benchmark Gold Reference Patch' : 'Agent Generated Git Diff'}
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {hasStagedPatch ? 'git diff HEAD staged' : 'No patch staged'}
                  </span>
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
                  ) : hasStagedPatch ? (
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
            )}

            {/* TAB CONTENT: Validation Test Runner */}
            {activeTab === 'test_runner' && (
              <div className="p-4 space-y-4">
                {/* Template Selection & Runner Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Select Test Template from <code className="text-indigo-300 font-mono">tests/</code>:</span>
                    </div>
                    <select
                      aria-label="Select test template"
                      value={selectedTestTemplate}
                      onChange={(e) => {
                        setSelectedTestTemplate(e.target.value);
                        setTestExecutionLog(null);
                        setTestResultStatus(null);
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {availableTestTemplates.map((tName) => (
                        <option key={tName} value={tName}>
                          tests/{tName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunValidationTest}
                      disabled={isRunningTest}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      {isRunningTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Running in Sandbox...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Run Validation Test</span>
                        </>
                      )}
                    </button>

                    {!hasStagedPatch && (
                      <button
                        onClick={handleFastForwardAndVerify}
                        className="px-2.5 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700/60 rounded text-xs flex items-center gap-1 transition cursor-pointer"
                        title="Fast-forward ReAct trajectory to patch phase and execute verification"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Apply & Verify</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Subview Toggle: Console vs Script Source */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setTestRunnerView('console')}
                      className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                        testRunnerView === 'console'
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Execution Console & Logs
                    </button>
                    <button
                      onClick={() => setTestRunnerView('source')}
                      className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                        testRunnerView === 'source'
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Code2 className="w-3 h-3 text-cyan-400" />
                      <span>Template Source (tests/{selectedTestTemplate})</span>
                    </button>
                  </div>

                  {testRunnerView === 'source' && (
                    <button
                      onClick={handleCopyScript}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-mono"
                    >
                      {copiedTestScript ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* VIEW 1: Execution Console Terminal */}
                {testRunnerView === 'console' && (
                  <div className="space-y-3">
                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner font-mono text-xs">
                      {/* Terminal Title Bar */}
                      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                          <span className="ml-2 text-slate-300">python3 /workspace/tests/{selectedTestTemplate}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-sans">SWE-Bench Sandbox</span>
                      </div>

                      {/* Terminal Output Body */}
                      <div className="p-3.5 max-h-[260px] min-h-[160px] overflow-y-auto space-y-1 text-slate-300">
                        {isRunningTest ? (
                          <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                            <div className="text-xs">Executing test harness in /workspace...</div>
                            <div className="text-[10px] text-slate-500 font-mono">Running AST check & pytest test suite</div>
                          </div>
                        ) : testExecutionLog ? (
                          testExecutionLog.split('\n').map((line, idx) => (
                            <div
                              key={idx}
                              className={
                                line.includes('SUCCESS') || line.includes('PASSED') || line.includes('OK:')
                                  ? 'text-emerald-400'
                                  : line.includes('FAILED') || line.includes('ERROR:') || line.includes('FAILURE')
                                  ? 'text-rose-400 bg-rose-950/20 px-1 rounded'
                                  : line.startsWith('$')
                                  ? 'text-indigo-300 font-semibold'
                                  : line.startsWith('=')
                                  ? 'text-cyan-400'
                                  : 'text-slate-300'
                              }
                            >
                              {line}
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-slate-500 space-y-2">
                            <Terminal className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
                            <div className="text-xs">
                              Click <strong className="text-emerald-400 font-sans">"Run Validation Test"</strong> above to verify your agent's patch.
                            </div>
                            <div className="text-[11px] text-slate-500 max-w-sm mx-auto font-sans">
                              Verifies that git diff HEAD is non-empty, checks for AST syntax regressions with compileall, and runs repository validation tests before submission.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pre-Submission Verification Summary Banner */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-slate-400">Pre-Submission Result:</div>
                        <div className="font-mono text-slate-200 text-[11px] flex items-center gap-1.5">
                          {testResultStatus === 'passed' ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED: Ready to package submission.zip
                            </span>
                          ) : testResultStatus === 'failed' ? (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> REJECTED: Fix patch before calling submit_patch()
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not tested yet in this session</span>
                          )}
                        </div>
                      </div>

                      <div>
                        {testResultStatus === 'passed' ? (
                          <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-300 px-3 py-1.5 rounded border border-emerald-800 font-mono font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>PASS (100%)</span>
                          </div>
                        ) : testResultStatus === 'failed' ? (
                          <div className="flex items-center gap-1.5 bg-rose-950 text-rose-300 px-3 py-1.5 rounded border border-rose-800 font-mono font-semibold">
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>FAIL (Exit 1)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-slate-900 text-slate-400 px-3 py-1.5 rounded border border-slate-800 font-mono">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Run</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: Template Source Viewer */}
                {testRunnerView === 'source' && (
                  <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-xs overflow-x-auto max-h-[300px]">
                    <div className="text-[10px] text-slate-500 mb-2 pb-1 border-b border-slate-800/80 flex items-center justify-between">
                      <span>File: /workspace/tests/{selectedTestTemplate}</span>
                      <span>{currentTestCode.split('\n').length} lines · Python 3.11</span>
                    </div>
                    {currentTestCode.split('\n').map((line, idx) => (
                      <div key={idx} className="flex gap-3 leading-5">
                        <span className="text-slate-600 text-[10px] w-6 text-right select-none">{idx + 1}</span>
                        <span className={
                          line.startsWith('def ') || line.startsWith('import ') || line.startsWith('from ')
                            ? 'text-indigo-300'
                            : line.startsWith('#')
                            ? 'text-slate-500 italic'
                            : line.includes('print(')
                            ? 'text-emerald-300'
                            : line.includes('assert ')
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }>
                          {line || '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
