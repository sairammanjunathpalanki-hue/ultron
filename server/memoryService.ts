import fs from 'fs';
import path from 'path';
import { MemoryItem } from '../shared/types';

class MemoryService {
  private memoryFile: string;
  private memories: MemoryItem[] = [];
  public isEnabled: boolean = true;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.memoryFile = path.join(dataDir, 'ultron_memory.json');
    this.loadMemories();
  }

  private loadMemories() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const raw = fs.readFileSync(this.memoryFile, 'utf8');
        this.memories = JSON.parse(raw);
      } else {
        this.memories = [
          {
            id: 'mem_1',
            key: 'User Designation',
            value: 'Commander',
            category: 'preference',
            createdAt: Date.now() - 3600000,
          },
          {
            id: 'mem_2',
            key: 'Operational Focus',
            value: 'Multimodal engineering & command operations',
            category: 'project',
            createdAt: Date.now() - 1800000,
          },
        ];
        this.saveMemories();
      }
    } catch (err) {
      console.error('[MemoryService] Error loading memories:', err);
      this.memories = [];
    }
  }

  private saveMemories() {
    try {
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.memories, null, 2), 'utf8');
    } catch (err) {
      console.error('[MemoryService] Error saving memories:', err);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public getAll(): MemoryItem[] {
    if (!this.isEnabled) return [];
    return this.memories;
  }

  public search(query: string): MemoryItem[] {
    if (!this.isEnabled) return [];
    const q = query.toLowerCase();
    return this.memories.filter(
      (m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || m.category.includes(q)
    );
  }

  public remember(key: string, value: string, category: 'preference' | 'project' | 'fact' | 'task' = 'fact'): MemoryItem | null {
    if (!this.isEnabled) {
      console.log('[MemoryService] Memory is disabled by privacy policy.');
      return null;
    }

    const existingIndex = this.memories.findIndex((m) => m.key.toLowerCase() === key.toLowerCase());
    if (existingIndex >= 0) {
      this.memories[existingIndex].value = value;
      this.memories[existingIndex].category = category;
      this.saveMemories();
      return this.memories[existingIndex];
    }

    const newItem: MemoryItem = {
      id: 'mem_' + Math.random().toString(36).substring(2, 9),
      key,
      value,
      category,
      createdAt: Date.now(),
    };
    this.memories.unshift(newItem);
    this.saveMemories();
    return newItem;
  }

  public forget(keyOrId: string): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter(
      (m) => m.id !== keyOrId && m.key.toLowerCase() !== keyOrId.toLowerCase()
    );
    if (this.memories.length !== initialLen) {
      this.saveMemories();
      return true;
    }
    return false;
  }

  public clear(): void {
    this.memories = [];
    this.saveMemories();
  }
}

export const memoryService = new MemoryService();
