import { resolveMissionRoute } from './routing.mjs';

export class Orchestrator {
  constructor(store, runner, emit = () => {}) {
    this.store = store;
    this.runner = runner;
    this.emit = emit;
  }

  async startMission(input) {
    const project = this.store.getProject(input.projectId);
    if (!project) throw new Error('미션을 실행할 repo를 선택하세요.');
    const requestedTeam = input.teamId && (project.teams || []).find((item) => item.id === input.teamId);
    if (input.teamId && !requestedTeam) throw new Error('선택한 팀을 찾을 수 없습니다.');
    const team = requestedTeam
      || (project.teams || []).find((item) => item.id === project.defaultTeamId);
    const routingScope = team ? {
      ...project,
      agentIds: team.agentIds,
      masterAgentId: team.leadAgentId,
      pipeline: team.pipeline,
      routingMode: team.routingMode,
      workflowId: team.workflowId,
    } : project;
    const route = resolveMissionRoute(routingScope, this.store.listAgents(), input.prompt, input.workflowId || routingScope.workflowId);
    const mission = await this.store.createMission({
      ...input, ...route,
      teamId: team?.id || '', teamName: team?.name || '',
      masterAgentId: team?.leadAgentId || project.masterAgentId || route.pipeline[0],
    });
    this.emit('mission', mission);
    const card = await this.createStep(mission, 0, null);
    await this.runner.enqueue(card.id);
    return this.store.getMission(mission.id);
  }

  async createStep(mission, stepIndex, previousCard) {
    const project = this.store.getProject(mission.projectId);
    const agent = this.store.getAgent(mission.pipeline[stepIndex]);
    if (!project || !agent) throw new Error('미션의 repo 또는 담당 에이전트를 찾을 수 없습니다.');
    const previousOutput = previousCard?.output?.trim();
    const handoff = previousOutput
      ? `\n\n--- 이전 작업 인계 ---\n담당: ${this.store.getAgent(previousCard.agentId)?.name || previousCard.agentId}\n결과:\n${previousOutput}`
      : '';
    const prompt = [
      '[My Vibe Office 멀티 에이전트 미션]',
      `Repo: ${project.name} (${project.path})`,
      mission.teamId && `팀: ${mission.teamName || mission.teamId}`,
      `라우팅: ${mission.routingMode || 'adaptive'} · ${mission.workflowId || 'auto'}`,
      `전체 목표: ${mission.prompt}`,
      `현재 단계: ${stepIndex + 1}/${mission.pipeline.length} · ${agent.name} (${agent.role || agent.modeId || '담당 역할'})`,
      '현재 역할의 책임 범위에서 작업하고, 다음 담당자가 이어받을 수 있도록 변경 사항, 검증 결과, 남은 위험을 정리하세요.',
    ].join('\n') + handoff;
    const card = await this.store.createCard({
      title: `[${stepIndex + 1}/${mission.pipeline.length}] ${mission.title}`,
      prompt, agentId: agent.id, workdir: project.path, projectId: project.id,
      teamId: mission.teamId || '',
      missionId: mission.id, missionStep: stepIndex, parentCardId: previousCard?.id || '',
    });
    const updated = await this.store.updateMission(mission.id, {
      status: 'running', stepIndex, currentCardId: card.id,
      cardIds: [...(mission.cardIds || []), card.id], error: '',
    });
    this.emit('card', card);
    this.emit('mission', updated);
    return card;
  }

  async handleCardComplete(card) {
    if (!card?.missionId) return;
    const mission = this.store.getMission(card.missionId);
    if (!mission || mission.status !== 'running' || mission.currentCardId !== card.id) return;
    if (card.exitCode !== 0 || card.error) {
      const failed = await this.store.updateMission(mission.id, {
        status: 'review', error: card.error || `단계 ${Number(card.missionStep) + 1} 실행에 실패했습니다.`,
        finishedAt: new Date().toISOString(),
      });
      this.emit('mission', failed);
      return;
    }
    const doneCard = await this.store.updateCard(card.id, { status: 'done' });
    this.emit('card', doneCard);
    const nextStep = Number(card.missionStep) + 1;
    if (nextStep >= mission.pipeline.length) {
      const completed = await this.store.updateMission(mission.id, {
        status: 'done', stepIndex: nextStep, currentCardId: '', finalOutput: card.output || '',
        error: '', finishedAt: new Date().toISOString(),
      });
      this.emit('mission', completed);
      return;
    }
    const nextCard = await this.createStep(this.store.getMission(mission.id), nextStep, card);
    await this.runner.enqueue(nextCard.id);
  }
}
