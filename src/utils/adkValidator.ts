import {
  ALLOWED_HARNESS_TOOLS,
  REQUIRED_BASE_MODEL,
  ValidationIssue,
  VirtualFileTree,
} from '../types/agent';
import yaml from 'yaml';

export interface ValidationSummary {
  passed: boolean;
  score: number; // 0 to 100
  errorsCount: number;
  warningsCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}

export function validateSubmissionFiles(files: VirtualFileTree): ValidationSummary {
  const issues: ValidationIssue[] = [];

  // 1. Root agent.yaml existence
  if (!files['agent.yaml'] || files['agent.yaml'].trim().length === 0) {
    issues.push({
      severity: 'error',
      category: 'files',
      path: 'agent.yaml',
      title: 'Missing agent.yaml at root',
      message: 'The competition harness requires an agent.yaml file directly at the root of submission.zip.',
      autoFixAvailable: true,
      fixAction: 'generate_default_agent_yaml',
    });
  } else {
    // Parse agent.yaml
    try {
      // Pre-sanitize !include for standard YAML parsers
      const sanitizedYaml = files['agent.yaml'].replace(/!include\s+([^\n]+)/g, '"!include $1"');
      const parsed = yaml.parse(sanitizedYaml) || {};

      // Check model
      const model = parsed.model || parsed.llm_model || parsed.base_model;
      if (!model) {
        issues.push({
          severity: 'error',
          category: 'model',
          path: 'agent.yaml',
          title: 'Undefined Model Specification',
          message: `agent.yaml must specify model: ${REQUIRED_BASE_MODEL}.`,
          autoFixAvailable: true,
          fixAction: 'set_base_model',
        });
      } else if (model !== REQUIRED_BASE_MODEL) {
        issues.push({
          severity: 'error',
          category: 'model',
          path: 'agent.yaml',
          title: 'Disallowed Model Variant',
          message: `The competition harness ONLY permits "${REQUIRED_BASE_MODEL}". Detected "${model}".`,
          autoFixAvailable: true,
          fixAction: 'set_base_model',
        });
      }

      // Check LoRA reference
      if (parsed.adapter) {
        const adapterName = parsed.adapter;
        if (!files.adapters[adapterName]) {
          issues.push({
            severity: 'error',
            category: 'lora',
            path: 'agent.yaml',
            title: `Unresolved LoRA Adapter "${adapterName}"`,
            message: `Root agent specifies adapter: "${adapterName}", but directory adapters/${adapterName}/ was not found.`,
            autoFixAvailable: true,
            fixAction: 'create_adapter_stub',
          });
        }
      }

      // Check tools
      const tools = parsed.tools || [];
      const allowedToolNames = new Set([
        ...ALLOWED_HARNESS_TOOLS.map((t) => t.name),
        'run_skill_script',
        'load_skill_resource',
      ]);

      // Check if subagents are referenced as agent_tools
      const subAgentNames = Object.keys(files.sub_agents).map((f) => f.replace(/\.ya?ml$/, ''));
      subAgentNames.forEach((n) => allowedToolNames.add(n));

      for (const t of tools) {
        const toolName = typeof t === 'string' ? t : (t.name || Object.keys(t)[0]);
        if (!allowedToolNames.has(toolName)) {
          issues.push({
            severity: 'error',
            category: 'tools',
            path: 'agent.yaml',
            title: `Disallowed Tool "${toolName}"`,
            message: `Tool "${toolName}" is not provided by the competition harness or registered sub_agents. Allowed harness tools: ${ALLOWED_HARNESS_TOOLS.map((at) => at.name).join(', ')}.`,
            autoFixAvailable: true,
            fixAction: `remove_tool_${toolName}`,
          });
        }
      }

      // Check if submit_patch is included
      if (!tools.includes('submit_patch')) {
        issues.push({
          severity: 'warning',
          category: 'tools',
          path: 'agent.yaml',
          title: 'Missing "submit_patch" Tool',
          message: 'The agent has no access to submit_patch(). It will not be able to stage diffs and submit solutions.',
          autoFixAvailable: true,
          fixAction: 'add_submit_patch',
        });
      }

      // Check if graph reasoning tools are present
      const hasGraphTools = tools.some((t: string) =>
        ['get_code_neighbors', 'search_similar_code', 'get_code_subgraph'].includes(t),
      );
      if (!hasGraphTools) {
        issues.push({
          severity: 'info',
          category: 'tools',
          path: 'agent.yaml',
          title: 'No Graph Reasoning Tools Configured',
          message: 'The competition harness provides specialized call-graph and embedding tools (get_code_neighbors, search_similar_code, get_code_subgraph). Adding these significantly improves SWE-Bench scores.',
          autoFixAvailable: true,
          fixAction: 'add_graph_tools',
        });
      }
    } catch (e: any) {
      issues.push({
        severity: 'error',
        category: 'files',
        path: 'agent.yaml',
        title: 'YAML Syntax Error in agent.yaml',
        message: e?.message || 'Failed to parse agent.yaml as valid YAML.',
        autoFixAvailable: false,
      });
    }
  }

  // 2. Check !include directives and path traversal
  const allYamlFiles: Record<string, string> = {
    'agent.yaml': files['agent.yaml'] || '',
    'configs/sampling.yaml': files['configs/sampling.yaml'] || '',
    'eval_config.yaml': files['eval_config.yaml'] || '',
    ...Object.fromEntries(
      Object.entries(files.sub_agents).map(([k, v]) => [`sub_agents/${k}`, v]),
    ),
  };

  for (const [filename, content] of Object.entries(allYamlFiles)) {
    const includeMatches = [...content.matchAll(/!include\s+([^\s\n#]+)/g)];
    for (const match of includeMatches) {
      const targetPath = match[1].replace(/['"]/g, '');

      // Traversal check
      if (targetPath.includes('..') || targetPath.startsWith('/')) {
        issues.push({
          severity: 'error',
          category: 'files',
          path: filename,
          title: 'Sandboxing Violation: Path Traversal in !include',
          message: `!include "${targetPath}" attempts traversal outside the submission root. Only relative descendant paths without ".." are permitted.`,
          autoFixAvailable: false,
        });
        continue;
      }

      // Check if target file exists
      const exists =
        files.prompts[targetPath.replace(/^prompts\//, '')] !== undefined ||
        targetPath === 'configs/sampling.yaml' ||
        targetPath === 'eval_config.yaml' ||
        files.sub_agents[targetPath.replace(/^sub_agents\//, '')] !== undefined;

      if (!exists) {
        issues.push({
          severity: 'error',
          category: 'files',
          path: filename,
          title: `Dangling !include Reference: "${targetPath}"`,
          message: `The file "${targetPath}" referenced by !include does not exist in the submission archive.`,
          autoFixAvailable: true,
          fixAction: `create_missing_include_${targetPath}`,
        });
      }
    }
  }

  // 3. Sub-agents verification
  for (const [subFilename, subContent] of Object.entries(files.sub_agents)) {
    try {
      const sanitized = subContent.replace(/!include\s+([^\n]+)/g, '"!include $1"');
      const parsed = yaml.parse(sanitized) || {};

      if (parsed.model && parsed.model !== REQUIRED_BASE_MODEL) {
        issues.push({
          severity: 'error',
          category: 'model',
          path: `sub_agents/${subFilename}`,
          title: `Disallowed Sub-agent Model: ${parsed.model}`,
          message: `Every subagent must use the required base model "${REQUIRED_BASE_MODEL}".`,
          autoFixAvailable: true,
          fixAction: `fix_subagent_model_${subFilename}`,
        });
      }

      if (parsed.adapter && !files.adapters[parsed.adapter]) {
        issues.push({
          severity: 'error',
          category: 'lora',
          path: `sub_agents/${subFilename}`,
          title: `Unresolved Adapter "${parsed.adapter}" in sub_agents/${subFilename}`,
          message: `Sub-agent references adapter "${parsed.adapter}" which is not found in adapters/ directory.`,
          autoFixAvailable: true,
        });
      }
    } catch {
      issues.push({
        severity: 'error',
        category: 'files',
        path: `sub_agents/${subFilename}`,
        title: `Invalid YAML in sub_agents/${subFilename}`,
        message: 'Could not parse sub-agent YAML file.',
        autoFixAvailable: false,
      });
    }
  }

  // 4. LoRA Adapters verification
  for (const [loraName, loraFiles] of Object.entries(files.adapters)) {
    if (!loraFiles.configJson || loraFiles.configJson.trim().length === 0) {
      issues.push({
        severity: 'error',
        category: 'lora',
        path: `adapters/${loraName}/adapter_config.json`,
        title: `Missing adapter_config.json for "${loraName}"`,
        message: `PEFT LoRA directory adapters/${loraName}/ must contain a valid adapter_config.json.`,
        autoFixAvailable: true,
      });
    } else {
      try {
        const config = JSON.parse(loraFiles.configJson);
        if (!config.r || !config.lora_alpha) {
          issues.push({
            severity: 'warning',
            category: 'lora',
            path: `adapters/${loraName}/adapter_config.json`,
            title: `Suspicious LoRA Config parameters for "${loraName}"`,
            message: 'adapter_config.json is missing standard LoRA rank (r) or alpha scaling (lora_alpha).',
            autoFixAvailable: false,
          });
        }
      } catch {
        issues.push({
          severity: 'error',
          category: 'lora',
          path: `adapters/${loraName}/adapter_config.json`,
          title: `Invalid JSON in adapter_config.json for "${loraName}"`,
          message: 'adapter_config.json contains syntax errors.',
          autoFixAvailable: false,
        });
      }
    }
  }

  // 5. Skills verification
  for (const [skillDir, skillData] of Object.entries(files.skills)) {
    if (!skillData.skillMd || skillData.skillMd.trim().length === 0) {
      issues.push({
        severity: 'error',
        category: 'skill',
        path: `skills/${skillDir}/SKILL.md`,
        title: `Missing SKILL.md in skills/${skillDir}`,
        message: 'Every skill directory must contain a SKILL.md manifest.',
        autoFixAvailable: true,
      });
    } else {
      // Check YAML frontmatter: --- name: ... ---
      const frontmatterMatch = skillData.skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatterMatch) {
        issues.push({
          severity: 'error',
          category: 'skill',
          path: `skills/${skillDir}/SKILL.md`,
          title: `Missing YAML frontmatter in SKILL.md (${skillDir})`,
          message: 'SKILL.md must begin with YAML frontmatter containing at least "name: <skill-name>".',
          autoFixAvailable: true,
          fixAction: `fix_skill_frontmatter_${skillDir}`,
        });
      } else {
        try {
          const fm = yaml.parse(frontmatterMatch[1]);
          if (!fm || !fm.name) {
            issues.push({
              severity: 'error',
              category: 'skill',
              path: `skills/${skillDir}/SKILL.md`,
              title: `Missing "name" field in frontmatter for ${skillDir}`,
              message: 'SKILL.md frontmatter must specify "name: <skill-name>".',
              autoFixAvailable: true,
            });
          }
        } catch {
          issues.push({
            severity: 'error',
            category: 'skill',
            path: `skills/${skillDir}/SKILL.md`,
            title: `Invalid frontmatter syntax in ${skillDir}/SKILL.md`,
            message: 'YAML frontmatter in SKILL.md failed to parse.',
            autoFixAvailable: false,
          });
        }
      }
    }
  }

  // 6. Budget & Eval checks
  if (files['eval_config.yaml']) {
    try {
      const evalParsed = yaml.parse(files['eval_config.yaml']) || {};
      if (evalParsed.max_overall_hours && evalParsed.max_overall_hours > 12) {
        issues.push({
          severity: 'error',
          category: 'budget',
          path: 'eval_config.yaml',
          title: 'Exceeds 12-Hour Total Competition Limit',
          message: `The competition hard cap is 12 hours. Configured: ${evalParsed.max_overall_hours} hours.`,
          autoFixAvailable: true,
          fixAction: 'fix_budget_12h',
        });
      }
    } catch {
      // yaml error
    }
  }

  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  const warningsCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  // Compute score
  let score = 100 - errorsCount * 25 - warningsCount * 8;
  if (score < 0) score = 0;
  if (errorsCount > 0 && score > 65) score = 65;

  return {
    passed: errorsCount === 0,
    score,
    errorsCount,
    warningsCount,
    infoCount,
    issues,
  };
}
