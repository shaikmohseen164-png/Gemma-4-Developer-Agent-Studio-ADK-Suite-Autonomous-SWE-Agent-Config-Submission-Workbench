import { AgentArchitecturePreset, PRESET_GRAPH_AUGMENTED } from '../data/defaultPresets';
import { VirtualFileTree } from '../types/agent';

export function buildFileTreeFromPreset(preset: AgentArchitecturePreset): VirtualFileTree {
  // 1. Build agent.yaml
  const toolsFormatted = preset.rootAgent.tools.map((t) => `  - ${t}`).join('\n');
  const subAgentsFormatted = preset.rootAgent.subAgents.length > 0
    ? `sub_agents:\n${preset.rootAgent.subAgents.map((sa) => `  - !include sub_agents/${sa}`).join('\n')}\n`
    : '';

  const agentYaml = `# ==============================================================================
# Google - The Gemma 4 Developer Agent Competition
# Root Agent Configuration (ADK Agent Config)
# ==============================================================================
name: ${preset.rootAgent.name}
model: ${preset.rootAgent.model}
${preset.rootAgent.adapter ? `adapter: ${preset.rootAgent.adapter}` : '# adapter: none'}

system_prompt: !include ${preset.rootAgent.systemPromptPath}
sampling_config: !include configs/sampling.yaml

tools:
${toolsFormatted}

${subAgentsFormatted}
`;

  // 2. configs/sampling.yaml
  const samplingYaml = `# Generation parameters for Gemma 4
temperature: ${preset.sampling.temperature}
top_p: ${preset.sampling.top_p}
top_k: ${preset.sampling.top_k}
max_output_tokens: ${preset.sampling.max_output_tokens}
`;

  // 3. eval_config.yaml
  const evalYaml = `# SWE-Bench Evaluation configuration
max_overall_hours: ${preset.evalConfig.max_overall_hours}
per_task_timeout_sec: ${preset.evalConfig.per_task_timeout_sec}
max_iterations_per_task: ${preset.evalConfig.max_iterations_per_task}
enable_sandbox_network: ${preset.evalConfig.enable_sandbox_network}
`;

  // 4. sub_agents/
  const subAgentsRecord: Record<string, string> = {};
  for (const sub of preset.subAgents) {
    const subTools = sub.tools.map((t) => `  - ${t}`).join('\n');
    subAgentsRecord[sub.filename] = `# Sub-agent tool configuration: ${sub.name}
name: ${sub.name}
description: "${sub.description}"
model: ${sub.model}
${sub.adapter ? `adapter: ${sub.adapter}` : '# adapter: none'}
system_prompt: !include ${sub.prompt_path}

tools:
${subTools}
`;
  }

  // 5. adapters/
  const adaptersRecord: Record<string, { configJson: string; dummyWeightsNote: string }> = {};
  for (const lora of preset.loras) {
    const adapterConfig = {
      base_model_name_or_path: 'google/gemma-4-31b-it-qat-w4a16-ct',
      bias: lora.bias,
      fan_in_fan_out: false,
      init_lora_weights: true,
      lora_alpha: lora.lora_alpha,
      lora_dropout: lora.lora_dropout,
      modules_to_save: null,
      peft_type: 'LORA',
      r: lora.r,
      target_modules: lora.target_modules,
      task_type: lora.task_type,
    };
    adaptersRecord[lora.name] = {
      configJson: JSON.stringify(adapterConfig, null, 2),
      dummyWeightsNote: `${lora.description} (Target: ${lora.target_modules.join(', ')})`,
    };
  }

  // 6. skills/
  const skillsRecord: Record<string, {
    skillMd: string;
    scripts: Record<string, string>;
    resources: Record<string, string>;
  }> = {};

  for (const sk of preset.skills) {
    const scriptsRec: Record<string, string> = {};
    for (const sc of sk.scripts) {
      scriptsRec[sc.filename] = sc.code;
    }
    const resRec: Record<string, string> = {};
    for (const r of sk.resources) {
      resRec[r.filename] = r.content;
    }
    skillsRecord[sk.directoryName] = {
      skillMd: sk.markdownDoc,
      scripts: scriptsRec,
      resources: resRec,
    };
  }

  return {
    'agent.yaml': agentYaml,
    'configs/sampling.yaml': samplingYaml,
    'eval_config.yaml': evalYaml,
    prompts: { ...preset.prompts },
    sub_agents: subAgentsRecord,
    adapters: adaptersRecord,
    skills: skillsRecord,
  };
}

export const INITIAL_FILES: VirtualFileTree = buildFileTreeFromPreset(PRESET_GRAPH_AUGMENTED);
