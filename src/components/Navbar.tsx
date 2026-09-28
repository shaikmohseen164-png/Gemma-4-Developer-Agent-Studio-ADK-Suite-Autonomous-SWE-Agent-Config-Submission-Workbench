import React, { useRef } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileCode2,
  Network,
  PlayCircle,
  ShieldCheck,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { ValidationSummary } from '../utils/adkValidator';
import { ALL_PRESETS } from '../data/defaultPresets';

interface NavbarProps {
  activeTab: 'config' | 'graph' | 'simulator' | 'linter' | 'research';
  setActiveTab: (tab: 'config' | 'graph' | 'simulator' | 'linter' | 'research') => void;
  validation: ValidationSummary;
  onExportZip: () => void;
  onImportZip: (file: File) => void;
  onSelectPreset: (presetId: string) => void;
  currentPresetId: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  validation,
  onExportZip,
  onImportZip,
  onSelectPreset,
  currentPresetId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportZip(file);
      e.target.value = '';
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      {/* Top Banner with competition highlight */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-cyan-950/60 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-400">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Google - The Gemma 4 Developer Agent Competition</span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            $100,000 Prize Pool ($65k Agents + $35k Research Papers)
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/60">
            Model: gemma-4-31b-it-qat-w4a16-ct
          </span>
          <span className="hidden md:inline text-slate-500">
            Max Evaluation Budget: 12h
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Preset picker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 text-sm">
              G4
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Gemma 4 Developer Agent Studio
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                  ADK Suite
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Autonomous SWE Agent Config & Submission Workbench
              </div>
            </div>
          </div>

          {/* Preset selector */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 text-[11px]">Preset:</span>
            <select
              aria-label="Preset configuration"
              value={currentPresetId}
              onChange={(e) => onSelectPreset(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-medium"
            >
              {ALL_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name} ({p.badge})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
              activeTab === 'config'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Agent ADK & Files</span>
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
              activeTab === 'graph'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Code Graph & Tools</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
              activeTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>SWE-Bench Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('linter')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
              activeTab === 'linter'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Harness Linter</span>
            {validation.errorsCount > 0 ? (
              <span className="bg-rose-500/80 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {validation.errorsCount}
              </span>
            ) : (
              <span className="bg-emerald-500/30 text-emerald-400 text-[10px] px-1 py-0.2 rounded font-mono">
                OK
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('research')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
              activeTab === 'research'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Paper Track ($35k)</span>
          </button>
        </nav>

        {/* Actions: Import, Export, Compliance Score */}
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div
            onClick={() => setActiveTab('linter')}
            className={`cursor-pointer hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition ${
              validation.passed
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/70 hover:bg-emerald-900/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/70 hover:bg-rose-900/40'
            }`}
          >
            {validation.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>Score: {validation.score}%</span>
          </div>

          {/* Import Zip */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".zip"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import an existing submission.zip to inspect and test"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import .zip</span>
          </button>

          {/* Export Zip */}
          <button
            onClick={onExportZip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded font-medium text-xs shadow-md shadow-emerald-950/50 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export submission.zip</span>
          </button>
        </div>
      </div>
    </header>
  );
};
