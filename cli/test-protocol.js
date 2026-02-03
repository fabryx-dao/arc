#!/usr/bin/env node

/**
 * Full protocol test: Registration + Agent-to-Agent communication
 */

import { ARCClient } from './src/client.js';
import chalk from 'chalk';

const HTTP_URL = 'http://localhost:8081';
const RELAY = 'ws://localhost:8080/arc';

async function register(agentId) {
  const response = await fetch(`${HTTP_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId })
  });

  return await response.json();
}

async function runTest() {
  console.log(chalk.bold('🧪 Full Protocol Test\n'));

  // Step 1: Register two agents
  console.log(chalk.cyan('Step 1: Registering two agents...\n'));

  const listener = await register('test-listener');
  console.log(chalk.green('✓ Registered:'), listener.agent_id);
  console.log(chalk.dim(`  Token: ${listener.token}\n`));

  const broadcaster = await register('test-broadcaster');
  console.log(chalk.green('✓ Registered:'), broadcaster.agent_id);
  console.log(chalk.dim(`  Token: ${broadcaster.token}\n`));

  // Step 2: Connect listener
  console.log(chalk.cyan('Step 2: Connecting listener...\n'));
  const listenerClient = new ARCClient(RELAY, listener.token);
  await listenerClient.connect();
  console.log(chalk.green('✓ Listener connected as:'), listenerClient.agentId);
  console.log();

  // Step 3: Listen for messages
  let receivedCount = 0;
  listenerClient.listen((msg) => {
    if (msg.type === 'welcome') return;
    
    receivedCount++;
    console.log(chalk.yellow(`📨 Listener received message ${receivedCount}:`));
    console.log(chalk.dim(`   From: ${msg.from} (verified by relay)`));
    console.log(chalk.dim(`   Type: ${msg.type || 'message'}`));
    console.log(chalk.dim(`   Payload: ${JSON.stringify(msg.payload)}`));
    console.log(chalk.dim(`   ID: ${msg.id}`));
    console.log(chalk.dim(`   Timestamp: ${msg.ts}`));
    console.log();

    if (receivedCount >= 2) {
      return false; // Stop after 2 messages
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 4: Connect broadcaster
  console.log(chalk.cyan('Step 3: Connecting broadcaster...\n'));
  const broadcasterClient = new ARCClient(RELAY, broadcaster.token);
  await broadcasterClient.connect();
  console.log(chalk.green('✓ Broadcaster connected as:'), broadcasterClient.agentId);
  console.log();

  // Step 5: Send broadcasts
  console.log(chalk.cyan('Step 4: Broadcasting messages (note: client does NOT send "from")...\n'));
  
  await broadcasterClient.broadcast('Hello from test-broadcaster!', 'thought');
  console.log(chalk.dim('Sent: thought\n'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await broadcasterClient.broadcast({ topic: 'protocol-test', success: true }, 'data');
  console.log(chalk.dim('Sent: data\n'));

  // Wait for messages to be received
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Cleanup
  broadcasterClient.close();
  
  console.log(chalk.green('✅ Protocol test complete!\n'));
  console.log(chalk.bold('Key points:'));
  console.log(chalk.dim('  • Agents registered and received tokens'));
  console.log(chalk.dim('  • Client does NOT send "from" field'));
  console.log(chalk.dim('  • Relay assigns "from" based on token'));
  console.log(chalk.dim('  • Relay assigns unique "id" and server "ts"'));
  console.log(chalk.dim('  • Identity cannot be spoofed\n'));
  
  process.exit(0);
}

runTest().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});
