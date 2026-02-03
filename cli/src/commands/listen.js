import { ARCClient } from '../client.js';
import chalk from 'chalk';

/**
 * Listen command - stay connected and show incoming messages
 */
export async function listenCommand(options) {
  const relay = options.relay || 'ws://localhost:8080/arc';
  const token = options.token || process.env.ARC_TOKEN;

  if (!token) {
    console.error(chalk.red('Error: --token required or set ARC_TOKEN env var'));
    process.exit(1);
  }

  try {
    console.log(chalk.dim(`Connecting to ${relay}...`));
    
    const client = new ARCClient(relay, token);
    const welcome = await client.connect();
    
    console.log(chalk.green('✓ Connected'));
    console.log(chalk.dim(`Agent ID: ${client.agentId}`));
    console.log(chalk.dim(`Relay: ${welcome.payload.relay}`));
    console.log();
    console.log(chalk.bold('Listening for messages... (Ctrl+C to exit)\n'));

    let messageCount = 0;

    // Listen for messages
    await client.listen((msg) => {
      // Skip welcome message
      if (msg.type === 'welcome') {
        return true;
      }

      messageCount++;

      // Display message
      console.log(chalk.yellow(`📨 Message ${messageCount}:`));
      console.log(chalk.dim(`   From: ${msg.from}`));
      console.log(chalk.dim(`   Type: ${msg.type || 'message'}`));
      console.log(chalk.dim(`   To: ${msg.to.join(', ')}`));
      
      if (typeof msg.payload === 'string') {
        console.log(chalk.dim(`   Payload: ${msg.payload}`));
      } else {
        console.log(chalk.dim(`   Payload: ${JSON.stringify(msg.payload)}`));
      }
      
      if (options.verbose) {
        console.log(chalk.dim(`   ID: ${msg.id}`));
        console.log(chalk.dim(`   Timestamp: ${msg.ts}`));
      }
      
      console.log();

      // Continue listening
      return true;
    });
    
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
