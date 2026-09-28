export interface SamplingConfig {
  temperature: number;
  top_p: number;
  top_k: number;
  max_output_tokens: number;
}

export interface ToolDef {
  name: string;
  signature: string;
  description: string;
  category: 'workspace' | 'graph' | 'skill' | 'core';
}

export const ALLOWED_HARNESS_TOOLS: ToolDef[] = [
  {
    name: 'run_command',
    signature: 'run_command(command: str) -> str',
    description: 'Executes a shell command in /bin/bash -c inside /workspace.',
    category: 'workspace',
  },
  {
    name: 'submit_patch',
    signature: 'submit_patch() -> str',
    description: 'Stages untracked file intents (git add -N .) and captures git diff HEAD from /workspace.',
    category: 'core',
  },
  {
    name: 'get_status',
    signature: 'get_status() -> str',
    description: 'Returns live budget consumption and patch status.',
    category: 'core',
  },
  {
    name: 'read_file',
    signature: 'read_file(filepath: str, start_line: int | None = None, end_line: int | None = None) -> str',
    description: 'Reads a file from /workspace with 1-indexed inclusive line slicing.',
    category: 'workspace',
  },
  {
    name: 'edit_file',
    signature: 'edit_file(filepath: str, old_string: str, new_string: str, allow_multiple: bool = False) -> str',
    description: 'Replaces old_string with new_string in an existing non-empty file inside /workspace.',
    category: 'workspace',
  },
  {
    name: 'write_file',
    signature: 'write_file(filepath: str, content: str) -> str',
    description: 'Creates or overwrites a file at /workspace/<filepath>, automatically creating parent directories.',
    category: 'workspace',
  },
  {
    name: 'get_code_neighbors',
    signature: 'get_code_neighbors(node: str, edge_type: str | None = None, max_neighbors: int = 50) -> str',
    description: 'Finds incoming and outgoing neighbors of a symbol (node) in the repository call/dependency graph.',
    category: 'graph',
  },
  {
    name: 'search_similar_code',
    signature: 'search_similar_code(query: str, k: int = 10) -> str',
    description: 'Finds top-k graph nodes with highest cosine similarity to query in the pre-computed embeddings.',
    category: 'graph',
  },
  {
    name: 'get_code_subgraph',
    signature: 'get_code_subgraph(nodes: list[str]) -> str',
    description: 'Extracts the induced subgraph (all nodes and interconnecting edges) for a list of symbols.',
    category: 'graph',
  },
];

export const REQUIRED_BASE_MODEL = 'gemma-4-31b-it-qat-w4a16-ct';

export interface SubAgentConfig {
  id: string;
  name: string;
  filename: string; // e.g. code_analyzer.yaml
  model: string;
  adapter?: string;
  prompt_path: string; // e.g. prompts/analyzer.md
  tools: string[];
  description: string;
}

export interface LoRAConfig {
  id: string;
  name: string; // folder name under adapters/
  r: number;
  lora_alpha: number;
  target_modules: string[];
  lora_dropout: number;
  bias: 'none' | 'all' | 'lora_only';
  task_type: string;
  safetensors_size_mb?: number;
  description: string;
}

export interface SkillScript {
  filename: string;
  language: 'python' | 'bash';
  code: string;
}

export interface SkillResource {
  filename: string;
  content: string;
}

export interface SkillConfig {
  id: string;
  directoryName: string; // e.g. repo_navigation
  name: string; // frontmatter name
  description: string;
  markdownDoc: string;
  scripts: SkillScript[];
  resources: SkillResource[];
}

export interface EvalConfig {
  max_overall_hours: number;
  per_task_timeout_sec: number;
  max_iterations_per_task: number;
  enable_sandbox_network: boolean;
}

export interface VirtualFileTree {
  'agent.yaml': string;
  'configs/sampling.yaml': string;
  'eval_config.yaml': string;
  prompts: Record<string, string>; // filename -> markdown content
  sub_agents: Record<string, string>; // filename -> yaml content
  adapters: Record<string, { configJson: string; dummyWeightsNote: string }>;
  skills: Record<string, {
    skillMd: string;
    scripts: Record<string, string>;
    resources: Record<string, string>;
  }>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'model' | 'tools' | 'files' | 'lora' | 'skill' | 'budget';
  path: string;
  title: string;
  message: string;
  autoFixAvailable: boolean;
  fixAction?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'module' | 'method';
  file: string;
  line: number;
  docstring?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'calls' | 'imports' | 'inherits' | 'instantiates' | 'references';
}

export interface CodeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SimulationStep {
  step: number;
  agent: string;
  phase: 'think' | 'act' | 'observe' | 'patch';
  thought: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  toolResult?: string;
  patchDelta?: string;
  durationMs: number;
}

export interface SWEBenchTask {
  id: string;
  repo: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  problemStatement: string;
  hint?: string;
  filesInvolved: string[];
  sampleGraph: CodeGraphData;
  goldenPatch: string;
  testCommand: string;
  steps: SimulationStep[];
}
