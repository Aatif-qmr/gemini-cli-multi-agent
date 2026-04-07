/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';

export interface PermissionRequest {
  id: string;
  instance: string;
  action: string;
  details?: string;
  status: 'pending' | 'approved' | 'denied';
  timestamp: string;
}

const NEXUS_DIR = path.join(os.homedir(), '.gemini-nexus');
const PERMISSIONS_FILE = path.join(NEXUS_DIR, 'pending-approvals.json');

/**
 * Service for gmi2/gmi3 to request permission from gmi1.
 * This uses a shared JSON file as a simple IPC mechanism.
 */
export class NexusPermissionService {
  
  /**
   * Requests permission for a specific action.
   * @param instance The name of the requesting instance (e.g., "gmi2")
   * @param action The action requiring approval
   * @param details Optional details
   * @param timeoutMs How long to wait for approval before failing (default: 5 mins)
   */
  static async request(instance: string, action: string, details?: string, timeoutMs: number = 300000): Promise<boolean> {
    await fs.mkdir(NEXUS_DIR, { recursive: true });

    const request: PermissionRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      instance,
      action,
      details,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    // Read existing requests
    let requests: PermissionRequest[] = [];
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      requests = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    // Add new request
    requests.push(request);
    await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(requests, null, 2));

    console.log(`\n⚠️  [${instance}] Waiting for approval: "${action}"...`);

    // Poll for response
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
        const currentRequests: PermissionRequest[] = JSON.parse(content);
        const myRequest = currentRequests.find(r => r.id === request.id);

        if (myRequest) {
          if (myRequest.status === 'approved') {
            console.log(`✅ [${instance}] Action Approved!`);
            return true;
          } else if (myRequest.status === 'denied') {
            console.log(`❌ [${instance}] Action Denied.`);
            return false;
          }
        } else {
          // Request was removed (maybe archived)
          return false; 
        }
      } catch {
        // Ignore read errors
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
    }

    console.log(`⌛ [${instance}] Approval request timed out.`);
    return false;
  }

  /**
   * Retrieves all pending requests.
   */
  static async getPending(): Promise<PermissionRequest[]> {
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      const requests: PermissionRequest[] = JSON.parse(content);
      return requests.filter(r => r.status === 'pending');
    } catch {
      return [];
    }
  }

  /**
   * Responds to a specific request by ID.
   */
  static async respond(id: string, decision: 'approved' | 'denied'): Promise<void> {
    try {
      const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
      const requests: PermissionRequest[] = JSON.parse(content);
      
      const index = requests.findIndex(r => r.id === id);
      if (index !== -1) {
        requests[index].status = decision;
        await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(requests, null, 2));
      }
    } catch (error) {
      console.error('Failed to update permissions file:', error);
    }
  }
}
