import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createSandboxProject, verifyApiKey, consume, whyDenied } from '../db/operations.js';
import { LLMS_TXT, LLMS_FULL_TXT, SKILL_MD } from '../docs/content.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..');

const app = express();
app.use(express.json());

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add a spend cap to your AI route</title>
  <meta name="description" content="Cap is a hosted consume() gate that protects AI routes with daily limits. 20 units per user per day by default. Returns HTTP 402 when capped. No signup, no Stripe, no dashboard.">
  <link rel="canonical" href="https://cap-alpha-one.vercel.app">
  <link rel="alternate" type="text/plain" href="/llms.txt">
  <meta property="og:url" content="https://cap-alpha-one.vercel.app">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Add a spend cap to your AI route">
  <meta property="og:description" content="Cap is a hosted consume() gate that protects AI routes with daily limits. 20 units per user per day by default. Returns HTTP 402 when capped.">
  <meta property="og:site_name" content="Cap">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Add a spend cap to your AI route">
  <meta name="twitter:description" content="Cap is a hosted consume() gate that protects AI routes with daily limits. 20 units per user per day by default. Returns HTTP 402 when capped.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Cap",
    "url": "https://cap-alpha-one.vercel.app",
    "description": "Cap is a hosted consume() gate that protects AI routes with daily limits. 20 units per user per day by default. Returns HTTP 402 when capped. No signup, no Stripe, no dashboard.",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "Daily usage limits per user",
      "Atomic consume() operation",
      "HTTP 402 when capped",
      "Idempotency for safe retries",
      "No signup required",
      "Sandbox API keys"
    ],
    "codeRepository": "https://github.com/jaanolev/cap"
  }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-top: 0; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Add a spend cap to your AI route</h1>
  <p>Cap is a hosted gate you call before running AI routes. One atomic <code>consume()</code> call checks and records usage. 20 units per user per day by default. Returns HTTP 402 when capped.</p>
  
  <h2>Quick Start</h2>
  <p>1. Mint a sandbox API key (no signup):</p>
  <pre><code>curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Returns: { "projectId": "...", "apiKey": "cap_..." }</code></pre>

  <p>2. Consume units in your route:</p>
  <pre><code>const response = await fetch('https://cap-alpha-one.vercel.app/v1/consume', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cap_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_123',
    units: 1,
    idempotencyKey: 'req_xyz' // optional
  })
});

const gate = await response.json();

if (!gate.ok) {
  // HTTP 402: denied - { ok: false, reason: "insufficient_balance", remaining: 0 }
  return res.status(402).json({ error: 'Daily limit exceeded' });
}

// HTTP 200: allowed - { ok: true, remaining: 19 }
// Proceed with AI route</code></pre>

  <h2>Documentation</h2>
  <ul>
    <li><a href="/llms.txt">API Reference (llms.txt)</a></li>
    <li><a href="/llms-full.txt">Full Documentation (llms-full.txt)</a></li>
    <li><a href="/SKILL.md">Cursor Skill Guide</a></li>
    <li><a href="https://github.com/jaanolev/cap">GitHub Repository</a></li>
  </ul>

  <h2>How It Works</h2>
  <ul>
    <li><strong>Daily Limits:</strong> 20 units/day per user (default). Resets at UTC midnight.</li>
    <li><strong>Fail Closed:</strong> If consume() fails, deny the request.</li>
    <li><strong>Idempotency:</strong> Use idempotencyKey to safely retry.</li>
    <li><strong>No Billing:</strong> Cap is a gate, not a billing system. For billing, use Stripe.</li>
  </ul>
</body>
</html>`;

app.get('/', (req, res) => {
  const acceptHeader = req.headers.accept || '';
  const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html');
  const wantsMarkdown = acceptHeader.includes('text/markdown');
  
  if (wantsMarkdown) {
    res.type('text/markdown; charset=utf-8').send(LLMS_TXT);
  } else if (wantsJson) {
    res.json({
      name: 'Cap',
      docs: 'https://cap-alpha-one.vercel.app/llms.txt',
      skill: 'https://cap-alpha-one.vercel.app/SKILL.md',
      health: 'https://cap-alpha-one.vercel.app/health'
    });
  } else {
    res.type('text/html').send(LANDING_HTML);
  }
});

app.get('/index.html', (req, res) => {
  res.type('text/html').send(LANDING_HTML);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/llms.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').send(LLMS_TXT);
});

app.get('/llms-full.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').send(LLMS_FULL_TXT);
});

app.get('/SKILL.md', (req, res) => {
  res.type('text/markdown; charset=utf-8').send(SKILL_MD);
});

app.get('/.well-known/llms.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').send(LLMS_TXT);
});

app.get('/robots.txt', (req, res) => {
  const robotsTxt = `# Cap - AI route spend cap gate
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: cohere-ai
Allow: /

# AI Content Signals
Sitemap: https://cap-alpha-one.vercel.app/sitemap.xml
`;
  res.type('text/plain; charset=utf-8').send(robotsTxt);
});

app.get('/sitemap.xml', (req, res) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cap-alpha-one.vercel.app/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cap-alpha-one.vercel.app/llms.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://cap-alpha-one.vercel.app/SKILL.md</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://cap-alpha-one.vercel.app/llms-full.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
  res.type('application/xml; charset=utf-8').send(sitemap);
});

app.get('/.well-known/agent-card.json', (req, res) => {
  res.json({
    name: 'Cap',
    description: 'Hosted spend cap gate for AI routes. 20 units per user per day by default. Returns HTTP 402 when capped.',
    url: 'https://cap-alpha-one.vercel.app',
    documentation: 'https://cap-alpha-one.vercel.app/llms.txt',
    repository: 'https://github.com/jaanolev/cap',
    capabilities: [
      'rate-limiting',
      'usage-tracking',
      'spend-caps',
      'daily-limits',
      'idempotency'
    ],
    endpoints: {
      base: 'https://cap-alpha-one.vercel.app',
      mint: '/v1/mint_sandbox_key',
      consume: '/v1/consume',
      why_denied: '/v1/why_denied'
    },
    mcp: {
      available: true,
      config_url: 'https://cap-alpha-one.vercel.app/mcp.json'
    }
  });
});

app.get('/mcp.json', (req, res) => {
  try {
    const mcpJsonPath = join(repoRoot, 'mcp.json');
    const mcpJson = readFileSync(mcpJsonPath, 'utf-8');
    const mcpData = JSON.parse(mcpJson);
    res.json(mcpData);
  } catch (error) {
    console.error('Error reading mcp.json:', error);
    res.status(500).json({ error: 'Failed to load MCP configuration' });
  }
});

app.post('/v1/mint_sandbox_key', async (req, res) => {
  try {
    const result = await createSandboxProject();
    res.json(result);
  } catch (error) {
    console.error('Error minting sandbox key:', error);
    res.status(500).json({ error: 'Failed to mint sandbox key' });
  }
});

app.post('/v1/consume', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    
    const apiKey = authHeader.substring(7);
    const project = await verifyApiKey(apiKey);
    
    if (!project) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const userId = req.body.user_id || req.body.userId;
    const units = req.body.units || 1;
    const idempotencyKey = req.body.idempotency_key || req.body.idempotencyKey;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await consume(project.id, userId, units, idempotencyKey);
    
    if (!result.ok) {
      return res.status(402).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error consuming:', error);
    res.status(500).json({ 
      error: 'Failed to consume',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/v1/why_denied', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    
    const apiKey = authHeader.substring(7);
    const project = await verifyApiKey(apiKey);
    
    if (!project) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const userId = req.body.user_id || req.body.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await whyDenied(project.id, userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting denial reason:', error);
    res.status(500).json({ 
      error: 'Failed to get denial reason',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

const PORT = process.env.PORT || 3000;

// Export the Express app for Vercel
export default app;

// Only start the server if running locally (not in Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Cap API running on port ${PORT}`);
  });
}
