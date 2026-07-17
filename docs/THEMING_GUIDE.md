# Theming Guide

The Janus Scheduler allows you to fully customize its appearance to match your brand and application's design system. By default, the scheduler uses a vibrant orange theme, but this can be easily overridden globally or on a per-instance basis.

There are two primary ways to theme the scheduler:

1. **Global CSS Variables** (Recommended for full app styling)
2. **The `brandColor` Property** (Recommended for dynamic or instance-specific overrides)

---

## 1. Global CSS Variables

The scheduler exposes public CSS Custom Properties (variables) that dictate its color scheme. These variables are attached to the root of the web component (`janus-scheduler`).

By overriding `--janus-primary-color` in your global stylesheet, you can instantly change the core accent color of the scheduler across your entire application.

### Usage

In your main CSS file (e.g., `index.css`, `App.css`, or global styles):

```css
/* Target the :root to ensure all standalone components inherit the variables */
:root {
  /* Change the primary accent color from orange to blue */
  --janus-primary-color: #3b82f6;

  /* Optionally override the lighter background tints used for badges/hover states */
  --janus-primary-bg: #eff6ff;

  /* Optionally override the glow effect color */
  --janus-primary-glow: rgba(59, 130, 246, 0.15);

  /* Optionally override the text color used against primary backgrounds */
  --janus-primary-text: #1d4ed8;
}
```

_Note: If you are using the React, Angular, Solid, or Vue wrappers, the sub-components (`<janus-timeline>`, `<janus-month-grid>`) are rendered as siblings. Using `:root` ensures that the CSS variables cascade correctly to all of them._

This method is highly recommended as it relies natively on the CSS cascade and performs excellently without any JavaScript overhead.

---

## 2. The `brandColor` Property

If you prefer to configure your theme dynamically via JavaScript, or if you need different instances of the scheduler to have different colors, you can use the `brandColor` property.

When `brandColor` is provided, the scheduler dynamically injects a `<style>` block to override `--janus-primary-color` specifically for that instance.

### Usage in HTML

```html
<janus-scheduler brandColor="#8b5cf6"></janus-scheduler>
```

### Usage in React

```jsx
import { JanusScheduler } from "@janus-scheduler/react";

function App() {
  return (
    <JanusScheduler
      brandColor="#8b5cf6"
      /* ...other props */
    />
  );
}
```

### Usage in SolidJS

```jsx
import { JanusScheduler } from "@janus-scheduler/solid";

function App() {
  return (
    <JanusScheduler
      brandColor="#8b5cf6"
      /* ...other props */
    />
  );
}
```

_Note: When using the `brandColor` property, the scheduler handles setting the primary color variable. If you also need to adjust the background tints (`--janus-primary-bg`, etc.), it is still recommended to use Global CSS Variables in combination with or instead of the property._

---

## Complete List of Theming Variables

Here is the complete list of exposed CSS variables that you can target to theme the scheduler, along with their default values:

| Variable                | Default Value              | Description                                                                                                    |
| :---------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `--janus-primary-color` | `#f97316` (Orange)         | The primary accent color used for active elements, borders, buttons, and highlights.                           |
| `--janus-primary-bg`    | `#fff7ed`                  | The lighter tint of the primary color, used for badge backgrounds, active hover states, and event backgrounds. |
| `--janus-primary-glow`  | `rgba(249, 115, 22, 0.15)` | The shadow color used for focus rings or glowing effects around active elements.                               |
| `--janus-primary-text`  | `#c2410c`                  | The darker text color used for text rendered on top of `--janus-primary-bg`.                                   |

By leveraging these properties, you can easily ensure the scheduler looks perfectly at home inside your application.
