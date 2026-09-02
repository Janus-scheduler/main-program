# Resource Configuration & Ordering Guide

Janus Scheduler provides a highly flexible way to map, group, and sort your resources (like Staff, Rooms, Equipment) using a combination of raw data and presentation rules.

## 1. The Raw Data (`ResourceData`)

When adding resources to the store, developers provide the raw, unfiltered data about that specific resource.

```typescript
manager.addResource({
  id: "r1",
  name: "Dr. Sarah Chen",
  type: "person", // Mandatory: Used to match against the UI config
  subtitle: "Specialist", // Optional: specific label for this resource
  avatar: "url_to_image",
});
```

Notice that we do **not** define visual grouping details like `order` or `groupLabel` here. The raw data should purely describe the resource itself.

## 2. The Presentation Rules (`ResourceTypeConfig`)

To tell the UI how to group and display these raw resources, we pass a configuration object to the `<Timeline />` component.

```typescript
const TIMELINE_RESOURCE_CONFIG = {
  person: { label: "STAFF", subtitle: "Staff", order: 1 },
  room: { label: "ROOMS", subtitle: "Facility", order: 2 },
  equipment: { label: "EQUIPMENT", subtitle: "Equipment", order: 3 },
};

// In React:
// <Timeline resourceTypeConfig={TIMELINE_RESOURCE_CONFIG} />
```

## 3. How Subtitles and Labels are Mapped

When the Web Component renders the timeline, it combines the Raw Data and the Presentation Rules using the following fallback logic:

### Group Labels (The Section Headers)

The timeline reads the `type` of the resource (e.g., `"person"`), looks up that type in the `TIMELINE_RESOURCE_CONFIG`, and uses the `label` property to create the group header.

- `"person"` -> `"STAFF"`
- `"room"` -> `"ROOMS"`

### Subtitles (Under the Resource Name)

The system checks for a subtitle in this exact priority:

1. **Specific Override:** Did the developer provide a `subtitle` on the specific resource? (e.g., `"Executive"`). If yes, use it.
2. **Type Fallback:** If not, what is the default `subtitle` for this type in `TIMELINE_RESOURCE_CONFIG`? (e.g., `"Staff"`). If it exists, use it.
3. **Capitalized Type:** If both are missing, it simply capitalizes the type name (e.g., `"Person"`).

## 4. How Ordering Works

It is important to understand that subtitles (like "Manager" or "Engineer") **do not** dictate the order on the screen.

1. **Group Order:** The large collapsible sections (STAFF, ROOMS, EQUIPMENT) are ordered by the `order` property inside your `TIMELINE_RESOURCE_CONFIG`. Because `person` has `order: 1`, the "STAFF" group will always appear at the top of the screen.
2. **Resource Order (Within the Group):** The individual resources _inside_ a group are ordered based on **insertion order** into the `schedulerStore`. The system does not sort them alphabetically by subtitle. If you add Dr. Sarah first, she appears at the top of the STAFF group.
