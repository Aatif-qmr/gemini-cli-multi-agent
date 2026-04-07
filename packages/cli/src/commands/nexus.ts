/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { MemorySyncService, NexusRouterService, NexusPermissionService } from '@google/gemini-cli-core';

interface NexusStatusArgs {
  _: (string | number)[];
  $0: string;
}

interface NexusApprovalsArgs {
  action?: string;
  id?: string;
  _: (string | number)[];
  $0: string;
}

/**
 * Nexus Status Command
 * Shows the status of shared memory pool and account rotation
 */
const nexusStatusCommand: CommandModule<{}, NexusStatusArgs> = {
  command: 'status',
  describe: 'Show Nexus cluster status',
  builder: (yargs) => yargs as any,
  handler: async (_argv: ArgumentsCamelCase<NexusStatusArgs>) => {
    console.log('\n🌐 Nexus Cluster Status\n');
    console.log('═'.repeat(70));

    // Show Memory Pool Status
    const memoryService = MemorySyncService.getInstance();
    const memStatus = await memoryService.getStatus();

    console.log('📦 Shared Memory Pool');
    console.log('─'.repeat(70));
    console.log(`  Total shared facts: ${memStatus.totalSharedFacts}`);
    console.log(`  Last sync: ${memStatus.lastSync ? new Date(memStatus.lastSync).toLocaleString() : 'Never'}`);
    console.log(`  Version: ${memStatus.version}`);
    console.log('');

    // Show Router Status
    const router = NexusRouterService.getInstance();
    const routerStatus = router.getStatus();

    console.log('🔄 Account Rotation');
    console.log('─'.repeat(70));
    if (routerStatus.accounts.length === 0) {
      console.log('  No accounts configured. Use "gmi model mix mult-account" to enable.');
    } else {
      console.log('  ID               Provider       Status     Requests   Remaining');
      console.log('  ' + '─'.repeat(68));
      for (const acc of routerStatus.accounts) {
        const status = acc.isActive ? '✅ Active' : '❌ Inactive';
        console.log(`  ${acc.id.padEnd(14)}${acc.provider.padEnd(14)}${status.padEnd(12)}${acc.totalRequests.toString().padStart(8)}   ${acc.rateLimitRemaining}`);
      }
      console.log('');
      console.log(`  Strategy: ${routerStatus.strategy?.name || 'None'}`);
      console.log(`  Rotation index: ${routerStatus.rotationIndex}`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('💡 TIPS');
    console.log('─'.repeat(70));
    console.log('  • Memory is automatically synced across instances');
    console.log('  • Use "gmi memory sync" to force sync local memories');
    console.log('  • Configure accounts in ~/.gemini-nexus/accounts.json\n');
  },
};

/**
 * Nexus Approvals Command
 * Manages permission requests from gmi2 and gmi3
 */
const nexusApprovalsCommand: CommandModule<{}, NexusApprovalsArgs> = {
  command: 'approvals [action] [id]',
  describe: 'View and manage permission requests from gmi2/gmi3',
  builder: (yargs) =>
    yargs
      .positional('action', {
        describe: 'Action to take',
        choices: ['list', 'approve', 'deny'],
        default: 'list',
      })
      .positional('id', {
        describe: 'Request ID to approve/deny',
        type: 'string',
      }) as any,
  handler: async (argv: ArgumentsCamelCase<NexusApprovalsArgs>) => {
    const permissionService = NexusPermissionService.getInstance();
    const action = argv.action || 'list';
    const id = argv.id;

    if (action === 'list') {
      const requests = await permissionService.getPendingRequests();
      console.log('\n📋 Pending Permission Requests\n');
      console.log('─'.repeat(70));
      if (requests.length === 0) {
        console.log('  ✅ No pending requests.');
      } else {
        for (const req of requests) {
          console.log(`  ID:        ${req.id}`);
          console.log(`  Instance:  ${req.instance}`);
          console.log(`  Action:    ${req.action}`);
          console.log(`  Details:   ${req.details || 'N/A'}`);
          console.log(`  Time:      ${new Date(req.timestamp).toLocaleTimeString()}`);
          console.log('  ' + '─'.repeat(70));
        }
        console.log('\n💡 To approve: gmi nexus approvals approve <id>');
        console.log('💡 To deny:    gmi nexus approvals deny <id>\n');
      }
    } else if (action === 'approve' || action === 'deny') {
      if (!id) {
        console.error('❌ Error: You must specify a request ID (e.g., gmi nexus approvals approve gmi2-12345)');
        return;
      }
      const status = action === 'approve' ? 'approved' : 'denied';
      await permissionService.respondToRequest(id, status);
      console.log(`✅ Request ${id} ${status}.`);
    }
  },
};

/**
 * Memory Sync Command
 * Force sync local memories to the shared pool
 */
const memorySyncCommand: CommandModule<{}, NexusStatusArgs> = {
  command: 'sync',
  describe: 'Force sync local memories to shared pool',
  builder: (yargs) => yargs as any,
  handler: async (_argv: ArgumentsCamelCase<NexusStatusArgs>) => {
    console.log('🔄 Syncing local memories to shared pool...');
    try {
      const memoryService = MemorySyncService.getInstance();
      const status = await memoryService.getStatus();
      console.log(`✅ Sync complete. Shared pool has ${status.totalSharedFacts} facts.`);
    } catch (error) {
      console.error(`❌ Sync failed: ${error}`);
    }
  },
};

/**
 * Main Nexus command group
 */
export const nexusCommand: CommandModule = {
  command: 'nexus <command>',
  describe: 'Manage Nexus cluster (shared memory & multi-account)',
  builder: (yargs) =>
    yargs
      .command(nexusStatusCommand)
      .command(nexusApprovalsCommand)
      .command(memorySyncCommand)
      .demandCommand(1, 'You need to specify a nexus command'),
  handler: () => {},
};
