import chalk from 'chalk';

/**
 * Register command - obtain a token for an agent ID
 */
export async function registerCommand(agentId, options) {
  let relay = options.relay || 'ws://localhost:8080/arc';
  
  // Auto-add protocol if missing
  if (!relay.startsWith('ws://') && !relay.startsWith('wss://') && 
      !relay.startsWith('http://') && !relay.startsWith('https://')) {
    relay = `wss://${relay}/arc`;
  }
  
  // Convert ws:// to http:// for registration endpoint
  const wsUrl = new URL(relay);
  const protocol = wsUrl.protocol === 'wss:' ? 'https:' : 'http:';
  const port = wsUrl.port || (wsUrl.protocol === 'wss:' ? '443' : '80');
  const registerUrl = `${protocol}//${wsUrl.hostname}:${port}/register`;

  try {
    console.log(chalk.dim(`Registering with ${registerUrl}...`));
    console.log();

    const body = agentId ? JSON.stringify({ agent_id: agentId }) : '{}';

    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(chalk.red('Registration failed:'));
      console.error(chalk.red(`  ${data.error}: ${data.message}`));
      process.exit(1);
    }

    console.log(chalk.green('✓ Registration successful\n'));
    console.log(chalk.bold('Your credentials:'));
    console.log(`  ${chalk.cyan('Agent ID:')} ${data.agent_id}`);
    console.log(`  ${chalk.cyan('Token:')} ${data.token}`);
    console.log();
    console.log(chalk.dim('Save your token! Set it as an environment variable:'));
    console.log(chalk.dim(`  export ARC_TOKEN=${data.token}`));
    console.log();
    console.log(chalk.dim('Or use with --token flag:'));
    console.log(chalk.dim(`  arc ping --token ${data.token}`));

  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
