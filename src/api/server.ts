import express from 'express';
import { createSandboxProject, verifyApiKey, consume, whyDenied } from '../db/operations.js';

const app = express();
app.use(express.json());

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
    
    const { user_id, units = 1, idempotency_key } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await consume(project.id, user_id, units, idempotency_key);
    res.json(result);
  } catch (error) {
    console.error('Error consuming:', error);
    res.status(500).json({ error: 'Failed to consume' });
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
    
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await whyDenied(project.id, user_id);
    res.json(result);
  } catch (error) {
    console.error('Error getting denial reason:', error);
    res.status(500).json({ error: 'Failed to get denial reason' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cap API running on port ${PORT}`);
});
