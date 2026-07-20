const fs = require("fs");
const path = require("path");
const uiDir =
  "/Users/chathurakumara/Desktop/fyp/janus/main-program/packages/ui/src";

const uiFiles = ["janus-scheduler.ts", "janus-confirm-dialog.ts"];
uiFiles.forEach((file) => {
  const filePath = path.join(uiDir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  // Replace activeColor defaults
  content = content.replace(
    /activeColor\s*=\s*"orange"/g,
    'activeColor = "primary"',
  );
  content = content.replace(
    /activeColor:\s*this.activeColor \|\| "orange"/g,
    'activeColor: this.activeColor || "primary"',
  );
  content = content.replace(
    /activeColor \|\| "orange"/g,
    'activeColor || "primary"',
  );
  content = content.replace(
    /accentColor\s*=\s*"orange"/g,
    'accentColor = "primary"',
  );

  // Change the avatar default
  content = content.replace(/avatar-orange/g, "avatar-primary");

  // Change COLORS array if needed (though replacing "orange" globally in COLORS might be needed)
  content = content.replace(
    /"orange",\n\s*"blue"/,
    '"primary",\n  "orange",\n  "blue"',
  );

  // Update swatch/accent/dot classes if any missed
  content = content.replace(/swatch-orange/g, "swatch-primary");
  content = content.replace(/color-orange/g, "color-primary");

  fs.writeFileSync(filePath, content);
});

console.log("UI updated!");
