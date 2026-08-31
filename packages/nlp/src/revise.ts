import { SessionState, TextSpan, SessionContext } from "./types";
import { beginSession, provideAnswer } from "./session";

/**
 * Replace a span of the original text with new text and re-evaluate.
 */
export function reviseSlot(
  state: SessionState,
  span: TextSpan | undefined,
  replacement: string,
  ctx: SessionContext,
): SessionState {
  if (span) {
    const prefix = state.text.slice(0, span.start);
    const suffix = state.text.slice(span.end);
    const newText = `${prefix}${replacement}${suffix}`
      .replace(/\s+/g, " ")
      .trim();
    return beginSession(newText, ctx);
  }

  if (state.status === "awaiting") {
    return provideAnswer(state, replacement, ctx);
  }

  const newText = `${state.text} ${replacement}`.replace(/\s+/g, " ").trim();
  return beginSession(newText, ctx);
}
