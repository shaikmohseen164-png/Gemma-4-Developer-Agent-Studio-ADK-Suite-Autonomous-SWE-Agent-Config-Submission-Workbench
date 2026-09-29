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

  // 7. tests/
  const testsRecord: Record<string, string> = {
    'validate_patch.py': `#!/usr/bin/env python3
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
    print(f"OK: Staged diff contains {len(res.stdout.splitlines())} lines.")
    return True

def run_regression_tests():
    print("[2/3] Executing repository test suite...")
    # Typically pytest or unittest within /workspace
    cmd = ["pytest", "-q", "--maxfail=1"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(res.stdout)
    if res.returncode != 0:
        print(f"FAILED: Test suite exited with returncode {res.returncode}")
        return False
    print("OK: All regression tests passed successfully!")
    return True

def audit_syntax():
    print("[3/3] Auditing modified files for syntax compilation...")
    # py_compile check
    res = subprocess.run(["python3", "-m", "compileall", "-q", "."], capture_output=True)
    return res.returncode == 0

if __name__ == "__main__":
    if check_staged_diff() and audit_syntax() and run_regression_tests():
        print("\\n>>> VERIFICATION SUCCESS: Safe to invoke submit_patch()")
        sys.exit(0)
    else:
        print("\\n>>> VERIFICATION FAILURE: Do NOT submit patch yet.")
        sys.exit(1)
`,
    'test_reproducer.py': `#!/usr/bin/env python3
"""
Stand-alone Bug Reproduction Template.
The agent scripts this to verify that the bug is reproduced before drafting fixes.
"""
import sys

def test_problem_statement():
    # Example for SymPy multivariate factorization
    from sympy import symbols, factor
    x, y = symbols('x y')
    expr = x**2 + 2*x + 1 - y**2
    res = factor(expr)
    expected = (x - y + 1) * (x + y + 1)
    assert res == expected, f"Expected {expected}, got {res}"
    print("Reproduction test passed: issue successfully fixed!")

if __name__ == "__main__":
    try:
        test_problem_statement()
        sys.exit(0)
    except AssertionError as e:
        print(f"BUG REPRODUCED: {e}")
        sys.exit(1)
`,
  };

  return {
    'agent.yaml': agentYaml,
    'configs/sampling.yaml': samplingYaml,
    'eval_config.yaml': evalYaml,
    prompts: { ...preset.prompts },
    sub_agents: subAgentsRecord,
    tests: testsRecord,
    adapters: adaptersRecord,
    skills: skillsRecord,
  };
}

export const INITIAL_FILES: VirtualFileTree = buildFileTreeFromPreset(PRESET_GRAPH_AUGMENTED);
