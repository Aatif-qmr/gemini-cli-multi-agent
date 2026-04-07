/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';

interface ModelListArgs {
  _: (string | number)[];
  $0: string;
}

interface ModelSelectArgs {
  model: string;
  _: (string | number)[];
  $0: string;
}

interface ModelMixArgs {
  mix: string;
  _: (string | number)[];
  $0: string;
}

interface ModelMixListArgs {
  _: (string | number)[];
  $0: string;
}

/**
 * Available models across all providers
 */
const AVAILABLE_MODELS = [
  // Google
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', description: 'Most capable model for complex reasoning', bestFor: 'Deep analysis, architecture' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Fast and capable for most tasks', bestFor: 'Daily coding, debugging' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', description: 'Fastest and most cost-effective', bestFor: 'Quick lookups, summaries' },
  // AWS Bedrock
  { id: 'devstral-2-123b', name: 'Devstral 2 123B', provider: 'aws-bedrock', description: 'Specialized coding model (Bedrock)', bestFor: 'Code generation, refactoring' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'aws-bedrock', description: 'High intelligence (Bedrock)', bestFor: 'Complex logic, creative writing' },
];

/**
 * Premade model mixes
 */
const MODEL_MIXES = [
  {
    id: 'balance',
    name: '⚖️ Balanced',
    description: 'Default mix - good for most tasks',
    strategy: {
      default: 'gemini-2.5-flash',
      complexThreshold: 0.7,
      complexModel: 'gemini-2.5-pro',
      fallback: 'gemini-2.5-flash-lite',
    },
  },
  {
    id: 'code-powerhouse',
    name: '💻 Code Powerhouse',
    description: 'Uses Devstral for coding, Gemini for logic',
    strategy: {
      coding: 'devstral-2-123b',
      reasoning: 'gemini-2.5-pro',
      chat: 'gemini-2.5-flash',
    },
  },
  {
    id: 'speed',
    name: '⚡ Speed Demon',
    description: 'Prioritize speed over capability',
    strategy: {
      default: 'gemini-2.5-flash-lite',
      complexThreshold: 0.85,
      complexModel: 'gemini-2.5-flash',
      fallback: 'devstral-2-123b', // Use Devstral if Gemini is slow/down
    },
  },
  {
    id: 'smart',
    name: '🧠 Maximum Intel',
    description: 'Always use the smartest model',
    strategy: {
      default: 'gemini-2.5-pro',
      complexThreshold: 0.5,
      complexModel: 'claude-3.5-sonnet',
      fallback: 'devstral-2-123b',
    },
  },
  {
    id: 'budget',
    name: '💰 Budget Saver',
    description: 'Minimize token costs',
    strategy: {
      default: 'gemini-2.5-flash-lite',
      complexThreshold: 0.9,
      complexModel: 'devstral-2-123b',
      fallback: 'gemini-2.5-flash-lite',
    },
  },
  {
    id: 'mult-account',
    name: '🔄 Multi-Account',
    description: 'Distribute across 3 accounts + AWS',
    strategy: {
      default: 'gemini-2.5-flash',
      rotation: true,
      accounts: ['account1', 'account2', 'account3', 'aws-bedrock'],
      complexModel: 'gemini-2.5-pro',
      fallback: 'devstral-2-123b',
    },
  },
];

/**
 * List available models
 */
const modelListCommand: CommandModule<{}, ModelListArgs> = {
  command: 'list',
  describe: 'List all available models',
  builder: (yargs) => yargs as any,
  handler: async (_argv: ArgumentsCamelCase<ModelListArgs>) => {
    console.log('\n🤖 Available Models\n');
    console.log('─'.repeat(70));
    console.log('  Model ID                 Provider           Best For');
    console.log('  ' + '─'.repeat(70));
    for (const model of AVAILABLE_MODELS) {
      const providerTag = model.provider === 'google' ? 'Google' : 'AWS Bedrock';
      console.log(`  ${model.id.padEnd(22)}${providerTag.padEnd(18)}${model.bestFor}`);
    }
    console.log('\n  Use "gmi model select <model-id>" to switch models\n');
  },
};

/**
 * Select a model
 */
const modelSelectCommand: CommandModule<{}, ModelSelectArgs> = {
  command: 'select <model>',
  describe: 'Select the default model for this session',
  builder: (yargs) =>
    yargs.positional('model', {
      type: 'string',
      demandOption: true,
      describe: 'Model ID to use',
    }) as any,
  handler: async (argv: ArgumentsCamelCase<ModelSelectArgs>) => {
    const modelId = argv.model;
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);

    if (!model) {
      console.error(`❌ Unknown model: ${modelId}`);
      console.log('\nAvailable models:');
      for (const m of AVAILABLE_MODELS) {
        console.log(`  • ${m.id}`);
      }
      return;
    }

    console.log(`\n✅ Model selected: ${model.name}`);
    console.log(`   ID: ${model.id}`);
    console.log(`   Best for: ${model.bestFor}\n`);
    console.log('  Tip: Use "gmi model mix <mix-id>" for automatic routing\n');
  },
};

/**
 * Set a model mix
 */
const modelMixCommand: CommandModule<{}, ModelMixArgs> = {
  command: 'mix <mix>',
  describe: 'Set a premade model mix for automatic routing',
  builder: (yargs) =>
    yargs.positional('mix', {
      type: 'string',
      demandOption: true,
      describe: 'Mix ID to use',
    }) as any,
  handler: async (argv: ArgumentsCamelCase<ModelMixArgs>) => {
    const mixId = argv.mix;
    const mix = MODEL_MIXES.find(m => m.id === mixId);

    if (!mix) {
      console.error(`❌ Unknown mix: ${mixId}`);
      console.log('\nAvailable mixes:');
      for (const m of MODEL_MIXES) {
        console.log(`  • ${m.id} - ${m.name}`);
      }
      return;
    }

    console.log(`\n✅ Model mix activated: ${mix.name}`);
    console.log(`   ${mix.description}\n`);
    console.log('   Strategy:');
    console.log(`   • Default model: ${mix.strategy.default}`);
    if (mix.strategy.complexThreshold) {
      console.log(`   • Complex threshold: ${(mix.strategy.complexThreshold * 100).toFixed(0)}%`);
      console.log(`   • Complex model: ${mix.strategy.complexModel}`);
    }
    console.log(`   • Fallback: ${mix.strategy.fallback}\n`);
  },
};

/**
 * List available mixes
 */
const modelMixListCommand: CommandModule<{}, ModelMixListArgs> = {
  command: 'mix-list',
  describe: 'List all available model mixes',
  builder: (yargs) => yargs as any,
  handler: async (_argv: ArgumentsCamelCase<ModelMixListArgs>) => {
    console.log('\n🎛️  Model Mixes (Automatic Routing)\n');
    console.log('─'.repeat(70));
    console.log('  Mix ID          Name                  Description');
    console.log('  ' + '─'.repeat(68));
    for (const mix of MODEL_MIXES) {
      console.log(`  ${mix.id.padEnd(15)}${mix.name.padEnd(21)}${mix.description}`);
    }
    console.log('\n  Use "gmi model mix <mix-id>" to activate a mix\n');
  },
};

/**
 * Main model command group
 */
export const modelCommand: CommandModule = {
  command: 'model <command>',
  describe: 'Manage models and routing',
  builder: (yargs) =>
    yargs
      .command(modelListCommand)
      .command(modelSelectCommand)
      .command(modelMixCommand)
      .command(modelMixListCommand)
      .demandCommand(1, 'You need to specify a model command'),
  handler: () => {},
};
