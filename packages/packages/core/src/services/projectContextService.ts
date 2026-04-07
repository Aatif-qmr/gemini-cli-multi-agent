/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type Config } from '../config/config.js';
import { debugLogger } from '../utils/debugLogger.js';
import { SessionSummaryService } from './sessionSummaryService.js';
import { BaseLlmClient } from '../core/baseLlmClient.js';

/**
 * Service to manage project-specific context and session logging.
 * Integrates functionalities from geminiM.sh into the core.
 */
export class ProjectContextService {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Checks if project context directory exists.
   */
  async contextExists(): Promise<boolean> {
    try {
      await fs.access(this.config.storage.getContextDir());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initializes the project context directory and scaffolds files.
   */
  async initializeContext(): Promise<void> {
    const contextDir = this.config.storage.getContextDir();
    const projectMdPath = this.config.storage.getProjectMdPath();
    const sessionLogPath = this.config.storage.getSessionLogPath();
    const projectName = path.basename(this.config.getTargetDir());
    const timestamp = new Date().toLocaleString();

    await fs.mkdir(contextDir, { recursive: true });

    const projectMdContent = `# Project: ${projectName}

**Directory:** ${this.config.getTargetDir()}
**Initialized:** ${timestamp}

---

## Overview
<!-- Describe what this project is -->

## Stack / Tech
<!-- Languages, frameworks, tools -->

## Current Goals
<!-- What are you actively working on? -->

## Key Files
<!-- Important files/dirs to know about -->

## Notes
<!-- Anything else the agent should know -->
`;

    const sessionLogContent = `# Session Log — ${projectName}

---
`;

    await fs.writeFile(projectMdPath, projectMdContent, 'utf-8');
    await fs.writeFile(sessionLogPath, sessionLogContent, 'utf-8');
  }

  /**
   * Loads the project context (PROJECT.md and recent SESSION_LOG.md).
   */
  async loadProjectContext(): Promise<string> {
    if (!(await this.contextExists())) {
      return '';
    }

    let context = '';
    try {
      const projectMd = await fs.readFile(this.config.storage.getProjectMdPath(), 'utf-8');
      context += projectMd + '\n\n---\n\n## Recent Session History\n\n';
    } catch (e) {
      debugLogger.warn('Failed to read PROJECT.md', e);
    }

    try {
      const logContent = await fs.readFile(this.config.storage.getSessionLogPath(), 'utf-8');
      const lines = logContent.split('\n');
      const recentLines = lines.slice(-80).join('\n');
      context += recentLines;
    } catch (e) {
      debugLogger.warn('Failed to read SESSION_LOG.md', e);
    }

    return context;
  }

  /**
   * Logs a session start entry.
   */
  async logSessionStart(): Promise<void> {
    if (!(await this.contextExists())) return;

    const timestamp = new Date().toLocaleString();
    const logPath = this.config.storage.getSessionLogPath();
    const entry = `\n## Session — ${timestamp}\n**Directory:** ${this.config.getTargetDir()}\n\n`;
    
    await fs.appendFile(logPath, entry, 'utf-8');
  }

  /**
   * Logs a turn (query + summary of work).
   */
  async logTurn(query: string, summary: string, agentsUsed: string[]): Promise<void> {
    if (!(await this.contextExists())) return;

    const timestamp = new Date().toLocaleString();
    const logPath = this.config.storage.getSessionLogPath();
    const agentsStr = agentsUsed.length > 0 ? `\n**Agents:** ${agentsUsed.join(', ')}` : '';
    const entry = `\n### Turn — ${timestamp}\n**User:** ${query}\n**Summary:** ${summary}${agentsStr}\n`;
    
    await fs.appendFile(logPath, entry, 'utf-8');
  }

  /**
   * Generates a summary of the current session and appends it to the log.
   */
  async summarizeSession(): Promise<void> {
    if (!(await this.contextExists())) return;

    try {
      const logPath = this.config.storage.getSessionLogPath();
      const logContent = await fs.readFile(logPath, 'utf-8');
      
      // Extract the content of the current session (from the last "## Session" to now)
      const sessions = logContent.split('\n## Session');
      const currentSessionContent = sessions.pop();
      if (!currentSessionContent) return;

      const contentGenerator = this.config.getContentGenerator();
      if (!contentGenerator) return;

      const baseLlmClient = new BaseLlmClient(contentGenerator, this.config);
      const summaryService = new SessionSummaryService(baseLlmClient);

      const summary = await summaryService.generateSummary({
        messages: [
          {
            id: 'summary-request',
            timestamp: new Date().toISOString(),
            type: 'user',
            content: [
              {
                text: `Please summarize the key accomplishments and changes in this session based on the log below. Be extremely concise. One paragraph max.\n\nLOG:\n${currentSessionContent}`,
              },
            ],
          },
        ],
      });

      if (summary) {
        const entry = `\n### SESSION SUMMARY\n${summary}\n`;
        await fs.appendFile(logPath, entry, 'utf-8');
      }
    } catch (e) {
      debugLogger.warn('Failed to generate session summary', e);
    }
  }

  /**
   * Logs a session end entry.
   */
  async logSessionEnd(): Promise<void> {
    if (!(await this.contextExists())) return;

    const timestamp = new Date().toLocaleString();
    const logPath = this.config.storage.getSessionLogPath();
    const entry = `\n_Session ended: ${timestamp}_\n---\n`;
    
    await fs.appendFile(logPath, entry, 'utf-8');
  }
}
