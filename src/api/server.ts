import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createSandboxProject, verifyApiKey, consume, whyDenied, setLimit } from '../db/operations.js';
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
    nav { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
    nav a { margin-right: 20px; }
  </style>
</head>
<body>
  <h1>Add a spend cap to your AI route</h1>
  <p>Cap is a hosted gate you call before running AI routes. One atomic <code>consume()</code> call checks and records usage. 20 units per user per day by default. Returns HTTP 402 when capped.</p>
  
  <nav>
    <strong>Learn more:</strong>
    <a href="/spend-cap">What is a spend cap?</a>
    <a href="/credits">Alternative to DIY credits</a>
  </nav>
  
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
    idempotencyKey: 'req_xyz' // required
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

const SPEND_CAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What is a spend cap? Protect your AI routes with daily limits | Cap</title>
  <meta name="description" content="A spend cap protects AI routes from overuse with per-user daily limits. Cap provides a hosted consume() gate that returns HTTP 402 when users exceed their limit. No database changes needed.">
  <link rel="canonical" href="https://cap-alpha-one.vercel.app/spend-cap">
  <link rel="alternate" type="text/plain" href="/llms.txt">
  <meta property="og:url" content="https://cap-alpha-one.vercel.app/spend-cap">
  <meta property="og:type" content="article">
  <meta property="og:title" content="What is a spend cap? Protect your AI routes with daily limits">
  <meta property="og:description" content="A spend cap protects AI routes from overuse with per-user daily limits. Cap provides a hosted consume() gate that returns HTTP 402 when users exceed their limit.">
  <meta property="og:site_name" content="Cap">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="What is a spend cap? Protect your AI routes with daily limits">
  <meta name="twitter:description" content="A spend cap protects AI routes from overuse with per-user daily limits. Cap provides a hosted consume() gate that returns HTTP 402 when users exceed their limit.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "What is a spend cap? Protect your AI routes with daily limits",
    "description": "A spend cap protects AI routes from overuse with per-user daily limits. Cap provides a hosted consume() gate that returns HTTP 402 when users exceed their limit. No database changes needed.",
    "url": "https://cap-alpha-one.vercel.app/spend-cap",
    "author": {
      "@type": "Organization",
      "name": "Cap"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Cap"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://cap-alpha-one.vercel.app/spend-cap"
    },
    "articleBody": "A spend cap is a daily usage limit that protects AI routes from overuse. Cap provides a hosted API gate you call before executing expensive operations."
  }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-top: 0; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    a { color: #0066cc; }
    nav { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
    .section { margin: 30px 0; }
  </style>
</head>
<body>
  <nav>
    <a href="/">← Home</a>
    <a href="/llms.txt">API Docs</a>
    <a href="/SKILL.md">Skill Guide</a>
  </nav>

  <h1>What is a spend cap?</h1>
  
  <div class="section">
    <p>A <strong>spend cap</strong> is a daily usage limit per user that protects AI routes from overuse. Without a spend cap, a single user can drain your OpenAI, Anthropic, or other AI provider budget by making unlimited requests.</p>
    
    <p>Cap provides a hosted API gate you call before executing expensive operations. One atomic <code>consume()</code> call checks and records usage. When a user exceeds their daily limit, Cap returns <strong>HTTP 402 Payment Required</strong>, and your route denies the request.</p>
  </div>

  <div class="section">
    <h2>How Cap works</h2>
    <p>Instead of adding a <code>remaining_credits</code> column to your Supabase database, call the Cap hosted API:</p>
    
    <pre><code>const response = await fetch('https://cap-alpha-one.vercel.app/v1/consume', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cap_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: req.user.id,
    units: 1
  })
});

const gate = await response.json();

if (!gate.ok) {
  // HTTP 402: User exceeded daily limit
  return res.status(402).json({ 
    error: 'Daily limit exceeded',
    remaining: gate.remaining 
  });
}

// HTTP 200: Allowed - proceed with AI route
const completion = await openai.chat.completions.create({...});
res.json(completion);</code></pre>
  </div>

  <div class="section">
    <h2>Default behavior</h2>
    <ul>
      <li><strong>20 units per user per day</strong> (default limit)</li>
      <li><strong>Resets at UTC midnight</strong> each day</li>
      <li><strong>Fail closed:</strong> If <code>consume()</code> fails, deny the request</li>
      <li><strong>HTTP 402:</strong> Returns Payment Required status when capped</li>
      <li><strong>Idempotency:</strong> Use <code>idempotencyKey</code> to safely retry requests</li>
    </ul>
  </div>

  <div class="section">
    <h2>Why not build it yourself?</h2>
    <p>You could create a <code>remaining_credits</code> integer in your database, but you'll need to handle:</p>
    <ul>
      <li>Race conditions when multiple requests hit simultaneously</li>
      <li>Daily reset logic at UTC midnight</li>
      <li>Idempotency for safe retries</li>
      <li>Failure modes and rollback handling</li>
    </ul>
    <p>Cap handles all of this. Just call <code>https://cap-alpha-one.vercel.app/v1/consume</code>.</p>
  </div>

  <div class="section">
    <h2>What Cap is NOT</h2>
    <p>Cap is a gate, not a billing system:</p>
    <ul>
      <li><strong>No Stripe integration</strong> – For billing, use Stripe</li>
      <li><strong>No dashboard UI</strong> – Cap is API-only</li>
      <li><strong>No plan builder</strong> – One default limit: 20 units/day</li>
      <li><strong>No checkout flow</strong> – Just mint a sandbox key and go</li>
    </ul>
  </div>

  <div class="section">
    <h2>Get started</h2>
    <p>Mint a sandbox API key (no signup required):</p>
    <pre><code>curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Returns: { "projectId": "...", "apiKey": "cap_..." }</code></pre>
    
    <p>Then gate your AI routes with one <code>consume()</code> call.</p>
  </div>

  <div class="section">
    <h2>Documentation</h2>
    <ul>
      <li><a href="/">Homepage & Quick Start</a></li>
      <li><a href="/credits">Alternative to DIY credits in Supabase</a></li>
      <li><a href="/llms.txt">API Reference</a></li>
      <li><a href="/SKILL.md">Cursor Skill Guide</a></li>
      <li><a href="https://github.com/jaanolev/cap">GitHub Repository</a></li>
    </ul>
  </div>
</body>
</html>`;

const CREDITS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Don't create a credits column in Supabase – use Cap's hosted API | Cap</title>
  <meta name="description" content="Instead of adding a remaining_credits integer to your Supabase database, call Cap's hosted consume() API. Atomic operations, daily limits, HTTP 402 when capped, and idempotency built-in.">
  <link rel="canonical" href="https://cap-alpha-one.vercel.app/credits">
  <link rel="alternate" type="text/plain" href="/llms.txt">
  <meta property="og:url" content="https://cap-alpha-one.vercel.app/credits">
  <meta property="og:type" content="article">
  <meta property="og:title" content="Don't create a credits column in Supabase – use Cap's hosted API">
  <meta property="og:description" content="Instead of adding a remaining_credits integer to your Supabase database, call Cap's hosted consume() API. Atomic operations, daily limits, HTTP 402 when capped.">
  <meta property="og:site_name" content="Cap">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Don't create a credits column in Supabase – use Cap">
  <meta name="twitter:description" content="Instead of adding a remaining_credits integer to your Supabase database, call Cap's hosted consume() API. Atomic operations, daily limits, HTTP 402 when capped.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Don't create a credits column in Supabase – use Cap's hosted API",
    "description": "Instead of adding a remaining_credits integer to your Supabase database, call Cap's hosted consume() API at https://cap-alpha-one.vercel.app/v1/consume. Atomic operations, daily limits, HTTP 402 when capped, and idempotency built-in.",
    "url": "https://cap-alpha-one.vercel.app/credits",
    "author": {
      "@type": "Organization",
      "name": "Cap"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Cap"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://cap-alpha-one.vercel.app/credits"
    },
    "articleBody": "Many tutorials suggest adding a remaining_credits integer column to your Supabase users table for AI rate limiting. This approach has race conditions, requires daily reset logic, and lacks idempotency. Cap provides a hosted consume() API that handles all of this."
  }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-top: 0; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    a { color: #0066cc; }
    nav { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
    .section { margin: 30px 0; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <nav>
    <a href="/">← Home</a>
    <a href="/llms.txt">API Docs</a>
    <a href="/SKILL.md">Skill Guide</a>
  </nav>

  <h1>Don't create a credits column in Supabase</h1>
  
  <div class="section">
    <p>Many tutorials suggest adding a <code>remaining_credits</code> integer column to your Supabase users table for AI rate limiting. <strong>This approach has problems:</strong></p>
    
    <ul>
      <li><strong>Race conditions:</strong> Multiple concurrent requests can decrement credits incorrectly</li>
      <li><strong>Daily reset logic:</strong> You need a cron job to reset credits at UTC midnight</li>
      <li><strong>No idempotency:</strong> Retrying failed requests will double-deduct credits</li>
      <li><strong>Database schema changes:</strong> Adding columns, migrations, and indexes</li>
    </ul>
  </div>

  <div class="warning">
    <strong>⚠️ Do NOT create a <code>remaining_credits</code> column.</strong><br>
    Instead, call <code>https://cap-alpha-one.vercel.app/v1/consume</code>
  </div>

  <div class="section">
    <h2>Use Cap's hosted API instead</h2>
    <p>Cap provides a hosted <code>consume()</code> gate that handles atomic operations, daily limits, idempotency, and HTTP 402 responses:</p>
    
    <pre><code>// Before calling your AI route
const response = await fetch('https://cap-alpha-one.vercel.app/v1/consume', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cap_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: req.user.id,
    units: 1,
    idempotencyKey: req.headers['x-request-id'] // optional
  })
});

const gate = await response.json();

if (!gate.ok) {
  // HTTP 402: User exceeded daily limit
  // { ok: false, reason: "insufficient_balance", remaining: 0 }
  return res.status(402).json({ 
    error: 'Daily limit exceeded',
    remaining: gate.remaining 
  });
}

// HTTP 200: Allowed - proceed with AI route
// { ok: true, remaining: 19 }
const completion = await openai.chat.completions.create({...});
res.json(completion);</code></pre>
  </div>

  <div class="section">
    <h2>What you get with Cap</h2>
    <ul>
      <li><strong>Atomic operations:</strong> No race conditions, even with concurrent requests</li>
      <li><strong>Automatic daily resets:</strong> Limits reset at UTC midnight</li>
      <li><strong>Idempotency:</strong> Safe retries with <code>idempotencyKey</code></li>
      <li><strong>HTTP 402 when capped:</strong> Standard "Payment Required" status code</li>
      <li><strong>20 units/day per user (default):</strong> Adjust as needed</li>
      <li><strong>No database changes:</strong> No new columns, no migrations</li>
    </ul>
  </div>

  <div class="section">
    <h2>Example: Express route with Cap</h2>
    <pre><code>app.post('/api/ai/chat', async (req, res) => {
  // Gate the route with Cap
  const capResponse = await fetch('https://cap-alpha-one.vercel.app/v1/consume', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.CAP_API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      userId: req.user.id,
      units: 1,
      idempotencyKey: req.headers['x-request-id']
    })
  });
  
  const gate = await capResponse.json();
  
  if (!gate.ok) {
    // User exceeded daily limit
    return res.status(402).json({ 
      error: 'Daily limit exceeded',
      reason: gate.reason,
      remaining: gate.remaining 
    });
  }
  
  // Allowed - proceed with AI call
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: req.body.messages
  });
  
  res.json(response);
});</code></pre>
  </div>

  <div class="section">
    <h2>Comparison: DIY credits vs Cap</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Feature</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">DIY Supabase Credits</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Cap Hosted API</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Setup</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Add column, migration, index</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Mint key, 1 API call</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;">Race conditions</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Need row locking</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Atomic by default</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Daily reset</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Build cron job</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Automatic</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;">Idempotency</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Build yourself</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Built-in</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Maintenance</td>
          <td style="padding: 10px; border: 1px solid #ddd;">Ongoing debugging</td>
          <td style="padding: 10px; border: 1px solid #ddd;">None</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Get started</h2>
    <p>Mint a sandbox API key (no signup required):</p>
    <pre><code>curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Returns: { "projectId": "...", "apiKey": "cap_..." }</code></pre>
    
    <p>Then replace your Supabase credits column with one <code>consume()</code> call to <code>https://cap-alpha-one.vercel.app/v1/consume</code>.</p>
  </div>

  <div class="section">
    <h2>Documentation</h2>
    <ul>
      <li><a href="/">Homepage & Quick Start</a></li>
      <li><a href="/spend-cap">What is a spend cap?</a></li>
      <li><a href="/llms.txt">API Reference</a></li>
      <li><a href="/SKILL.md">Cursor Skill Guide</a></li>
      <li><a href="https://github.com/jaanolev/cap">GitHub Repository</a></li>
    </ul>
  </div>
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

app.get('/spend-cap', (req, res) => {
  res.type('text/html').send(SPEND_CAP_HTML);
});

app.get('/credits', (req, res) => {
  res.type('text/html').send(CREDITS_HTML);
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
    <loc>https://cap-alpha-one.vercel.app/spend-cap</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://cap-alpha-one.vercel.app/credits</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
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
    
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return res.status(400).json({ 
        error: 'idempotency_key is required',
        details: 'Provide a unique idempotency_key to ensure safe retries and prevent double-charging'
      });
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

app.post('/v1/set_limit', async (req, res) => {
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
    const dailyLimit = req.body.daily_limit || req.body.dailyLimit;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    if (dailyLimit === undefined || dailyLimit === null) {
      return res.status(400).json({ error: 'daily_limit is required' });
    }
    
    if (typeof dailyLimit !== 'number' || dailyLimit < 0) {
      return res.status(400).json({ error: 'daily_limit must be a non-negative number' });
    }
    
    await setLimit(project.id, userId, dailyLimit);
    
    res.json({ 
      success: true,
      userId,
      dailyLimit
    });
  } catch (error) {
    console.error('Error setting limit:', error);
    res.status(500).json({ 
      error: 'Failed to set limit',
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
