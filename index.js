// Port debugging version for Railway
const express = require('express');
const app = express();

console.log('=== PORT DEBUGGING ===');
console.log('process.env.PORT:', process.env.PORT);
console.log('Available env vars:');
Object.keys(process.env).forEach(key => {
  if (key.includes('PORT') || key.includes('HOST')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});
console.log('======================');

// Basic middleware
app.use(express.text({ type: '*/*' }));

// Root endpoint 
app.get('/', (req, res) => {
  console.log('=== REQUEST RECEIVED ===');
  console.log('Request to root endpoint');
  console.log('Request headers:', req.headers);
  console.log('=======================');
  
  res.json({ 
    status: 'ok',
    message: 'Port debug version working',
    serverPort: process.env.PORT || 'undefined',
    listeningPort: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({ 
    status: 'ok', 
    message: 'Health check passed',
    port: process.env.PORT || 'undefined'
  });
});

// Use Railway's PORT exactly as provided
const PORT = process.env.PORT || 3001;

console.log(`Railway provided PORT: ${process.env.PORT}`);
console.log(`Using PORT: ${PORT}`);
console.log(`Attempting to start server on port ${PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started successfully`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`📍 Railway PORT env var: ${process.env.PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  console.error('Error code:', error.code);
  console.error('Error address:', error.address);
  console.error('Error port:', error.port);
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`🎯 Server actually listening on ${addr.address}:${addr.port}`);
});

console.log('Script execution completed');