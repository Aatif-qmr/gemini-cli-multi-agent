/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '../utils/debugLogger.js';
import type { NexusAccount, NexusRoutingStrategy } from './nexusRouterService.js';
import { NexusRouterService } from './nexusRouterService.js';

/**
 * Multi-Account Rotation Service
 * Provides seamless failover and load balancing across multiple API accounts
 */
export class MultiAccountRotationService {
  private router: NexusRouterService;
  private retryAttempts: number = 3;
  private retryDelayMs: number = 1000;

  constructor() {
    this.router = NexusRouterService.getInstance();
  }

  /**
   * Execute a request with automatic failover
   * If the primary account fails, it tries fallback accounts
   */
  async executeWithFailover<T>(
    requestFn: (accountId: string) => Promise<T>,
    isComplex: boolean = false
  ): Promise<T> {
    let attempts = 0;
    const triedAccounts = new Set<string>();

    while (attempts < this.retryAttempts) {
      const account = this.router.getBestAccount(isComplex);
      
      if (!account) {
        throw new Error('No healthy accounts available in Nexus cluster');
      }

      if (triedAccounts.has(account.id) && triedAccounts.size >= this.router.getStatus().accounts.length) {
        throw new Error('All accounts exhausted after failover attempts');
      }

      triedAccounts.add(account.id);

      try {
        const result = await requestFn(account.id);
        this.router.recordSuccess(account.id, 0); // Tokens tracked elsewhere
        return result;
      } catch (error: any) {
        attempts++;
        
        // Check if it's a rate limit error
        if (error.status === 429 || error.message?.includes('rate limit')) {
          const resetTime = this.extractRateLimitReset(error);
          this.router.recordFailure(account.id, resetTime);
          debugLogger.warn(`Account ${account.id} rate limited, trying fallback...`);
        } else if (error.status === 401 || error.status === 403) {
          // Auth error, mark account as inactive
          debugLogger.error(`Account ${account.id} auth failed, marking as inactive`);
          // In a real impl, we'd update the account status in storage
        }

        // Wait before retrying
        if (attempts < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempts));
        }
      }
    }

    throw new Error('All failover attempts exhausted');
  }

  /**
   * Extract rate limit reset time from error
   */
  private extractRateLimitReset(error: any): number {
    // Default to 60 seconds from now if not specified
    const header = error.headers?.['retry-after'] || error.headers?.['x-ratelimit-reset'];
    if (header) {
      const seconds = parseInt(header, 10);
      if (!isNaN(seconds)) {
        return Date.now() + (seconds * 1000);
      }
    }
    return Date.now() + (60 * 1000);
  }

  /**
   * Initialize rotation with accounts and strategy
   */
  async initialize(accounts: NexusAccount[], strategy: NexusRoutingStrategy): Promise<void> {
    await this.router.initialize(accounts, strategy);
    debugLogger.log(`Multi-Account Rotation initialized with ${accounts.length} accounts`);
  }

  /**
   * Get current rotation status
   */
  getStatus() {
    return this.router.getStatus();
  }
}
