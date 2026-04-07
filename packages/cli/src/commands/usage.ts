/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';

interface UsageStats {
  instance: string;
  totalTokens: number;
  totalRequests: number;
  sessionCount: number;
  dateRange: { earliest: string; latest: string };
  topProjects: Record<string, number>;
}

interface UsageDashboardArgs {
  days?: number;
  project?: string;
  _: (string | number)[];
  $0: string;
}

/**
 * Read all session files from a gemini instance directory
 */
async function readInstanceSessions(instanceDir: string, daysAgo?: number): Promise<UsageStats> {
  const stats: UsageStats = {
    instance: path.basename(instanceDir),
    totalTokens: 0,
    totalRequests: 0,
    sessionCount: 0,
    dateRange: { earliest: '', latest: '' },
    topProjects: {},
  };

  // Scan all project subdirectories in tmp
  const tmpDir = path.join(instanceDir, 'tmp');
  try {
    const projects = await fs.readdir(tmpDir);
    const cutoffDate = daysAgo ? new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) : null;

    for (const project of projects) {
      const chatsDir = path.join(tmpDir, project, 'chats');
      try {
        const files = await fs.readdir(chatsDir);

        for (const file of files) {
          if (!file.startsWith('session-') || !file.endsWith('.json')) continue;

          try {
            const content = await fs.readFile(path.join(chatsDir, file), 'utf-8');
            const session = JSON.parse(content);
            
            const sessionDate = new Date(session.startTime);
            if (cutoffDate && sessionDate < cutoffDate) continue;

            stats.sessionCount++;

            // Update date range
            if (!stats.dateRange.earliest || session.startTime < stats.dateRange.earliest) {
              stats.dateRange.earliest = session.startTime;
            }
            if (!stats.dateRange.latest || session.lastUpdated > stats.dateRange.latest) {
              stats.dateRange.latest = session.lastUpdated;
            }

            // Count messages and estimate tokens
            const messages = session.messages || [];
            stats.totalRequests += messages.filter((m: any) => m.type === 'user').length;

            // Sum token usage from messages (handle different token structures)
            for (const msg of messages) {
              if (msg.tokens) {
                if (typeof msg.tokens === 'number') {
                  stats.totalTokens += msg.tokens;
                } else if (msg.tokens.total) {
                  stats.totalTokens += msg.tokens.total;
                } else if (msg.tokens.input && msg.tokens.output) {
                  stats.totalTokens += msg.tokens.input + msg.tokens.output;
                }
              }
              // Also check for usageMetadata at the end of session if available
              if (msg.usageMetadata) {
                // Only count if it's the last message or has usage info
                stats.totalTokens += msg.usageMetadata.totalTokenCount || msg.usageMetadata.promptTokenCount || 0;
              }
            }
            // If session has top-level usageMetadata, use it (more accurate)
            if (session.usageMetadata?.totalTokenCount) {
               // Reset calculated and use the authoritative total
               stats.totalTokens -= (session.messages || []).reduce((acc: number, m: any) => acc + (m.tokens?.total || 0), 0);
               stats.totalTokens += session.usageMetadata.totalTokenCount;
            }

            // Track project hash
            if (session.projectHash) {
              const hash = session.projectHash.substring(0, 8);
              stats.topProjects[hash] = (stats.topProjects[hash] || 0) + 1;
            }
          } catch (e) {
            // Fix 3: Skip corrupted files instead of crashing
            debugLogger.warn(`Skipping corrupted session file: ${file}`);
          }
        }
      } catch {
        // Chats dir doesn't exist for this project
      }
    }
  } catch {
    // Tmp directory doesn't exist
  }

  return stats;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate estimated cost (rough estimate based on Gemini pricing)
 */
function estimateCost(tokens: number): string {
  // Rough average: $0.0000035 per token (blended rate)
  const cost = tokens * 0.0000035;
  return `$${cost.toFixed(2)}`;
}

/**
 * Main usage command group
 */
export const usageCommand: CommandModule = {
  command: 'usage [options]',
  describe: 'View usage statistics and dashboard',
  builder: (yargs) =>
    yargs
      .option('days', {
        alias: 'd',
        type: 'number',
        describe: 'Show usage for last N days',
      })
      .option('project', {
        alias: 'p',
        type: 'string',
        describe: 'Filter by project hash prefix',
      }),
  handler: async (argv: ArgumentsCamelCase<UsageDashboardArgs>) => {
    const homeDir = os.homedir();
    const days = argv.days;
    // projectFilter reserved for future implementation

    // Define all gemini instances
    const instances = [
      path.join(homeDir, '.gemini'),
      path.join(homeDir, '.gemini2'),
      path.join(homeDir, '.gemini3'),
    ];

    console.log('\n' + '═'.repeat(70));
    console.log('              🌟 Gemini Usage Dashboard');
    if (days) {
      console.log(`              Last ${days} days`);
    } else {
      console.log('              All time');
    }
    console.log('═'.repeat(70) + '\n');

    // Read all instances
    const allStats: UsageStats[] = [];
    for (const instance of instances) {
      const stats = await readInstanceSessions(instance, days);
      if (stats.sessionCount > 0) {
        allStats.push(stats);
      }
    }

    if (allStats.length === 0) {
      console.log('  No session data found.');
      console.log('  Start using Gemini CLI to generate usage data!\n');
      return;
    }

    // Calculate totals
    const totalTokens = allStats.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalRequests = allStats.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalSessions = allStats.reduce((sum, s) => sum + s.sessionCount, 0);

    // Show per-instance breakdown
    console.log('📊 INSTANCE BREAKDOWN');
    console.log('─'.repeat(80));
    console.log('  Instance       Sessions     Requests     Tokens            Est. Cost');
    console.log('  ' + '─'.repeat(78));

    for (const stat of allStats) {
      const name = stat.instance.padEnd(16);
      const sessions = formatNumber(stat.sessionCount).padStart(8);
      const requests = formatNumber(stat.totalRequests).padStart(10);
      const tokens = formatNumber(stat.totalTokens).padStart(16);
      const cost = estimateCost(stat.totalTokens).padStart(14);
      console.log(`  ${name}${sessions}      ${requests}  ${tokens}  ${cost}`);
    }

    console.log('  ' + '─'.repeat(78));
    const totalLine = 'TOTAL'.padEnd(16);
    console.log(`  ${totalLine}${formatNumber(totalSessions).padStart(8)}      ${formatNumber(totalRequests).padStart(10)}  ${formatNumber(totalTokens).padStart(16)}  ${estimateCost(totalTokens).padStart(14)}`);
    console.log('');

    // Show date range
    const earliest = allStats.reduce((min, s) => !min || s.dateRange.earliest < min ? s.dateRange.earliest : min, '');
    const latest = allStats.reduce((max, s) => !max || s.dateRange.latest > max ? s.dateRange.latest : max, '');
    
    console.log('📅 DATE RANGE');
    console.log('─'.repeat(70));
    console.log(`  Earliest session: ${earliest ? new Date(earliest).toLocaleString() : 'N/A'}`);
    console.log(`  Latest session:   ${latest ? new Date(latest).toLocaleString() : 'N/A'}`);
    console.log('');

    // Show top projects across all instances
    const combinedProjects: Record<string, number> = {};
    for (const stat of allStats) {
      for (const [hash, count] of Object.entries(stat.topProjects)) {
        combinedProjects[hash] = (combinedProjects[hash] || 0) + count;
      }
    }

    const sortedProjects = Object.entries(combinedProjects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedProjects.length > 0) {
      console.log('🔥 TOP PROJECTS');
      console.log('─'.repeat(70));
      console.log('  Project Hash       Sessions    % of Total');
      console.log('  ' + '─'.repeat(68));
      for (const [hash, count] of sortedProjects) {
        const pct = ((count / totalSessions) * 100).toFixed(1);
        console.log(`  ${hash.padEnd(18)}${formatNumber(count).padStart(10)}    ${pct.padStart(8)}%`);
      }
      console.log('');
    }

    // Show tips
    console.log('💡 TIPS');
    console.log('─'.repeat(70));
    console.log('  • Use "gmi usage --days 7" to see last week\'s usage');
    console.log('  • Use "gmi usage --project <hash>" to filter by project');
    console.log('  • Monitor token usage to stay within rate limits');
    console.log('  • Check cost estimates to track API spending\n');
    console.log('═'.repeat(70) + '\n');
  },
};
