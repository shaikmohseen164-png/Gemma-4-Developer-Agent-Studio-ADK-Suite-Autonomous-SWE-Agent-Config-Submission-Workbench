import { VirtualFileTree, GraphNode, GraphEdge, CodeGraphData } from '../types/agent';
import yaml from 'yaml';

/**
 * Parses files in the submission / workspace to generate a live code-graph of symbols and dependencies.
 */
export function extractCodeGraphFromFiles(files: VirtualFileTree): CodeGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenNodeIds = new Set<string>();

  const addNode = (node: GraphNode) => {
    if (!seenNodeIds.has(node.id)) {
      seenNodeIds.add(node.id);
      nodes.push(node);
    }
  };

  // 1. Root agent node
  let rootModel = 'gemma-4-31b-it-qat-w4a16-ct';
  let rootAdapter: string | undefined;
  let rootTools: string[] = [];

  try {
    const rawYaml = (files['agent.yaml'] || '').replace(/!include\s+([^\n]+)/g, '"!include $1"');
    const parsed = yaml.parse(rawYaml) || {};
    rootModel = parsed.model || rootModel;
    rootAdapter = parsed.adapter;
    rootTools = parsed.tools || [];
  } catch {
    // fallback
  }

  const rootAgentId = 'agent.yaml:root';
  addNode({
    id: rootAgentId,
    name: 'agent.yaml (Root Agent)',
    type: 'module',
    file: 'agent.yaml',
    line: 1,
    docstring: `Root Gemma 4 SWE orchestrator agent using model ${rootModel}`,
  });

  // 2. Sampling config node
  if (files['configs/sampling.yaml']) {
    const samplingId = 'configs/sampling.yaml';
    addNode({
      id: samplingId,
      name: 'configs/sampling.yaml',
      type: 'module',
      file: 'configs/sampling.yaml',
      line: 1,
      docstring: 'Generation sampling hyperparameters (temperature, top_p, top_k)',
    });
    edges.push({
      source: rootAgentId,
      target: samplingId,
      type: 'references',
    });
  }

  // 3. Eval config node
  if (files['eval_config.yaml']) {
    const evalId = 'eval_config.yaml';
    addNode({
      id: evalId,
      name: 'eval_config.yaml',
      type: 'module',
      file: 'eval_config.yaml',
      line: 1,
      docstring: 'SWE-bench budget limits (12h cap, timeout, iterations)',
    });
    edges.push({
      source: rootAgentId,
      target: evalId,
      type: 'references',
    });
  }

  // 4. Prompts nodes
  for (const [pName, pContent] of Object.entries(files.prompts)) {
    const pId = `prompts/${pName}`;
    const firstLine = pContent.trim().split('\n')[0]?.replace(/^#*\s*/, '') || pName;
    addNode({
      id: pId,
      name: `prompts/${pName}`,
      type: 'function',
      file: `prompts/${pName}`,
      line: 1,
      docstring: `System instructions: ${firstLine}`,
    });
    // Link root to system prompt if referenced
    if (files['agent.yaml']?.includes(pName)) {
      edges.push({
        source: rootAgentId,
        target: pId,
        type: 'references',
      });
    }
  }

  // 5. Sub-agents nodes
  for (const [saName, saContent] of Object.entries(files.sub_agents)) {
    const saId = `sub_agents/${saName}`;
    let subTools: string[] = [];
    let subAdapter: string | undefined;
    let subPrompt: string | undefined;
    try {
      const parsed = yaml.parse(saContent.replace(/!include\s+([^\n]+)/g, '"!include $1"')) || {};
      subTools = parsed.tools || [];
      subAdapter = parsed.adapter;
      subPrompt = parsed.system_prompt;
    } catch {
      // fallback
    }

    addNode({
      id: saId,
      name: `sub_agent:${saName.replace(/\.ya?ml$/, '')}`,
      type: 'class',
      file: `sub_agents/${saName}`,
      line: 1,
      docstring: `Auxiliary AgentTool for specialized operations (${subTools.length} tools)`,
    });

    edges.push({
      source: rootAgentId,
      target: saId,
      type: 'calls',
    });

    // Check if subagent references a prompt
    for (const pName of Object.keys(files.prompts)) {
      if (saContent.includes(pName)) {
        edges.push({
          source: saId,
          target: `prompts/${pName}`,
          type: 'references',
        });
      }
    }

    // Check if subagent references an adapter
    if (subAdapter && files.adapters[subAdapter]) {
      const adapterId = `adapters/${subAdapter}`;
      addNode({
        id: adapterId,
        name: `adapter:${subAdapter}`,
        type: 'method',
        file: `adapters/${subAdapter}/adapter_config.json`,
        line: 1,
        docstring: `Fine-tuned PEFT LoRA adapter for ${subAdapter}`,
      });
      edges.push({
        source: saId,
        target: adapterId,
        type: 'references',
      });
    }
  }

  // 6. LoRA adapters for root
  if (rootAdapter && files.adapters[rootAdapter]) {
    const adapterId = `adapters/${rootAdapter}`;
    addNode({
      id: adapterId,
      name: `adapter:${rootAdapter}`,
      type: 'method',
      file: `adapters/${rootAdapter}/adapter_config.json`,
      line: 1,
      docstring: `Fine-tuned PEFT LoRA adapter for root agent (${rootAdapter})`,
    });
    edges.push({
      source: rootAgentId,
      target: adapterId,
      type: 'references',
    });
  }

  // Any other adapters
  for (const [loraName, loraObj] of Object.entries(files.adapters)) {
    const adapterId = `adapters/${loraName}`;
    addNode({
      id: adapterId,
      name: `adapter:${loraName}`,
      type: 'method',
      file: `adapters/${loraName}/adapter_config.json`,
      line: 1,
      docstring: loraObj.dummyWeightsNote || `PEFT LoRA adapter: ${loraName}`,
    });
  }

  // 7. Skills nodes and scripts
  for (const [skillDir, skillData] of Object.entries(files.skills)) {
    const skillId = `skills/${skillDir}`;
    addNode({
      id: skillId,
      name: `skill:${skillDir}`,
      type: 'module',
      file: `skills/${skillDir}/SKILL.md`,
      line: 1,
      docstring: `ADK Skill manifest and sandboxed environment tools for ${skillDir}`,
    });

    edges.push({
      source: rootAgentId,
      target: skillId,
      type: 'imports',
    });

    // Scripts in skill
    for (const scriptName of Object.keys(skillData.scripts)) {
      const scriptId = `skills/${skillDir}/scripts/${scriptName}`;
      addNode({
        id: scriptId,
        name: `script:${scriptName}`,
        type: 'function',
        file: `skills/${skillDir}/scripts/${scriptName}`,
        line: 1,
        docstring: `Executable sandboxed Python script for skill ${skillDir}`,
      });
      edges.push({
        source: skillId,
        target: scriptId,
        type: 'calls',
      });
    }

    // Resources in skill
    for (const resName of Object.keys(skillData.resources)) {
      const resId = `skills/${skillDir}/resources/${resName}`;
      addNode({
        id: resId,
        name: `resource:${resName}`,
        type: 'class',
        file: `skills/${skillDir}/resources/${resName}`,
        line: 1,
        docstring: `Domain knowledge resource for ${skillDir}`,
      });
      edges.push({
        source: skillId,
        target: resId,
        type: 'references',
      });
    }
  }

  // 8. Tests nodes
  if (files.tests) {
    for (const [testName, testCode] of Object.entries(files.tests)) {
      const testId = `tests/${testName}`;
      addNode({
        id: testId,
        name: `test:${testName}`,
        type: 'function',
        file: `tests/${testName}`,
        line: 1,
        docstring: `Validation test script to verify patch before submission: ${testName}`,
      });
      edges.push({
        source: rootAgentId,
        target: testId,
        type: 'calls',
      });
    }
  }

  // 9. Tool bindings nodes for the harness
  const activeHarnessTools = rootTools.filter((t) =>
    ['get_code_neighbors', 'search_similar_code', 'get_code_subgraph', 'submit_patch', 'run_command', 'read_file', 'edit_file', 'write_file', 'get_status'].includes(t),
  );

  for (const tool of activeHarnessTools) {
    const toolId = `tool:${tool}`;
    addNode({
      id: toolId,
      name: `${tool}()`,
      type: 'function',
      file: 'harness:predefined_tools',
      line: 1,
      docstring: `Predefined competition harness tool: ${tool}`,
    });
    edges.push({
      source: rootAgentId,
      target: toolId,
      type: 'calls',
    });
  }

  return { nodes, edges };
}
