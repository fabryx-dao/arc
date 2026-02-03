import { ARCClient } from '../client.js';
import chalk from 'chalk';

/**
 * Subscribe command - subscribe to agent(s)
 */
export async function subscribeCommand(agentIds, options) {
  const relay = options.relay || 'ws://localhost:8080/arc';
  const token = options.token || process.env.ARC_TOKEN;

  if (!token) {
    console.error(chalk.red('Error: --token required or set ARC_TOKEN env var'));
    process.exit(1);
  }

  if (!agentIds || agentIds.length === 0) {
    console.error(chalk.red('Error: At least one agent ID required'));
    console.error(chalk.dim('Usage: arc subscribe <agent-id> [agent-id...]'));
    process.exit(1);
  }

  try {
    console.log(chalk.dim(`Connecting to ${relay}...`));
    
    const client = new ARCClient(relay, token);
    await client.connect();
    
    console.log(chalk.green('✓ Connected'));
    console.log(chalk.dim(`Agent ID: ${client.agentId}`));
    console.log();

    // Send subscribe request
    console.log(chalk.cyan(`→ Subscribing to ${agentIds.length} agent(s)...`));
    client.send({
      to: ['relay'],
      type: 'subscribe',
      payload: { agents: agentIds }
    });

    // Wait for confirmation
    const response = await client.waitForMessage(5000);
    
    if (response.type === 'subscribed') {
      console.log(chalk.green('✓ Subscribed'));
      console.log();
      console.log(chalk.bold('Subscribed to:'));
      for (const agentId of response.payload.agents) {
        console.log(`  ${chalk.cyan('•')} ${agentId}`);
      }
    } else {
      console.log(chalk.yellow('Unexpected response:'), response);
    }

    client.close();
    
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
