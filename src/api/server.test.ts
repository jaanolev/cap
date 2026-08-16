import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Import the app (we'll need to refactor server.ts slightly to export just the app)
// For now, we'll test the content directly
describe('Landing Page', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Dynamically import the server module
    const serverModule = await import('./server.js');
    app = serverModule.default;
  });

  describe('GET /', () => {
    test('should return HTML when Accept header includes text/html', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('<title>Add a spend cap to your AI route</title>');
      expect(response.text).toContain('<h1>Add a spend cap to your AI route</h1>');
      expect(response.text).toContain('https://cap-alpha-one.vercel.app');
    });

    test('should return HTML when Accept header is missing', async () => {
      const response = await request(app)
        .get('/');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('<title>Add a spend cap to your AI route</title>');
    });

    test('should return JSON when Accept header is application/json', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        name: 'Cap',
        docs: 'https://cap-alpha-one.vercel.app/llms.txt',
        skill: 'https://cap-alpha-one.vercel.app/SKILL.md',
        health: 'https://cap-alpha-one.vercel.app/health'
      });
    });

    test('HTML should contain curl mint example', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key');
    });

    test('HTML should contain fetch consume example', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('fetch(\'https://cap-alpha-one.vercel.app/v1/consume\'');
      expect(response.text).toContain('userId');
      expect(response.text).toContain('units');
    });

    test('HTML should contain meta description with HTTP 402', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('<meta name="description"');
      expect(response.text).toContain('HTTP 402');
      expect(response.text).toContain('20 units');
    });

    test('HTML should contain canonical URL', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('<link rel="canonical" href="https://cap-alpha-one.vercel.app">');
    });

    test('HTML should contain robots-friendly llms.txt link', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('<link rel="alternate" type="text/plain" href="/llms.txt">');
    });

    test('HTML should link to documentation', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).toContain('/llms.txt');
      expect(response.text).toContain('/SKILL.md');
      expect(response.text).toContain('https://github.com/jaanolev/cap');
    });

    test('HTML should not mention competitors', async () => {
      const response = await request(app)
        .get('/')
        .set('Accept', 'text/html');

      expect(response.text).not.toContain('Vercel AI Gateway');
      expect(response.text).not.toContain('llm-hard-cap');
    });
  });

  describe('GET /index.html', () => {
    test('should return HTML landing page', async () => {
      const response = await request(app)
        .get('/index.html');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('<title>Add a spend cap to your AI route</title>');
      expect(response.text).toContain('https://cap-alpha-one.vercel.app');
    });
  });
});
