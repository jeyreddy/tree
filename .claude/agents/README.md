# Agents

Sub-agents for this project. Each `.md` file defines a specialized agent that Claude Code can spawn for focused tasks.

## How to add an agent

Create a file here named `<agent-name>.md` with this frontmatter:

```markdown
---
name: agent-name
description: One-line summary of when to use this agent
---

You are a specialist in ...

Your job is to ...
```

Claude Code will use the `description` to decide when to spawn the agent automatically.

## Planned agents

| Agent | Purpose |
|-------|---------|
| `db-auditor` | Review Supabase schema changes for correctness and RLS policy gaps |
| `component-reviewer` | Review new React components for consistency with existing style patterns |
