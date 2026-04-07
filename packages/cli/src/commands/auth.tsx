/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import type { CommandModule } from 'yargs';
import { execa } from 'execa';
import * as path from 'node:path';
import { homedir } from '@google/gemini-cli-core';
import { initializeOutputListenersAndFlush } from '../gemini.js';

export const authCommand: CommandModule = {
  command: 'auth <command>',
  describe: 'Manage authentication for primary and sub-agents.',
  builder: (yargs) =>
    yargs
      .middleware((argv) => {
        initializeOutputListenersAndFlush();
        argv['isCommand'] = true;
      })
      .command({
        command: 'login',
        describe: 'Login to a Google account.',
        builder: (yargs) =>
          yargs.option('agent', {
            type: 'string',
            choices: ['2', '3'],
            description: 'The sub-agent index to authenticate (e.g. 2 for ~/.gemini2).',
          }),
        handler: async (argv) => {
          const agent = argv.agent;
          const env = { ...process.env };

          if (agent) {
            const agentHome = path.join(homedir(), `.gemini${agent}`);
            env['GEMINI_CLI_HOME'] = agentHome;
            console.log(`Authenticating for Sub-Agent ${agent} (Home: ${agentHome})...`);
          } else {
            console.log('Authenticating for Primary Agent...');
          }

          try {
            // Spawn a new gem process to handle the interactive login
            // We use 'auth login' which is the slash command equivalent
            await execa('gmi', ['--prompt', '/auth login'], {
              env,
              stdio: 'inherit',
            });
            console.log('\nLogin successful!');
          } catch {
            console.error('\nLogin failed or was cancelled.');
          }
        },
      })
      .command({
        command: 'logout',
        describe: 'Logout and clear cached credentials.',
        builder: (yargs) =>
          yargs.option('agent', {
            type: 'string',
            choices: ['2', '3'],
            description: 'The sub-agent index to logout.',
          }),
        handler: async (argv) => {
          const agent = argv.agent;
          const env = { ...process.env };

          if (agent) {
            env['GEMINI_CLI_HOME'] = path.join(homedir(), `.gemini${agent}`);
          }

          try {
            await execa('gmi', ['--prompt', '/auth logout'], {
              env,
              stdio: 'inherit',
            });
            console.log('\nLogged out successfully.');
          } catch {
            console.error('\nLogout failed.');
          }
        },
      })
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};
