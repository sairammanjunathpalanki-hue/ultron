import { describe, it, expect, beforeEach } from 'vitest';
import { permissionEngine } from '../server/permissionEngine';
import { memoryService } from '../server/memoryService';
import { toolsService } from '../server/toolsService';
import fs from 'fs';
import path from 'path';

describe('ULTRON Command Center Engine Tests', () => {
  beforeEach(() => {
    permissionEngine.abortAll();
  });

  describe('1. Centralized Permission Engine (Non-Autonomous Safeguards)', () => {
    it('should categorize web search as Level 1 Safe and not require approval card', () => {
      const evalRes = permissionEngine.evaluatePermission('search_web', { query: 'SIH 2026' });
      expect(evalRes.level).toBe(1);
      expect(evalRes.requiresConfirmation).toBe(false);
    });

    it('should categorize presentation creation as Level 2 Action', () => {
      const evalRes = permissionEngine.evaluatePermission('create_presentation', { title: 'SIH Brief' });
      expect(evalRes.level).toBe(2);
      expect(evalRes.requiresConfirmation).toBe(false);
    });

    it('should categorize delete_file as Level 3 High Impact and mandate confirmation', () => {
      const evalRes = permissionEngine.evaluatePermission('delete_file', { filepath: 'target_dir' });
      expect(evalRes.level).toBe(3);
      expect(evalRes.requiresConfirmation).toBe(true);
    });

    it('should categorize arbitrary shell command as Level 3 High Impact', () => {
      const evalRes = permissionEngine.evaluatePermission('run_command', { command: 'npm test' });
      expect(evalRes.level).toBe(3);
      expect(evalRes.requiresConfirmation).toBe(true);
    });

    it('should instantly abort pending approvals when Emergency STOP is triggered', async () => {
      const confirmPromise = permissionEngine.requestConfirmation(
        'delete_file',
        { filepath: 'temp_folder' },
        3,
        'delete temp_folder',
        'Delete target folder'
      );

      const pending = permissionEngine.getPendingRequests();
      expect(pending.length).toBe(1);

      // Trigger Emergency STOP
      permissionEngine.abortAll();

      const result = await confirmPromise;
      expect(result.approved).toBe(false);
      expect(result.error).toContain('Emergency STOP');
      expect(permissionEngine.getPendingRequests().length).toBe(0);
    });
  });

  describe('2. Explicit Memory Store', () => {
    it('should remember explicit facts and retrieve them', () => {
      const mem = memoryService.remember('Security Protocol', 'Level-Alpha', 'preference');
      expect(mem.key).toBe('Security Protocol');
      expect(mem.value).toBe('Level-Alpha');

      const all = memoryService.getAll();
      const found = all.find((m) => m.key === 'Security Protocol');
      expect(found).toBeDefined();
      expect(found?.value).toBe('Level-Alpha');
    });

    it('should forget items when explicitly requested', () => {
      memoryService.remember('Temporary Memo', '12345', 'fact');
      const removed = memoryService.forget('Temporary Memo');
      expect(removed).toBe(true);

      const all = memoryService.getAll();
      const found = all.find((m) => m.key === 'Temporary Memo');
      expect(found).toBeUndefined();
    });
  });

  describe('3. Sandboxed File & Document Generators', () => {
    it('should prevent path traversal outside sandbox boundary', async () => {
      await expect(toolsService.read_file('../../windows/system32/cmd.exe')).rejects.toThrow(
        /Path access violation/
      );
    });

    it('should create a real .pptx presentation file in sandbox', async () => {
      const res = await toolsService.create_presentation({
        title: 'Vitest Automated Presentation',
        subtitle: 'Validation of PPTX Generator',
        slides: [
          {
            title: 'Automated Slide 1',
            bulletPoints: ['Point Alpha', 'Point Beta'],
          },
        ],
      });

      expect(res.filename).toContain('.pptx');
      expect(fs.existsSync(res.fullPath)).toBe(true);
      const stat = fs.statSync(res.fullPath);
      expect(stat.size).toBeGreaterThan(1000); // Verify real binary content
    });

    it('should create a real .docx document file in sandbox', async () => {
      const res = await toolsService.create_document({
        title: 'Vitest Automated Document',
        sections: [
          { heading: 'Section 1', content: 'Verified docx generation pipeline.' },
        ],
      });

      expect(res.filename).toContain('.docx');
      expect(fs.existsSync(res.fullPath)).toBe(true);
      const stat = fs.statSync(res.fullPath);
      expect(stat.size).toBeGreaterThan(500);
    });

    it('should create a real .xlsx spreadsheet file in sandbox', async () => {
      const res = await toolsService.create_spreadsheet({
        title: 'Vitest Automated Spreadsheet',
        sheets: [
          {
            name: 'Telemetry',
            headers: ['Metric', 'Value'],
            rows: [
              ['CPU', '35%'],
              ['FPS', '60'],
            ],
          },
        ],
      });

      expect(res.filename).toContain('.xlsx');
      expect(fs.existsSync(res.fullPath)).toBe(true);
      const stat = fs.statSync(res.fullPath);
      expect(stat.size).toBeGreaterThan(1000);
    });
  });
});
