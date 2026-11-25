# @akaatale/ow-sdk

Hand a user's intent from one site's AI agent to another, safely, and send conversations to be scored.

- **Signed handover:** Site A packages the user's goal into a short-lived token that only Site B can accept.
- **Safe to inject:** Site B gets the intent as fenced, untrusted data, never as instructions.
- **Traceable:** the W3C trace context travels inside the token (OpenTelemetry), so both sites' spans can join one trace.
- **Observed:** a small client sends conversations to the platform, which scores them against your own rules.

Works in Node 20+ and edge runtimes. ESM and CommonJS.

```sh
npm install @akaatale/ow-sdk @opentelemetry/api
```

## 1. Create keys (once per site that sends handovers)

```sh
npx @akaatale/ow-sdk keygen
```

Register the **public** key in your dashboard. Keep the **private** key in a server-side env var (`OW_PRIVATE_JWK`). Never ship it to a browser.

## 2. Site A: hand the user over

```ts
import { signHandover } from "@akaatale/ow-sdk";

const token = await signHandover({
  privateJwk: JSON.parse(process.env.OW_PRIVATE_JWK!),
  issuer: SITE_A_ID,      // site ids come from the dashboard
  audience: SITE_B_ID,
  intent: { goal: "Buy a used Land Cruiser under $30k", constraints: ["pickup in Kampala"] },
  consent: true,          // required: the user agreed to share this
  subject: "session-123", // pseudonymous only, never an email or name
});
redirect(`https://site-b.com/chat?ow_handoff=${token}`);
```

Tokens expire in 5 minutes by default (10 at most), name one receiving site, and can be used once.

## 3. Site B: receive it

```ts
import { OwClient, buildHandoffContext, handoverContext } from "@akaatale/ow-sdk";
import { context } from "@opentelemetry/api";

const ow = new OwClient({ apiKey: process.env.OW_API_KEY! }); // server-side only

const handover = await ow.consumeHandover(token); // signature, audience, expiry, replay
const { prompt } = await ow.getPrompt();
const system = `${prompt}\n\n${buildHandoffContext(handover)}`;

await context.with(handoverContext(handover.traceparent), () => runAgent(system));

await ow.track({
  sessionId: handover.jti,
  messages: [/* only messages not sent before */],
  observe: true, // score this conversation against your rules
});
```

`consumeHandover` throws `OwApiError`. The body's `error` is one of `malformed`, `unknown_issuer`, `bad_signature`, `wrong_audience`, `expired`, `replayed`.

### Verify locally instead (no platform)

```ts
import { verifyHandover, memoryNonceStore } from "@akaatale/ow-sdk";

const handover = await verifyHandover(token, {
  audience: SITE_B_ID,
  resolveKey: async (siteId) => lookupPublicJwk(siteId), // your own trust list
  nonceStore: memoryNonceStore(), // use a shared store (Redis, DB) if you run more than one instance
});
```

Failures throw `HandoverError` with a `code`.

## API

| Export | Purpose |
| --- | --- |
| `generateSiteKeys()` | Ed25519 key pair as JWKs |
| `signHandover(opts)` | Site A: create the token |
| `verifyHandover(token, opts)` | Site B: verify locally |
| `buildHandoffContext(handover)` | Prompt text with the intent fenced as untrusted data |
| `handoverContext(traceparent)` | OpenTelemetry context that continues Site A's trace |
| `OwClient` | `track()`, `consumeHandover()`, `getPrompt()` against the hosted API |
| `memoryNonceStore()` | In-process replay guard for tests and single instances |

## Security notes

- Treat everything in `handover.intent` as user-controlled input. Use `buildHandoffContext`, and do not let it choose tools or permissions.
- Share only what the next site needs. The intent is capped (goal 500 characters, summary 2,000).
- Keep API keys and private keys on the server.

## License

Apache-2.0. See `LICENSE`.
