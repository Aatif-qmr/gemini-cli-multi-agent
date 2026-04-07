/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client Profiles for Stealth & Compliance (Layer 7)
 * 
 * By rotating User-Agents and Client Versions, we ensure that each instance
 * presents a slightly different fingerprint to the backend, making the cluster
 * look like separate, organic users rather than a single bot farm.
 */

export interface ClientProfile {
  userAgent: string;
  clientVersion: string;
  platform: string;
}

export const CLIENT_PROFILES: Record<string, ClientProfile> = {
  // Instance 1: Stable Release on Apple Silicon
  gmi1: {
    userAgent: 'GeminiCLI/1.1.0 (macOS; Apple Silicon)',
    clientVersion: '1.1.0',
    platform: 'darwin-arm64',
  },
  // Instance 2: Previous Release on Intel Mac
  gmi2: {
    userAgent: 'GeminiCLI/1.0.9 (macOS; Intel)',
    clientVersion: '1.0.9',
    platform: 'darwin-x64',
  },
  // Instance 3: Nightly Build on Linux
  gmi3: {
    userAgent: 'GeminiCLI/1.1.1-nightly (Linux; Arm64)',
    clientVersion: '1.1.1-nightly.20260317',
    platform: 'linux-arm64',
  },
};

export function getProfileById(id: string): ClientProfile {
  return CLIENT_PROFILES[id] || CLIENT_PROFILES['gmi1'];
}
