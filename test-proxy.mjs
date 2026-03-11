import WebSocket from 'ws';

async function testREST() {
  console.log('Testing REST Proxy...');
  try {
    const res = await fetch('http://localhost:5173/mmt-api/api/v1/usage', {
      headers: { 'X-API-Key': 'dummy_key' }
    });
    console.log(`REST Response Status: ${res.status}`);
    const text = await res.text();
    console.log(`REST Response Body: ${text}`);
    if (res.status === 401 || res.status === 200) {
      console.log('✅ REST Proxy routed successfully to MMT.');
    } else {
      console.log('❌ REST Proxy returned unexpected status.');
    }
  } catch (err) {
    console.error('REST Error:', err.message);
  }
}

async function testWebSocket() {
  console.log('\nTesting WebSocket Proxy...');
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:5173/mmt-ws/api/v1/ws?api_key=dummy_key');
    
    ws.on('open', () => {
      console.log('WS Connection Opened (proxy working)!');
      ws.close();
      console.log('✅ WebSocket Proxy routed successfully to MMT.');
      resolve();
    });

    ws.on('error', (err) => {
      console.error('WS Error:', err.message);
      resolve();
    });

    ws.on('unexpected-response', (req, res) => {
      console.log(`WS Unexpected Response Status: ${res.statusCode}`);
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.log('✅ WebSocket Proxy routed successfully to MMT (Got expected auth rejection for dummy key).');
      } else {
        console.log('❌ WebSocket Proxy returned unexpected status.');
      }
      resolve();
    });
  });
}

(async () => {
  await testREST();
  await testWebSocket();
})();
