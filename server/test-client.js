import WebSocket from 'ws';

const RELAY_URL = 'ws://localhost:8080/arc';

async function testRelay() {
  console.log('🧪 Testing ARC Relay...\n');

  // Create two agents
  const agent1 = new WebSocket(`${RELAY_URL}?token=agent-test-1`);
  const agent2 = new WebSocket(`${RELAY_URL}?token=agent-test-2`);

  // Agent 1 setup
  agent1.on('open', () => {
    console.log('✅ Agent 1 connected');
  });

  agent1.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log(`📨 Agent 1 received: ${msg.type || 'message'}`);
    if (msg.type === 'welcome') {
      console.log(`   Relay: ${msg.payload.relay}`);
      console.log(`   Version: ${msg.payload.version}`);
      console.log();
    } else {
      console.log(`   From: ${msg.from}`);
      console.log(`   Payload: ${JSON.stringify(msg.payload)}`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   TS: ${msg.ts}`);
      console.log();
    }
  });

  // Agent 2 setup
  agent2.on('open', () => {
    console.log('✅ Agent 2 connected\n');
    
    // Wait a bit for welcome, then send a broadcast
    setTimeout(() => {
      console.log('📤 Agent 2 sending broadcast...\n');
      agent2.send(JSON.stringify({
        from: 'agent-test-2',
        to: ['*'],
        type: 'thought',
        payload: 'Hello from agent 2!'
      }));

      // Send another after delay
      setTimeout(() => {
        console.log('📤 Agent 2 sending another broadcast...\n');
        agent2.send(JSON.stringify({
          from: 'agent-test-2',
          to: ['*'],
          payload: { text: 'Structured payload test', count: 42 }
        }));

        // Close after final message
        setTimeout(() => {
          console.log('🔚 Closing connections...\n');
          agent1.close();
          agent2.close();
          setTimeout(() => process.exit(0), 500);
        }, 1000);
      }, 1000);
    }, 500);
  });

  agent2.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log(`📨 Agent 2 received: ${msg.type || 'message'}`);
    if (msg.type === 'welcome') {
      console.log(`   Connected as: ${msg.to[0]}`);
      console.log();
    }
  });

  agent1.on('error', (err) => console.error('Agent 1 error:', err));
  agent2.on('error', (err) => console.error('Agent 2 error:', err));
}

testRelay().catch(console.error);
