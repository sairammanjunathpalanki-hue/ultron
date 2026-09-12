export type UltronState = 
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'EXECUTING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'SPEAKING'
  | 'STOPPED'
  | 'ERROR';

export type PermissionLevel = 1 | 2 | 3;

export interface ToolExecutionRecord {
  id: string;
  name: string;
  args: Record<string, any>;
  permissionLevel: PermissionLevel;
  status: 'PENDING' | 'WAITING_CONFIRMATION' | 'EXECUTING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'ABORTED';
  result?: any;
  error?: string;
  timestamp: number;
  originatingCommand: string;
  durationMs?: number;
}

export interface ConfirmationRequest {
  id: string;
  toolCallId: string;
  actionName: string;
  description: string;
  itemsCount?: number;
  details?: Record<string, any>;
  permissionLevel: PermissionLevel;
  timestamp: number;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'preference' | 'project' | 'fact' | 'task';
  createdAt: number;
}

export type GestureType = 
  | 'NONE'
  | 'OPEN_PALM'
  | 'THUMBS_UP'
  | 'THUMBS_DOWN'
  | 'PINCH'
  | 'POINT_LEFT'
  | 'POINT_RIGHT'
  | 'POINT_UP'
  | 'POINT_DOWN'
  | 'FIST'
  | 'WAVE'
  | 'SWIPE_LEFT'
  | 'SWIPE_RIGHT';

export interface VisionTrackingState {
  faceDetected: boolean;
  faceConfidence: number;
  faceBox?: { x: number; y: number; width: number; height: number };
  headOrientation?: { yaw: number; pitch: number; roll: number };
  handDetected: boolean;
  handGesture: GestureType;
  gestureConfidence: number;
  fps: number;
}

export interface SystemStatusState {
  aiCore: 'ONLINE' | 'STANDBY' | 'DEGRADED' | 'OFFLINE';
  voice: 'ONLINE' | 'MUTED' | 'UNAVAILABLE';
  vision: 'ONLINE' | 'PAUSED' | 'UNAVAILABLE';
  gestures: 'ONLINE' | 'PAUSED' | 'UNAVAILABLE';
  web: 'ONLINE' | 'OFFLINE';
  tools: 'ONLINE' | 'ERROR';
  memory: 'ONLINE' | 'ERROR';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolExecutionRecord[];
}
