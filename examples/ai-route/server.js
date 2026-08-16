import express from 'express';

const app = express();
app.use(express.json());

const CAP_API_KEY = process.env.CAP_API_KEY;
const CAP_BASE_URL = 'https://cap-alpha-one.vercel.app';

app.post('/chat', async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message required' });
  }

  if (!CAP_API_KEY) {
    return res.status(500).json({ error: 'CAP_API_KEY not configured' });
  }

  try {
    const response = await fetch(`${CAP_BASE_URL}/v1/consume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CAP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        units: 1,
        idempotencyKey: `${userId}-${Date.now()}`
      })
    });

    const gate = await response.json();

    if (!gate.ok) {
      return res.status(402).json({
        error: 'Daily limit exceeded',
        reason: gate.reason,
        remaining: gate.remaining
      });
    }

    return res.json({
      reply: 'ok',
      remaining: gate.remaining
    });

  } catch (error) {
    console.error('Cap API error:', error);
    return res.status(502).json({ error: 'Failed to check spend cap' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI route example running on http://localhost:${PORT}`);
  console.log(`Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"userId":"user_123","message":"hello"}'`);
});
