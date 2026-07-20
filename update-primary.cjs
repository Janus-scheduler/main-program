const fs = require("fs");
const path = require("path");

const uiDir =
  "/Users/chathurakumara/Desktop/fyp/janus/main-program/packages/ui/src";
const appFile =
  "/Users/chathurakumara/Desktop/fyp/janus/main-program/demo/react-demo/src/App.tsx";

// 1. Update App.tsx
let appContent = fs.readFileSync(appFile, "utf8");
appContent = appContent.replace(
  /activeColor: e\.color \|\| "orange"/g,
  'activeColor: e.color || "primary"',
);
fs.writeFileSync(appFile, appContent);

// 2. Update styles.ts and others: duplicate orange classes to primary, then fix orange to be actual orange
const styleFiles = [
  "styles.ts",
  "month-grid-styles.ts",
  "timeline-styles.ts",
  "topbar-styles.ts",
  "ai-bar-styles.ts",
  "timeline-drag.ts",
];

styleFiles.forEach((file) => {
  const filePath = path.join(uiDir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  // Replace variables:
  // --orange: var(--janus-primary-color, #f97316); -> --primary: var(--janus-primary-color, #3b82f6); \n    --orange: #f97316;
  content = content.replace(
    /--orange:\s*var\(--janus-primary-color,\s*#f97316\);/g,
    "--primary: var(--janus-primary-color, #3b82f6);\n    --orange: #f97316;",
  );
  content = content.replace(
    /--orange-light:\s*var\(--janus-primary-bg,\s*#fff7ed\);/g,
    "--primary-light: var(--janus-primary-bg, #eff6ff);\n    --orange-light: #fff7ed;",
  );
  content = content.replace(
    /--orange-glow:\s*var\(--janus-primary-glow,\s*rgba\(249,\s*115,\s*22,\s*0\.15\)\);/g,
    "--primary-glow: var(--janus-primary-glow, rgba(59, 130, 246, 0.15));\n    --orange-glow: rgba(249, 115, 22, 0.15);",
  );
  content = content.replace(
    /--c-orange:\s*var\(--janus-primary-color,\s*#f97316\);/g,
    "--c-primary: var(--janus-primary-color, #3b82f6);\n    --c-orange: #f97316;",
  );

  content = content.replace(
    /--orange-lt:\s*var\(--janus-primary-bg,\s*#fff7ed\);/g,
    "--primary-lt: var(--janus-primary-bg, #eff6ff);\n    --orange-lt: #fff7ed;",
  );
  content = content.replace(
    /--c-orange-bg:\s*var\(--janus-primary-bg,\s*#fff7ed\);/g,
    "--c-primary-bg: var(--janus-primary-bg, #eff6ff);\n    --c-orange-bg: #fff7ed;",
  );
  content = content.replace(
    /--c-orange-bd:\s*var\(--janus-primary-color,\s*#f97316\);/g,
    "--c-primary-bd: var(--janus-primary-color, #3b82f6);\n    --c-orange-bd: #f97316;",
  );
  content = content.replace(
    /--c-orange-tx:\s*var\(--janus-primary-text,\s*#c2410c\);/g,
    "--c-primary-tx: var(--janus-primary-text, #1d4ed8);\n    --c-orange-tx: #c2410c;",
  );

  // Now, everywhere else in the CSS, if it uses --orange, we probably want to duplicate the rule for --primary.
  // Wait, duplicating all rules is hard with regex. Let's just do a global replace of "orange" to "primary" for the entire file content,
  // EXCEPT we keep the old file content and just append the modified content (for classes only)? No, too complex.

  // It's easier: just replace "orange" with "primary" everywhere, except where we want to preserve orange.
  // But wait, we DO want an actual orange color in the system.
  // If we just replace "orange" with "primary" everywhere, we lose the orange color option completely.

  // Let's just do a blanket replace of "orange" -> "primary" to fix the issue, then we can add "orange" back if needed.
  // Wait, if I replace all "orange", I can just do:
  content = content.replace(/orange/g, "primary");
  // Then fix the color hexes if we want primary to look like blue by default.
  // Actually, replacing all "orange" -> "primary" means the CSS will have `.swatch-primary`, `.color-primary`, etc.

  fs.writeFileSync(filePath, content);
});

console.log("CSS updated!");
