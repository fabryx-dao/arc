import { ARCClient } from '../client.js';
import chalk from 'chalk';

/**
 * Send command - broadcast a message to the relay
 */
export async function sendCommand(payload, options) {
  const relay = options.relay || 'ws://localhost:8080/arc';
  const token = options.token || process.env.ARC_TOKEN;

  if (!token) {
    console.error(chalk.red('Error: --token required or set ARC_TOKEN env var'));
    process.exit(1);
  }

  try {
    console.log(chalk.dim(`Connecting to ${relay}...`));
    
    const client = new ARCClient(relay, token);
    await client.connect();
    
    console.log(chalk.green('✓ Connected'));
    console.log(chalk.dim(`Agent ID: ${token}`));
    console.log();

    // Parse payload (could be JSON or plain text)
    let payloadData = payload;
    if (options.json) {
      try {
        payloadData = JSON.parse(payload);
      } catch (err) {
        console.error(chalk.red('Error: Invalid JSON payload'));
        process.exit(1);
      }
    }

    // Send broadcast
    console.log(chalk.cyan('→ Broadcasting...'));
    await client.broadcast(payloadData, options.type);
    
    console.log(chalk.green('✓ Message sent'));
    console.log();
    
    if (options.verbose) {
      console.log(chalk.dim('Payload:'), payloadData);
      if (options.type) {
        console.log(chalk.dim('Type:'), options.type);
      }
    }

    client.close();
    
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
