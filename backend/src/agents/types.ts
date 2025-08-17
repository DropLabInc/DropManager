export type AgentType =
  | 'orchestrator'
  | 'task'
  | 'project'
  | 'sentiment'
  | 'question'
  | 'reporting'
  | 'notification'
  | 'analysis';

export type AgentMessageType = 'REQUEST' | 'RESPONSE' | 'NOTIFICATION' | 'QUERY';

export interface AgentMessage<TPayload = any> {
  id: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  type: AgentMessageType;
  payload: TPayload;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  context: AgentContext;
  timestamp: string;
}

export interface AgentContext {
  userId: string;
  conversationId: string;
  // Minimal shared context for MVP
  weekOf?: string;
  pendingQuestions?: Question[];
  knowledgeGaps?: KnowledgeGap[];
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  outbound: AgentMessage[];
  logs?: string[];
}

export interface Agent<TInput = any> {
  name: AgentType;
  canHandle(input: TInput, context: AgentContext): boolean;
  handle(input: TInput, context: AgentContext): Promise<AgentResult>;
}

export interface KnowledgeGap {
  code: string;
  description: string;
  field?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Question {
  id: string;
  text: string;
  field?: string;
  required: boolean;
}

export interface ExtractedTaskLike {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  tags?: string[];
}


