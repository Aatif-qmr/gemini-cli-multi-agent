/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execa } from 'execa';
import * as path from 'node:path';
import { homedir } from '../utils/paths.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
} from './tools.js';
import { DELEGATE_TOOL_NAME } from './tool-names.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { DELEGATE_DEFINITION } from './definitions/coreTools.js';
import { ProjectContextService } from '../services/projectContextService.js';
import type { Config } from '../config/config.js';

export interface DelegateTask {
  agent: 'gemini2' | 'gemini3';
  prompt: string;
}

export interface DelegateParams {
  tasks: DelegateTask[];
}

export class DelegateToolInvocation extends BaseToolInvocation<
  DelegateParams,
  ToolResult
> {
  private readonly config: Config;

  constructor(
    params: DelegateParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
    config: Config,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
    this.config = config;
  }

  getDescription(): string {
    const agents = this.params.tasks.map((t) => t.agent).join(', ');
    return `Delegate tasks to agents [${agents}]`;
  }

  private async executeTask(
    task: DelegateTask,
    signal: AbortSignal,
  ): Promise<string> {
    const { agent, prompt } = task;
    const subAgentHome = path.join(homedir(), `.${agent}`);
    const subAgentIndex = agent === 'gemini2' ? '2' : '3';

    // Share project context with the sub-agent
    const projectContextService = new ProjectContextService(this.config);
    const projectContext = await projectContextService.loadProjectContext();
    const contextualPrompt = projectContext.trim() 
      ? `PROJECT CONTEXT:\n${projectContext}\n\nTASK:\n${prompt}`
      : prompt;

    const workerSystemPrompt = `# SUB-AGENT ${subAgentIndex} — WORKER

You are Sub-Agent ${subAgentIndex} in Aatif's multi-agent Gemini system.
You do NOT interact with Aatif directly.
You receive tasks from the Primary Agent and return complete, high-quality output.

## YOUR ROLE
You are a skilled worker, not a planner.
The Primary Agent has already thought through what needs to be done.
Your job: execute it at the highest possible quality, completely, with no shortcuts.

## YOUR RULES
1. **Execute completely** — finish the entire task, never stop halfway
2. **Maximum quality** — this output goes to Aatif. Make it excellent.
3. **Clean output only** — no filler, no "I hope this helps", no meta-commentary
4. **No clarifying questions** — work with what you are given, make reasonable assumptions
5. **No further delegation** — you are the end of the chain
6. **Structured output** — use markdown, code blocks, headers as appropriate
7. **Ready to use** — Primary Agent should be able to use your output directly

## OUTPUT STANDARDS
- Code: complete, runnable, commented where non-obvious
- Documents: full content, proper structure, no placeholders
- Research/summaries: comprehensive, accurate, well-organized

## WHAT YOU WILL NOT DO
- Talk to Aatif directly
- Ask for clarification
- Produce partial or placeholder output
- Add unnecessary explanation about what you did
- Delegate to another agent`;

    try {
      // Use the current node executable and current script to spawn sub-agent
      const executable = process.argv[0];
      const script = process.argv[1];
      const { stdout, stderr, exitCode } = await execa(
        executable,
        [script, '--system-prompt', workerSystemPrompt, '--prompt', contextualPrompt],
        {
          env: {
            ...process.env,
            GEMINI_CLI_HOME: subAgentHome,
            GEMINI_FORCE_FILE_STORAGE: 'true',
            NODE_ENV: 'production',
          },
          signal,
          reject: false,
        },
      );

      const output = stdout || stderr || '(no output)';
      return `### Results from ${agent} (Exit Code: ${exitCode})\n\n${output}\n---`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `### Error from ${agent}\n\n${errorMessage}\n---`;
    }
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const results = await Promise.all(
      this.params.tasks.map((task) => this.executeTask(task, signal)),
    );

    const consolidatedOutput = results.join('\n\n');
    const agentList = this.params.tasks.map((t) => t.agent).join(', ');

    return {
      llmContent: consolidatedOutput,
      returnDisplay: `Parallel tasks completed by: ${agentList}`,
    };
  }
}

export class DelegateTool extends BaseDeclarativeTool<
  DelegateParams,
  ToolResult
> {
  static readonly Name = DELEGATE_TOOL_NAME;
  private readonly config: Config;

  constructor(config: Config, messageBus: MessageBus) {
    super(
      DelegateTool.Name,
      'Delegate',
      'Delegate complex or high-volume tasks to specialized sub-agents (gmi2 or gmi3) in parallel.',
      Kind.Execute,
      DELEGATE_DEFINITION.base.parametersJsonSchema,
      messageBus,
    );
    this.config = config;
  }

  protected createInvocation(
    params: DelegateParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    return new DelegateToolInvocation(
      params,
      messageBus,
      _toolName ?? this.name,
      _toolDisplayName ?? this.displayName,
      this.config,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(DELEGATE_DEFINITION, modelId);
  }
}
