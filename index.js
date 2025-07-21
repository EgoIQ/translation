// Working Railway translation proxy - built on successful minimal version
const express = require('express');
const app = express();

console.log('Starting translation proxy...');

// Middleware
app.use(express.text({ type: '*/*' }));
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Root endpoint (working)
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    service: 'ego-translation-proxy',
    message: 'Claude Translation Proxy is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3001,
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

// Health endpoint (working)
app.get('/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({ 
    status: 'ok', 
    message: 'Health check passed',
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

// Translation endpoint with better error handling
app.post('/translate', async (req, res) => {
  console.log('Translation request received');
  
  try {
    const textToTranslate = req.body;
    
    // Validate input
    if (!textToTranslate || textToTranslate.trim() === '') {
      console.log('Empty text received, returning as-is');
      return res.send(textToTranslate || '');
    }

    // Check API key
    if (!process.env.CLAUDE_API_KEY) {
      console.error('No Claude API key found');
      return res.status(200).send(textToTranslate); // Fallback: return original
    }

    console.log(`Translating: "${textToTranslate.substring(0, 50)}..."`);

    // Import axios only when needed (avoid startup issues)
    const axios = require('axios');

    // Your translation prompt
    const prompt = `Translate the following English text to grammatically perfect Finnish, preserving all markdown formatting (e.g. ## headers, \\n line breaks, **bold**, lists - etc). 

CRITICAL RULES:
- Do NOT translate code, slugs, markdown syntax, URLs, or HTML
- Preserve ALL formatting exactly as shown
- Use the English text for context before re-writing
- Write as if you were a Finnish native speaker
- For business content: Use professional tone suitable for Finnish B2B market
- Maintain SEO-friendly language for Finnish searches

English text:
${textToTranslate}

Finnish translation:`;
    
    // Call Claude API with timeout and error handling
    const claudeResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000 // 30 second timeout
    });

    // Extract translation
    const translatedText = claudeResponse.data.content[0].text.trim();
    
    console.log(`Translation successful: "${translatedText.substring(0, 50)}..."`);
    
    res.send(translatedText);
    
  } catch (error) {
    console.error('Translation error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Graceful fallback: return original text
    console.log('Falling back to original text');
    res.status(200).send(req.body || 'Translation failed');
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error.message);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: error.message 
  });
});

const PORT = process.env.PORT || 3001;

console.log(`Attempting to start server on port ${PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Claude Translation Proxy successfully started on port ${PORT}`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔑 Claude API Key: ${process.env.CLAUDE_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

console.log('Script execution completed');

module.exports = app;