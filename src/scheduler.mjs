import { nextScheduleAt } from './store.mjs';

const sameLocalDay = (value, at) => {
  const date = new Date(value || 0);
  return date.getFullYear() === at.getFullYear() && date.getMonth() === at.getMonth() && date.getDate() === at.getDate();
};

export function dailyReportPrompt(store, schedule, at = new Date()) {
  const snapshot = store.snapshot();
  const agents = new Map((snapshot.agents || []).map((agent) => [agent.id, agent.name]));
  const cards = (snapshot.cards || []).filter((card) => card.projectId === schedule.projectId && sameLocalDay(card.updatedAt || card.createdAt, at));
  const missions = (snapshot.missions || []).filter((mission) => mission.projectId === schedule.projectId && sameLocalDay(mission.updatedAt || mission.createdAt, at));
  const work = cards.slice(-30).map((card) => `- [${card.status}] ${card.title} · ${agents.get(card.agentId) || '담당자 미상'}${card.durationMs != null ? ` · ${(card.durationMs / 1000).toFixed(1)}초` : ''}${card.error ? ' · 오류 있음' : ''}`).join('\n') || '- 오늘 기록된 작업 카드 없음';
  const missionRows = missions.slice(-15).map((mission) => `- [${mission.status}] ${mission.title} · ${mission.teamName || '기본 팀'} · ${Math.min(Number(mission.stepIndex || 0) + 1, mission.pipeline?.length || 1)}/${mission.pipeline?.length || 1} 단계`).join('\n') || '- 오늘 기록된 멀티 에이전트 미션 없음';
  return `${schedule.prompt}\n\n--- 자동 수집된 로컬 활동 요약 ---\n기준 날짜: ${at.toLocaleDateString('ko-KR')}\n\n작업 카드:\n${work}\n\n멀티 에이전트 미션:\n${missionRows}\n\n현재 작업 폴더의 Git 상태와 당일 변경도 직접 확인하세요. 원본 프롬프트, 비밀값, 내부 URL, 사용자명과 로컬 절대 경로는 보고서에 포함하지 마세요. Markdown 초안만 반환하고 파일 수정·커밋·푸시·외부 게시는 하지 마세요.`;
}

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
      const prompt = schedule.templateId === 'daily-report' ? dailyReportPrompt(this.store, schedule, at) : schedule.prompt;
      const card = await this.store.createCard({
        title: schedule.templateId === 'daily-report' ? `[데일리 리포트] ${schedule.name}` : `[예약] ${schedule.name}`, prompt,
        agentId: schedule.agentId, workdir: schedule.workdir, projectId: schedule.projectId,
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
