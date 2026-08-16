export interface CapConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ConsumeOptions {
  userId: string;
  units?: number;
  idempotencyKey?: string;
}

export interface ConsumeResult {
  ok: boolean;
  reason?: string;
  remaining?: number;
}

export interface WhyDeniedResult {
  reason: string;
  details: {
    userId: string;
    dailyLimit: number;
    extraBalance: number;
    usedToday: number;
    available: number;
  };
}

export class CapClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: CapConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://cap-alpha-one.vercel.app';
  }

  async consume(options: ConsumeOptions): Promise<ConsumeResult> {
    const response = await fetch(`${this.baseUrl}/v1/consume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: options.userId,
        units: options.units || 1,
        idempotency_key: options.idempotencyKey,
      }),
    });

    if (response.status === 402) {
      return response.json() as Promise<ConsumeResult>;
    }

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to consume');
    }

    return response.json() as Promise<ConsumeResult>;
  }

  async whyDenied(userId: string): Promise<WhyDeniedResult> {
    const response = await fetch(`${this.baseUrl}/v1/why_denied`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to get denial reason');
    }

    return response.json() as Promise<WhyDeniedResult>;
  }
}

export async function mintSandboxKey(baseUrl = 'https://cap-alpha-one.vercel.app'): Promise<{
  projectId: string;
  apiKey: string;
}> {
  const response = await fetch(`${baseUrl}/v1/mint_sandbox_key`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to mint sandbox key');
  }

  return response.json() as Promise<{ projectId: string; apiKey: string }>;
}
