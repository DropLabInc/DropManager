### AI Multi‑Agent Architecture Plan for DropManager

This document defines the multi‑agent architecture, responsibilities, communication model, data flows, and delivery plan. It also tracks tasks to do and tasks accomplished.

---

### Goals
- Build specialized AI agents that collaborate to process updates, manage projects/tasks, and interact with users to fill knowledge gaps.
- Keep the system modular, observable, and incrementally deployable.
- Leverage existing `ProjectManager` and `GeminiNLP` while evolving to an orchestrated agent system.

---

### High‑Level Architecture
- Agent Orchestrator
  - Routes incoming events, maintains conversation context, coordinates agents.
- Specialized Agents
  - Task Agent: extract tasks, identify dependencies, estimate/track effort.
  - Project Agent: classify/categorize work, manage lifecycle, create projects.
  - Sentiment Agent: analyze tone, detect blockers, assess risk.
  - Question Agent: detect knowledge gaps, generate clarifying questions, follow‑ups.
  - Reporting Agent: summaries, insights, trends, analytics for dashboard.
  - Notification Agent: reminders, alerts, escalations, subscriptions.
- Shared Knowledge Base
  - Conversation state, user preferences, learned patterns, domain knowledge.
- Data Layer
  - Firestore (employees, projects, tasks, updates) with in‑memory fallback.

---

### Proposed Code Structure
```
backend/src/
  agents/
    orchestrator.ts            // Agent Orchestrator (entrypoint)
    types.ts                   // Shared agent interfaces/types
    taskAgent.ts               // Task Agent implementation
    projectAgent.ts            // Project Agent implementation
    sentimentAgent.ts          // Sentiment Agent implementation
    questionAgent.ts           // Question Agent implementation
    reportingAgent.ts          // Reporting Agent implementation
    notificationAgent.ts       // Notification Agent implementation
  services/
    projectManager.ts          // Bridges agents with existing data/services
    geminiNLP.ts               // Underlying LLM utilities
  store/
    memory.ts                  // In‑memory store (already exists)
```

---

### Core Interfaces (planning)
- AgentMessage
  - id, fromAgent, toAgent, type: REQUEST | RESPONSE | NOTIFICATION | QUERY
  - payload: any, priority: LOW | MEDIUM | HIGH | URGENT
  - context: userId, conversationId, knowledgeGaps[], pendingQuestions[], timestamp
- Agent
  - name, canHandle(message): boolean
  - handle(message, context): Promise<AgentMessage | AgentMessage[]>
- Orchestrator
  - routeInbound(event): determines agent(s) to invoke
  - mergeResponses(responses): coherent single reply to UI/Chat
  - persistContext(context): stores conversation state/decisions

---

### Inter‑Agent Communication
- Use typed `AgentMessage` envelopes; all payloads must be serializable.
- Orchestrator is the broker; agents do not call each other directly (prevents tight coupling).
- Agents may emit `QUERY` messages; Orchestrator translates them into user prompts if needed.
- All messages carry `conversationId` + `userId` and minimal context to reproduce state.

---

### Knowledge & Context Management
- Short‑term: Context held in orchestrator memory + persisted snapshots in Firestore (`conversations/{id}`) for durability.
- Long‑term: Add embeddings store for semantic recall (future scope), keeping PII minimal.

---

### Delivery Plan (Milestones)
- M1: Scaffolding and Orchestrator
  - Create `agents/` directory, shared types, and orchestrator with routing skeleton.
  - Integrate with `ProjectManager` to read/write tasks/projects/updates.
  - Expose a simple `/agents/debug` route to inspect message flows.
- M2: Task Agent + Project Agent (Core)
  - Implement task extraction wrapper on top of `GeminiNLP`.
  - Auto‑categorize work and create/attach projects.
  - Emit `QUERY` when required fields are missing (e.g., due date, priority).
- M3: Sentiment + Question Agents (Intelligence)
  - Detect blockers/risks, recommend actions.
  - Generate clarifying questions and follow‑ups based on knowledge gaps.
- M4: Reporting + Notification Agents (Automation)
  - Analytics summaries and dashboard insights.
  - Reminders and escalation policies.

---

### Task Board

#### To Do
- [ ] Define `agents/types.ts` with `AgentMessage`, `AgentContext`, `Agent` interfaces.
- [ ] Implement `agents/orchestrator.ts` with routing and simple fan‑out → fan‑in.
- [ ] Wire orchestrator entrypoints from `inbound` and `chat` routes where appropriate.
- [ ] Implement `TaskAgent` MVP:
  - [ ] Use `GeminiNLP` to extract tasks (existing code path).
  - [ ] Detect missing fields; emit `QUERY` messages for the user.
- [ ] Implement `ProjectAgent` MVP:
  - [ ] Categorize tasks, assign or create projects via `ProjectManager`.
  - [ ] Ensure idempotency on repeated messages.
- [ ] Add `/agents/debug` route to inspect conversations and message logs.
- [ ] Persist conversation context snapshots in Firestore.
- [ ] Update admin dashboard with basic agent metrics: queries asked, answered, unresolved gaps.

#### In Progress
- [ ] System architecture & planning document (this file) – ongoing refinement.

#### Done
- [x] Drafted multi‑agent architecture and roles.
- [x] Defined code layout and milestone plan.
- [x] Identified communication protocol and context model at a high level.

---

### Risks & Mitigations
- Ambiguity in message formats → enforce typed envelopes and validation.
- Over‑prompting users → Question Agent must prioritize and batch questions.
- Coupling between agents → Orchestrator mediates; agents remain isolated modules.
- Cost/latency of LLM calls → cache intermediate results and use fallbacks.

---

### Definition of Done (per Milestone)
- M1 DoD: Orchestrator routes messages; debug route shows traces; unit tests for routing.
- M2 DoD: New updates produce tasks + project assignments with minimal questions; tests for idempotency.
- M3 DoD: Blockers detected; clarifying questions appear in Chat UI; reduced unknowns in updates.
- M4 DoD: Dashboard displays insights; reminders/escalations trigger and are auditable.

---

### Next Actions (Actionable)
1) Create `backend/src/agents/types.ts` with core interfaces.
2) Implement `backend/src/agents/orchestrator.ts` with minimal router + logging.
3) Wire orchestrator from `inbound` handler path behind a feature flag (safe rollout).
4) Add `/agents/debug` route to observe flows.


