import { hasDomainAnchor } from "./gates";
import { EntityCatalog } from "./types";

export type SmalltalkKind = "greeting" | "thanks" | "farewell" | "help";

const GREETING_RE = /^\s*(hi|hello|hey|greetings|morning|afternoon|evening)\b/i;
const THANKS_RE = /^\s*(thanks|thank you|cheers|appreciate it)\b/i;
const FAREWELL_RE = /^\s*(bye|goodbye|see you|cya|catch you later)\b/i;
/**
 * Help phrases, anchored to the WHOLE utterance.
 *
 * Anchoring is what stops a room called “Help Desk” being swallowed: an
 * earlier version matched only the START of the string, so tapping that room
 * on a resource question answered it with a help blurb.
 *
 * The trailing `[?!.]*` is load-bearing. Without it `\s*$` rejected any
 * punctuation, so “what can you do” worked and **“what can you do?” did not** —
 * and the question mark is how most people write it. The other three patterns
 * are prefix-anchored with `\b`, so they already tolerate it.
 */
const HELP_RE =
  /^\s*(help|what can you do|what can i say|how does this work|commands|options|stuck)\s*[?!.]*\s*$/i;

export function classifySmalltalk(
  text: string,
  catalog?: EntityCatalog,
): SmalltalkKind | null {
  // Guard 2: Only when !hasDomainAnchor(text)
  if (hasDomainAnchor(text)) return null;

  // Guard: Protect catalog resource names from being swallowed
  if (catalog?.resources) {
    const lower = text.trim().toLowerCase();
    for (const res of catalog.resources) {
      if (res.name.toLowerCase() === lower) return null;
      if (res.aliases?.some((a) => a.toLowerCase() === lower)) return null;
    }
  }

  // Guard 3: Only under ~4 words (some help phrases are 4 words)
  // A naive split on whitespace. Bare "cancel", "yes", "no" are not in the regexes above.
  const words = text.trim().split(/\s+/);
  if (words.length > 4) return null;

  if (GREETING_RE.test(text)) return "greeting";
  if (THANKS_RE.test(text)) return "thanks";
  if (FAREWELL_RE.test(text)) return "farewell";
  if (HELP_RE.test(text)) return "help";

  return null;
}
