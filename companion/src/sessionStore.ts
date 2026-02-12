import { randomUUID } from "node:crypto";

import type { SessionRef } from "@webviewmcp/protocol";

export class SessionStore {
  readonly #sessions = new Map<string, SessionRef>();

  attach(tabId: number, frameId: number): string {
    const sessionId = `s_${randomUUID()}`;
    this.#sessions.set(sessionId, { tabId, frameId });
    return sessionId;
  }

  detach(sessionId: string): boolean {
    return this.#sessions.delete(sessionId);
  }

  get(sessionId: string): SessionRef | undefined {
    return this.#sessions.get(sessionId);
  }
}
