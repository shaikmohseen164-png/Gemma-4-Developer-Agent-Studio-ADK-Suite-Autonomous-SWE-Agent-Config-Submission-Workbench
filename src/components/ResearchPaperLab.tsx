import React, { useState } from 'react';
import {
  BookOpen,
  Award,
  Calendar,
  Sparkles,
  Copy,
  Check,
  FileText,
  BrainCircuit,
  Binary,
  GitBranch,
  Target,
} from 'lucide-react';
import { AgentArchitecturePreset } from '../data/defaultPresets';

interface ResearchPaperLabProps {
  currentPreset: AgentArchitecturePreset;
}

export const ResearchPaperLab: React.FC<ResearchPaperLabProps> = ({ currentPreset }) => {
  const [copied, setCopied] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<number>(0);

  const researchTopics = [
    {
      title: 'Tuning & Optimization',
      tagline: 'PEFT LoRA & Reinforcement Learning for SWE Agents',
      icon: Binary,
      description:
        'Parameter-efficient fine-tuning (rank r=16/32, alpha=32/64) and RL with execution feedback (RLHF/DPO/PPO) designed to steer Gemma 4 (31B QAT W4A16) toward minimal surgical unified diffs rather than destructive file overwrites.',
      keyIdeas: [
        'Multi-adapter routing: separate LoRAs for code navigation vs unified diff patch drafting',
        'Direct Preference Optimization (DPO) on SWE-Bench trajectories with unit test pass signals',
        'Quantization-aware training (QAT W4A16) stability and inference latency debits against 12h budget',
      ],
    },
    {
      title: 'Code Comprehension',
      tagline: 'Code-Graph Generation, AST Parsing & Dense Embeddings',
      icon: BrainCircuit,
      description:
        'Techniques for converting repository ASTs, symbol tables, and type inference trees into multi-relational graphs for zero-shot bug localization.',
      keyIdeas: [
        'Bi-encoder dense code embeddings trained on contrastive docstring-to-implementation pairs',
        'AST-aware graph tokenization bridging raw Python source code and static dependency maps',
        'Dynamic call-graph pruning to filter out noisy stdlib and external test dependencies',
      ],
    },
    {
      title: 'Graph Reasoning',
      tagline: 'LLM Reasoning over Large-Scale Code Graphs',
      icon: GitBranch,
      description:
        'Architectures enabling Gemma 4 to reason over induced subgraphs (get_code_subgraph) and trace multi-hop caller-callee chains across thousands of symbols without context window saturation.',
      keyIdeas: [
        'Iterative subgraph expansion using BFS frontier expansion guided by semantic relevance',
        'Topological sorting of call chains injected directly into ReAct scratchpad prompts',
        'Graph-constrained decoding preventing hallucinated symbol references in generated patches',
      ],
    },
    {
      title: 'Tasks & Benchmarks',
      tagline: 'Evaluation Datasets & Structured Code Generation',
      icon: Target,
      description:
        'Benchmarking SWE agents beyond simple single-file edits: evaluating resilience on multi-file refactoring, regression avoidance, and real-time sandbox resource debiting.',
      keyIdeas: [
        'PASS/FAIL test harness isolation with containerized Docker sandboxing',
        'Diagnostic analysis of failure modes: syntax errors vs test assertion failures vs timeouts',
        'Cross-repository generalization across dynamic typing (Python) and complex math engines (SymPy)',
      ],
    },
  ];

  // Dynamic LaTeX / Markdown Abstract Generator
  const generatePaperDraft = () => {
    return `# Sovereign-SWE: Graph-Augmented Autonomous Engineering with Gemma 4

**Authors:** Research Track Submission (Google - The Gemma 4 Developer Agent Competition)
**Track:** Research Paper Track ($35,000 Award) · NeurIPS Expo Workshop Showcase
**Base Model:** Google Gemma 4 (31B QAT W4A16)
**Architecture Preset:** ${currentPreset.name}

## Abstract
Autonomous software engineering agents require both structural code comprehension and precision in code generation. In this work, we introduce an autonomous agent architecture built upon Google's Gemma 4 31B QAT model for SWE-Bench issue resolution. Addressing the limitations of unstructured repository file traversal, our system pairs a root orchestrator with specialized AgentTools utilizing pre-computed repository call graphs (\`get_code_neighbors\`, \`get_code_subgraph\`) and dense semantic embeddings (\`search_similar_code\`).

Through parameter-efficient LoRA adapters (targeting attention projections \`q_proj\`, \`v_proj\`, \`o_proj\`), our agent decouples symbol topology exploration from patch synthesis. Under strict evaluation constraints capped at a 12-hour execution budget, our agent achieves high pass rates on regression tests while minimizing token consumption and context degradation. We analyze the interplay between induced graph representations and multi-step ReAct reasoning, highlighting the efficacy of graph-constrained grounding in autonomous software engineering.

## Proposed Methodology
1. **Semantic Anchor Localization**: Cosine similarity retrieval over pre-computed symbol embeddings.
2. **Induced Subgraph Grounding**: Pruning irrelevant call trees to present Gemma 4 with caller-callee subgraphs.
3. **PEFT Multi-LoRA Specialization**: Adapter separation between read-only structural analysis and surgical patch generation.
4. **Iterative Test-Driven Repair**: Feedback loop executing validation suites inside a hardened Docker sandbox.

## Target Venue & Timeline
- Paper Submission Deadline: November 12, 2026 (11:59 PM UTC)
- Final Competition Deadline: December 2, 2026
`;
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(generatePaperDraft());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
      {/* Top Banner: $35k Paper Award & NeurIPS Event */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-800/50 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Paper Submission Award Track: $35,000 Prize
            </h2>
            <span className="text-[11px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              NeurIPS Expo Workshop
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Participants are encouraged to submit original, unpublished research papers on novel SWE agent techniques. Top submissions will be highlighted at a Google-hosted event and awarded prizes from the $35,000 paper pool.
          </p>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 rounded-lg flex items-center gap-3 shrink-0">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <div className="text-xs">
            <div className="text-slate-400 text-[10px] uppercase font-mono">Paper Deadline</div>
            <div className="font-semibold text-slate-200">November 12, 2026 (11:59 PM UTC)</div>
          </div>
        </div>
      </div>

      {/* 4 Research Themes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {researchTopics.map((topic, idx) => {
          const Icon = topic.icon;
          const isSelected = selectedTopic === idx;
          return (
            <div
              key={idx}
              onClick={() => setSelectedTopic(idx)}
              className={`p-4 rounded-xl border bg-slate-900/80 cursor-pointer transition flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-950/40'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Track #{idx + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{topic.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-3">{topic.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-medium text-indigo-400">
                {isSelected ? 'Viewing details ↓' : 'Click to inspect ideas'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Theme Deep-Dive */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
              <span>{researchTopics[selectedTopic].title}</span>
              <span className="text-xs text-slate-400 font-normal">
                — {researchTopics[selectedTopic].tagline}
              </span>
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {researchTopics[selectedTopic].keyIdeas.map((idea, idx) => (
            <div
              key={idx}
              className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5"
            >
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] flex items-center justify-center shrink-0 border border-indigo-500/30">
                {idx + 1}
              </span>
              <span>{idea}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Paper Abstract & Outline Generator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white">Auto-Generated Research Paper Draft</h3>
            <span className="text-[10px] font-mono text-slate-500">
              (Tailored to {currentPreset.name})
            </span>
          </div>

          <button
            onClick={handleCopyDraft}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Markdown'}</span>
          </button>
        </div>

        <pre className="bg-slate-950 rounded-lg border border-slate-800 p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[300px] whitespace-pre-wrap selection:bg-indigo-500/30">
          {generatePaperDraft()}
        </pre>
      </div>

      {/* Official Prize Breakdown & Timeline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Competition Timeline & Prize Distribution ($100,000)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Prizes */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2.5">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Agent Leaderboard Prizes ($65,000)</span>
              <span className="text-amber-400 font-mono font-bold">$65,000</span>
            </div>
            <div className="space-y-1.5 pl-2 text-slate-300">
              <div className="flex justify-between">
                <span>🥇 1st Place</span>
                <span className="font-mono text-emerald-400 font-semibold">$37,000</span>
              </div>
              <div className="flex justify-between">
                <span>🥈 2nd Place</span>
                <span className="font-mono text-emerald-400 font-semibold">$18,000</span>
              </div>
              <div className="flex justify-between">
                <span>🥉 3rd Place</span>
                <span className="font-mono text-emerald-400 font-semibold">$10,000</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 text-amber-300">
                <span>📄 Paper Submission Award (Optional)</span>
                <span className="font-mono font-semibold">$35,000</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2.5">
            <div className="font-semibold text-slate-200">Official Dates & Deadlines</div>
            <div className="space-y-1.5 pl-2 text-slate-300">
              <div className="flex justify-between">
                <span>Start Date</span>
                <span className="font-mono text-slate-400">September 23, 2026</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Research Paper Deadline</span>
                <span className="font-mono font-semibold">November 12, 2026</span>
              </div>
              <div className="flex justify-between">
                <span>Entry & Team Merger Deadline</span>
                <span className="font-mono text-slate-400">November 25, 2026</span>
              </div>
              <div className="flex justify-between text-emerald-300 font-medium">
                <span>Final Submission Deadline</span>
                <span className="font-mono font-semibold">December 2, 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
