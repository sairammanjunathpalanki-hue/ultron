import React, { useState } from 'react';
import { Settings, X, Key, Cpu, Volume2, Sliders, Check, Globe } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl } from '../config/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  model: string;
  onSaveModel: (model: string) => void;
  quality: 'high' | 'medium' | 'low';
  onSaveQuality: (q: 'high' | 'medium' | 'low') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  model,
  onSaveModel,
  quality,
  onSaveQuality,
}) => {
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const [inputKey, setInputKey] = useState(apiKey);
  const [selectedModel, setSelectedModel] = useState(model);
  const [selectedQuality, setSelectedQuality] = useState(quality);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiBaseUrl(backendUrl);
    onSaveApiKey(inputKey.trim());
    onSaveModel(selectedModel);
    onSaveQuality(selectedQuality);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#08080e] border border-[#ffaa00]/30 rounded-lg p-6 shadow-[0_0_50px_rgba(255,170,0,0.15)] relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#ffaa00]/20">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#ffaa00]" />
            <h2 className="text-sm font-orbitron font-bold text-[#ffaa00] tracking-wider">
              SYSTEM CONFIGURATION
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          {/* Remote Backend URL (HTTPS) */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono-tech text-neutral-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-[#ffaa00]" />
              <span>REMOTE BACKEND URL (HTTPS)</span>
            </label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://your-ultron-backend.onrender.com"
              className="w-full bg-black/70 border border-[#ffaa00]/30 rounded px-3.5 py-2 text-xs font-mono-tech text-neutral-200 focus:outline-none focus:border-[#ffaa00]"
            />
            <p className="text-[10px] font-mono-tech text-neutral-500">
              Public cloud URL for 5G/LTE access from your phone. Leave blank when running locally with Vite proxy.
            </p>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono-tech text-neutral-300 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-[#ffaa00]" />
              <span>OPENAI API KEY (GPT-6 ASTRA / RESPONSES)</span>
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-black/70 border border-[#ffaa00]/30 rounded px-3.5 py-2 text-xs font-mono-tech text-neutral-200 focus:outline-none focus:border-[#ffaa00]"
            />
            <p className="text-[10px] font-mono-tech text-neutral-500">
              Keys are securely handled on the local backend server. If left blank, Ultron operates in safe local deterministic mode.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono-tech text-neutral-300 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#ffaa00]" />
              <span>TARGET AI INTELLIGENCE MODEL</span>
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-black/70 border border-[#ffaa00]/30 rounded px-3.5 py-2 text-xs font-mono-tech text-neutral-200 focus:outline-none focus:border-[#ffaa00]"
            >
              <option value="gpt-6-astra">gpt-6-astra (Primary Spec Target)</option>
              <option value="gpt-4o">gpt-4o (Verified Multimodal Fallback)</option>
              <option value="gpt-4o-mini">gpt-4o-mini (High Speed / Low Latency)</option>
            </select>
            <p className="text-[10px] font-mono-tech text-neutral-500">
              If gpt-6-astra is unentitled for the current OpenAI account, the system automatically falls back to gpt-4o.
            </p>
          </div>

          {/* Graphics Quality */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono-tech text-neutral-300 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#ffaa00]" />
              <span>HOLOGRAPHIC 3D CORE GRAPHICS QUALITY</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['high', 'medium', 'low'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuality(q)}
                  className={`py-1.5 rounded text-xs font-mono-tech uppercase border transition ${
                    selectedQuality === q
                      ? 'bg-[#ffaa00]/20 border-[#ffaa00] text-[#ffaa00] font-bold'
                      : 'bg-black/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {q} ({q === 'high' ? '3500 pts' : q === 'medium' ? '2200 pts' : '1200 pts'})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#ffaa00]/20 flex items-center justify-between">
          <span className="text-[11px] font-mono-tech text-neutral-500">
            {savedSuccess ? 'Settings updated successfully!' : 'All configurations apply live.'}
          </span>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#ffaa00]/20 hover:bg-[#ffaa00]/30 border border-[#ffaa00] text-[#ffaa00] font-rajdhani font-bold text-xs tracking-wider transition"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-[#00ffaa]" /> : null}
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
