// Rate-limited Claude translation proxy for Railway
const express = require('express');
const app = express();

console.log('Starting Rate-Limited Claude Translation Proxy...');

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

// Rate limiting configuration for Claude API (5 requests per minute)
class RateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestTimes = [];
    this.maxRequestsPerMinute = 4; // Conservative: 4 per minute to stay under 5
  }

  async addToQueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Clean old request times (older than 1 minute)
      const oneMinuteAgo = Date.now() - 60000;
      this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);

      // Check if we can make a request
      if (this.requestTimes.length >= this.maxRequestsPerMinute) {
        const oldestRequest = Math.min(...this.requestTimes);
        const waitTime = 60000 - (Date.now() - oldestRequest) + 1000; // +1s buffer
        console.log(`⏳ Rate limit: waiting ${Math.round(waitTime/1000)}s before next request`);
        await this.sleep(waitTime);
        continue;
      }

      // Process next request
      const { requestFn, resolve, reject } = this.queue.shift();
      
      try {
        console.log(`📤 Processing request (${this.requestTimes.length + 1}/${this.maxRequestsPerMinute} this minute)`);
        this.requestTimes.push(Date.now());
        const result = await requestFn();
        resolve(result);
        
        // Small delay between requests to be extra safe
        await this.sleep(2000);
        
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      recentRequests: this.requestTimes.length,
      maxPerMinute: this.maxRequestsPerMinute,
      processing: this.processing
    };
  }
}

const rateLimiter = new RateLimiter();

// Root endpoint 
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok',
    service: 'ego-translation-proxy-rate-limited',
    message: 'Rate-Limited Claude Translation Proxy is running',
    port: PORT,
    maxTokens: 8000,
    rateLimit: '4 requests per minute',
    queueStatus: rateLimiter.getQueueStatus(),
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
    queueStatus: rateLimiter.getQueueStatus()
  });
});

// Queue status endpoint for debugging
app.get('/queue-status', (req, res) => {
  res.json(rateLimiter.getQueueStatus());
});

// Rough token estimation
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Rate-limited Claude translation endpoint
app.post('/translate', async (req, res) => {
  console.log('Translation request received - adding to queue');
  
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

    const inputTokens = estimateTokens(textToTranslate);
    console.log(`📝 Queuing translation: ${textToTranslate.length} chars (~${inputTokens} tokens)`);
    console.log(`📊 Queue status: ${rateLimiter.getQueueStatus().queueLength} waiting, ${rateLimiter.getQueueStatus().recentRequests}/4 used this minute`);

    // Add to rate-limited queue
    const translatedText = await rateLimiter.addToQueue(async () => {
      console.log(`🔄 Starting translation: "${textToTranslate.substring(0, 80)}..."`);
      
      const axios = require('axios');

      // Your exact original prompt
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
      
      // Call Claude API
      const claudeResponse = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
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
        timeout: 120000 // 2 minute timeout for queued requests
      });

      return claudeResponse.data.content[0].text.trim();
    });

    const outputTokens = estimateTokens(translatedText);
    console.log(`✅ Translation completed: ${translatedText.length} chars (~${outputTokens} tokens)`);
    console.log(`📤 Result preview: "${translatedText.substring(0, 80)}..."`);
    
    res.send(translatedText);
    
  } catch (error) {
    console.error('Translation error:', {
      message: error.message,
      status: error.response?.status,
      type: error.response?.data?.error?.type
    });
    
    // Better error handling for rate limits
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limit hit despite queuing - implementing longer delay');
    }
    
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

console.log(`Starting server on port ${PORT} with rate limiting (4 req/min)`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Rate-Limited Claude Translation Proxy started on port ${PORT}`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`🔑 Claude API Key: ${process.env.CLAUDE_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`📊 Max tokens: 8000, Rate limit: 4 requests per minute`);
  console.log(`⏳ Requests will be queued to respect Claude's rate limits`);
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