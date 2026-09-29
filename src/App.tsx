/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { AgentConfigEditor } from './components/AgentConfigEditor';
import { GraphReasoningLab } from './components/GraphReasoningLab';
import { SWEBenchSimulator } from './components/SWEBenchSimulator';
import { LinterInspector } from './components/LinterInspector';
import { ResearchPaperLab } from './components/ResearchPaperLab';
import {
  ALL_PRESETS,
  PRESET_GRAPH_AUGMENTED,
  AgentArchitecturePreset,
} from './data/defaultPresets';
import { VirtualFileTree, REQUIRED_BASE_MODEL, ALLOWED_HARNESS_TOOLS } from './types/agent';
import { buildFileTreeFromPreset, INITIAL_FILES } from './utils/yamlHelpers';
import { validateSubmissionFiles, ValidationSummary } from './utils/adkValidator';
import { packageSubmissionZip, unpackSubmissionZip } from './utils/zipHandler';
import yaml from 'yaml';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'config' | 'graph' | 'simulator' | 'linter' | 'research'>('config');
  const [currentPresetId, setCurrentPresetId] = useState<string>(PRESET_GRAPH_AUGMENTED.id);
  const [files, setFiles] = useState<VirtualFileTree>(INITIAL_FILES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Real-time validation
  const validation: ValidationSummary = useMemo(() => {
    return validateSubmissionFiles(files);
  }, [files]);

  const currentPreset = useMemo(() => {
    return ALL_PRESETS.find((p) => p.id === currentPresetId) || PRESET_GRAPH_AUGMENTED;
  }, [currentPresetId]);

  // Handle preset switch
  const handleSelectPreset = (presetId: string) => {
    const preset = ALL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setCurrentPresetId(preset.id);
      const newFiles = buildFileTreeFromPreset(preset);
      setFiles(newFiles);
      showToast(`Loaded preset architecture: "${preset.name}"`);
    }
  };

  // File modification handler
  const handleChangeFile = (filePath: string, content: string) => {
    setFiles((prev) => {
      const updated = { ...prev };
      if (filePath === 'agent.yaml') {
        updated['agent.yaml'] = content;
      } else if (filePath === 'configs/sampling.yaml') {
        updated['configs/sampling.yaml'] = content;
      } else if (filePath === 'eval_config.yaml') {
        updated['eval_config.yaml'] = content;
      } else if (filePath.startsWith('prompts/')) {
        const fname = filePath.replace(/^prompts\//, '');
        updated.prompts = { ...updated.prompts, [fname]: content };
      } else if (filePath.startsWith('sub_agents/')) {
        const fname = filePath.replace(/^sub_agents\//, '');
        updated.sub_agents = { ...updated.sub_agents, [fname]: content };
      } else if (filePath.startsWith('tests/')) {
        const fname = filePath.replace(/^tests\//, '');
        updated.tests = { ...updated.tests, [fname]: content };
      } else if (filePath.startsWith('adapters/')) {
        const parts = filePath.split('/');
        const adapterName = parts[1];
        if (!updated.adapters[adapterName]) {
          updated.adapters[adapterName] = { configJson: '', dummyWeightsNote: '' };
        }
        if (parts[2] === 'adapter_config.json') {
          updated.adapters[adapterName] = {
            ...updated.adapters[adapterName],
            configJson: content,
          };
        }
      } else if (filePath.startsWith('skills/')) {
        const parts = filePath.split('/');
        const skillName = parts[1];
        if (!updated.skills[skillName]) {
          updated.skills[skillName] = { skillMd: '', scripts: {}, resources: {} };
        }
        if (parts[2] === 'SKILL.md') {
          updated.skills[skillName] = { ...updated.skills[skillName], skillMd: content };
        } else if (parts[2] === 'scripts' && parts[3]) {
          updated.skills[skillName] = {
            ...updated.skills[skillName],
            scripts: { ...updated.skills[skillName].scripts, [parts[3]]: content },
          };
        } else if (parts[2] === 'resources' && parts[3]) {
          updated.skills[skillName] = {
            ...updated.skills[skillName],
            resources: { ...updated.skills[skillName].resources, [parts[3]]: content },
          };
        }
      }
      return updated;
    });
  };

  // File creation handler
  const handleCreateFile = (type: 'prompt' | 'subagent' | 'skill' | 'lora' | 'test', name: string) => {
    setFiles((prev) => {
      const updated = { ...prev };
      if (type === 'prompt') {
        updated.prompts = {
          ...updated.prompts,
          [name]: `# ${name.replace(/\.md$/, '')}\n\nSystem instructions for ${name}...\n`,
        };
      } else if (type === 'subagent') {
        updated.sub_agents = {
          ...updated.sub_agents,
          [name]: `# Sub-agent: ${name}\nname: ${name.replace(/\.yaml$/, '')}\nmodel: ${REQUIRED_BASE_MODEL}\nsystem_prompt: !include prompts/system.md\ntools:\n  - read_file\n  - run_command\n`,
        };
      } else if (type === 'test') {
        updated.tests = {
          ...updated.tests,
          [name]: `#!/usr/bin/env python3\n"""\nValidation test template: ${name}\nVerify patch validity before submit_patch().\n"""\nimport sys\n\ndef test_suite():\n    print("Running patch verification...")\n    # Implement test assertion\n    assert True, "Validation assertion failed"\n    print("Validation passed!")\n\nif __name__ == "__main__":\n    test_suite()\n    sys.exit(0)\n`,
        };
      } else if (type === 'lora') {
        const adapterConfig = {
          base_model_name_or_path: 'google/gemma-4-31b-it-qat-w4a16-ct',
          bias: 'none',
          fan_in_fan_out: false,
          init_lora_weights: true,
          lora_alpha: 32,
          lora_dropout: 0.05,
          peft_type: 'LORA',
          r: 16,
          target_modules: ['q_proj', 'v_proj'],
          task_type: 'CAUSAL_LM',
        };
        updated.adapters = {
          ...updated.adapters,
          [name]: {
            configJson: JSON.stringify(adapterConfig, null, 2),
            dummyWeightsNote: 'Fine-tuned LoRA PEFT weights',
          },
        };
      }
      return updated;
    });
    showToast(`Created new file: ${name}`);
  };

  // File deletion handler
  const handleDeleteFile = (type: 'prompt' | 'subagent' | 'skill' | 'lora' | 'test', name: string) => {
    setFiles((prev) => {
      const updated = { ...prev };
      if (type === 'prompt') {
        const copy = { ...updated.prompts };
        delete copy[name];
        updated.prompts = copy;
      } else if (type === 'subagent') {
        const copy = { ...updated.sub_agents };
        delete copy[name];
        updated.sub_agents = copy;
      } else if (type === 'test') {
        const copy = { ...updated.tests };
        delete copy[name];
        updated.tests = copy;
      }
      return updated;
    });
    showToast(`Deleted ${name}`);
  };

  // Export submission.zip
  const handleExportZip = async () => {
    try {
      const blob = await packageSubmissionZip(files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'submission.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Successfully exported submission.zip for Kaggle!');
    } catch (err: any) {
      showToast(`Export error: ${err?.message || 'Failed to package zip'}`);
    }
  };

  // Import submission.zip
  const handleImportZip = async (file: File) => {
    try {
      const unpacked = await unpackSubmissionZip(file);
      setFiles(unpacked);
      setActiveTab('linter');
      showToast(`Imported archive "${file.name}" with ${Object.keys(unpacked.prompts).length} prompts and ${Object.keys(unpacked.sub_agents).length} sub-agents.`);
    } catch (err: any) {
      showToast(`Import error: ${err?.message || 'Could not parse zip archive'}`);
    }
  };

  // Auto-Fix implementation
  const handleAutoFix = (action?: string) => {
    if (!action) return;

    if (action === 'set_base_model') {
      let current = files['agent.yaml'] || '';
      if (/model:\s*[^\n]+/.test(current)) {
        current = current.replace(/model:\s*[^\n]+/, `model: ${REQUIRED_BASE_MODEL}`);
      } else {
        current = `model: ${REQUIRED_BASE_MODEL}\n` + current;
      }
      handleChangeFile('agent.yaml', current);
      showToast(`Updated base model to "${REQUIRED_BASE_MODEL}"`);
    } else if (action === 'add_submit_patch') {
      let current = files['agent.yaml'] || '';
      if (current.includes('tools:')) {
        current = current.replace('tools:', 'tools:\n  - submit_patch');
      }
      handleChangeFile('agent.yaml', current);
      showToast('Added required "submit_patch" tool');
    } else if (action === 'add_graph_tools') {
      let current = files['agent.yaml'] || '';
      if (current.includes('tools:')) {
        current = current.replace(
          'tools:',
          'tools:\n  - get_code_neighbors\n  - search_similar_code\n  - get_code_subgraph',
        );
      }
      handleChangeFile('agent.yaml', current);
      showToast('Configured code graph reasoning tools');
    } else if (action === 'fix_budget_12h') {
      let current = files['eval_config.yaml'] || '';
      current = current.replace(/max_overall_hours:\s*\d+/, 'max_overall_hours: 12');
      handleChangeFile('eval_config.yaml', current);
      showToast('Adjusted max_overall_hours to 12');
    } else if (action.startsWith('create_missing_include_')) {
      const target = action.replace('create_missing_include_', '');
      if (target.startsWith('prompts/')) {
        const fname = target.replace('prompts/', '');
        handleCreateFile('prompt', fname);
      }
    }
  };

  const handleFixAll = () => {
    // Perform full sweep auto-fix
    let agentYaml = files['agent.yaml'] || '';
    if (!agentYaml.includes(`model: ${REQUIRED_BASE_MODEL}`)) {
      agentYaml = agentYaml.replace(/model:\s*[^\n]+/, `model: ${REQUIRED_BASE_MODEL}`);
    }
    if (!agentYaml.includes('submit_patch')) {
      agentYaml = agentYaml.replace('tools:', 'tools:\n  - submit_patch');
    }
    if (!agentYaml.includes('search_similar_code')) {
      agentYaml = agentYaml.replace('tools:', 'tools:\n  - search_similar_code\n  - get_code_neighbors');
    }
    handleChangeFile('agent.yaml', agentYaml);

    // Fix budget
    let evalYaml = files['eval_config.yaml'] || '';
    evalYaml = evalYaml.replace(/max_overall_hours:\s*\d+/, 'max_overall_hours: 12');
    handleChangeFile('eval_config.yaml', evalYaml);

    showToast('Auto-fixed all detectable compliance issues!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navbar with tab switching and actions */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        validation={validation}
        onExportZip={handleExportZip}
        onImportZip={handleImportZip}
        onSelectPreset={handleSelectPreset}
        currentPresetId={currentPresetId}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'config' && (
          <AgentConfigEditor
            files={files}
            onChangeFile={handleChangeFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
          />
        )}

        {activeTab === 'graph' && <GraphReasoningLab files={files} />}

        {activeTab === 'simulator' && <SWEBenchSimulator files={files} />}

        {activeTab === 'linter' && (
          <LinterInspector
            validation={validation}
            files={files}
            onAutoFix={handleAutoFix}
            onFixAll={handleFixAll}
          />
        )}

        {activeTab === 'research' && <ResearchPaperLab currentPreset={currentPreset} />}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
