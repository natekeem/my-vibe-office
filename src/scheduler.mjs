import { nextScheduleAt } from './store.mjs';

export class Scheduler {
  constructor(store, runner, emit = () => {}) {
    this.store = store;
    this.runner = runner;
    this.emit = emit;
    this.timer = null;
    this.ticking = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => {}), 15000);
    this.timer.unref?.();
    setTimeout(() => this.tick().catch(() => {}), 500).unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(at = new Date()) {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = this.store.listSchedules().filter((s) => s.enabled && s.nextRunAt && new Date(s.nextRunAt) <= at);
      for (const schedule of due) await this.runSchedule(schedule, at);
    } finally { this.ticking = false; }
  }

  async runSchedule(schedule, at) {
    try {
      const card = await this.store.createCard({
        title: `[예약] ${schedule.name}`, prompt: schedule.prompt,
        agentId: schedule.agentId, workdir: schedule.workdir,
      });
      const nextRunAt = schedule.type === 'once' ? null : nextScheduleAt(schedule, new Date(at.getTime() + 1000));
      await this.store.markScheduleRun(schedule.id, {
        lastRunAt: at.toISOString(), lastCardId: card.id, nextRunAt,
        enabled: schedule.type !== 'once', error: '',
      });
      this.emit('schedule', { scheduleId: schedule.id, cardId: card.id });
      await this.runner.enqueue(card.id);
    } catch (error) {
      await this.store.markScheduleRun(schedule.id, { enabled: false, error: error.message });
      this.emit('schedule', { scheduleId: schedule.id, error: error.message });
    }
  }
}
