import { hasDomainAnchor } from "./gates";

export type SmalltalkKind = "greeting" | "thanks" | "farewell" | "help";

const GREETING_RE = /^\s*(hi|hello|hey|greetings|morning|afternoon|evening)\b/i;
const THANKS_RE = /^\s*(thanks|thank you|cheers|appreciate it)\b/i;
const FAREWELL_RE = /^\s*(bye|goodbye|see you|cya|catch you later)\b/i;
const HELP_RE =
  /^\s*(help|what can you do|how does this work|commands|options|stuck)\b/i;

export function classifySmalltalk(text: string): SmalltalkKind | null {
  // Guard 2: Only when !hasDomainAnchor(text)
  if (hasDomainAnchor(text)) return null;

  // Guard 3: Only under ~4 words
  // A naive split on whitespace. Bare "cancel", "yes", "no" are not in the regexes above.
  const words = text.trim().split(/\s+/);
  if (words.length >= 4) return null;

  if (GREETING_RE.test(text)) return "greeting";
  if (THANKS_RE.test(text)) return "thanks";
  if (FAREWELL_RE.test(text)) return "farewell";
  if (HELP_RE.test(text)) return "help";

  return null;
}
