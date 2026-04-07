/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { debugLogger } from '../utils/debugLogger.js';

export interface PermissionRequest {
  id: string;
  instance: string;
  action: string;
  details: string;
  status: 'pending' | 'approved' | 'denied';
  timestamp: string;
}

const NEXUS_DIR = path.join(os.homedir(), '.gemini-nexus');
const PERMISSIONS_FILE = path.join(NEXUS_DIR, 'pending-approvals.json');

/**
 * Service for gmi2/gmi3 to request permission from gmi1.
 * Uses a shared JSON file as a simple IPC mechanism.
 */
export class NexusPermissionService {
  private static instance: NexusPermissionService | null = null;

  private constructor() {}

  static getInstance(): NexusPermissionService {
    if (!this.instance) {
      this.instance = new NexusPermissionService();
    }
    return this.instance;
  }

  /**
   * Requests permission for a specific action.
   * This writes to the shared mailbox and waits for a response.
   */
  async requestPermission(instance: string, action: string, details: string): Promise<boolean> {
    await fs.mkdir(NEXUS_DIR, { recursive: true });

    const request: PermissionRequest = {
      id: `${instance}-${Date.now()}`,
      instance,
      action,
      details,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    // Append to the mailbox
    let requests: PermissionRequest[] = [];
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      requests = JSON.parse(content);
    } catch {
      // File doesn't exist or is empty
    }

    requests.push(request);
    await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(requests, null, 2));
    debugLogger.log(`⏳ [${instance}] Waiting for approval: ${action}...`);

    // Poll for response
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
          const currentRequests = JSON.parse(content);
          const myRequest = currentRequests.find((r: PermissionRequest) => r.id === request.id);

          if (myRequest) {
            if (myRequest.status === 'approved') {
              clearInterval(interval);
              debugLogger.log(`✅ [${instance}] Approval granted!`);
              resolve(true);
            } else if (myRequest.status === 'denied') {
              clearInterval(interval);
              debugLogger.log(`❌ [${instance}] Approval denied.`);
              resolve(false);
            }
          } else {
            // Request was removed (archived or processed)
            clearInterval(interval);
            resolve(false); 
          }
        } catch {
          // Ignore read errors
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Gets all pending requests.
   */
  async getPendingRequests(): Promise<PermissionRequest[]> {
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      const requests: PermissionRequest[] = JSON.parse(content);
      return requests.filter(r => r.status === 'pending');
    } catch {
      return [];
    }
  }

  /**
   * Approves or denies a request.
   */
  async respondToRequest(id: string, status: 'approved' | 'denied'): Promise<void> {
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      const requests: PermissionRequest[] = JSON.parse(content);
      const index = requests.findIndex(r => r.id === id);
      if (index !== -1) {
        requests[index].status = status;
        await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(requests, null, 2));
      }
    } catch (error) {
      debugLogger.error(`Failed to update permissions: ${error}`);
    }
  }
}
