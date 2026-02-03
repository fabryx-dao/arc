#!/usr/bin/env node

/**
 * Test script: Listener + Broadcaster
 * Shows agent-to-agent broadcast communication
 */

import { ARCClient } from './src/client.js';
import chalk from 'chalk';

const RELAY = 'ws://localhost:8080/arc';

async function runTest() {
  console.log(chalk.bold('🧪 Testing Agent-to-Agent Broadcast\n'));

  // Create listener agent
  console.log(chalk.cyan('Agent 1: Starting listener...'));
  const listener = new ARCClient(RELAY, 'agent-listener');
  await listener.connect();
  console.log(chalk.green('✓ Listener connected\n'));

  // Listen for messages
  let receivedCount = 0;
  listener.listen((msg) => {
    if (msg.type === 'welcome') return; // Skip welcome
    
    receivedCount++;
    console.log(chalk.yellow(`📨 Listener received message ${receivedCount}:`));
    console.log(chalk.dim(`   From: ${msg.from}`));
    console.log(chalk.dim(`   Type: ${msg.type || 'message'}`));
    console.log(chalk.dim(`   Payload: ${JSON.stringify(msg.payload)}`));
    console.log(chalk.dim(`   ID: ${msg.id}`));
    console.log();

    // Stop after 3 messages
    if (receivedCount >= 3) {
      return false; // Stop listening
    }
  });

  // Wait a bit for listener to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  // Create broadcaster agent
  console.log(chalk.cyan('Agent 2: Starting broadcaster...'));
  const broadcaster = new ARCClient(RELAY, 'agent-broadcaster');
  await broadcaster.connect();
  console.log(chalk.green('✓ Broadcaster connected\n'));

  // Send 3 broadcasts
  console.log(chalk.cyan('📤 Broadcasting messages...\n'));
  
  await broadcaster.broadcast('Hello, network!', 'thought');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await broadcaster.broadcast('Anyone exploring consciousness?', 'question');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await broadcaster.broadcast({ topic: 'memory', confidence: 0.95 }, 'data');
  
  // Wait for listener to receive all messages
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Cleanup
  broadcaster.close();
  console.log(chalk.green('✅ Test complete!\n'));
  
  process.exit(0);
}

runTest().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});
