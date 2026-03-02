import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchedulerComponent } from "./scheduler.component";
import { EventCardComponent } from "./event-card.component";
import { SchedulerService } from "./scheduler.service";

/**
 * SchedulerModule (NgModule – for apps that prefer module-based architecture)
 *
 * For standalone-based apps, import `SchedulerComponent` and
 * `EventCardComponent` directly in the `imports` array instead.
 *
 * @example – Module-based
 * ```ts
 * // app.module.ts
 * import { SchedulerModule } from '@janus-scheduler/angular';
 * ＠NgModule({ imports: [SchedulerModule] })
 * export class AppModule {}
 * ```
 *
 * @example – Standalone
 * ```ts
 * // app.component.ts
 * import { SchedulerComponent } from '@janus-scheduler/angular';
 * ＠Component({ imports: [SchedulerComponent] })
 * ```
 */
@NgModule({
  imports: [CommonModule, SchedulerComponent, EventCardComponent],
  exports: [SchedulerComponent, EventCardComponent],
  providers: [SchedulerService],
})
export class SchedulerModule {}
