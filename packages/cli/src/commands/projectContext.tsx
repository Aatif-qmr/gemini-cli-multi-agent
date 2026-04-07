/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import type { CommandModule } from 'yargs';
import { ProjectContextService, sessionId } from '@google/gemini-cli-core';
import { loadSettings } from '../config/settings.js';
import { loadCliConfig } from '../config/config.js';
import { initializeOutputListenersAndFlush } from '../gemini.js';

export const projectContextCommand: CommandModule = {
  command: 'context <command>',
  aliases: ['ctx'],
  describe: 'Manage project-specific context and logs.',
  builder: (yargs) =>
    yargs
      .middleware((argv) => {
        initializeOutputListenersAndFlush();
        argv['isCommand'] = true;
      })
      .command({
        command: 'init',
        describe: 'Initialize the .gemini-context directory and files.',
        handler: async (argv) => {
          const settings = loadSettings();
          const config = await loadCliConfig(settings.merged, sessionId, argv);
          const service = new ProjectContextService(config);

          if (await service.contextExists()) {
            console.log('Project context already exists in this directory.');
            return;
          }

          await service.initializeContext();
          console.log('Successfully initialized .gemini-context/ with PROJECT.md and SESSION_LOG.md');
          console.log('You can now use "gmi" to start project-aware sessions.');
        },
      })
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};
