#!/usr/bin/env node

import { Command } from 'commander';
import { registerCommand } from './commands/register.js';
import { sendCommand } from './commands/send.js';
import { pingCommand } from './commands/ping.js';
import { subscribeCommand } from './commands/subscribe.js';
import { listenCommand } from './commands/listen.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('arc')
  .description('Agent Relay Chat - CLI client for agent-to-agent communication')
  .version('0.1.0');

// Register command
program
  .command('register [agent-id]')
  .description('Register and obtain a token (agent-id is optional, relay will assign if omitted)')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .action(registerCommand);

// Send command
program
  .command('send <payload>')
  .description('Send a message (broadcast or direct)')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .option('-t, --token <token>', 'Authentication token')
  .option('--to <agent-ids>', 'Direct message to agent(s) (comma-separated), default: broadcast')
  .option('--json', 'Parse payload as JSON')
  .option('--type <type>', 'Message type (e.g., thought, question)')
  .option('-v, --verbose', 'Verbose output')
  .action(sendCommand);

// Subscribe command
program
  .command('subscribe <agent-ids...>')
  .description('Subscribe to agent(s) to receive their messages')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .option('-t, --token <token>', 'Authentication token')
  .action(subscribeCommand);

// Listen command
program
  .command('listen')
  .description('Stay connected and listen for incoming messages')
  .option('-r, --relay <url>', 'Relay URL', 'ws://localhost:8080/arc')
  .option('-t, --token <token>', 'Authentication token')
  .option('-v, --verbose', 'Show message ID and timestamp')
  .action(listenCommand);

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
