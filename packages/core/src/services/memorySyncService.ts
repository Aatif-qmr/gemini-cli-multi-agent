/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { debugLogger } from '../utils/debugLogger.js';

export interface SharedMemoryEntry {
  fact: string;
  timestamp: string;
  source: string; // Which instance added it
  scope: 'global' | 'project';
}

export interface SharedMemoryPool {
  entries: SharedMemoryEntry[];
  lastSync: string;
  version: number;
}

const NEXUS_DIR = path.join(os.homedir(), '.gemini-nexus');
const SHARED_MEMORY_FILE = path.join(NEXUS_DIR, 'shared-memory.json');
const MAX_MEMORY_SIZE_CHARS = 15000; // Limit to ~2000-4000 tokens to prevent context overflow

/**
 * Service to synchronize memory across multiple Gemini CLI instances
 * by maintaining a shared memory pool in a central location.
 */
export class MemorySyncService {
  private static instance: MemorySyncService | null = null;
  private pool: SharedMemoryPool | null = null;
  private initialized = false;
  
  // Fix 1: Async Write Queue to prevent Race Conditions
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  static getInstance(): MemorySyncService {
    if (!this.instance) {
      this.instance = new MemorySyncService();
    }
    return this.instance;
  }

  /**
   * Initialize the shared memory pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(NEXUS_DIR, { recursive: true });
      
      try {
        const content = await fs.readFile(SHARED_MEMORY_FILE, 'utf-8');
        this.pool = JSON.parse(content);
      } catch {
        // File doesn't exist, create new pool
        this.pool = {
          entries: [],
          lastSync: new Date().toISOString(),
          version: 1,
        };
        await this.savePool();
      }
      this.initialized = true;
    } catch (error) {
      debugLogger.error(`Failed to initialize MemorySyncService: ${error}`);
      this.pool = { entries: [], lastSync: '', version: 1 };
      this.initialized = true;
    }
  }

  /**
   * Save the current pool to disk (Queue + Atomic Write)
   * Fixes: Race Conditions and Corrupted Files
   */
  private async savePool(): Promise<void> {
    if (!this.pool) return;

    // Add to write queue to prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Fix 2: Context Window Overflow (Eviction Policy)
        // Trim oldest entries if we exceed size limit
        let content = JSON.stringify(this.pool, null, 2);
        while (content.length > MAX_MEMORY_SIZE_CHARS && this.pool!.entries.length > 0) {
          this.pool!.entries.shift(); // Remove oldest
          content = JSON.stringify(this.pool, null, 2);
        }

        this.pool!.lastSync = new Date().toISOString();
        this.pool!.version++;
        content = JSON.stringify(this.pool, null, 2);

        // Fix 3: Atomic Writes (Safe Writes)
        // Write to temp file first, then rename. Prevents corruption on crash.
        const tempFile = SHARED_MEMORY_FILE + '.tmp';
        await fs.writeFile(tempFile, content, 'utf-8');
        await fs.rename(tempFile, SHARED_MEMORY_FILE);
      } catch (error) {
        debugLogger.error(`Failed to save shared memory pool: ${error}`);
      }
    }).catch(err => {
      debugLogger.error(`Write queue error: ${err}`);
    });

    await this.writeQueue;
  }

  /**
   * Add a new fact to the shared pool
   */
  async addFact(fact: string, source: string, scope: 'global' | 'project' = 'global'): Promise<void> {
    await this.initialize();
    if (!this.pool) return;

    // Check for duplicates
    const exists = this.pool.entries.some(e => e.fact.toLowerCase() === fact.toLowerCase());
    if (exists) return;

    this.pool.entries.push({
      fact,
      timestamp: new Date().toISOString(),
      source,
      scope,
    });

    await this.savePool();
  }

  /**
   * Get all facts from the shared pool
   */
  async getFacts(scope?: 'global' | 'project'): Promise<SharedMemoryEntry[]> {
    await this.initialize();
    if (!this.pool) return [];

    if (scope) {
      return this.pool.entries.filter(e => e.scope === scope);
    }
    return this.pool.entries;
  }

  /**
   * Remove a fact from the shared pool by index
   */
  async removeFact(index: number): Promise<boolean> {
    await this.initialize();
    if (!this.pool || index < 0 || index >= this.pool.entries.length) return false;

    this.pool.entries.splice(index, 1);
    await this.savePool();
    return true;
  }

  /**
   * Clear all facts from the shared pool
   */
  async clearFacts(): Promise<void> {
    await this.initialize();
    if (!this.pool) return;

    this.pool.entries = [];
    await this.savePool();
  }

  /**
   * Sync local memories to the shared pool
   * Merges local facts that aren't already in the pool
   */
  async syncFromLocal(localFacts: string[], source: string, scope: 'global' | 'project'): Promise<void> {
    await this.initialize();
    if (!this.pool) return;

    for (const fact of localFacts) {
      const exists = this.pool.entries.some(e => e.fact.toLowerCase() === fact.toLowerCase());
      if (!exists) {
        this.pool.entries.push({
          fact,
          timestamp: new Date().toISOString(),
          source,
          scope,
        });
      }
    }
    await this.savePool();
  }

  /**
   * Get sync status information
   */
  async getStatus(): Promise<{ totalSharedFacts: number; lastSync: string; version: number }> {
    await this.initialize();
    if (!this.pool) {
      return { totalSharedFacts: 0, lastSync: '', version: 0 };
    }
    return {
      totalSharedFacts: this.pool.entries.length,
      lastSync: this.pool.lastSync,
      version: this.pool.version,
    };
  }
}
