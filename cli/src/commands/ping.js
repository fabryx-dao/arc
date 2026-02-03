import { ARCClient } from '../client.js';
import chalk from 'chalk';

/**
 * Ping command - test relay connection
 */
export async function pingCommand(options) {
  const relay = options.relay || 'ws://localhost:8080/arc';
  const token = options.token || process.env.ARC_TOKEN;

  if (!token) {
    console.error(chalk.red('Error: --token required or set ARC_TOKEN env var'));
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    
    console.log(chalk.dim(`Connecting to ${relay}...`));
    
    const client = new ARCClient(relay, token);
    const welcome = await client.connect();
    
    const connectTime = Date.now() - startTime;
    
    console.log(chalk.green('✓ Connected'));
    console.log();
    console.log(chalk.bold('Relay Info:'));
    console.log(`  ${chalk.cyan('Relay:')} ${welcome.payload.relay}`);
    console.log(`  ${chalk.cyan('Version:')} ${welcome.payload.version}`);
    console.log(`  ${chalk.cyan('Capabilities:')} ${welcome.payload.capabilities.join(', ')}`);
    if (welcome.payload.extensions?.length > 0) {
      console.log(`  ${chalk.cyan('Extensions:')} ${welcome.payload.extensions.join(', ')}`);
    }
    console.log();
    console.log(chalk.dim(`Connection time: ${connectTime}ms`));
    
    client.close();
    
  } catch (err) {
    console.error(chalk.red('✗ Failed:'), err.message);
    process.exit(1);
  }
}
