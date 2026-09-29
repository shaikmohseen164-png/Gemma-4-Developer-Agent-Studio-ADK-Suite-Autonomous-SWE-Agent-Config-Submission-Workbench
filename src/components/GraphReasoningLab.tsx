import React, { useState, useMemo } from 'react';
import {
  Network,
  Search,
  ArrowRight,
  GitFork,
  FileCode,
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  FolderTree,
  Filter,
} from 'lucide-react';
import { GraphNode, GraphEdge, VirtualFileTree } from '../types/agent';
import { extractCodeGraphFromFiles } from '../utils/graphExtractor';

interface GraphReasoningLabProps {
  files?: VirtualFileTree;
  onInsertToolCall?: (toolName: string, args: Record<string, unknown>) => void;
}

// Sample repository benchmark call-graph dataset
const BENCHMARK_NODES: GraphNode[] = [
  { id: 'sympy.polys.polytools.factor', name: 'factor', type: 'function', file: 'sympy/polys/polytools.py', line: 5820, docstring: 'Compute the factorization of an expression into irreducible factors.' },
  { id: 'sympy.polys.polytools._generic_factor', name: '_generic_factor', type: 'function', file: 'sympy/polys/polytools.py', line: 5912, docstring: 'Helper for domain-specific factorization dispatch.' },
  { id: 'sympy.polys.polytools._symbolic_factor', name: '_symbolic_factor', type: 'function', file: 'sympy/polys/polytools.py', line: 5950, docstring: 'Handles algebraic extensions and multivariate symbolic terms.' },
  { id: 'sympy.polys.factortools.dmp_factor_list', name: 'dmp_factor_list', type: 'function', file: 'sympy/polys/factortools.py', line: 1290, docstring: 'Factor multivariate polynomial in distributed representation.' },
  { id: 'sympy.polys.factortools.dup_factor_list', name: 'dup_factor_list', type: 'function', file: 'sympy/polys/factortools.py', line: 1140, docstring: 'Factor dense univariate polynomials.' },
  { id: 'sympy.polys.domains.domain.Domain.convert', name: 'Domain.convert', type: 'method', file: 'sympy/polys/domains/domain.py', line: 310, docstring: 'Convert element to target algebraic domain representation.' },
  { id: 'sympy.polys.polyoptions.build_options', name: 'build_options', type: 'function', file: 'sympy/polys/polyoptions.py', line: 720, docstring: 'Normalize options flags for polynomials.' },
  { id: 'sympy.core.expr.Expr.as_poly', name: 'Expr.as_poly', type: 'method', file: 'sympy/core/expr.py', line: 1045, docstring: 'Convert expression to Poly instance if possible.' },
];

const BENCHMARK_EDGES: GraphEdge[] = [
  { source: 'sympy.polys.polytools.factor', target: 'sympy.polys.polytools._generic_factor', type: 'calls' },
  { source: 'sympy.polys.polytools.factor', target: 'sympy.polys.polyoptions.build_options', type: 'calls' },
  { source: 'sympy.polys.polytools._generic_factor', target: 'sympy.polys.polytools._symbolic_factor', type: 'calls' },
  { source: 'sympy.polys.polytools._generic_factor', target: 'sympy.polys.factortools.dmp_factor_list', type: 'calls' },
  { source: 'sympy.polys.factortools.dmp_factor_list', target: 'sympy.polys.factortools.dup_factor_list', type: 'calls' },
  { source: 'sympy.polys.factortools.dup_factor_list', target: 'sympy.polys.domains.domain.Domain.convert', type: 'calls' },
  { source: 'sympy.polys.polytools.factor', target: 'sympy.core.expr.Expr.as_poly', type: 'references' },
];

export const GraphReasoningLab: React.FC<GraphReasoningLabProps> = ({ files }) => {
  const [graphMode, setGraphMode] = useState<'current_files' | 'benchmark_repo'>('current_files');
  const [activeTab, setActiveTab] = useState<'search' | 'neighbors' | 'subgraph'>('search');
  const [searchQuery, setSearchQuery] = useState('factor polynomial multivariate algebraic extension');
  const [edgeFilter, setEdgeFilter] = useState<'all' | 'calls' | 'references' | 'imports'>('all');
  const [kResults, setKResults] = useState<number>(4);

  // Compute live graph from current submission files
  const liveFileGraph = useMemo(() => {
    if (!files) {
      return { nodes: BENCHMARK_NODES, edges: BENCHMARK_EDGES };
    }
    return extractCodeGraphFromFiles(files);
  }, [files]);

  // Active dataset
  const activeNodes = graphMode === 'current_files' ? liveFileGraph.nodes : BENCHMARK_NODES;
  const activeEdges = graphMode === 'current_files' ? liveFileGraph.edges : BENCHMARK_EDGES;

  const [selectedNodeId, setSelectedNodeId] = useState<string>(() => {
    return activeNodes[0]?.id || 'agent.yaml:root';
  });

  const [subgraphNodes, setSubgraphNodes] = useState<string[]>(() => {
    return activeNodes.slice(0, 3).map((n) => n.id);
  });

  // Keep selected node synced if dataset changes
  const selectedNode = activeNodes.find((n) => n.id === selectedNodeId) || activeNodes[0] || {
    id: 'unknown',
    name: 'Unknown',
    type: 'module',
    file: 'unknown',
    line: 1,
    docstring: '',
  };

  // Filtered edges
  const filteredEdges = activeEdges.filter((e) => {
    if (edgeFilter === 'all') return true;
    return e.type === edgeFilter;
  });

  // Calculate coordinates for SVG dynamic layout
  const nodePositions = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const total = activeNodes.length;

    if (graphMode === 'benchmark_repo') {
      const fixedBenchmark: Record<string, { x: number; y: number }> = {
        'sympy.polys.polytools.factor': { x: 90, y: 160 },
        'sympy.polys.polyoptions.build_options': { x: 140, y: 50 },
        'sympy.core.expr.Expr.as_poly': { x: 90, y: 280 },
        'sympy.polys.polytools._generic_factor': { x: 280, y: 160 },
        'sympy.polys.polytools._symbolic_factor': { x: 280, y: 50 },
        'sympy.polys.factortools.dmp_factor_list': { x: 470, y: 160 },
        'sympy.polys.factortools.dup_factor_list': { x: 620, y: 160 },
        'sympy.polys.domains.domain.Domain.convert': { x: 620, y: 280 },
      };
      return fixedBenchmark;
    }

    // Dynamic radial/force layout for current files
    // Put root agent in center
    const rootIndex = activeNodes.findIndex((n) => n.id === 'agent.yaml:root');
    const width = 740;
    const height = 360;
    const centerX = width / 2;
    const centerY = height / 2;

    coords['agent.yaml:root'] = { x: centerX, y: centerY };

    // Group other nodes into orbits by type
    const nonRoot = activeNodes.filter((n) => n.id !== 'agent.yaml:root');
    const count = nonRoot.length;

    nonRoot.forEach((node, idx) => {
      // Determine distance by node category
      let radius = 135;
      if (node.id.startsWith('tool:')) radius = 150;
      else if (node.id.startsWith('sub_agents/')) radius = 110;
      else if (node.id.startsWith('adapters/')) radius = 120;
      else if (node.id.startsWith('skills/')) radius = 140;

      const angle = (idx / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
      const x = Math.round(centerX + Math.cos(angle) * (radius * 1.55));
      const y = Math.round(centerY + Math.sin(angle) * radius);
      coords[node.id] = {
        x: Math.max(50, Math.min(width - 50, x)),
        y: Math.max(40, Math.min(height - 40, y)),
      };
    });

    return coords;
  }, [activeNodes, graphMode]);

  // Simulated cosine similarity matching
  const getSearchResults = () => {
    const queryTokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return activeNodes.map((node) => {
      const text = `${node.name} ${node.id} ${node.docstring || ''} ${node.file}`.toLowerCase();
      let matchScore = 0.35;
      queryTokens.forEach((tok) => {
        if (text.includes(tok)) matchScore += 0.18;
      });
      if (node.name.toLowerCase().includes(queryTokens[0] || '')) matchScore += 0.22;
      return {
        node,
        similarity: Math.min(0.98, Math.max(0.38, Number(matchScore.toFixed(3)))),
      };
    })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, kResults);
  };

  // Node neighbors
  const getNeighbors = (nodeId: string) => {
    const outgoing = activeEdges.filter((e) => e.source === nodeId);
    const incoming = activeEdges.filter((e) => e.target === nodeId);
    return { outgoing, incoming };
  };

  const { outgoing, incoming } = getNeighbors(selectedNode.id);

  // Induced subgraph calculation
  const inducedEdges = activeEdges.filter(
    (e) => subgraphNodes.includes(e.source) && subgraphNodes.includes(e.target),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
      {/* Top Banner explaining the 3 Graph Tools */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-900/50 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Repository Code-Graph & Semantic Embedding Tools
            </h2>
            <span className="text-[11px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
              Gemma 4 Harness
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            The competition harness provides graph reasoning tools: <code className="text-indigo-300 font-mono">search_similar_code</code>,{' '}
            <code className="text-indigo-300 font-mono">get_code_neighbors</code>, and{' '}
            <code className="text-indigo-300 font-mono">get_code_subgraph</code>. Below, visualize both the live dependency graph extracted from your current files and the SWE-bench evaluation benchmark.
          </p>
        </div>

        {/* Graph Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => {
              setGraphMode('current_files');
              if (liveFileGraph.nodes[0]) setSelectedNodeId(liveFileGraph.nodes[0].id);
              setSubgraphNodes(liveFileGraph.nodes.slice(0, 3).map((n) => n.id));
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              graphMode === 'current_files'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Current Files Graph</span>
          </button>

          <button
            onClick={() => {
              setGraphMode('benchmark_repo');
              setSelectedNodeId(BENCHMARK_NODES[0].id);
              setSubgraphNodes(BENCHMARK_NODES.slice(0, 3).map((n) => n.id));
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              graphMode === 'benchmark_repo'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Benchmark Repo (SymPy)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Visual Graph Canvas Card */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800/80 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                {graphMode === 'current_files' ? 'Current Submission Structure Code-Graph' : 'Repository Call/Dependency Graph'}
              </h3>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {activeNodes.length} nodes · {filteredEdges.length} edges
              </span>
            </div>

            {/* Edge Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3" /> Edge:
              </span>
              <select
                aria-label="Filter edge types"
                value={edgeFilter}
                onChange={(e) => setEdgeFilter(e.target.value as any)}
                className="bg-slate-950 text-slate-300 text-xs rounded border border-slate-800 px-2 py-0.5 focus:outline-none"
              >
                <option value="all">All Edges</option>
                <option value="calls">calls</option>
                <option value="references">references</option>
                <option value="imports">imports</option>
              </select>
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800/80 h-[380px] overflow-hidden p-2 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 740 360">
              <defs>
                <marker
                  id="arrow-calls"
                  viewBox="0 0 10 10"
                  refX="19"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#6366f1" />
                </marker>
                <marker
                  id="arrow-references"
                  viewBox="0 0 10 10"
                  refX="19"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
                </marker>
                <marker
                  id="arrow-imports"
                  viewBox="0 0 10 10"
                  refX="19"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="20"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Render edges */}
              {filteredEdges.map((edge, idx) => {
                const src = nodePositions[edge.source];
                const tgt = nodePositions[edge.target];
                if (!src || !tgt) return null;
                const isSelected = edge.source === selectedNode.id || edge.target === selectedNode.id;
                const edgeColor = isSelected
                  ? '#38bdf8'
                  : edge.type === 'calls'
                  ? '#4f46e5'
                  : edge.type === 'references'
                  ? '#0284c7'
                  : '#059669';

                return (
                  <g key={`${edge.source}-${edge.target}-${idx}`}>
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={edgeColor}
                      strokeWidth={isSelected ? 2.2 : 1.2}
                      strokeDasharray={edge.type === 'references' ? '4 3' : undefined}
                      markerEnd={
                        isSelected
                          ? 'url(#arrow-active)'
                          : edge.type === 'references'
                          ? 'url(#arrow-references)'
                          : edge.type === 'imports'
                          ? 'url(#arrow-imports)'
                          : 'url(#arrow-calls)'
                      }
                    />
                    {/* Edge label */}
                    <text
                      x={(src.x + tgt.x) / 2}
                      y={(src.y + tgt.y) / 2 - 4}
                      fill={isSelected ? '#7dd3fc' : '#64748b'}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {edge.type}
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {activeNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const isSelected = node.id === selectedNode.id;
                const isInSubgraph = subgraphNodes.includes(node.id);
                const isRoot = node.id === 'agent.yaml:root';

                // Node coloring by type
                let nodeStroke = '#6366f1';
                let nodeFill = '#0f172a';
                if (isRoot) {
                  nodeStroke = '#eab308';
                  nodeFill = '#713f12';
                } else if (node.type === 'class') {
                  nodeStroke = '#a855f7';
                } else if (node.type === 'method') {
                  nodeStroke = '#06b6d4';
                } else if (node.type === 'module') {
                  nodeStroke = '#10b981';
                }

                if (isSelected) {
                  nodeFill = '#4338ca';
                  nodeStroke = '#38bdf8';
                } else if (isInSubgraph) {
                  nodeFill = '#1e293b';
                }

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer transition-transform hover:scale-105"
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isRoot ? 18 : isSelected ? 15 : 12}
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth={isSelected ? 3 : isRoot ? 2.5 : 1.5}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 22}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                      fontSize="10"
                      fontWeight={isSelected || isRoot ? '600' : '400'}
                      fontFamily="monospace"
                    >
                      {node.name.length > 20 ? `${node.name.slice(0, 18)}..` : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="absolute bottom-2 left-2 text-[10px] text-slate-500 font-mono bg-slate-950/80 px-2 py-1 rounded border border-slate-800 flex items-center gap-3">
              <span>Click node to select</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Root Agent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span> Functions/Tools
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span> SubAgents/Classes
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Modules/Skills
              </span>
            </div>
          </div>

          {/* Selected Node Details */}
          <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-semibold text-white">{selectedNode.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!subgraphNodes.includes(selectedNode.id)) {
                      setSubgraphNodes([...subgraphNodes, selectedNode.id]);
                    }
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono border border-cyan-800/60 bg-cyan-950/40 px-2 py-0.5 rounded cursor-pointer"
                >
                  + Add to Subgraph
                </button>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {selectedNode.type}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              File path: <span className="font-mono text-slate-200">{selectedNode.file}:{selectedNode.line}</span>
            </div>
            {selectedNode.docstring && (
              <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded border border-slate-800/80">
                "{selectedNode.docstring}"
              </p>
            )}
          </div>
        </div>

        {/* Interactive Tool Execution Playground Card */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col space-y-4">
          {/* Tool Selector Tabs */}
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-1.5 rounded text-center font-medium transition cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              search_similar_code
            </button>
            <button
              onClick={() => setActiveTab('neighbors')}
              className={`flex-1 py-1.5 rounded text-center font-medium transition cursor-pointer ${
                activeTab === 'neighbors'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              get_code_neighbors
            </button>
            <button
              onClick={() => setActiveTab('subgraph')}
              className={`flex-1 py-1.5 rounded text-center font-medium transition cursor-pointer ${
                activeTab === 'subgraph'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              get_code_subgraph
            </button>
          </div>

          {/* TAB 1: search_similar_code */}
          {activeTab === 'search' && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Natural Language or Semantic Query:</span>
                  <span className="text-[10px] text-slate-500 font-mono">Dense Vector Embeddings</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. multivariate factor algebraic extension"
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-500 text-[11px]">k:</span>
                    <select
                      aria-label="Number of results k"
                      value={kResults}
                      onChange={(e) => setKResults(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={6}>6</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live search results */}
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
                {getSearchResults().map(({ node, similarity }, idx) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="p-2.5 bg-slate-950 hover:bg-slate-800/60 rounded-lg border border-slate-800/80 cursor-pointer transition flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                        <span className="font-mono text-xs text-indigo-300 font-medium">{node.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({node.file.split('/').pop()}:{node.line})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                        {node.id}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                        {(similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Python execution call preview */}
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 font-mono text-[11px] text-slate-300">
                <span className="text-indigo-400">tool_call</span>: search_similar_code(query="{searchQuery}", k={kResults})
              </div>
            </div>
          )}

          {/* TAB 2: get_code_neighbors */}
          {activeTab === 'neighbors' && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Target Node:</span>
                <span className="font-mono text-indigo-300 text-xs">{selectedNode.name}</span>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  Outgoing Edges ({outgoing.length})
                </div>
                {outgoing.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded">No outgoing edges recorded</div>
                ) : (
                  outgoing.map((edge, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNodeId(edge.target)}
                      className="p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 flex items-center justify-between text-xs font-mono cursor-pointer"
                    >
                      <span className="text-cyan-300">{edge.target.split('.').pop() || edge.target}</span>
                      <span className="text-[10px] text-slate-500">[{edge.type}]</span>
                    </div>
                  ))
                )}

                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 pt-2">
                  <ArrowRight className="w-3 h-3 text-amber-400 rotate-180" />
                  Incoming Edges ({incoming.length})
                </div>
                {incoming.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded">No incoming edges recorded</div>
                ) : (
                  incoming.map((edge, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNodeId(edge.source)}
                      className="p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 flex items-center justify-between text-xs font-mono cursor-pointer"
                    >
                      <span className="text-amber-300">{edge.source.split('.').pop() || edge.source}</span>
                      <span className="text-[10px] text-slate-500">[{edge.type}]</span>
                    </div>
                  ))
                )}
              </div>

              {/* Call preview */}
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 font-mono text-[11px] text-slate-300 mt-auto">
                <span className="text-indigo-400">tool_call</span>: get_code_neighbors(node="{selectedNode.id}")
              </div>
            </div>
          )}

          {/* TAB 3: get_code_subgraph */}
          {activeTab === 'subgraph' && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="text-xs text-slate-400">
                Extracts the induced subgraph connecting multiple symbols. This allows Gemma 4 to see how 2 or more files interlock without reading hundreds of lines.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Selected Symbols ({subgraphNodes.length}):</label>
                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {subgraphNodes.map((n) => (
                    <div
                      key={n}
                      className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-xs font-mono"
                    >
                      <span className="text-indigo-300 truncate">{n}</span>
                      <button
                        onClick={() => setSubgraphNodes(subgraphNodes.filter((x) => x !== n))}
                        className="text-slate-500 hover:text-rose-400 text-xs ml-2 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Induced Interconnecting Edges: <span className="font-mono text-cyan-400 font-semibold">{inducedEdges.length} edges</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 font-mono text-[11px] text-slate-300 mt-auto">
                <span className="text-indigo-400">tool_call</span>: get_code_subgraph(nodes={JSON.stringify(subgraphNodes)})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
