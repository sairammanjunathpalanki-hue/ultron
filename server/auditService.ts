import { ToolExecutionRecord, PermissionLevel } from '../shared/types';
import fs from 'fs';
import path from 'path';

class AuditService {
  private records: ToolExecutionRecord[] = [];
  private logFilePath: string;

  constructor() {
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, 'ultron_audit.jsonl');
  }

  public record(item: Omit<ToolExecutionRecord, 'id' | 'timestamp'>): ToolExecutionRecord {
    const record: ToolExecutionRecord = {
      ...item,
      id: 'act_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };

    this.records.unshift(record);
    if (this.records.length > 200) {
      this.records.pop();
    }

    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      console.error('[AuditService] Failed to write to log file:', err);
    }

    return record;
  }

  public updateRecord(id: string, updates: Partial<ToolExecutionRecord>): ToolExecutionRecord | undefined {
    const record = this.records.find((r) => r.id === id);
    if (record) {
      Object.assign(record, updates);
      if (updates.status === 'COMPLETED' || updates.status === 'FAILED' || updates.status === 'REJECTED') {
        record.durationMs = Date.now() - record.timestamp;
      }
    }
    return record;
  }

  public getRecords(limit = 50): ToolExecutionRecord[] {
    return this.records.slice(0, limit);
  }

  public clear(): void {
    this.records = [];
  }
}

export const auditService = new AuditService();
