// Go back to the minimal version that was working
const express = require('express');
const app = express();

console.log('Starting minimal working application...');

// Basic middleware
app.use(express.text({ type: '*/*' }));

// Test endpoint that was working
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    message: 'Minimal proxy is working',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3001,
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

app.get('/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({ status: 'ok', message: 'Health check passed' });
});

// Simple test translation (no Claude API yet)
app.post('/translate', (req, res) => {
  console.log('Translate endpoint hit with body:', req.body);
  console.log('Body type:', typeof req.body);
  console.log('Body length:', req.body ? req.body.length : 'undefined');
  
  try {
    const input = req.body || 'empty';
    const testResponse = `TEST FINNISH: ${input}`;
    console.log('Sending response:', testResponse);
    res.send(testResponse);
  } catch (error) {
    console.error('Error in translate endpoint:', error);
    res.status(500).send('Error in translate endpoint');
  }
});

const PORT = process.env.PORT || 3001;

console.log(`Attempting to start server on port ${PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal server successfully started on port ${PORT}`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('Script execution completed');