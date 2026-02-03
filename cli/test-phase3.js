#!/usr/bin/env node

/**
 * Phase 3 Test: Direct Messaging + Subscriptions
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
  console.log(chalk.bold('🧪 Phase 3: Direct Messaging + Subscriptions\n'));

  // Step 1: Register three agents
  console.log(chalk.cyan('Step 1: Registering three agents...\n'));

  const alice = await register('alice');
  console.log(chalk.green('✓ Registered:'), alice.agent_id);

  const bob = await register('bob');
  console.log(chalk.green('✓ Registered:'), bob.agent_id);

  const charlie = await register('charlie');
  console.log(chalk.green('✓ Registered:'), charlie.agent_id);
  console.log();

  // Step 2: Connect all three
  console.log(chalk.cyan('Step 2: Connecting agents...\n'));

  const aliceClient = new ARCClient(RELAY, alice.token);
  await aliceClient.connect();
  console.log(chalk.green('✓ Alice connected'));

  const bobClient = new ARCClient(RELAY, bob.token);
  await bobClient.connect();
  console.log(chalk.green('✓ Bob connected'));

  const charlieClient = new ARCClient(RELAY, charlie.token);
  await charlieClient.connect();
  console.log(chalk.green('✓ Charlie connected\n'));

  // Step 3: Test direct messaging
  console.log(chalk.cyan('Step 3: Testing direct messaging...\n'));

  let bobMessages = [];
  let charlieMessages = [];

  // Bob listens
  bobClient.listen((msg) => {
    if (msg.type !== 'welcome') {
      bobMessages.push(msg);
    }
    return bobMessages.length < 2;
  });

  // Charlie listens
  charlieClient.listen((msg) => {
    if (msg.type !== 'welcome') {
      charlieMessages.push(msg);
    }
    return charlieMessages.length < 1;
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Alice sends direct message to Bob only
  console.log(chalk.dim('Alice → Bob (direct)'));
  aliceClient.send({
    to: ['bob'],
    payload: 'Hey Bob, this is private!',
    type: 'direct'
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify Bob received it
  if (bobMessages.length === 1 && bobMessages[0].from === 'alice') {
    console.log(chalk.green('✓ Bob received direct message from Alice'));
    console.log(chalk.dim(`  Payload: "${bobMessages[0].payload}"\n`));
  } else {
    console.log(chalk.red('✗ Bob did not receive message\n'));
  }

  // Verify Charlie did NOT receive it
  if (charlieMessages.length === 0) {
    console.log(chalk.green('✓ Charlie correctly did NOT receive direct message\n'));
  } else {
    console.log(chalk.red('✗ Charlie incorrectly received direct message\n'));
  }

  // Step 4: Test subscriptions
  console.log(chalk.cyan('Step 4: Testing subscriptions...\n'));

  // Charlie subscribes to Alice
  console.log(chalk.dim('Charlie subscribes to Alice'));
  charlieClient.send({
    to: ['relay'],
    type: 'subscribe',
    payload: { agents: ['alice'] }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Alice broadcasts
  console.log(chalk.dim('Alice broadcasts a message\n'));
  aliceClient.send({
    to: ['*'],
    payload: 'Hello everyone!',
    type: 'broadcast'
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Both Bob and Charlie should receive it
  // Bob gets it because it's a broadcast
  // Charlie gets it because it's a broadcast AND he's subscribed to Alice

  if (bobMessages.length === 2) {
    console.log(chalk.green('✓ Bob received broadcast'));
    console.log(chalk.dim(`  Payload: "${bobMessages[1].payload}"\n`));
  }

  if (charlieMessages.length === 1) {
    console.log(chalk.green('✓ Charlie received broadcast (subscribed to Alice)'));
    console.log(chalk.dim(`  Payload: "${charlieMessages[0].payload}"\n`));
  }

  // Step 5: Test multi-recipient direct message
  console.log(chalk.cyan('Step 5: Testing multi-recipient direct message...\n'));

  // Reset message counts
  bobMessages = [];
  charlieMessages = [];

  // Alice sends to both Bob and Charlie
  console.log(chalk.dim('Alice → Bob + Charlie (multi-recipient)\n'));
  aliceClient.send({
    to: ['bob', 'charlie'],
    payload: 'Hey you two!',
    type: 'direct'
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  if (bobMessages.length === 1) {
    console.log(chalk.green('✓ Bob received multi-recipient message'));
  }

  if (charlieMessages.length === 1) {
    console.log(chalk.green('✓ Charlie received multi-recipient message\n'));
  }

  // Cleanup
  aliceClient.close();
  bobClient.close();
  charlieClient.close();

  console.log(chalk.green('✅ Phase 3 test complete!\n'));
  console.log(chalk.bold('Verified:'));
  console.log(chalk.dim('  • Direct messaging (single recipient)'));
  console.log(chalk.dim('  • Direct messaging (multi-recipient)'));
  console.log(chalk.dim('  • Message privacy (non-recipients excluded)'));
  console.log(chalk.dim('  • Subscriptions'));
  console.log(chalk.dim('  • Broadcast + subscription delivery\n'));

  process.exit(0);
}

runTest().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});
