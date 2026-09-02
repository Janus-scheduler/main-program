# Skills

Agent-facing documentation for Janus Scheduler.

`@janus-scheduler` was first published on 2026-09-02, so no model has it in its
training data. Without a skill, coding agents invent an API — most often
`manager.store.subscribe(...)`, which does not exist and throws at runtime.

## janus-scheduler

Everything an agent needs to use the packages correctly: which one to install,
working code for both tiers, and the eleven details models reliably get wrong.

**Use it in a project that consumes Janus Scheduler:**

```bash
mkdir -p .claude/skills/janus-scheduler
curl -o .claude/skills/janus-scheduler/SKILL.md \
  https://raw.githubusercontent.com/Janus-scheduler/main-program/main/skills/janus-scheduler/SKILL.md
```

Or copy `skills/janus-scheduler/SKILL.md` in by hand. Claude Code picks up
anything under `.claude/skills/`; the `description` in the frontmatter is what
decides when it loads.

Other agent tools generally read `AGENTS.md` or `CLAUDE.md` at the project root
instead — the same file works there, frontmatter and all.

## Keeping it accurate

A skill that drifts is worse than none, because agents trust it over their
priors. When you change a public API, update this file in the same commit —
especially the "Critical gotchas" and "Error → cause" sections, which is where
its value is concentrated.
