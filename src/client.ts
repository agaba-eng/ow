import type { VerifiedHandover } from "./types";

export interface OwClientOptions {
  /** Site API key from the dashboard (ow_live_...). Server-side only. */
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface TrackMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export class OwApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`ow api error ${status}`);
    this.name = "OwApiError";
  }
}

export class OwClient {
  private base: string;
  private f: typeof fetch;

  constructor(private opts: OwClientOptions) {
    this.base = (opts.baseUrl ?? "https://ow.akaatale.com").replace(/\/$/, "");
    this.f = opts.fetch ?? fetch;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.f(`${this.base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.opts.apiKey}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new OwApiError(res.status, body);
    return body as T;
  }

  /**
   * Send new messages for a session. Pass only messages not sent before.
   * Set `observe` to have the observer agent score the conversation afterwards.
   */
  track(input: {
    sessionId: string;
    messages: TrackMessage[];
    traceId?: string;
    observe?: boolean;
  }) {
    return this.call<{ conversationId: string }>("/api/v1/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Verify an incoming handover token through the platform (signature, audience, expiry, replay). */
  consumeHandover(token: string) {
    return this.call<VerifiedHandover>("/api/v1/handover/consume", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  /** Latest prompt approved (or auto-applied) in your dashboard. */
  getPrompt() {
    return this.call<{ prompt: string | null; version: number }>("/api/v1/prompt");
  }
}
