// Minimal test version for Railway debugging
const express = require('express');
const app = express();

console.log('Starting application...');

// Basic middleware
app.use(express.text({ type: '*/*' }));

// Test endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    message: 'Test proxy is working',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3001,
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

app.get('/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({ status: 'ok', message: 'Health check passed' });
});

// Simple translation test (without Claude for now)
app.post('/translate', (req, res) => {
  console.log('Translate endpoint hit with:', req.body);
  res.send(`TEST TRANSLATION: ${req.body}`);
});

const PORT = process.env.PORT || 3001;

console.log(`Attempting to start server on port ${PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully started on port ${PORT}`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('Script execution completed');