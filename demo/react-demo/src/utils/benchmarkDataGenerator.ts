import { Event, Resource, schedulerStore } from "@janus-scheduler/react";

const FIRST_NAMES = [
  "Sarah",
  "Michael",
  "Ann",
  "Alan",
  "Emily",
  "David",
  "Jessica",
  "James",
  "Sophia",
  "Robert",
  "Olivia",
  "William",
  "Ava",
  "Joseph",
  "Mia",
  "Charles",
  "Charlotte",
  "Daniel",
  "Amelia",
  "Matthew",
  "Harper",
  "Anthony",
  "Evelyn",
  "Mark",
  "Abigail",
  "Donald",
  "Emily",
  "Steven",
  "Elizabeth",
  "Paul",
  "Sofia",
  "Andrew",
  "Avery",
  "Joshua",
  "Ella",
  "Kenneth",
  "Scarlett",
  "Kevin",
  "Grace",
  "Brian",
  "Chloe",
  "George",
  "Victoria",
  "Edward",
  "Riley",
  "Ronald",
  "Aria",
  "Timothy",
  "Lily",
  "Jason",
];

const LAST_NAMES = [
  "Chen",
  "Ross",
  "Sherin",
  "Turing",
  "Watson",
  "Rivera",
  "Patel",
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
];

const DOCTOR_AVATARS = [
  "https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
  "https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000",
  "https://westernsydneydiabetes.com.au/uploads/2021/06/Rona-scaled.jpg",
  "https://tse4.mm.bing.net/th/id/OIP.kqx_nQhmMAt1EtXnbBhOBwHaK0?r=0&w=832&h=1216&rs=1&pid=ImgDetMain&o=7&rm=3",
];

const ROOM_AVATARS = [
  "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=120&h=120",
];

const EQUIPMENT_AVATARS = [
  "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=120&h=120",
  "https://tse3.mm.bing.net/th/id/OIP.gB5vMFJ88MAKfv9CPhYJ9QHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
];

const EVENT_TITLES = [
  "Cardiology Consultation",
  "Emergency Surgery",
  "CT Brain Scan",
  "Ward Round",
  "MRI Knee Protocol",
  "Routine Maintenance",
  "Post-Op Followup",
  "Neurology Board Review",
  "Ultrasound Guided Biopsy",
  "Endoscopy Procedure",
  "Pediatric Checkup",
  "Anesthesia Pre-Check",
  "Orthopedic Assessment",
  "Chemotherapy Session",
  "Dialysis Treatment",
  "ICU Special Shift",
];

const COLORS = [
  "primary",
  "blue",
  "yellow",
  "purple",
  "green",
  "red",
  "pink",
  "teal",
  "indigo",
];

/**
 * Generates a heavy synthetic dataset (150 resources & 1,500+ events)
 * for dense timeline benchmarking.
 * Atomically updates the Zustand store so all resources and events render instantly.
 */
export const DEFAULT_BENCHMARK_RESOURCE_COUNT = 500;

/**
 * Generates a heavy synthetic dataset (configurable: 100, 500, 2,000+ resources)
 * with proportional timeline events across a 21-day timeline range.
 * Atomically updates the Zustand store so all resources and events render instantly.
 */
export function loadDenseBenchmarkData(
  requestedResourceCount: number = DEFAULT_BENCHMARK_RESOURCE_COUNT,
): {
  resourceCount: number;
  eventCount: number;
} {
  const store = schedulerStore;
  const today = new Date();

  const count = Math.max(10, requestedResourceCount);

  // Split target count: 40% Staff, 30% Rooms, 30% Equipment
  const staffCount = Math.max(1, Math.round(count * 0.4));
  const roomCount = Math.max(1, Math.round(count * 0.3));
  const equipmentCount = Math.max(1, count - staffCount - roomCount);

  const resourceMap: Record<string, Resource> = {};
  const resourceList: Resource[] = [];

  // 1. Generate Staff
  for (let i = 1; i <= staffCount; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const avatar = DOCTOR_AVATARS[i % DOCTOR_AVATARS.length];
    const suffix = i > FIRST_NAMES.length ? ` (${i})` : "";
    const r = new Resource({
      id: `r_staff_${i}`,
      name: `Dr. ${fn} ${ln}${suffix}`,
      type: "person",
      avatar,
    });
    resourceMap[r.id] = r;
    resourceList.push(r);
  }

  // 2. Generate Rooms
  for (let i = 1; i <= roomCount; i++) {
    const roomType =
      i % 3 === 1
        ? "Operating Room"
        : i % 3 === 2
          ? "Consulting Suite"
          : "ICU Bay";
    const r = new Resource({
      id: `r_room_${i}`,
      name: `${roomType} ${i}`,
      type: "room",
      avatar: ROOM_AVATARS[0],
    });
    resourceMap[r.id] = r;
    resourceList.push(r);
  }

  // 3. Generate Equipment
  for (let i = 1; i <= equipmentCount; i++) {
    const eqType =
      i % 3 === 1
        ? "MRI Scanner"
        : i % 3 === 2
          ? "CT Machine"
          : "Ultrasound Workstation";
    const char = String.fromCharCode(65 + (i % 26));
    const r = new Resource({
      id: `r_eq_${i}`,
      name: `${eqType} ${char}${i}`,
      type: "equipment",
      avatar: EQUIPMENT_AVATARS[i % EQUIPMENT_AVATARS.length],
    });
    resourceMap[r.id] = r;
    resourceList.push(r);
  }

  // 4. Generate Events across 21 days (-7 to +13 days)
  const eventMap: Record<string, Event> = {};
  let eventCounter = 1;
  const timeSlots = [
    { startH: 8, startM: 0, endH: 9, endM: 30 },
    { startH: 9, startM: 45, endH: 11, endM: 15 },
    { startH: 11, startM: 30, endH: 13, endM: 0 },
    { startH: 14, startM: 0, endH: 15, endM: 30 },
    { startH: 15, startM: 45, endH: 17, endM: 15 },
    { startH: 17, startM: 30, endH: 19, endM: 0 },
  ];

  for (let dayOffset = -7; dayOffset <= 13; dayOffset++) {
    const targetDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + dayOffset,
    );

    resourceList.forEach((res, resIdx) => {
      const numEventsOnDay = (resIdx + Math.abs(dayOffset)) % 2 === 0 ? 1 : 2;

      for (let e = 0; e < numEventsOnDay; e++) {
        const slotIdx =
          (resIdx * 2 + Math.abs(dayOffset) + e) % timeSlots.length;
        const slot = timeSlots[slotIdx];
        const title =
          EVENT_TITLES[(eventCounter + resIdx) % EVENT_TITLES.length];
        const color =
          COLORS[(eventCounter + Math.abs(dayOffset)) % COLORS.length];

        const startD = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          slot.startH,
          slot.startM,
          0,
        );
        const endD = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          slot.endH,
          slot.endM,
          0,
        );

        const evt = new Event({
          id: `bm_evt_${eventCounter}`,
          title: `${title} #${eventCounter}`,
          startTime: startD.toISOString(),
          endTime: endD.toISOString(),
          resourceIds: [res.id],
          status: "confirmed",
          color,
        });

        eventMap[evt.id] = evt;
        eventCounter++;
      }
    });
  }

  // Atomically replace store state in a single tick
  store.setState({
    resources: resourceMap,
    events: eventMap,
    assignments: {},
  });

  console.log(
    `[Benchmark] Loaded ${Object.keys(resourceMap).length} resources and ${Object.keys(eventMap).length} events into store.`,
  );
  return {
    resourceCount: Object.keys(resourceMap).length,
    eventCount: Object.keys(eventMap).length,
  };
}

/**
 * Restores default 7 resources and 2 initial events.
 */
export function loadDefaultDemoData() {
  const store = schedulerStore;
  const today = new Date();

  const r1 = new Resource({
    id: "r1",
    name: "Dr. Sarah Chen",
    type: "person",
    avatar:
      "https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
  });
  const r2 = new Resource({
    id: "r2",
    name: "Dr. Michael Ross",
    type: "person",
    avatar:
      "https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000",
  });
  const r3 = new Resource({
    id: "r3",
    name: "Dr. Ann sherin",
    type: "person",
    avatar:
      "https://westernsydneydiabetes.com.au/uploads/2021/06/Rona-scaled.jpg",
  });
  const r4 = new Resource({
    id: "r4",
    name: "Operating Room 1",
    type: "room",
    avatar:
      "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=120&h=120",
  });
  const r5 = new Resource({
    id: "r5",
    name: "MRI Scanner A",
    type: "equipment",
    avatar:
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=120&h=120",
  });
  const r6 = new Resource({
    id: "r6",
    name: "MRI Scanner B",
    type: "equipment",
    avatar:
      "https://tse3.mm.bing.net/th/id/OIP.gB5vMFJ88MAKfv9CPhYJ9QHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
  });
  const r7 = new Resource({
    id: "r7",
    name: "Dr. Alan Turing",
    type: "person",
    avatar:
      "https://tse4.mm.bing.net/th/id/OIP.kqx_nQhmMAt1EtXnbBhOBwHaK0?r=0&w=832&h=1216&rs=1&pid=ImgDetMain&o=7&rm=3",
  });

  const start1 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    9,
    0,
    0,
  ).toISOString();
  const end1 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    11,
    30,
    0,
  ).toISOString();
  const e1 = new Event({
    id: "e1",
    title: "Appendectomy",
    startTime: start1,
    endTime: end1,
    resourceIds: ["r1", "r3"],
    status: "confirmed",
    color: "primary",
  });

  const start2 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    13,
    0,
    0,
  ).toISOString();
  const end2 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    14,
    0,
    0,
  ).toISOString();
  const e2 = new Event({
    id: "e2",
    title: "Pre-op Assessment",
    startTime: start2,
    endTime: end2,
    resourceIds: ["r2"],
    status: "confirmed",
    color: "primary",
  });

  store.setState({
    resources: { r1, r2, r3, r4, r5, r6, r7 },
    events: { e1, e2 },
    assignments: {},
  });
}
