const WebSocket = require('ws');

console.log('Testing WebSocket connection to ws://localhost:3001/ws');

const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connection opened successfully');
  
  // Test sending a message
  ws.send(JSON.stringify({
    type: 'test',
    message: 'Hello WebSocket!'
  }));
});

ws.on('message', function message(data) {
  console.log('📨 Received message:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
  process.exit(0);
});

// Close after 5 seconds
setTimeout(() => {
  console.log('⏰ Closing connection after 5 seconds');
  ws.close();
}, 5000); 