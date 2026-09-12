import { PermissionLevel, ConfirmationRequest, ToolExecutionRecord } from '../shared/types';
import { auditService } from './auditService';
import { toolsService } from './toolsService';

export interface PendingApproval {
  id: string;
  toolCallId: string;
  name: string;
  args: Record<string, any>;
  permissionLevel: PermissionLevel;
  originatingCommand: string;
  description: string;
  itemsCount?: number;
  resolve: (value: { approved: boolean; result?: any; error?: string }) => void;
  createdAt: number;
}

class PermissionEngine {
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  // Categorize tools into Level 1, 2, or 3
  public evaluatePermission(toolName: string, args: Record<string, any>): {
    level: PermissionLevel;
    requiresConfirmation: boolean;
    description: string;
    itemsCount?: number;
  } {
    switch (toolName) {
      // LEVEL 1: SAFE
      case 'search_web':
      case 'read_file':
      case 'search_code':
      case 'read_screen':
      case 'capture_camera_frame':
      case 'analyze_image':
      case 'open_url':
      case 'open_app':
      case 'list_memories':
        return {
          level: 1,
          requiresConfirmation: false,
          description: `Safe operation: ${toolName}`,
        };

      // LEVEL 2: ACTION (Document creation, file writes, memory storage)
      case 'create_presentation':
        return {
          level: 2,
          requiresConfirmation: false, // User explicitly commanded PPT generation, safe inside sandbox
          description: `Generate presentation: ${args.title || 'Untitled'}`,
          itemsCount: args.slides?.length || 3,
        };

      case 'create_document':
        return {
          level: 2,
          requiresConfirmation: false,
          description: `Generate document: ${args.title || 'Untitled'}`,
          itemsCount: args.sections?.length || 2,
        };

      case 'create_spreadsheet':
        return {
          level: 2,
          requiresConfirmation: false,
          description: `Generate spreadsheet: ${args.title || 'Untitled'}`,
        };

      case 'write_file':
      case 'patch_file':
        return {
          level: 2,
          requiresConfirmation: false,
          description: `Write file to sandbox: ${args.filepath}`,
        };

      case 'remember':
      case 'forget':
        return {
          level: 2,
          requiresConfirmation: false,
          description: `Update personal memory: ${args.key}`,
        };

      // LEVEL 3: HIGH IMPACT (Deletions, Arbitrary Shell Commands, Destructive actions)
      case 'delete_file':
        return {
          level: 3,
          requiresConfirmation: true,
          description: `Delete target file or folder: ${args.filepath}`,
          itemsCount: 1,
        };

      case 'run_command':
        return {
          level: 3,
          requiresConfirmation: true,
          description: `Execute terminal command: "${args.command}"`,
        };

      default:
        return {
          level: 2,
          requiresConfirmation: false,
          description: `Execute tool: ${toolName}`,
        };
    }
  }

  // Request approval for Level 2/3 tools that require confirmation
  public requestConfirmation(
    toolName: string,
    args: Record<string, any>,
    level: PermissionLevel,
    originatingCommand: string,
    description: string,
    itemsCount?: number
  ): Promise<{ approved: boolean; result?: any; error?: string }> {
    const approvalId = 'req_' + Math.random().toString(36).substring(2, 9);
    const toolCallId = 'act_' + Math.random().toString(36).substring(2, 9);

    // Record initial audit entry
    auditService.record({
      name: toolName,
      args,
      permissionLevel: level,
      status: 'WAITING_CONFIRMATION',
      originatingCommand,
    });

    return new Promise((resolve) => {
      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        toolCallId,
        name: toolName,
        args,
        permissionLevel: level,
        originatingCommand,
        description,
        itemsCount,
        resolve,
        createdAt: Date.now(),
      });
    });
  }

  // Handle confirmation resolution (via UI button, voice "Confirm", or Thumbs Up gesture)
  public async resolveApproval(approvalId: string, approved: boolean): Promise<{ success: boolean; result?: any }> {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      return { success: false };
    }

    this.pendingApprovals.delete(approvalId);

    if (!approved) {
      auditService.record({
        name: pending.name,
        args: pending.args,
        permissionLevel: pending.permissionLevel,
        status: 'REJECTED',
        originatingCommand: pending.originatingCommand,
        error: 'Action cancelled by user authorization protocol.',
      });

      pending.resolve({ approved: false, error: 'Authorization rejected.' });
      return { success: true, result: 'Cancelled' };
    }

    // Approved: Execute the tool
    try {
      const execRecord = auditService.record({
        name: pending.name,
        args: pending.args,
        permissionLevel: pending.permissionLevel,
        status: 'EXECUTING',
        originatingCommand: pending.originatingCommand,
      });

      let res: any;
      if (pending.name === 'delete_file') {
        res = await toolsService.delete_file(pending.args.filepath);
      } else if (pending.name === 'run_command') {
        res = await toolsService.run_command(pending.args.command);
      } else {
        res = { executed: true };
      }

      auditService.updateRecord(execRecord.id, {
        status: 'COMPLETED',
        result: res,
      });

      pending.resolve({ approved: true, result: res });
      return { success: true, result: res };
    } catch (err: any) {
      pending.resolve({ approved: true, error: err.message });
      return { success: false, result: err.message };
    }
  }

  // Get all currently pending confirmations for visual display
  public getPendingRequests(): ConfirmationRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => ({
      id: p.id,
      toolCallId: p.toolCallId,
      actionName: p.name,
      description: p.description,
      itemsCount: p.itemsCount,
      details: p.args,
      permissionLevel: p.permissionLevel,
      timestamp: p.createdAt,
    }));
  }

  // Emergency abort all pending approvals
  public abortAll(): void {
    for (const [id, pending] of this.pendingApprovals.entries()) {
      pending.resolve({ approved: false, error: 'Emergency STOP triggered.' });
    }
    this.pendingApprovals.clear();
  }
}

export const permissionEngine = new PermissionEngine();
