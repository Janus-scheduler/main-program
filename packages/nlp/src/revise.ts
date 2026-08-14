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
  if (!span) {
    // If there's no original span, just append the replacement
    return provideAnswer(state, replacement, ctx);
  }

  const prefix = state.text.slice(0, span.start);
  const suffix = state.text.slice(span.end);
  const newText = `${prefix}${replacement}${suffix}`
    .replace(/\s+/g, " ")
    .trim();

  // Reset the session with the newly spliced text
  return beginSession(newText, ctx);
}
