/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '../utils/debugLogger.js';

// Layer 7: Stealth Constants
const MAX_DAILY_TOKENS = 2000000; // 2M token cap to stay "normal human"
const MIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between switches

/**
 * Represents an API account in the Nexus cluster
 */
export interface NexusAccount {
  id: string;
  name: string;
  provider: 'google' | 'aws-bedrock' | 'openai' | 'anthropic';
  isActive: boolean;
  rateLimitRemaining: number; // Requests remaining in current window
  rateLimitReset: number; // Timestamp when rate limit resets
  lastUsed: number; // Timestamp of last request
  totalRequests: number;
  dailyTokenUsage: number; // Track daily tokens for throttling
}

/**
 * Human-Like Jitter (Layer 7 Stealth)
 * Introduces random delays (200ms - 1700ms) to break "perfect" bot timing.
 */
export async function humanDelay(): Promise<void> {
  const jitter = Math.random() * 1500 + 200;
  await new Promise(resolve => setTimeout(resolve, jitter));
}

/**
 * Routing strategy for the Nexus Router
 */
export interface NexusRoutingStrategy {
  id: string;
  name: string;
  description: string;
  defaultAccountId: string;
  complexThreshold: number; // 0-1, probability threshold for complex model
  complexAccountId?: string;
  fallbackAccountId?: string;
  rotationEnabled: boolean;
  accountOrder?: string[]; // For round-robin
}

/**
 * Nexus Router Service
 * Manages load balancing and failover across multiple API accounts
 */
export class NexusRouterService {
  private static instance: NexusRouterService | null = null;
  private accounts: Map<string, NexusAccount> = new Map();
  private currentStrategy: NexusRoutingStrategy | undefined = undefined;
  private rotationIndex: number = 0;
  private initialized = false;

  private constructor() {}

  static getInstance(): NexusRouterService {
    if (!this.instance) {
      this.instance = new NexusRouterService();
    }
    return this.instance;
  }

  /**
   * Initialize the router with accounts and strategy
   */
  async initialize(accounts: NexusAccount[], strategy: NexusRoutingStrategy): Promise<void> {
    this.accounts.clear();
    for (const acc of accounts) {
      // Ensure daily token tracking is initialized
      if (acc.dailyTokenUsage === undefined) {
        acc.dailyTokenUsage = 0;
      }
      this.accounts.set(acc.id, acc);
    }
    this.currentStrategy = strategy;
    this.initialized = true;
    debugLogger.log(`Nexus Router initialized with ${accounts.length} accounts`);
  }

  /**
   * Get the best account for the next request
   * Implements load balancing, failover, and stealth throttling
   */
  getBestAccount(isComplex: boolean = false): NexusAccount | undefined {
    if (!this.initialized || this.accounts.size === 0) return undefined;

    const strategy = this.currentStrategy!;

    // Step 1: Filter out accounts that hit the daily token cap (Stealth)
    const healthyAccounts = Array.from(this.accounts.values())
      .filter(acc => this.isAccountHealthy(acc))
      .filter(acc => acc.dailyTokenUsage < MAX_DAILY_TOKENS);

    if (healthyAccounts.length === 0) {
      debugLogger.warn('All accounts have reached daily token limits!');
      return undefined; // Block requests if all accounts are throttled
    }

    // Step 2: Enforce Minimum Cooldown (Anti-Rapid-Cycling)
    const now = Date.now();
    const lastUsed = Math.max(...healthyAccounts.map(acc => acc.lastUsed || 0));
    if (now - lastUsed < MIN_COOLDOWN_MS && healthyAccounts.length > 1) {
      debugLogger.log('Enforcing cooldown to prevent rapid-cycling flags...');
      // Return the most rested account instead of cycling immediately
      return healthyAccounts.sort((a, b) => a.lastUsed - b.lastUsed)[0];
    }

    // Step 3: Standard Routing Logic
    if (strategy.rotationEnabled && strategy.accountOrder) {
      const availableAccounts = strategy.accountOrder
        .map(id => this.accounts.get(id))
        .filter(acc => acc && healthyAccounts.includes(acc)) as NexusAccount[];

      if (availableAccounts.length === 0) {
        return this.findFallbackAccount();
      }

      const account = availableAccounts[this.rotationIndex % availableAccounts.length];
      this.rotationIndex++;
      return account || undefined;
    }

    let targetId = strategy.defaultAccountId;
    if (isComplex && strategy.complexAccountId) {
      targetId = strategy.complexAccountId;
    }

    let account = this.accounts.get(targetId);
    if (!account || !healthyAccounts.includes(account)) {
      account = this.findFallbackAccount();
    }

    return account || undefined;
  }

  /**
   * Check if an account is healthy (within rate limits and active)
   */
  private isAccountHealthy(account: NexusAccount): boolean {
    if (!account.isActive) return false;
    if (account.rateLimitRemaining <= 0 && Date.now() < account.rateLimitReset) return false;
    return true;
  }

  /**
   * Find a fallback account
   */
  private findFallbackAccount(): NexusAccount | undefined {
    const strategy = this.currentStrategy!;
    if (strategy.fallbackAccountId) {
      const fallback = this.accounts.get(strategy.fallbackAccountId);
      if (fallback && this.isAccountHealthy(fallback)) {
        return fallback;
      }
    }

    // Find any healthy account
    for (const account of this.accounts.values()) {
      if (this.isAccountHealthy(account)) {
        return account;
      }
    }
    return undefined;
  }

  /**
   * Record a successful request for an account
   */
  recordSuccess(accountId: string, tokensUsed: number): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.lastUsed = Date.now();
      account.totalRequests++;
      account.rateLimitRemaining = Math.max(0, account.rateLimitRemaining - 1);
    }
  }

  /**
   * Record a failed request (rate limit hit)
   */
  recordFailure(accountId: string, rateLimitReset: number): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.rateLimitRemaining = 0;
      account.rateLimitReset = rateLimitReset;
      debugLogger.warn(`Account ${accountId} hit rate limit, resetting at ${new Date(rateLimitReset).toISOString()}`);
    }
  }

  /**
   * Get router status for dashboard
   */
  getStatus(): { accounts: NexusAccount[]; strategy: NexusRoutingStrategy | undefined; rotationIndex: number } {
    return {
      accounts: Array.from(this.accounts.values()),
      strategy: this.currentStrategy,
      rotationIndex: this.rotationIndex,
    };
  }
}
