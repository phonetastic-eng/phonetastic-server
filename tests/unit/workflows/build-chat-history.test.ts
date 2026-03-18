import { describe, it, expect } from 'vitest';
import { buildChatHistory } from '../../../src/workflows/process-inbound-email.js';

describe('buildChatHistory', () => {
  it('labels end user emails as [Customer]', () => {
    const result = buildChatHistory(
      [{ endUserId: 1, userId: null, bodyText: 'Hello', createdAt: new Date('2026-03-16T10:00:00Z') }],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].label).toBe('[Customer]');
    expect(result[0].content).toBe('Hello');
  });

  it('labels owner emails as [Human Agent]', () => {
    const result = buildChatHistory(
      [{ endUserId: null, userId: 5, bodyText: 'We can help', createdAt: new Date('2026-03-16T10:00:00Z') }],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('[Human Agent]');
  });

  it('renders tool calls as function_call + function_call_response pairs', () => {
    const result = buildChatHistory([], [
      {
        toolCallId: 'tc-abc',
        toolName: 'company_info',
        input: { query: 'pricing' },
        output: { found: true, results: [{ question: 'Price?', answer: '$39' }] },
        createdAt: new Date('2026-03-16T10:01:00Z'),
      },
    ]);

    expect(result).toHaveLength(2);

    const call = JSON.parse(result[0].content);
    expect(call.type).toBe('function_call');
    expect(call.tool_name).toBe('company_info');
    expect(call.query).toBe('pricing');
    expect(result[0].role).toBe('assistant');

    const response = JSON.parse(result[1].content);
    expect(response.type).toBe('function_call_response');
    expect(response.tool_call_id).toBe('tc-abc');
    expect(response.output.found).toBe(true);
    expect(result[1].role).toBe('user');
  });

  it('merges emails and tool calls in chronological order', () => {
    const result = buildChatHistory(
      [
        { endUserId: 1, userId: null, bodyText: 'First', createdAt: new Date('2026-03-16T10:00:00Z') },
        { endUserId: 1, userId: null, bodyText: 'Third', createdAt: new Date('2026-03-16T10:02:00Z') },
      ],
      [
        {
          toolCallId: 'tc-1',
          toolName: 'company_info',
          input: { query: 'q' },
          output: { found: false },
          createdAt: new Date('2026-03-16T10:01:00Z'),
        },
      ],
    );

    expect(result).toHaveLength(4);
    expect(result[0].content).toBe('First');
    expect(JSON.parse(result[1].content).type).toBe('function_call');
    expect(JSON.parse(result[2].content).type).toBe('function_call_response');
    expect(result[3].content).toBe('Third');
  });

  it('returns empty array when no emails or tool calls', () => {
    expect(buildChatHistory([], [])).toEqual([]);
  });

  it('includes attachment summaries with [Attachment] label', () => {
    const result = buildChatHistory([], [], [
      { id: 1, filename: 'invoice.pdf', storageKey: 'k', contentType: 'application/pdf', summary: 'An invoice for $500', error: null, createdAt: new Date('2026-03-16T10:00:00Z') },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].label).toBe('[Attachment]');
    expect(result[0].content).toBe('invoice.pdf: An invoice for $500');
  });

  it('includes attachment errors when summarization failed', () => {
    const result = buildChatHistory([], [], [
      { id: 1, filename: 'broken.pdf', storageKey: 'k', contentType: 'application/pdf', summary: null, error: 'Summarization failed for broken.pdf', createdAt: new Date('2026-03-16T10:00:00Z') },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('[Attachment]');
    expect(result[0].content).toContain('Summarization failed');
  });

  it('places attachments before emails chronologically', () => {
    const result = buildChatHistory(
      [{ endUserId: 1, userId: null, bodyText: 'Hello', createdAt: new Date('2026-03-16T10:00:00Z') }],
      [],
      [{ id: 1, filename: 'f.pdf', storageKey: 'k', contentType: 'application/pdf', summary: 'A file', error: null, createdAt: new Date('2026-03-16T09:59:00Z') }],
    );

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('[Attachment]');
    expect(result[1].label).toBe('[Customer]');
  });
});
