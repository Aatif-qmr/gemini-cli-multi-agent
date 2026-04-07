# Gemini CLI Multi-Agent

A multi-agent orchestration CLI built on Gemini - delegate tasks across isolated AI workers with parallel execution, environment isolation, and intelligent session logging.

---

## What is this?

This is a custom fork of Google's Gemini CLI, transformed into a multi-agent orchestration system. Instead of a single AI agent, it includes a coordination layer that lets a primary AI delegate tasks to specialized sub-agents that run in parallel with complete environment isolation.

The system works like having a team of AI workers:

- **Primary Agent (gmi)** acts as the strategic planner and orchestrator
- **Sub-Agent 2 (gmi2)** handles heavy code generation and implementation
- **Sub-Agent 3 (gmi3)** focuses on research, analysis, and documentation

All three can run simultaneously with separate Google accounts, isolated environments, and zero credential sharing.

---

## Key Features

### Multi-Agent Delegation

The primary agent can split complex tasks across sub-agents that execute in parallel. Ask it to "research best practices and write tests" and it will delegate both tasks simultaneously.

### Environment Isolation

Each agent gets its own:

- Separate home directory (~/.gemini, ~/.gemini2, ~/.gemini3)
- Independent OAuth credentials (different Google accounts per agent)
- Isolated settings, memory, and configuration
- No shared state between agents

### Project Context System

Initialize any directory as a project-aware workspace:

```bash
gmi context init
```

Creates .gemini-context/ with PROJECT.md (tech stack definition) and SESSION_LOG.md (complete audit trail of all AI sessions).

### Built-in Sub-Agents

Beyond the custom gmi2/gmi3 workers, the system includes specialized local agents:

- **Codebase Investigator** - Deep codebase exploration
- **CLI Help Agent** - Interactive usage assistance
- **Generalist Agent** - High-volume task execution
- **Browser Agent** - Chrome automation via DevTools Protocol
- **Memory Manager Agent** - Persistent knowledge management

### Policy Engine

Fine-grained control over what each agent can do. Set per-agent tool permissions, file access restrictions, and command approval requirements.

### Intelligent Session Logging

Every interaction is automatically logged with timestamps, agent activity, and outcome summaries. Perfect for auditing and replaying decision history.

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- macOS, Linux, or Windows

### Installation

Global install (recommended):

```bash
npm install -g @google/gemini-cli-multi-agent
```

Or link for development:

```bash
git clone https://github.com/Aatif-qmr/gemini-cli-multi-agent.git
cd gemini-cli-multi-agent
npm install
npm link
```

### First Run

Authenticate:

```bash
gmi auth login
```

Initialize a project:

```bash
cd your-project
gmi context init
```

Start working:

```bash
# Interactive mode
gmi

# Non-interactive query
gmi -p "Explain this codebase"

# Sub-agent queries
gmi2 -p "Write comprehensive tests for the API"
gmi3 -p "Research TypeScript best practices"
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `gmi` | Launch interactive session |
| `gmi -p "prompt"` | Run non-interactive query |
| `gmi mcp` | Manage MCP servers |
| `gmi extensions` | Manage CLI extensions |
| `gmi skills` | Manage agent skills |
| `gmi hooks` | Manage event hooks |
| `gmi context` | Manage project context |
| `gmi auth` | Manage authentication |
| `gmi system` | System integration tools |

---

## Architecture

```
Primary Agent (gmi) - Strategic Orchestrator
    |
    +-- Agent Registry
    +-- Tool Registry
    +-- Message Bus
    |
    +-- Delegation Engine
         |
         +-- Local Agents (Codebase Investigator, CLI Help, Generalist, Browser, Memory)
         +-- Worker Agents (gmi2, gmi3 - Separate Processes, Isolated Environments)
```

### How Delegation Works

1. You ask the primary agent to do something complex
2. It plans the approach and identifies tasks that can be parallelized
3. It delegates to gmi2 and/or gmi3 via the Delegate Tool
4. Workers execute simultaneously in isolated environments
5. Results consolidate back to the primary agent
6. You get a unified, comprehensive response

---

## Authentication and Multi-Account Setup

Each agent can use a different Google account:

```bash
# Authenticate primary agent
gmi auth login

# Authenticate sub-agent 2 (different account)
gmi2 auth login

# Authenticate sub-agent 3 (third account)
gmi3 auth login
```

OAuth credentials are completely isolated:

- Primary: ~/.gemini/oauth_creds.json
- Sub-Agent 2: ~/.gemini2/.gemini/oauth_creds.json
- Sub-Agent 3: ~/.gemini3/.gemini/oauth_creds.json

No credential sharing. No collisions. Each agent is fully independent.

---

## Project Structure

```
gemini-cli-multi-agent/
├── bundle/                    # Production bundle
│   ├── gemini.js             # Main entry point
│   ├── chunk-*.js            # Code-split modules
│   ├── builtin/              # Built-in skills
│   ├── bundled/              # Bundled MCP servers
│   └── policies/             # Sandbox policies
├── packages/                  # Monorepo workspaces
│   ├── cli/                  # User-facing terminal UI
│   ├── core/                 # Backend logic and API orchestration
│   ├── sdk/                  # Programmatic SDK
│   ├── devtools/             # Network/Console inspector
│   └── a2a-server/           # Agent-to-Agent server
├── scripts/                  # Build and release automation
├── sea/                      # Single Executable Application support
├── .gemini/                  # Project-level AI config
└── .gemini-context/          # Session context (per-project)
```

---

## Development

Install dependencies:

```bash
npm install
```

Build TypeScript:

```bash
npm run build
```

Create production bundle:

```bash
npm run bundle
```

Build standalone binary:

```bash
npm run build:binary
```

Run tests:

```bash
npm run test:ci
```

Lint code:

```bash
npm run lint
```

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GEMINI_CLI_HOME` | Override home directory | ~/.gemini |
| `GEMINI_SANDBOX` | Enable sandbox mode | false |
| `GEMINI_FORCE_FILE_STORAGE` | Use file-based keychain | false |
| `NODE_ENV` | Runtime mode | production |
| `DEBUG` | Enable debug logging | false |

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | >= 20.0.0 |
| npm | >= 9.0.0 |
| Disk Space | ~500 MB (with dependencies) |
| RAM | 2 GB minimum |
| OS | macOS 12+, Ubuntu 20.04+, Windows 10+ |

---

## Why I Built This

I needed a way to get AI assistance that could handle complex, multi-faceted tasks without constantly asking for permission or getting stuck in planning loops. The standard Gemini CLI is great for simple queries, but when working on real projects, I need:

1. Parallel execution - Don't make me wait for research to finish before code generation starts
2. Environment isolation - Keep work accounts separate from personal experiments
3. Session auditing - Know exactly what the AI did and why, weeks later
4. Zero-friction workflows - Set it up once, then let it work

This fork delivers all of that. It is production-ready, thoroughly tested, and I use it daily.

---

## License

Apache-2.0 (based on Google's Gemini CLI)

---

## Author

**Aatif Qmr**
- GitHub: [Aatif-qmr](https://github.com/Aatif-qmr)

---

## Acknowledgments

- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) - The original open-source project this fork is based on
- [Google GenAI SDK](https://github.com/googleapis/python-aiplatform) - API integration layer
- [React](https://react.dev/) and [Ink](https://github.com/vadimdemedes/ink) - Terminal UI framework

---

Built by Aatif Qmr
