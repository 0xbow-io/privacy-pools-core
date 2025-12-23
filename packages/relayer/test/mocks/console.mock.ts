import { vi } from 'vitest';

// Mock console methods to suppress output during tests
const originalConsole = global.console;

beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});