import JSZip from 'jszip';
import { VirtualFileTree } from '../types/agent';

/**
 * Creates minimal valid safetensors binary header so unpicklers and safetensors readers parse it correctly.
 */
function createMinimalSafetensorsBinary(): Uint8Array {
  const headerObj = {
    '__metadata__': {
      'format': 'pt',
      'source': 'Gemma 4 Developer Agent Studio Export',
      'competition': 'Google - The Gemma 4 Developer Agent Competition',
    },
    'base_model.model.model.layers.0.self_attn.q_proj.lora_A.weight': {
      'dtype': 'F32',
      'shape': [16, 4096],
      'data_offsets': [0, 65536],
    },
  };
  const headerStr = JSON.stringify(headerObj);
  const headerBytes = new TextEncoder().encode(headerStr);
  const headerLen = headerBytes.length;

  // 8-byte little-endian header length + header bytes + dummy data
  const buffer = new ArrayBuffer(8 + headerLen + 65536);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(headerLen), true);

  const uint8 = new Uint8Array(buffer);
  uint8.set(headerBytes, 8);
  // Rest is zeroed tensor weights
  return uint8;
}

export async function packageSubmissionZip(files: VirtualFileTree): Promise<Blob> {
  const zip = new JSZip();

  // Root agent.yaml
  zip.file('agent.yaml', files['agent.yaml'] || '');

  // configs
  if (files['configs/sampling.yaml']) {
    zip.file('configs/sampling.yaml', files['configs/sampling.yaml']);
  }

  // eval_config.yaml
  if (files['eval_config.yaml']) {
    zip.file('eval_config.yaml', files['eval_config.yaml']);
  }

  // prompts/
  for (const [filename, content] of Object.entries(files.prompts)) {
    zip.file(`prompts/${filename}`, content);
  }

  // sub_agents/
  for (const [filename, content] of Object.entries(files.sub_agents)) {
    zip.file(`sub_agents/${filename}`, content);
  }

  // tests/
  if (files.tests) {
    for (const [filename, content] of Object.entries(files.tests)) {
      zip.file(`tests/${filename}`, content);
    }
  }

  // adapters/
  const dummySafetensor = createMinimalSafetensorsBinary();
  for (const [adapterName, adapterData] of Object.entries(files.adapters)) {
    zip.file(`adapters/${adapterName}/adapter_config.json`, adapterData.configJson);
    zip.file(`adapters/${adapterName}/adapter_model.safetensors`, dummySafetensor);
  }

  // skills/
  for (const [skillDir, skillData] of Object.entries(files.skills)) {
    zip.file(`skills/${skillDir}/SKILL.md`, skillData.skillMd);
    for (const [scriptFile, scriptCode] of Object.entries(skillData.scripts)) {
      zip.file(`skills/${skillDir}/scripts/${scriptFile}`, scriptCode);
    }
    for (const [resFile, resContent] of Object.entries(skillData.resources)) {
      zip.file(`skills/${skillDir}/resources/${resFile}`, resContent);
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

export async function unpackSubmissionZip(file: File): Promise<VirtualFileTree> {
  const zip = await JSZip.loadAsync(file);

  const result: VirtualFileTree = {
    'agent.yaml': '',
    'configs/sampling.yaml': '',
    'eval_config.yaml': '',
    prompts: {},
    sub_agents: {},
    tests: {},
    adapters: {},
    skills: {},
  };

  const filePromises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    const promise = (async () => {
      if (relativePath === 'agent.yaml') {
        result['agent.yaml'] = await zipEntry.async('string');
      } else if (relativePath === 'configs/sampling.yaml') {
        result['configs/sampling.yaml'] = await zipEntry.async('string');
      } else if (relativePath === 'eval_config.yaml') {
        result['eval_config.yaml'] = await zipEntry.async('string');
      } else if (relativePath.startsWith('prompts/')) {
        const fname = relativePath.replace(/^prompts\//, '');
        result.prompts[fname] = await zipEntry.async('string');
      } else if (relativePath.startsWith('sub_agents/')) {
        const fname = relativePath.replace(/^sub_agents\//, '');
        result.sub_agents[fname] = await zipEntry.async('string');
      } else if (relativePath.startsWith('tests/')) {
        const fname = relativePath.replace(/^tests\//, '');
        result.tests[fname] = await zipEntry.async('string');
      } else if (relativePath.startsWith('adapters/')) {
        const parts = relativePath.split('/');
        const adapterName = parts[1];
        const innerFile = parts[2];
        if (!result.adapters[adapterName]) {
          result.adapters[adapterName] = { configJson: '', dummyWeightsNote: '' };
        }
        if (innerFile === 'adapter_config.json') {
          result.adapters[adapterName].configJson = await zipEntry.async('string');
        } else if (innerFile === 'adapter_model.safetensors') {
          result.adapters[adapterName].dummyWeightsNote = 'Binary weights loaded';
        }
      } else if (relativePath.startsWith('skills/')) {
        const parts = relativePath.split('/');
        const skillName = parts[1];
        if (!result.skills[skillName]) {
          result.skills[skillName] = { skillMd: '', scripts: {}, resources: {} };
        }
        if (parts[2] === 'SKILL.md') {
          result.skills[skillName].skillMd = await zipEntry.async('string');
        } else if (parts[2] === 'scripts' && parts[3]) {
          result.skills[skillName].scripts[parts[3]] = await zipEntry.async('string');
        } else if (parts[2] === 'resources' && parts[3]) {
          result.skills[skillName].resources[parts[3]] = await zipEntry.async('string');
        }
      }
    })();

    filePromises.push(promise);
  });

  await Promise.all(filePromises);
  return result;
}
