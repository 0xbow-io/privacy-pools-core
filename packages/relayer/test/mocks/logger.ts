import { vi } from 'vitest';

// Global logger mock that can be used across all test files
export const mockLogger = {
  silly: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock the logger module
vi.mock('../../src/logger/index.js', () => ({
  createModuleLogger: vi.fn(() => mockLogger),
  default: mockLogger,
}));