import {
  context,
  trace,
  SpanStatusCode,
  TraceFlags,
  type Attributes,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { TRACEPARENT_RE } from "./types";

const tracer = trace.getTracer("@akaatale/ow-sdk", "0.1.0");

/** W3C traceparent for the active span, if there is one. */
export function currentTraceparent(): string | undefined {
  const sc = trace.getActiveSpan()?.spanContext();
  if (!sc || !trace.isSpanContextValid(sc)) return undefined;
  const flags = (sc.traceFlags & 0xff).toString(16).padStart(2, "0");
  return `00-${sc.traceId}-${sc.spanId}-${flags}`;
}

/**
 * OTel context whose active span is the remote emit span from the other site.
 * Run Site B's agent inside `context.with(handoverContext(h), ...)` and its spans
 * join the same trace as Site A's.
 */
export function handoverContext(traceparent?: string): Context {
  if (!traceparent || !TRACEPARENT_RE.test(traceparent)) return context.active();
  const [, traceId, spanId, flags] = traceparent.split("-") as [string, string, string, string];
  return trace.setSpanContext(context.active(), {
    traceId,
    spanId,
    traceFlags: parseInt(flags, 16) as TraceFlags,
    isRemote: true,
  });
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
