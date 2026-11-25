import { z } from "zod";
import type { JWK } from "jose";

/** What the user is trying to do. Keep it small: this crosses a trust boundary. */
export const IntentSchema = z
  .object({
    goal: z.string().min(1).max(500),
    summary: z.string().max(2000).optional(),
    constraints: z.array(z.string().max(200)).max(10).optional(),
    language: z.string().max(20).optional(),
    entities: z.record(z.string().max(100), z.string().max(300)).optional(),
  })
  .strict();
export type IntentPacket = z.infer<typeof IntentSchema>;

export const TRACEPARENT_RE = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

export const ClaimsSchema = z.object({
  iss: z.string().min(1),
  aud: z.string().min(1),
  jti: z.string().min(8),
  sub: z.string().max(200).optional(),
  iat: z.number(),
  exp: z.number(),
  intent: IntentSchema,
  traceparent: z.string().regex(TRACEPARENT_RE).optional(),
  consent: z.literal(true),
});

/** A handover that has passed signature, audience, expiry and replay checks. */
export interface VerifiedHandover {
  issuer: string;
  audience: string;
  subject?: string;
  jti: string;
  intent: IntentPacket;
  traceparent?: string;
}

/** Returns true the first time a jti is seen, false on replay. */
export interface NonceStore {
  consume(jti: string, expiresAtSeconds: number): Promise<boolean>;
}

/** Resolve a site's public key by site id. */
export type KeyResolver = (siteId: string) => Promise<JWK | null>;

export type HandoverErrorCode =
  | "consent_required"
  | "invalid_intent"
  | "malformed"
  | "unknown_issuer"
  | "bad_signature"
  | "expired"
  | "wrong_audience"
  | "ttl_too_long"
  | "replayed";

export class HandoverError extends Error {
  constructor(public code: HandoverErrorCode, message?: string) {
    super(message ?? code);
    this.name = "HandoverError";
  }
}
