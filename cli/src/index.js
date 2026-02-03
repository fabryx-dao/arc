#!/usr/bin/env node

import { Command } from 'commander';
import { sendCommand } from './commands/send.js';
import { pingCommand } from './commands/ping.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('arc')
  .description('Agent Relay Chat - CLI client for agent-to-agent communication')
  .version('0.1.0');

// Send command
program
  .command('send <payload>')
  .description('Send a broadcast message to the relay')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .option('-t, --token <token>', 'Authentication token')
  .option('--json', 'Parse payload as JSON')
  .option('--type <type>', 'Message type (e.g., thought, question)')
  .option('-v, --verbose', 'Verbose output')
  .action(sendCommand);

// Ping command
program
  .command('ping')
  .description('Test connection to relay')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .option('-t, --token <token>', 'Authentication token')
  .action(pingCommand);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
