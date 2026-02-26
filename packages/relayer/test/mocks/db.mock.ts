import { vi } from "vitest";

export function createDbMock() {
  return {
    initialized: true,
    createNewRequest: vi.fn(),
    updateBroadcastedRequest: vi.fn(),
    updateFailedRequest: vi.fn(),
  };
}
