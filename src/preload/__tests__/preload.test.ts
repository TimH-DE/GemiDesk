import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
  },
}));

// Mock window and document
global.window = {
  addEventListener: vi.fn(),
} as any;

global.document = {
  addEventListener: vi.fn(),
} as any;

import { extractChatId } from '../preload';

describe('extractChatId', () => {
  it('extracts chat ID from a valid URL', () => {
    expect(extractChatId('https://gemini.google.com/app/1234567890abcdef')).toBe('1234567890abcdef');
  });

  it('extracts chat ID when URL has query parameters', () => {
    expect(extractChatId('https://gemini.google.com/app/1234567890abcdef?hl=en')).toBe('1234567890abcdef');
  });

  it('returns null for empty or falsy URL', () => {
    expect(extractChatId('')).toBeNull();
    expect(extractChatId(undefined as unknown as string)).toBeNull();
    expect(extractChatId(null as unknown as string)).toBeNull();
  });

  it('returns null if no chat ID matches', () => {
    expect(extractChatId('https://gemini.google.com/')).toBeNull();
    expect(extractChatId('https://gemini.google.com/?hl=en')).toBeNull();
  });

  it('handles custom URLs correctly', () => {
    expect(extractChatId('https://gemini.google.com/app/custom-chat-id_123')).toBe('custom-chat-id_123');
  });

  it('handles paths without domain', () => {
    expect(extractChatId('/app/1234567890abcdef')).toBe('1234567890abcdef');
  });
});
