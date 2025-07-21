// Enhanced Claude translation proxy with better token handling
const express = require('express');
const app = express();

console.log('Starting Enhanced Claude Translation Proxy...');

// Middleware
app.use(express.text({ type: '*/*' }));
app.use(express.json());

// CORS for production
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Root endpoint 
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    service: 'ego-translation-proxy-enhanced',
    message: 'Enhanced Claude Translation Proxy is running',
    port: PORT,
    maxTokens: 8000,
    timestamp: new Date().toISOString(),
    hasClaudeKey: !!process.env.CLAUDE_API_KEY
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({ 
    status: 'ok', 
    message: 'Health check passed',
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    maxTokens: 8000
  });
});

// Rough token estimation (1 token ≈ 4 characters for most text)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Enhanced Claude translation endpoint
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
      return res.status(200).send(textToTranslate);
    }

    // Estimate token usage
    const inputTokens = estimateTokens(textToTranslate);
    const promptTokens = estimateTokens('Translate the following English text...'); // Rough estimate
    const totalInputTokens = inputTokens + promptTokens;
    
    console.log(`Text length: ${textToTranslate.length} chars`);
    console.log(`Estimated input tokens: ~${totalInputTokens}`);
    console.log(`Translating: "${textToTranslate.substring(0, 100)}..."`);

    // Warn if text is very long
    if (totalInputTokens > 6000) {
      console.warn(`⚠️  Large text detected (${totalInputTokens} tokens). Translation may be truncated.`);
    }

    // Import axios for Claude API call
    const axios = require('axios');

    // Your exact original prompt for English → Finnish
    const prompt = `Translate the following English text to grammatically perfect Finnish, preserving all markdown formatting (e.g. ## headers, \\n line breaks, **bold**, lists - etc). 

CRITICAL RULES:
- Do NOT translate code, slugs, markdown syntax, URLs, or HTML
- Preserve ALL formatting exactly as shown
- Use the English text for context before re-writing
- Write as if you were a Finnish native speaker
- For business content: Use professional tone suitable for Finnish B2B market
- Maintain SEO-friendly language for Finnish searches
- IMPORTANT: Translate the COMPLETE text, do not truncate or summarize

English text:
${textToTranslate}

Finnish translation:`;
    
    // Call Claude API with increased token limit
    const claudeResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000, // Increased from 2000 to handle long articles
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
      timeout: 60000 // Increased timeout for long content
    });

    // Extract translation
    const translatedText = claudeResponse.data.content[0].text.trim();
    const outputTokens = estimateTokens(translatedText);
    
    console.log(`Translation successful: "${translatedText.substring(0, 100)}..."`);
    console.log(`Output length: ${translatedText.length} chars (~${outputTokens} tokens)`);
    
    // Check if translation might be truncated
    if (outputTokens >= 7500) {
      console.warn('⚠️  Output near token limit - translation may be truncated');
    }
    
    // Basic completeness check
    const inputLines = textToTranslate.split('\n').length;
    const outputLines = translatedText.split('\n').length;
    if (Math.abs(inputLines - outputLines) > 5) {
      console.warn(`⚠️  Line count mismatch: Input ${inputLines} lines, Output ${outputLines} lines`);
    }
    
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

// Use port 3000 to match Railway configuration
const PORT = 3000;

console.log(`Starting server on port ${PORT} with 8000 max tokens`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Enhanced Claude Translation Proxy started on port ${PORT}`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`🔑 Claude API Key: ${process.env.CLAUDE_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`📊 Max tokens: 8000 (4x increase for long content)`);
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