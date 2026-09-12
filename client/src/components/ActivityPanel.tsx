import React from 'react';
import { Terminal, Globe, FileText, Presentation, FileSpreadsheet, Trash2, ShieldAlert, CheckCircle2, AlertCircle, Clock, Download, ChevronRight } from 'lucide-react';
import { ToolExecutionRecord } from '../../../shared/types';
import { apiUrl } from '../config/api';

interface ActivityPanelProps {
  records: ToolExecutionRecord[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  records,
  onClear,
  isOpen,
  onToggle,
}) => {
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'search_web':
        return <Globe className="w-4 h-4 text-[#00d4ff]" />;
      case 'create_presentation':
        return <Presentation className="w-4 h-4 text-[#ffaa00]" />;
      case 'create_document':
        return <FileText className="w-4 h-4 text-[#ff8800]" />;
      case 'create_spreadsheet':
        return <FileSpreadsheet className="w-4 h-4 text-[#00ffaa]" />;
      case 'delete_file':
        return <Trash2 className="w-4 h-4 text-[#ff3344]" />;
      case 'emergency_stop':
        return <ShieldAlert className="w-4 h-4 text-[#ff3344]" />;
      default:
        return <Terminal className="w-4 h-4 text-[#ffaa00]" />;
    }
  };

  const getStatusBadge = (status: ToolExecutionRecord['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-mono-tech text-[#00ffaa] bg-[#00ffaa]/10 px-1.5 py-0.5 rounded border border-[#00ffaa]/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>COMPLETED</span>
          </span>
        );
      case 'WAITING_CONFIRMATION':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-mono-tech text-[#ffcc00] bg-[#ffcc00]/20 px-1.5 py-0.5 rounded border border-[#ffcc00]/40 animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span>WAITING AUTH</span>
          </span>
        );
      case 'EXECUTING':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-mono-tech text-[#00d4ff] bg-[#00d4ff]/10 px-1.5 py-0.5 rounded border border-[#00d4ff]/30 animate-pulse">
            <Clock className="w-3 h-3 animate-spin" />
            <span>ACTIVE</span>
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
      case 'ABORTED':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-mono-tech text-[#ff3344] bg-[#ff3344]/10 px-1.5 py-0.5 rounded border border-[#ff3344]/30">
            <AlertCircle className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getLevelBadge = (level: number) => {
    switch (level) {
      case 1:
        return <span className="text-[9px] font-mono-tech text-neutral-400 bg-neutral-800 px-1 py-0.5 rounded">LVL 1 SAFE</span>;
      case 2:
        return <span className="text-[9px] font-mono-tech text-[#ffaa00] bg-[#ffaa00]/20 px-1 py-0.5 rounded">LVL 2 ACTION</span>;
      case 3:
        return <span className="text-[9px] font-mono-tech text-[#ff3344] bg-[#ff3344]/20 px-1 py-0.5 rounded">LVL 3 IMPACT</span>;
      default:
        return null;
    }
  };

  return (
    <aside
      className={`fixed right-4 top-16 bottom-24 z-20 w-84 transition-all duration-300 flex flex-col pointer-events-auto ${
        isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
      style={{ width: '340px' }}
    >
      {/* Toggle Tab */}
      <button
        onClick={onToggle}
        className="absolute -left-8 top-6 p-1.5 rounded-l bg-[#0a0a10] border-y border-l border-[#ffaa00]/30 text-[#ffaa00] hover:bg-[#ffaa00]/20 transition"
        title={isOpen ? 'Collapse Activity Panel' : 'Expand Activity Panel'}
      >
        <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} />
      </button>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col bg-[#06060c]/85 border border-[#ffaa00]/25 rounded-lg backdrop-blur-md overflow-hidden hud-glass-panel shadow-2xl">
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-[#ffaa00]/20 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-[#ffaa00]" />
            <span className="text-xs font-orbitron tracking-wider text-[#ffaa00]">
              COMMAND AUDIT LOG
            </span>
          </div>
          <button
            onClick={onClear}
            className="text-[10px] font-mono-tech text-neutral-400 hover:text-neutral-200 transition"
          >
            CLEAR
          </button>
        </div>

        {/* Scrollable Records */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {records.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <Terminal className="w-8 h-8 mb-2 opacity-30 text-[#ffaa00]" />
              <span className="text-xs font-rajdhani">NO EXECUTIONS YET</span>
              <p className="text-[11px] font-mono-tech mt-1 text-neutral-600">
                Execute a voice or text command to view tool telemetry.
              </p>
            </div>
          ) : (
            records.map((rec) => (
              <div
                key={rec.id}
                className="p-2.5 rounded bg-black/50 border border-[#ffaa00]/15 hover:border-[#ffaa00]/40 transition space-y-1.5"
              >
                {/* Top Row: Tool Name + Level + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getToolIcon(rec.name)}
                    <span className="text-xs font-rajdhani font-bold text-neutral-200 uppercase tracking-wide">
                      {rec.name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {getStatusBadge(rec.status)}
                </div>

                {/* Second Row: Level & Originating Command */}
                <div className="flex items-center justify-between text-[10px] font-mono-tech">
                  {getLevelBadge(rec.permissionLevel)}
                  <span className="text-neutral-500">
                    {new Date(rec.timestamp).toTimeString().split(' ')[0]}
                  </span>
                </div>

                {/* Originating command quote */}
                {rec.originatingCommand && (
                  <div className="text-[11px] text-neutral-400 font-mono-tech italic truncate">
                    "{rec.originatingCommand}"
                  </div>
                )}

                {/* Result or Download link */}
                {rec.status === 'COMPLETED' && rec.result && (
                  <div className="mt-1 pt-1.5 border-t border-neutral-800/80 text-[11px] font-mono-tech text-neutral-300">
                    {rec.result.relativePath ? (
                      <a
                        href={apiUrl(`/api/files/download?path=${encodeURIComponent(rec.result.relativePath)}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[#00ffaa] hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download: {rec.result.filename || rec.result.relativePath}</span>
                      </a>
                    ) : rec.result.results ? (
                      <span className="text-[#00d4ff]">
                        Retrieved {rec.result.results.length} search citations
                      </span>
                    ) : (
                      <span className="text-neutral-400">Operation verified</span>
                    )}
                  </div>
                )}

                {/* Error information */}
                {rec.error && (
                  <div className="text-[10px] font-mono-tech text-[#ff3344] bg-[#ff3344]/10 p-1 rounded">
                    {rec.error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
