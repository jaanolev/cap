import express from 'express';
import { createSandboxProject, verifyApiKey, consume, whyDenied } from '../db/operations.js';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Cap API',
    docs: '/llms.txt',
    health: '/health'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
