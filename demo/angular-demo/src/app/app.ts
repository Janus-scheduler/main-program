import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  SchedulerComponent,
  SchedulerService,
  JanusEventData,
  JanusResourceData,
  EventClickPayload,
  EventDeletePayload,
  ResourceClickPayload,
} from '@janus-scheduler/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule, SchedulerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = 'Janus Scheduler – Angular Demo';

  readonly scheduler = inject(SchedulerService);

  ngOnInit(): void {
    // Seed with demo data so the scheduler renders immediately
    const resources: JanusResourceData[] = [
      { id: 'res_001', name: 'Dr. Alice Smith', type: 'person', email: 'alice@example.com' },
      { id: 'res_002', name: 'Conference Room A', type: 'room' },
      { id: 'res_003', name: 'Projector #1', type: 'equipment' },
    ];

    const today = new Date();
    const fmt = (d: Date) => d.toISOString();

    const h = (base: Date, offsetH: number, durationH = 1): [string, string] => {
      const s = new Date(base);
      s.setHours(offsetH, 0, 0, 0);
      const e = new Date(s);
      e.setHours(e.getHours() + durationH);
      return [fmt(s), fmt(e)];
    };

    const events: JanusEventData[] = [
      {
        id: 'evt_001',
        title: 'Team Standup',
        startTime: h(today, 9)[0],
        endTime: h(today, 9)[1],
        resourceId: 'res_001',
        status: 'confirmed',
        description: 'Daily sync with the engineering team',
      },
      {
        id: 'evt_002',
        title: 'Product Review',
        startTime: h(today, 11)[0],
        endTime: h(today, 11, 2)[1],
        resourceId: 'res_002',
        status: 'confirmed',
        description: 'Q1 product roadmap review',
      },
      {
        id: 'evt_003',
        title: 'Client Presentation',
        startTime: h(today, 14)[0],
        endTime: h(today, 14, 2)[1],
        resourceId: 'res_002',
        status: 'draft',
        description: 'Demo of the new scheduler component',
      },
      {
        id: 'evt_004',
        title: 'One-on-One',
        startTime: h(today, 16)[0],
        endTime: h(today, 16)[1],
        resourceId: 'res_001',
        status: 'draft',
      },
    ];

    this.scheduler.init({
      resources,
      events,
      config: { defaultView: 'week', startHour: 8, endHour: 20, slotDuration: 30 },
    });
  }

  onEventClick(payload: EventClickPayload): void {
    console.log('[Demo] Event clicked:', payload.event.title);
  }

  onEventDelete(payload: EventDeletePayload): void {
    console.log('[Demo] Event deleted:', payload.id);
  }

  onResourceClick(payload: ResourceClickPayload): void {
    console.log('[Demo] Resource clicked:', payload.resource.name);
  }

  // ── Quick add form ────────────────────────────────────────────────────────
  quickTitle = '';
  quickResourceId = 'res_001';

  addQuickEvent(): void {
    if (!this.quickTitle.trim()) return;
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    this.scheduler.addEvent({
      id: `evt_${Date.now()}`,
      title: this.quickTitle.trim(),
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      resourceId: this.quickResourceId,
      status: 'draft',
    });
    this.quickTitle = '';
  }

  deleteSelected(): void {
    const id = this.scheduler.selectedEventId();
    if (id) this.scheduler.deleteEvent(id);
  }
}
