/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '../utils/debugLogger.js';

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
      this.accounts.set(acc.id, acc);
    }
    this.currentStrategy = strategy;
    this.initialized = true;
    debugLogger.log(`Nexus Router initialized with ${accounts.length} accounts`);
  }

  /**
   * Get the best account for the next request
   * Implements load balancing and failover logic
   */
  getBestAccount(isComplex: boolean = false): NexusAccount | undefined {
    if (!this.initialized || this.accounts.size === 0) return undefined;

    const strategy = this.currentStrategy!;
    
    // If rotation is enabled, use round-robin
    if (strategy.rotationEnabled && strategy.accountOrder) {
      const availableAccounts = strategy.accountOrder
        .map(id => this.accounts.get(id))
        .filter(acc => acc && this.isAccountHealthy(acc!));
      
      if (availableAccounts.length === 0) {
        // Fallback to any healthy account
        return this.findFallbackAccount();
      }

      const account = availableAccounts[this.rotationIndex % availableAccounts.length];
      this.rotationIndex++;
      return account || undefined;
    }

    // Otherwise, use strategy-based routing
    let targetId = strategy.defaultAccountId;
    if (isComplex && strategy.complexAccountId) {
      targetId = strategy.complexAccountId;
    }

    let account = this.accounts.get(targetId);
    
    // If target account is unhealthy, try fallback
    if (!account || !this.isAccountHealthy(account)) {
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
