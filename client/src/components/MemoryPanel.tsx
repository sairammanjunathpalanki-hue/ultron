import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Tag, Clock, ChevronRight } from 'lucide-react';
import { MemoryItem } from '../../../shared/types';
import { apiUrl } from '../config/api';

interface MemoryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ isOpen, onToggle }) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [category, setCategory] = useState<'preference' | 'project' | 'fact' | 'task'>('fact');

  const fetchMemories = async () => {
    try {
      const res = await fetch(apiUrl('/api/memory'));
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const res = await fetch(apiUrl('/api/memory'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.trim(), value: newValue.trim(), category }),
      });
      if (res.ok) {
        setNewKey('');
        setNewValue('');
        fetchMemories();
      }
    } catch (_) {}
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/memory/${id}`), { method: 'DELETE' });
      if (res.ok) {
        fetchMemories();
      }
    } catch (_) {}
  };

  return (
    <aside
      className={`fixed left-4 top-16 bottom-24 z-20 transition-all duration-300 flex flex-col pointer-events-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
      }`}
      style={{ width: '320px' }}
    >
      {/* Toggle Tab */}
      <button
        onClick={onToggle}
        className="absolute -right-8 top-6 p-1.5 rounded-r bg-[#0a0a10] border-y border-r border-[#ffaa00]/30 text-[#ffaa00] hover:bg-[#ffaa00]/20 transition"
        title={isOpen ? 'Collapse Memory Store' : 'Expand Memory Store'}
      >
        <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-[#06060c]/85 border border-[#ffaa00]/25 rounded-lg backdrop-blur-md overflow-hidden hud-glass-panel shadow-2xl">
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-[#ffaa00]/20 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#ffaa00]" />
            <span className="text-xs font-orbitron tracking-wider text-[#ffaa00]">
              SYSTEM MEMORY
            </span>
          </div>
          <span className="text-[10px] font-mono-tech text-neutral-400">
            {memories.length} STORED
          </span>
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleAdd} className="p-3 border-b border-[#ffaa00]/15 space-y-2 bg-black/30">
          <div className="text-[10px] font-mono-tech text-neutral-400">STORE EXPLICIT MEMORY:</div>
          <input
            type="text"
            placeholder="Key / Concept (e.g. User Designation)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full bg-black/60 border border-[#ffaa00]/20 rounded px-2.5 py-1 text-xs font-rajdhani text-neutral-200 focus:outline-none focus:border-[#ffaa00]"
          />
          <input
            type="text"
            placeholder="Value / Detail"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full bg-black/60 border border-[#ffaa00]/20 rounded px-2.5 py-1 text-xs font-rajdhani text-neutral-200 focus:outline-none focus:border-[#ffaa00]"
          />
          <div className="flex items-center justify-between pt-1">
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="bg-black/60 border border-[#ffaa00]/20 rounded px-2 py-1 text-[10px] font-mono-tech text-neutral-300 focus:outline-none focus:border-[#ffaa00]"
            >
              <option value="preference">Preference</option>
              <option value="project">Project</option>
              <option value="fact">Fact</option>
              <option value="task">Task</option>
            </select>
            <button
              type="submit"
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#ffaa00]/20 hover:bg-[#ffaa00]/30 border border-[#ffaa00]/40 rounded text-[10px] font-orbitron text-[#ffaa00] transition"
            >
              <Plus className="w-3 h-3" />
              <span>REMEMBER</span>
            </button>
          </div>
        </form>

        {/* Memories List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {memories.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs font-rajdhani">
              NO STORED MEMORIES
            </div>
          ) : (
            memories.map((m) => (
              <div
                key={m.id}
                className="p-2 rounded bg-black/50 border border-[#ffaa00]/15 hover:border-[#ffaa00]/35 transition group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-rajdhani font-bold text-[#ffaa00]">
                    {m.key}
                  </span>
                  <span className="text-[9px] font-mono-tech uppercase px-1 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    {m.category}
                  </span>
                </div>
                <p className="text-xs font-rajdhani text-neutral-300 mt-1">
                  {m.value}
                </p>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-neutral-800/80">
                  <span className="text-[9px] font-mono-tech text-neutral-600">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-neutral-500 hover:text-[#ff3344] transition opacity-0 group-hover:opacity-100"
                    title="Forget this memory"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
