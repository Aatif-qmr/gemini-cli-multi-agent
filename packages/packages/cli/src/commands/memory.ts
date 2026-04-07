/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import {
  getGlobalMemoryFilePath,
  MEMORY_SECTION_HEADER,
} from '@google/gemini-cli-core';
import * as fs from 'node:fs/promises';

interface MemoryListArgs {
  scope?: 'global' | 'project';
  _: (string | number)[];
  $0: string;
}

interface MemoryDeleteArgs {
  index: number;
  scope?: 'global' | 'project';
  _: (string | number)[];
  $0: string;
}

interface MemoryClearArgs {
  scope: 'global' | 'project' | 'both';
  _: (string | number)[];
  $0: string;
}

/**
 * Read memories from file and return as array
 */
async function readMemories(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);
    if (headerIndex === -1) return [];

    const startOfSection = headerIndex + MEMORY_SECTION_HEADER.length;
    let endOfSection = content.indexOf('\n## ', startOfSection);
    if (endOfSection === -1) endOfSection = content.length;

    const sectionContent = content.substring(startOfSection, endOfSection);
    return sectionContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2));
  } catch {
    return [];
  }
}

/**
 * Write memories back to file
 */
async function writeMemories(filePath: string, memories: string[]): Promise<void> {
  try {
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist, create it
    }

    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);
    if (headerIndex === -1) {
      // Create new section
      const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n\n';
      const newSection = memories.map(m => `- ${m}`).join('\n');
      content += `${separator}${MEMORY_SECTION_HEADER}\n${newSection}\n`;
    } else {
      // Replace existing section
      const beforeHeader = content.substring(0, headerIndex).trimEnd();
      let endOfSection = content.indexOf('\n## ', headerIndex + MEMORY_SECTION_HEADER.length);
      if (endOfSection === -1) endOfSection = content.length;
      const afterSection = content.substring(endOfSection);

      const newSection = memories.map(m => `- ${m}`).join('\n');
      content = `${beforeHeader}\n${MEMORY_SECTION_HEADER}\n${newSection}${afterSection}`;
    }

    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Error writing memories: ${error}`);
  }
}

/**
 * List memories command
 */
const memoryListCommand: CommandModule<{}, MemoryListArgs> = {
  command: 'list [scope]',
  describe: 'List all saved memories',
  builder: (yargs) =>
    yargs
      .option('scope', {
        alias: 's',
        type: 'string',
        choices: ['global', 'project'],
        default: 'global',
        describe: 'Which memory scope to list',
      }) as any,
  handler: async (argv: ArgumentsCamelCase<MemoryListArgs>) => {
    const scope = argv.scope as 'global' | 'project';
    
    if (scope === 'global') {
      const filePath = getGlobalMemoryFilePath();
      const memories = await readMemories(filePath);
      
      console.log(`\n🧠 Global Memories (${memories.length} items):`);
      console.log('='.repeat(50));
      
      if (memories.length === 0) {
        console.log('  No memories saved.');
      } else {
        memories.forEach((memory, index) => {
          console.log(`  ${index + 1}. ${memory}`);
        });
      }
      console.log(`\nFile: ${filePath}\n`);
      console.log('Tip: Use "gmi memory delete <number>" to remove a memory');
      console.log('Tip: Use "gmi memory clear --scope global" to clear all\n');
    } else {
      console.log('⚠️  Project memory scope not yet implemented.');
      console.log('Use --scope global for now.\n');
    }
  },
};

/**
 * Delete memory command
 */
const memoryDeleteCommand: CommandModule<{}, MemoryDeleteArgs> = {
  command: 'delete <index>',
  describe: 'Delete a specific memory by index',
  builder: (yargs) =>
    yargs
      .positional('index', {
        type: 'number',
        demandOption: true,
        describe: 'Memory index to delete (1-based)',
      })
      .option('scope', {
        alias: 's',
        type: 'string',
        choices: ['global', 'project'],
        default: 'global',
        describe: 'Which memory scope to delete from',
      }) as any,
  handler: async (argv: ArgumentsCamelCase<MemoryDeleteArgs>) => {
    const scope = argv.scope as 'global' | 'project';
    const index = argv.index - 1; // Convert to 0-based
    
    if (scope === 'global') {
      const filePath = getGlobalMemoryFilePath();
      const memories = await readMemories(filePath);
      
      if (index < 0 || index >= memories.length) {
        console.error(`❌ Invalid index. Must be between 1 and ${memories.length}`);
        return;
      }

      const deleted = memories.splice(index, 1)[0];
      await writeMemories(filePath, memories);
      
      console.log(`✅ Deleted memory: "${deleted}"`);
      console.log(`Remaining memories: ${memories.length}\n`);
    } else {
      console.log('⚠️  Project memory scope not yet implemented.\n');
    }
  },
};

/**
 * Clear memories command
 */
const memoryClearCommand: CommandModule<{}, MemoryClearArgs> = {
  command: 'clear',
  describe: 'Clear all memories',
  builder: (yargs) =>
    yargs.option('scope', {
      alias: 's',
      type: 'string',
      choices: ['global', 'project', 'both'],
      default: 'global',
      demandOption: true,
      describe: 'Which memory scope to clear',
    }) as any,
  handler: async (argv: ArgumentsCamelCase<MemoryClearArgs>) => {
    const scope = argv.scope;
    
    if (scope === 'global' || scope === 'both') {
      const filePath = getGlobalMemoryFilePath();
      await writeMemories(filePath, []);
      console.log('✅ Cleared all global memories\n');
    }
    
    if (scope === 'project' || scope === 'both') {
      console.log('⚠️  Project memory scope not yet implemented.\n');
    }
  },
};

/**
 * Main memory command group
 */
export const memoryCommand: CommandModule = {
  command: 'memory <command>',
  describe: 'Manage Gemini memories',
  builder: (yargs) =>
    yargs
      .command(memoryListCommand)
      .command(memoryDeleteCommand)
      .command(memoryClearCommand)
      .demandCommand(1, 'You need to specify a memory command'),
  handler: () => {},
};
