import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    commandLine: { appendSwitch: vi.fn() },
    setName: vi.fn(),
    userAgentFallback: '',
    getPath: vi.fn().mockReturnValue(''),
    on: vi.fn(),
    whenReady: vi.fn().mockReturnValue(new Promise(() => {})), // Don't resolve immediately to prevent app initialization
    relaunch: vi.fn(),
    exit: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: class MockBrowserWindow {
    static getAllWindows = vi.fn().mockReturnValue([]);
  },
  BrowserView: class MockBrowserView {},
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  session: {
    defaultSession: {
      clearStorageData: vi.fn(),
      webRequest: {
        onBeforeSendHeaders: vi.fn()
      }
    }
  }
}));

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get = vi.fn();
      set = vi.fn();
      clear = vi.fn();
    }
  };
});

import { getChatId } from '../main';

describe('getChatId', () => {
  it('extracts chat ID from a regular gemini chat URL', () => {
    expect(getChatId('https://gemini.google.com/app/1234567890abcdef')).toBe('1234567890abcdef');
  });

  it('extracts chat ID when URL has query parameters', () => {
    expect(getChatId('https://gemini.google.com/app/1234567890abcdef?hl=en')).toBe('1234567890abcdef');
  });

  it('returns "app" for the root app URL', () => {
    expect(getChatId('https://gemini.google.com/app')).toBe('app');
  });

  it('handles custom URLs correctly', () => {
    expect(getChatId('https://gemini.google.com/app/custom-chat-id_123')).toBe('custom-chat-id_123');
  });

  it('returns the full URL if no match is found (fallback)', () => {
    expect(getChatId('https://example.com')).toBe('https://example.com');
  });
});
