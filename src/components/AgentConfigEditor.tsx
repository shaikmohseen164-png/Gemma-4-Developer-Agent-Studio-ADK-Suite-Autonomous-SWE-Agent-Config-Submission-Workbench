import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Cpu,
  Layers,
  Wrench,
  Plus,
  Trash2,
  Sliders,
  Check,
  Zap,
  Clock,
  Terminal,
} from 'lucide-react';
import { VirtualFileTree, ALLOWED_HARNESS_TOOLS, REQUIRED_BASE_MODEL } from '../types/agent';
import yaml from 'yaml';

interface AgentConfigEditorProps {
  files: VirtualFileTree;
  onChangeFile: (path: string, content: string) => void;
  onCreateFile: (type: 'prompt' | 'subagent' | 'skill' | 'lora', name: string) => void;
  onDeleteFile: (type: 'prompt' | 'subagent' | 'skill' | 'lora', name: string) => void;
}

export const AgentConfigEditor: React.FC<AgentConfigEditorProps> = ({
  files,
  onChangeFile,
  onCreateFile,
  onDeleteFile,
}) => {
  const [selectedFile, setSelectedFile] = useState<string>('agent.yaml');
  const [newPromptName, setNewPromptName] = useState('');
  const [newSubAgentName, setNewSubAgentName] = useState('');
  const [showAddPromptModal, setShowAddPromptModal] = useState(false);
  const [showAddSubAgentModal, setShowAddSubAgentModal] = useState(false);
  const [showAddLoraModal, setShowAddLoraModal] = useState(false);
  const [newLoraName, setNewLoraName] = useState('');

  // Determine current content
  const getCurrentContent = (): string => {
    if (selectedFile === 'agent.yaml') return files['agent.yaml'] || '';
    if (selectedFile === 'configs/sampling.yaml') return files['configs/sampling.yaml'] || '';
    if (selectedFile === 'eval_config.yaml') return files['eval_config.yaml'] || '';

    if (selectedFile.startsWith('prompts/')) {
      const p = selectedFile.replace(/^prompts\//, '');
      return files.prompts[p] || '';
    }
    if (selectedFile.startsWith('sub_agents/')) {
      const sa = selectedFile.replace(/^sub_agents\//, '');
      return files.sub_agents[sa] || '';
    }
    if (selectedFile.startsWith('adapters/')) {
      const parts = selectedFile.split('/');
      const adapterName = parts[1];
      const sub = parts[2];
      if (sub === 'adapter_config.json') {
        return files.adapters[adapterName]?.configJson || '';
      }
      return `# LoRA Adapter Weights Metadata: ${adapterName}
Status: adapter_model.safetensors loaded
Size: PEFT standard format
Target Modules: q_proj, k_proj, v_proj, o_proj
`;
    }
    if (selectedFile.startsWith('skills/')) {
      const parts = selectedFile.split('/');
      const skillName = parts[1];
      const category = parts[2];
      if (category === 'SKILL.md') {
        return files.skills[skillName]?.skillMd || '';
      }
      if (category === 'scripts' && parts[3]) {
        return files.skills[skillName]?.scripts[parts[3]] || '';
      }
      if (category === 'resources' && parts[3]) {
        return files.skills[skillName]?.resources[parts[3]] || '';
      }
    }
    return '';
  };

  const handleTextChange = (text: string) => {
    onChangeFile(selectedFile, text);
  };

  // Helper to get active tools in agent.yaml
  const getActiveToolsInRoot = (): string[] => {
    try {
      const sanitizedYaml = (files['agent.yaml'] || '').replace(/!include\s+([^\n]+)/g, '"!include $1"');
      const parsed = yaml.parse(sanitizedYaml) || {};
      return parsed.tools || [];
    } catch {
      return [];
    }
  };

  const toggleToolInRootAgent = (toolName: string) => {
    try {
      const current = files['agent.yaml'] || '';
      // Find lines under tools:
      const lines = current.split('\n');
      const toolsIndex = lines.findIndex((l) => l.trim().startsWith('tools:'));
      if (toolsIndex === -1) return;

      const activeTools = getActiveToolsInRoot();
      let updatedTools: string[];
      if (activeTools.includes(toolName)) {
        updatedTools = activeTools.filter((t) => t !== toolName);
      } else {
        updatedTools = [...activeTools, toolName];
      }

      // Reconstruct
      const prefix = lines.slice(0, toolsIndex + 1);
      // find next non-indented section
      let nextSectionIndex = lines.length;
      for (let i = toolsIndex + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim().length > 0 && !l.startsWith('  -') && !l.startsWith(' ') && !l.startsWith('#')) {
          nextSectionIndex = i;
          break;
        }
      }
      const suffix = lines.slice(nextSectionIndex);
      const toolsBlock = updatedTools.map((t) => `  - ${t}`);
      const newContent = [...prefix, ...toolsBlock, '', ...suffix].join('\n');
      onChangeFile('agent.yaml', newContent);
    } catch {
      // ignore
    }
  };

  const activeTools = getActiveToolsInRoot();
  const currentText = getCurrentContent();
  const estimatedTokens = Math.round(currentText.length / 4);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN: File Tree & Architecture Navigator */}
      <div className="lg:col-span-4 space-y-4">
        {/* Architecture Snapshot Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Agent Topology</h2>
            </div>
            <span className="text-[11px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
              ADK YAML
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>Base Model</span>
                <span className="text-[10px] text-emerald-400 font-mono">COMPLIANT</span>
              </div>
              <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 font-mono text-[11px] text-slate-200 flex items-center justify-between">
                <span className="truncate">{REQUIRED_BASE_MODEL}</span>
                <span className="text-[10px] text-slate-500">W4A16</span>
              </div>
            </div>

            {/* LoRA Adapters */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>LoRA Adapters ({Object.keys(files.adapters).length})</span>
                <button
                  onClick={() => setShowAddLoraModal(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Adapter
                </button>
              </div>
              <div className="space-y-1">
                {Object.keys(files.adapters).map((adapterName) => (
                  <div
                    key={adapterName}
                    onClick={() => setSelectedFile(`adapters/${adapterName}/adapter_config.json`)}
                    className="bg-slate-950/80 hover:bg-slate-800/60 cursor-pointer px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-mono text-[11px] text-slate-200">{adapterName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">PEFT .safetensors</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fast Tool Whitelist Toggles */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  Harness Tools in Root Agent ({activeTools.length})
                </span>
                <span className="text-[10px] text-slate-500">Click to toggle</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALLOWED_HARNESS_TOOLS.map((tool) => {
                  const isEnabled = activeTools.includes(tool.name);
                  return (
                    <button
                      key={tool.name}
                      onClick={() => toggleToolInRootAgent(tool.name)}
                      title={tool.description}
                      className={`text-[11px] font-mono px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer border ${
                        isEnabled
                          ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {isEnabled && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                      <span>{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Submission Virtual File Tree */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">submission.zip Tree</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Exact Layout</span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            {/* Root configs */}
            <div
              onClick={() => setSelectedFile('agent.yaml')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition ${
                selectedFile === 'agent.yaml'
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>agent.yaml</span>
              </div>
              <span className="text-[10px] text-amber-400/90">REQUIRED</span>
            </div>

            <div
              onClick={() => setSelectedFile('configs/sampling.yaml')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition ${
                selectedFile === 'configs/sampling.yaml'
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>configs/sampling.yaml</span>
            </div>

            <div
              onClick={() => setSelectedFile('eval_config.yaml')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition ${
                selectedFile === 'eval_config.yaml'
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>eval_config.yaml</span>
            </div>

            {/* Prompts folder */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px] px-1 py-1">
                <span className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  prompts/
                </span>
                <button
                  onClick={() => setShowAddPromptModal(true)}
                  className="hover:text-indigo-400 flex items-center gap-0.5 text-[10px] cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
              <div className="pl-4 space-y-0.5">
                {Object.keys(files.prompts).map((fname) => (
                  <div
                    key={fname}
                    onClick={() => setSelectedFile(`prompts/${fname}`)}
                    className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[11px] transition ${
                      selectedFile === `prompts/${fname}`
                        ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{fname}</span>
                    {fname !== 'system.md' && (
                      <button
                        aria-label={`Delete prompt ${fname}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFile('prompt', fname);
                        }}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sub Agents folder */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px] px-1 py-1">
                <span className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  sub_agents/
                </span>
                <button
                  onClick={() => setShowAddSubAgentModal(true)}
                  className="hover:text-indigo-400 flex items-center gap-0.5 text-[10px] cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
              <div className="pl-4 space-y-0.5">
                {Object.keys(files.sub_agents).length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic px-2 py-0.5">
                    (No sub-agents defined)
                  </div>
                ) : (
                  Object.keys(files.sub_agents).map((fname) => (
                    <div
                      key={fname}
                      onClick={() => setSelectedFile(`sub_agents/${fname}`)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[11px] transition ${
                        selectedFile === `sub_agents/${fname}`
                          ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>{fname}</span>
                      <button
                        aria-label={`Delete sub-agent ${fname}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFile('subagent', fname);
                        }}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Skills folder */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px] px-1 py-1">
                <span className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  skills/
                </span>
              </div>
              <div className="pl-4 space-y-1">
                {Object.entries(files.skills).map(([skillDir, sdata]) => (
                  <div key={skillDir} className="space-y-0.5">
                    <div
                      onClick={() => setSelectedFile(`skills/${skillDir}/SKILL.md`)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[11px] ${
                        selectedFile === `skills/${skillDir}/SKILL.md`
                          ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="text-emerald-300">{skillDir}/SKILL.md</span>
                    </div>
                    {/* scripts */}
                    {Object.keys(sdata.scripts).map((scriptName) => (
                      <div
                        key={scriptName}
                        onClick={() => setSelectedFile(`skills/${skillDir}/scripts/${scriptName}`)}
                        className={`pl-3 text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                          selectedFile === `skills/${skillDir}/scripts/${scriptName}`
                            ? 'text-cyan-300 bg-cyan-950/40'
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        ↳ scripts/{scriptName}
                      </div>
                    ))}
                    {/* resources */}
                    {Object.keys(sdata.resources).map((resName) => (
                      <div
                        key={resName}
                        onClick={() => setSelectedFile(`skills/${skillDir}/resources/${resName}`)}
                        className={`pl-3 text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                          selectedFile === `skills/${skillDir}/resources/${resName}`
                            ? 'text-amber-300 bg-amber-950/40'
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        ↳ resources/{resName}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Monospace Live Editor & Variable Preview */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-[720px]">
          {/* Editor Header Bar */}
          <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-indigo-300 font-semibold flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                {selectedFile}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 text-xs">
                {currentText.split('\n').length} lines · ~{estimatedTokens} tokens
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {selectedFile === 'agent.yaml' && (
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 font-mono text-[11px]">
                  <Zap className="w-3 h-3" /> Root Agent Spec
                </div>
              )}
              {selectedFile.includes('!include') && (
                <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                  !include active
                </div>
              )}
            </div>
          </div>

          {/* Code Textarea with line numbers */}
          <div className="flex-1 flex overflow-hidden bg-slate-950">
            {/* Line numbers gutter */}
            <div className="w-12 py-3 bg-slate-950/80 border-r border-slate-800/60 text-slate-600 font-mono text-xs text-right pr-3 select-none overflow-hidden">
              {currentText.split('\n').map((_, idx) => (
                <div key={idx} className="leading-6">
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Code text area */}
            <textarea
              value={currentText}
              onChange={(e) => handleTextChange(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-transparent text-slate-200 font-mono text-xs p-3 leading-6 focus:outline-none resize-none selection:bg-indigo-500/30 overflow-y-auto"
            />
          </div>

          {/* Quick Context Tips for active file */}
          <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-300">Rules Notice:</span>
              {selectedFile === 'agent.yaml' && (
                <span>Must retain model: gemma-4-31b-it-qat-w4a16-ct and relative !include directives.</span>
              )}
              {selectedFile.startsWith('prompts/') && (
                <span>Prompts are loaded relative to agent root via !include prompts/&lt;filename&gt;.</span>
              )}
              {selectedFile.startsWith('sub_agents/') && (
                <span>Sub-agents act as AgentTools for the root orchestrator.</span>
              )}
              {selectedFile.startsWith('adapters/') && (
                <span>LoRA adapters must specify target_modules and PEFT config.</span>
              )}
              {selectedFile.startsWith('skills/') && (
                <span>Skills must have YAML frontmatter with matching name in SKILL.md.</span>
              )}
              {selectedFile === 'eval_config.yaml' && (
                <span>Overall competition time limit is capped at 12 hours.</span>
              )}
              {selectedFile === 'configs/sampling.yaml' && (
                <span>Loaded via !include configs/sampling.yaml.</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Changes auto-saved</span>
          </div>
        </div>
      </div>

      {/* MODAL: Add New Prompt */}
      {showAddPromptModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Create New Prompt File</h3>
            <p className="text-xs text-slate-400">
              New prompt will be saved under <code className="text-indigo-300 font-mono">prompts/</code> and can be loaded via <code className="text-cyan-300 font-mono">!include prompts/&lt;name&gt;.md</code>.
            </p>
            <input
              type="text"
              placeholder="e.g. test_runner.md"
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowAddPromptModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPromptName.trim()) {
                    const fname = newPromptName.endsWith('.md') ? newPromptName.trim() : `${newPromptName.trim()}.md`;
                    onCreateFile('prompt', fname);
                    setSelectedFile(`prompts/${fname}`);
                    setShowAddPromptModal(false);
                    setNewPromptName('');
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium cursor-pointer"
              >
                Create Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Sub-Agent */}
      {showAddSubAgentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Create New Sub-Agent</h3>
            <p className="text-xs text-slate-400">
              Sub-agents act as specialized <code className="text-purple-300 font-mono">AgentTool</code> configurations in <code className="text-indigo-300 font-mono">sub_agents/</code>.
            </p>
            <input
              type="text"
              placeholder="e.g. git_diff_reviewer.yaml"
              value={newSubAgentName}
              onChange={(e) => setNewSubAgentName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowAddSubAgentModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newSubAgentName.trim()) {
                    const fname = newSubAgentName.endsWith('.yaml') ? newSubAgentName.trim() : `${newSubAgentName.trim()}.yaml`;
                    onCreateFile('subagent', fname);
                    setSelectedFile(`sub_agents/${fname}`);
                    setShowAddSubAgentModal(false);
                    setNewSubAgentName('');
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium cursor-pointer"
              >
                Create Sub-Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New LoRA */}
      {showAddLoraModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Register PEFT LoRA Adapter</h3>
            <p className="text-xs text-slate-400">
              Creates directory <code className="text-indigo-300 font-mono">adapters/&lt;name&gt;/</code> with <code className="text-cyan-300 font-mono">adapter_config.json</code> and <code className="text-cyan-300 font-mono">adapter_model.safetensors</code>.
            </p>
            <input
              type="text"
              placeholder="e.g. test_driven_lora"
              value={newLoraName}
              onChange={(e) => setNewLoraName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowAddLoraModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newLoraName.trim()) {
                    onCreateFile('lora', newLoraName.trim());
                    setSelectedFile(`adapters/${newLoraName.trim()}/adapter_config.json`);
                    setShowAddLoraModal(false);
                    setNewLoraName('');
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium cursor-pointer"
              >
                Create LoRA Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
