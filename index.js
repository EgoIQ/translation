// Fixed for Railway port 3000 configuration
const express = require('express');
const app = express();

console.log('Starting application...');

// Basic middleware
app.use(express.text({ type: '*/*' }));

// Root endpoint 
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    message: 'Translation proxy working on correct port',
    port: PORT,
    timestamp: new Date().toISOString(),
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({ 
    status: 'ok', 
    message: 'Health check passed',
    port: PORT
  });
});

// Simple translation test
app.post('/translate', (req, res) => {
  console.log('Translation request received:', req.body);
  res.send(`TEST FINNISH: ${req.body}`);
});

// Force port 3000 to match Railway configuration
const PORT = 3000;

console.log(`Starting server on port ${PORT} (Railway configured port)`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('Script execution completed');