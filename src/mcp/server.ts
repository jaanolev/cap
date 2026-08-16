#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createSandboxProject, verifyApiKey, consume, whyDenied } from '../db/operations.js';
import { supabase } from '../db/client.js';

const server = new Server(
  {
    name: 'cap-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'mint_key',
        description: 'Create a new sandbox API key with default 20 units/day limit',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_limit',
        description: 'Set daily limit for a specific user in a project',
        inputSchema: {
          type: 'object',
          properties: {
            api_key: {
              type: 'string',
              description: 'Cap API key',
            },
            user_id: {
              type: 'string',
              description: 'User ID to set limit for',
            },
            daily_limit: {
              type: 'number',
              description: 'New daily limit in units',
            },
          },
          required: ['api_key', 'user_id', 'daily_limit'],
        },
      },
      {
        name: 'consume_test',
        description: 'Test consumption of units for a user',
        inputSchema: {
          type: 'object',
          properties: {
            api_key: {
              type: 'string',
              description: 'Cap API key',
            },
            user_id: {
              type: 'string',
              description: 'User ID',
            },
            units: {
              type: 'number',
              description: 'Number of units to consume (default: 1)',
            },
            idempotency_key: {
              type: 'string',
              description: 'Optional idempotency key for safe retries',
            },
          },
          required: ['api_key', 'user_id'],
        },
      },
      {
        name: 'why_denied',
        description: 'Get detailed balance information for a user',
        inputSchema: {
          type: 'object',
          properties: {
            api_key: {
              type: 'string',
              description: 'Cap API key',
            },
            user_id: {
              type: 'string',
              description: 'User ID',
            },
          },
          required: ['api_key', 'user_id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'mint_key': {
        const result = await createSandboxProject();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'set_limit': {
        const { api_key, user_id, daily_limit } = args as {
          api_key: string;
          user_id: string;
          daily_limit: number;
        };

        const project = await verifyApiKey(api_key);
        if (!project) {
          throw new Error('Invalid API key');
        }

        const { data: existing } = await supabase
          .from('end_users')
          .select('*')
          .eq('project_id', project.id)
          .eq('user_id', user_id)
          .single();

        if (existing) {
          await supabase
            .from('end_users')
            .update({ daily_limit })
            .eq('project_id', project.id)
            .eq('user_id', user_id);
        } else {
          await supabase
            .from('end_users')
            .insert({
              project_id: project.id,
              user_id,
              daily_limit,
            });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  user_id,
                  daily_limit,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'consume_test': {
        const { api_key, user_id, units = 1, idempotency_key } = args as {
          api_key: string;
          user_id: string;
          units?: number;
          idempotency_key?: string;
        };

        const project = await verifyApiKey(api_key);
        if (!project) {
          throw new Error('Invalid API key');
        }

        const result = await consume(project.id, user_id, units, idempotency_key);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'why_denied': {
        const { api_key, user_id } = args as {
          api_key: string;
          user_id: string;
        };

        const project = await verifyApiKey(api_key);
        if (!project) {
          throw new Error('Invalid API key');
        }

        const result = await whyDenied(project.id, user_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cap MCP Server running on stdio');
}

main().catch(console.error);
