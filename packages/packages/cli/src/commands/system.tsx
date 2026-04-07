/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import type { CommandModule } from 'yargs';
import { initializeOutputListenersAndFlush } from '../gemini.js';

export const systemCommand: CommandModule = {
  command: 'system <command>',
  describe: 'System integration and setup tools.',
  builder: (yargs) =>
    yargs
      .middleware((argv) => {
        initializeOutputListenersAndFlush();
        argv['isCommand'] = true;
      })
      .command({
        command: 'install-aliases',
        describe: 'Generate shell aliases for the multi-agent production setup.',
        handler: async () => {
          const aliases = `
# Gemini Multi-Agent System Aliases
# Add these to your ~/.zshrc or ~/.bashrc

# Primary Agent (Project Aware)
# After installation, 'gemini' will be available globally via npm
alias gmi='gemini'
alias geminiM='gemini'

# Sub-Agent Management
# These set isolated home directories for worker agents
alias gmi2='GEMINI_CLI_HOME=~/.gemini2 gemini'
alias gmi3='GEMINI_CLI_HOME=~/.gemini3 gemini'

# Orchestration Shortcuts
alias gorchestra='gemini' # Native delegation is built-in
alias glog='cat .gemini-context/SESSION_LOG.md'
`;
          console.log('--- Copy these aliases to your shell configuration file (~/.zshrc or ~/.bashrc) ---');
          console.log(aliases);
          console.log('----------------------------------------------------------------------------------');
          console.log('\nAfter adding them, run: source ~/.zshrc (or restart your terminal)');
        },
      })
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};
