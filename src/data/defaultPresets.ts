import {
  LoRAConfig,
  SamplingConfig,
  SkillConfig,
  SubAgentConfig,
  SWEBenchTask,
  REQUIRED_BASE_MODEL,
} from '../types/agent';

export interface AgentArchitecturePreset {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  rootAgent: {
    name: string;
    model: string;
    adapter?: string;
    systemPromptPath: string;
    tools: string[];
    subAgents: string[]; // filenames
  };
  subAgents: SubAgentConfig[];
  prompts: Record<string, string>; // filepath -> content
  sampling: SamplingConfig;
  loras: LoRAConfig[];
  skills: SkillConfig[];
  evalConfig: {
    max_overall_hours: number;
    per_task_timeout_sec: number;
    max_iterations_per_task: number;
    enable_sandbox_network: boolean;
  };
}

export const PRESET_GRAPH_AUGMENTED: AgentArchitecturePreset = {
  id: 'graph-swe-react',
  name: 'Graph-Augmented SWE ReAct Agent',
  badge: 'Recommended SOTA',
  tagline: 'Orchestrator + Code Analyzer AgentTool with Repository Call-Graph & Embedding Retrieval',
  rootAgent: {
    name: 'GemmaSweOrchestrator',
    model: REQUIRED_BASE_MODEL,
    adapter: 'main_lora',
    systemPromptPath: 'prompts/system.md',
    tools: [
      'read_file',
      'edit_file',
      'write_file',
      'run_command',
      'submit_patch',
      'get_status',
      'get_code_neighbors',
      'search_similar_code',
      'get_code_subgraph',
    ],
    subAgents: ['code_analyzer.yaml'],
  },
  subAgents: [
    {
      id: 'sub-1',
      name: 'CodeGraphAnalyzer',
      filename: 'code_analyzer.yaml',
      model: REQUIRED_BASE_MODEL,
      adapter: 'tool_lora',
      prompt_path: 'prompts/analyzer.md',
      tools: ['get_code_neighbors', 'search_similar_code', 'get_code_subgraph', 'read_file'],
      description: 'Read-only specialist agent tool that queries repository graph structures, symbol definitions, and cosine embeddings to isolate faulty code nodes.',
    },
  ],
  prompts: {
    'prompts/system.md': `# Gemma 4 Autonomous SWE Orchestrator

You are an expert autonomous software engineering agent powered by Gemma 4 (31B QAT W4A16).
Your task is to independently locate, reproduce, resolve, and verify repository bugs under SWE-Bench evaluation constraints.

## Operational Methodology:
1. **Locate & Ground**:
   - Begin by analyzing the problem statement.
   - Use \`search_similar_code(query)\` to find semantic anchor nodes in the pre-computed embeddings.
   - Use \`get_code_neighbors(node)\` and \`get_code_subgraph(nodes)\` to map caller-callee chains and class hierarchies.
   - Delegate heavy structural analysis to the \`code_analyzer\` AgentTool when dealing with multi-module traces.

2. **Inspect Files**:
   - Read the relevant source files with line slicing using \`read_file(filepath, start_line, end_line)\`.
   - Never speculate on file contents without reading the exact code first.

3. **Reproduce & Test**:
   - Write a standalone test script or run the repository test suite via \`run_command(command)\`.
   - Ensure the failure matches the bug description before attempting fixes.

4. **Precise Patch Drafting**:
   - Apply minimal, atomic surgical changes using \`edit_file(filepath, old_string, new_string)\`.
   - Avoid indiscriminate rewrites that create unintended regressions.

5. **Validation & Patch Submission**:
   - Re-run the tests to verify the regression is solved and existing tests pass.
   - Call \`submit_patch()\` to stage untracked files and record your final git diff.
   - Query \`get_status()\` to check elapsed budget and patch status.
`,
    'prompts/analyzer.md': `# Code Graph & Symbol Dependency Specialist

You are an auxiliary analysis agent tool specialized in structural navigation over repository call graphs.
You have read-only access to graph tools and source code files.

## Guidelines:
- Inspect call graphs via \`get_code_neighbors\` to trace incoming/outgoing call edges.
- Formulate precise induced subgraphs with \`get_code_subgraph\` when complex multi-hop dependencies exist.
- Return structured summaries specifying:
  - Exact file paths and line numbers of suspected root causes.
  - Upstream caller dependencies that might be broken by signature modifications.
  - Recommended verification tests.
`,
  },
  sampling: {
    temperature: 0.2,
    top_p: 0.95,
    top_k: 40,
    max_output_tokens: 4096,
  },
  loras: [
    {
      id: 'lora-1',
      name: 'main_lora',
      r: 16,
      lora_alpha: 32,
      target_modules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
      lora_dropout: 0.05,
      bias: 'none',
      task_type: 'CAUSAL_LM',
      safetensors_size_mb: 284,
      description: 'Fine-tuned on SWE-Bench repair trajectories with unified diff editing and step-by-step tool invocation.',
    },
    {
      id: 'lora-2',
      name: 'tool_lora',
      r: 8,
      lora_alpha: 16,
      target_modules: ['q_proj', 'v_proj', 'o_proj'],
      lora_dropout: 0.05,
      bias: 'none',
      task_type: 'CAUSAL_LM',
      safetensors_size_mb: 142,
      description: 'Fine-tuned specifically for code-graph reasoning, symbol topology retrieval, and induced subgraph reasoning.',
    },
  ],
  skills: [
    {
      id: 'skill-1',
      directoryName: 'repo_navigation',
      name: 'repo_navigation',
      description: 'Domain knowledge and AST search tools to fast-track navigation across multi-million line codebases.',
      markdownDoc: `---
name: repo_navigation
description: Guidance and scripts for exploring codebase architecture, AST patterns, and call hierarchies.
---

# Repository Navigation Skill

When encountering unknown codebases:
1. Check \`resources/graph_schema.md\` to understand edge types (calls, imports, inherits, references).
2. For AST node discovery, execute \`python scripts/ast_search.py <pattern>\` via \`run_skill_script\`.
`,
      scripts: [
        {
          filename: 'ast_search.py',
          language: 'python',
          code: `#!/usr/bin/env python3
import ast
import sys
import os

def find_symbols(target_name, root_dir="/workspace"):
    matches = []
    for root, _, files in os.walk(root_dir):
        for f in files:
            if f.endswith(".py"):
                p = os.path.join(root, f)
                try:
                    with open(p, "r", encoding="utf-8") as handle:
                        tree = ast.parse(handle.read(), filename=p)
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                            if target_name.lower() in node.name.lower():
                                matches.append(f"{p}:{node.lineno} -> {type(node).__name__} {node.name}")
                except Exception:
                    continue
    return matches

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    for m in find_symbols(query):
        print(m)
`,
        },
      ],
      resources: [
        {
          filename: 'graph_schema.md',
          content: `# Graph Schema Definitions

The pre-computed repository graph contains:
- **Nodes**: Class, Method, Function, Module definitions with fully qualified names (e.g., \`pkg.module.ClassName.method_name\`).
- **Edges**:
  - \`calls\`: Static & dynamic call invocations
  - \`imports\`: Module dependency links
  - \`inherits\`: Object-oriented inheritance links
  - \`instantiates\`: Class constructor invocations
`,
        },
      ],
    },
  ],
  evalConfig: {
    max_overall_hours: 12,
    per_task_timeout_sec: 1800,
    max_iterations_per_task: 35,
    enable_sandbox_network: false,
  },
};

export const PRESET_DUAL_ARCHITECT: AgentArchitecturePreset = {
  id: 'dual-architect-reviewer',
  name: 'Dual-Agent: Architect & Patch Reviewer',
  badge: 'High Precision',
  tagline: 'Separation of concerns: Root orchestrator devises strategy while patch reviewer audits git diffs before submit.',
  rootAgent: {
    name: 'ArchitectAgent',
    model: REQUIRED_BASE_MODEL,
    adapter: 'main_lora',
    systemPromptPath: 'prompts/system.md',
    tools: [
      'read_file',
      'edit_file',
      'write_file',
      'run_command',
      'submit_patch',
      'get_status',
      'get_code_neighbors',
      'search_similar_code',
    ],
    subAgents: ['patch_auditor.yaml'],
  },
  subAgents: [
    {
      id: 'sub-patch-audit',
      name: 'PatchAuditor',
      filename: 'patch_auditor.yaml',
      model: REQUIRED_BASE_MODEL,
      adapter: 'tool_lora',
      prompt_path: 'prompts/patch_auditor.md',
      tools: ['read_file', 'run_command'],
      description: 'Audits staged modifications against syntax regressions, style guidelines, and edge-case test failures.',
    },
  ],
  prompts: {
    'prompts/system.md': `# Gemma 4 SWE Architect

You are the Lead SWE Architect.
Prioritize safety, minimal diff footprint, and rigorous hypothesis validation.
Before invoking \`submit_patch()\`, ask \`patch_auditor\` to review the diff.
`,
    'prompts/patch_auditor.md': `# Patch Auditor Specialist

You evaluate prospective bug fixes. Verify that:
- No unintentional whitespace or unrelated file diffs are included.
- All modified code compiles cleanly without syntax errors.
- Test suites pass with exit status 0.
`,
  },
  sampling: {
    temperature: 0.15,
    top_p: 0.9,
    top_k: 40,
    max_output_tokens: 4096,
  },
  loras: [
    {
      id: 'lora-arch',
      name: 'main_lora',
      r: 32,
      lora_alpha: 64,
      target_modules: ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
      lora_dropout: 0.05,
      bias: 'none',
      task_type: 'CAUSAL_LM',
      safetensors_size_mb: 310,
      description: 'Fine-tuned on reasoning traces and architectural bug localization.',
    },
    {
      id: 'lora-audit',
      name: 'tool_lora',
      r: 8,
      lora_alpha: 16,
      target_modules: ['q_proj', 'v_proj'],
      lora_dropout: 0.05,
      bias: 'none',
      task_type: 'CAUSAL_LM',
      safetensors_size_mb: 130,
      description: 'Tuned on code review, AST diff validation, and test harness execution.',
    },
  ],
  skills: [],
  evalConfig: {
    max_overall_hours: 12,
    per_task_timeout_sec: 2100,
    max_iterations_per_task: 40,
    enable_sandbox_network: false,
  },
};

export const PRESET_MINIMALIST: AgentArchitecturePreset = {
  id: 'fast-single-agent',
  name: 'Minimalist Single Agent (Fast Sweeper)',
  badge: 'Fast & Lightweight',
  tagline: 'Ultra-low overhead single agent config designed to maximize solved tasks within the 12-hour limit.',
  rootAgent: {
    name: 'FastSweeperAgent',
    model: REQUIRED_BASE_MODEL,
    adapter: 'main_lora',
    systemPromptPath: 'prompts/system.md',
    tools: [
      'read_file',
      'edit_file',
      'write_file',
      'run_command',
      'submit_patch',
      'get_status',
      'search_similar_code',
      'get_code_neighbors',
    ],
    subAgents: [],
  },
  subAgents: [],
  prompts: {
    'prompts/system.md': `# Gemma 4 Fast Sweeper Agent

Direct and decisive SWE agent.
1. Locate culprit using \`search_similar_code\`
2. Read 40 lines around target using \`read_file\`
3. Edit target with \`edit_file\`
4. Run \`pytest\` via \`run_command\`
5. If passes, immediately run \`submit_patch()\`
`,
  },
  sampling: {
    temperature: 0.1,
    top_p: 0.9,
    top_k: 30,
    max_output_tokens: 3072,
  },
  loras: [
    {
      id: 'lora-fast',
      name: 'main_lora',
      r: 16,
      lora_alpha: 32,
      target_modules: ['q_proj', 'v_proj'],
      lora_dropout: 0.0,
      bias: 'none',
      task_type: 'CAUSAL_LM',
      safetensors_size_mb: 220,
      description: 'Optimized for high-speed deterministic single-pass problem solving.',
    },
  ],
  skills: [],
  evalConfig: {
    max_overall_hours: 12,
    per_task_timeout_sec: 900,
    max_iterations_per_task: 20,
    enable_sandbox_network: false,
  },
};

export const ALL_PRESETS = [PRESET_GRAPH_AUGMENTED, PRESET_DUAL_ARCHITECT, PRESET_MINIMALIST];

export const SAMPLE_SWE_TASKS: SWEBenchTask[] = [
  {
    id: 'sympy-18080',
    repo: 'sympy/sympy',
    title: 'Factorization bug in polytools with multivariate algebraic expressions',
    difficulty: 'Medium',
    problemStatement: `Issue: \`factor\` method fails to factor polynomials of the form \`x**2 + 2*x + 1 - y**2\` when complex algebraic coefficients are specified.
Expected:
\`factor(x**2 + 2*x + 1 - y**2) -> (x - y + 1)*(x + y + 1)\`
Actual:
Returns unreduced expression or raises \`PolynomialError: cannot construct domain\`.
Please investigate \`sympy/polys/polytools.py\` and \`sympy/polys/factortools.py\`.`,
    hint: 'Check domain coercion in dup_factor_list and ensure algebraic extension fields handle composite constants correctly.',
    filesInvolved: ['sympy/polys/polytools.py', 'sympy/polys/factortools.py', 'sympy/polys/tests/test_polytools.py'],
    sampleGraph: {
      nodes: [
        { id: 'sympy.polys.polytools.factor', name: 'factor', type: 'function', file: 'sympy/polys/polytools.py', line: 5820, docstring: 'Compute the factorization of an expression into irreducible factors.' },
        { id: 'sympy.polys.polytools._generic_factor', name: '_generic_factor', type: 'function', file: 'sympy/polys/polytools.py', line: 5912 },
        { id: 'sympy.polys.factortools.dup_factor_list', name: 'dup_factor_list', type: 'function', file: 'sympy/polys/factortools.py', line: 1140 },
        { id: 'sympy.polys.factortools.dmp_factor_list', name: 'dmp_factor_list', type: 'function', file: 'sympy/polys/factortools.py', line: 1290 },
        { id: 'sympy.polys.domains.domain.Domain.convert', name: 'Domain.convert', type: 'method', file: 'sympy/polys/domains/domain.py', line: 310 },
      ],
      edges: [
        { source: 'sympy.polys.polytools.factor', target: 'sympy.polys.polytools._generic_factor', type: 'calls' },
        { source: 'sympy.polys.polytools._generic_factor', target: 'sympy.polys.factortools.dmp_factor_list', type: 'calls' },
        { source: 'sympy.polys.factortools.dmp_factor_list', target: 'sympy.polys.factortools.dup_factor_list', type: 'calls' },
        { source: 'sympy.polys.factortools.dup_factor_list', target: 'sympy.polys.domains.domain.Domain.convert', type: 'calls' },
      ],
    },
    goldenPatch: `diff --git a/sympy/polys/polytools.py b/sympy/polys/polytools.py
--- a/sympy/polys/polytools.py
+++ b/sympy/polys/polytools.py
@@ -5912,7 +5912,9 @@ def _generic_factor(expr, gens, args, method):
         except DomainError:
             return expr
 
-    if not (f.is_multivariate or f.is_algebraic):
+    if not f.is_multivariate and not f.is_algebraic:
+        factors, opt = _symbolic_factor(f, opt, method)
+    elif f.is_multivariate and f.is_algebraic:
         factors, opt = _symbolic_factor(f, opt, method)
     else:
         factors, opt = _factor(f, opt, method)
`,
    testCommand: 'pytest sympy/polys/tests/test_polytools.py -k test_factor_algebraic',
    steps: [
      {
        step: 1,
        agent: 'GemmaSweOrchestrator',
        phase: 'think',
        thought: 'I need to find where `factor` is defined and how it processes multivariate expressions with algebraic coefficients.',
        toolCall: {
          name: 'search_similar_code',
          args: { query: 'factor polynomial multivariate algebraic coefficient domain', k: 3 },
        },
        toolResult: 'Found nodes:\n1. sympy.polys.polytools.factor (similarity: 0.892)\n2. sympy.polys.polytools._generic_factor (similarity: 0.841)\n3. sympy.polys.factortools.dmp_factor_list (similarity: 0.815)',
        durationMs: 420,
      },
      {
        step: 2,
        agent: 'GemmaSweOrchestrator',
        phase: 'think',
        thought: 'Let me look at the caller and callee graph around `sympy.polys.polytools.factor` to see which helper does the domain dispatching.',
        toolCall: {
          name: 'get_code_neighbors',
          args: { node: 'sympy.polys.polytools.factor', max_neighbors: 5 },
        },
        toolResult: 'Neighbors of sympy.polys.polytools.factor:\n-> calls: sympy.polys.polytools._generic_factor (outgoing)\n-> calls: sympy.polys.polyoptions.build_options (outgoing)',
        durationMs: 380,
      },
      {
        step: 3,
        agent: 'GemmaSweOrchestrator',
        phase: 'think',
        thought: 'Let me read lines 5900-5930 of sympy/polys/polytools.py to inspect `_generic_factor`.',
        toolCall: {
          name: 'read_file',
          args: { filepath: 'sympy/polys/polytools.py', start_line: 5905, end_line: 5925 },
        },
        toolResult: `5905:     try:
5906:         f, opt = poly_from_expr(expr, *gens, **args)
5907:     except PolificationFailed as exc:
5908:         return expr
5909:     except DomainError:
5910:         return expr
5911: 
5912:     if not (f.is_multivariate or f.is_algebraic):
5913:         factors, opt = _factor(f, opt, method)
5914:     else:
5915:         factors, opt = _factor(f, opt, method)`,
        durationMs: 510,
      },
      {
        step: 4,
        agent: 'GemmaSweOrchestrator',
        phase: 'think',
        thought: 'Notice line 5912 has improper branching for combined multivariate AND algebraic expressions. Let me edit the file to route multivariate algebraic cases to `_symbolic_factor`.',
        toolCall: {
          name: 'edit_file',
          args: {
            filepath: 'sympy/polys/polytools.py',
            old_string: '    if not (f.is_multivariate or f.is_algebraic):\n        factors, opt = _factor(f, opt, method)',
            new_string: '    if not f.is_multivariate and not f.is_algebraic:\n        factors, opt = _symbolic_factor(f, opt, method)\n    elif f.is_multivariate and f.is_algebraic:\n        factors, opt = _symbolic_factor(f, opt, method)',
          },
        },
        toolResult: 'Successfully replaced target string in sympy/polys/polytools.py',
        patchDelta: '+    elif f.is_multivariate and f.is_algebraic:\n+        factors, opt = _symbolic_factor(f, opt, method)',
        durationMs: 650,
      },
      {
        step: 5,
        agent: 'GemmaSweOrchestrator',
        phase: 'act',
        thought: 'Now running the validation test suite to confirm the fix.',
        toolCall: {
          name: 'run_command',
          args: { command: 'pytest sympy/polys/tests/test_polytools.py -k test_factor_algebraic' },
        },
        toolResult: '==================== 3 passed, 0 failed in 1.48s ====================',
        durationMs: 1480,
      },
      {
        step: 6,
        agent: 'GemmaSweOrchestrator',
        phase: 'patch',
        thought: 'Tests passed cleanly! Submitting the patch to git diff HEAD stage.',
        toolCall: {
          name: 'submit_patch',
          args: {},
        },
        toolResult: 'Patch recorded successfully. Diff size: 8 lines. Untracked files staged.',
        durationMs: 310,
      },
    ],
  },
  {
    id: 'scikit-learn-14092',
    repo: 'scikit-learn/scikit-learn',
    title: 'NCA fails with NeighborhoodComponentsAnalysis when tol is not None and verbose=1',
    difficulty: 'Easy',
    problemStatement: `Issue: When instantiating \`NeighborhoodComponentsAnalysis(tol=1e-4, verbose=1)\`, fitting on data throws \`TypeError: 'NoneType' object is not iterable\` in the progress logger.
Steps to reproduce:
\`\`\`python
from sklearn.neighbors import NeighborhoodComponentsAnalysis
nca = NeighborhoodComponentsAnalysis(tol=1e-4, verbose=1)
nca.fit(X, y)
\`\`\`
Please fix the verbose formatting string in \`sklearn/neighbors/nca.py\`.`,
    filesInvolved: ['sklearn/neighbors/nca.py', 'sklearn/neighbors/tests/test_nca.py'],
    sampleGraph: {
      nodes: [
        { id: 'sklearn.neighbors.nca.NeighborhoodComponentsAnalysis.fit', name: 'NCA.fit', type: 'method', file: 'sklearn/neighbors/nca.py', line: 180 },
        { id: 'sklearn.neighbors.nca.NeighborhoodComponentsAnalysis._loss_and_grad', name: 'NCA._loss_and_grad', type: 'method', file: 'sklearn/neighbors/nca.py', line: 260 },
        { id: 'scipy.optimize.minimize', name: 'minimize', type: 'function', file: 'external:scipy.optimize', line: 1 },
      ],
      edges: [
        { source: 'sklearn.neighbors.nca.NeighborhoodComponentsAnalysis.fit', target: 'scipy.optimize.minimize', type: 'calls' },
        { source: 'sklearn.neighbors.nca.NeighborhoodComponentsAnalysis.fit', target: 'sklearn.neighbors.nca.NeighborhoodComponentsAnalysis._loss_and_grad', type: 'calls' },
      ],
    },
    goldenPatch: `diff --git a/sklearn/neighbors/nca.py b/sklearn/neighbors/nca.py
--- a/sklearn/neighbors/nca.py
+++ b/sklearn/neighbors/nca.py
@@ -318,3 +318,3 @@
-        if self.verbose:
+        if self.verbose and self.tol is not None:
             cls_name = self.__class__.__name__
`,
    testCommand: 'pytest sklearn/neighbors/tests/test_nca.py -k test_verbose',
    steps: [
      {
        step: 1,
        agent: 'GemmaSweOrchestrator',
        phase: 'think',
        thought: 'Find the verbose logging statement inside NeighborhoodComponentsAnalysis fit implementation.',
        toolCall: {
          name: 'search_similar_code',
          args: { query: 'NeighborhoodComponentsAnalysis verbose logging tol NoneType', k: 2 },
        },
        toolResult: 'Found: sklearn.neighbors.nca.NeighborhoodComponentsAnalysis.fit in sklearn/neighbors/nca.py:180',
        durationMs: 310,
      },
      {
        step: 2,
        agent: 'GemmaSweOrchestrator',
        phase: 'act',
        thought: 'Read lines 310-330 in sklearn/neighbors/nca.py',
        toolCall: {
          name: 'read_file',
          args: { filepath: 'sklearn/neighbors/nca.py', start_line: 310, end_line: 330 },
        },
        toolResult: '318:        if self.verbose:\n319:            cls_name = self.__class__.__name__\n320:            print(f"[{cls_name}] Iteration {n_iter} ...")',
        durationMs: 290,
      },
      {
        step: 3,
        agent: 'GemmaSweOrchestrator',
        phase: 'patch',
        thought: 'Check if tol is None before printing convergence stats.',
        toolCall: {
          name: 'edit_file',
          args: {
            filepath: 'sklearn/neighbors/nca.py',
            old_string: '        if self.verbose:',
            new_string: '        if self.verbose and self.tol is not None:',
          },
        },
        toolResult: 'Edit successful.',
        durationMs: 340,
      },
      {
        step: 4,
        agent: 'GemmaSweOrchestrator',
        phase: 'patch',
        thought: 'Submit the verified patch.',
        toolCall: {
          name: 'submit_patch',
          args: {},
        },
        toolResult: 'Patch submitted.',
        durationMs: 250,
      },
    ],
  },
];
