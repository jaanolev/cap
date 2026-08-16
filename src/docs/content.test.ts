import { describe, test, expect } from '@jest/globals';
import { LLMS_TXT, SKILL_MD } from '../docs/content.js';

describe('Documentation Content', () => {
  describe('llms.txt', () => {
    test('should start with the correct title', () => {
      expect(LLMS_TXT).toContain('Add a spend cap to your AI route');
      expect(LLMS_TXT.split('\n')[0]).toBe('# Add a spend cap to your AI route');
    });

    test('should reference hosted API URL', () => {
      expect(LLMS_TXT).toContain('https://cap-alpha-one.vercel.app');
      expect(LLMS_TXT).not.toContain('http://localhost:3000');
    });

    test('should not mention npm install cap', () => {
      expect(LLMS_TXT).not.toContain('npm install cap');
    });

    test('should warn against creating credits in Supabase', () => {
      expect(LLMS_TXT).toContain('Do NOT create a credits');
    });

    test('should document 402 response', () => {
      expect(LLMS_TXT).toContain('402');
      expect(LLMS_TXT).toContain('insufficient_balance');
    });

    test('should not contain environment variables or secrets', () => {
      expect(LLMS_TXT).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(LLMS_TXT).not.toContain('SUPABASE_URL');
      expect(LLMS_TXT).not.toContain('PORT=');
    });
  });

  describe('SKILL.md', () => {
    test('should start with the correct title', () => {
      expect(SKILL_MD).toContain('Add a spend cap to your AI route');
      expect(SKILL_MD.split('\n')[0]).toBe('# Add a spend cap to your AI route');
    });

    test('should reference hosted API URL', () => {
      expect(SKILL_MD).toContain('https://cap-alpha-one.vercel.app');
      expect(SKILL_MD).not.toContain('http://localhost:3000');
    });

    test('should include Express/Next.js examples', () => {
      expect(SKILL_MD).toContain('Express');
      expect(SKILL_MD).toContain('Next.js');
    });

    test('should mention MCP tools', () => {
      expect(SKILL_MD).toContain('mint_key');
      expect(SKILL_MD).toContain('consume_test');
      expect(SKILL_MD).toContain('why_denied');
    });

    test('should not contain environment variables or secrets', () => {
      expect(SKILL_MD).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(SKILL_MD).not.toContain('SUPABASE_URL=');
      expect(SKILL_MD).not.toContain('PORT=');
    });
  });
});
