import { presets } from './presets.mjs';

const intentRules = [
  ['blog-article', /블로그\s*(?:글|게시|아티클)|게시물\s*(?:후보|작성|기획)|콘텐츠\s*(?:기획|작성|초안)|검색\s*의도|blog\s*(?:post|article)|seo\s*(?:글|콘텐츠)/i],
  ['incident', /장애|배포 실패|서비스 중단|incident|outage|production/i],
  ['review-only', /리뷰|검토|감사|취약점|review|audit|security/i],
  ['frontend-change', /화면|버튼|레이아웃|디자인|접근성|프론트|ui|ux|css|react|frontend/i],
  ['backend-change', /api|db|데이터베이스|서버|인증|권한|backend/i],
  ['quick-fix', /버그|오류|에러|고쳐|수정|debug|bug|fix|broken/i],
  ['direct', /계획만|기획만|요구사항|로드맵|plan only|roadmap/i],
];

const compatibleModes = {
  architect: ['architect', 'planner'],
  fullstack: ['fullstack', 'coder', 'frontend', 'backend'],
  frontend: ['frontend', 'fullstack', 'coder'],
  backend: ['backend', 'fullstack', 'coder'],
  design: ['design', 'frontend'],
  qa: ['qa', 'reviewer'],
  reviewer: ['reviewer', 'qa'],
  devops: ['devops', 'git'],
};

export function detectWorkflow(prompt = '') {
  return intentRules.find(([, pattern]) => pattern.test(prompt))?.[0] || 'feature';
}

export function resolveMissionRoute(project, agents, prompt, requestedWorkflowId = '') {
  const routingMode = project.routingMode || 'adaptive';
  if (routingMode === 'sequential') {
    return { routingMode, workflowId: 'sequential', pipeline: project.pipeline || [], modes: [] };
  }
  if (routingMode === 'manual') {
    const agentId = project.masterAgentId || project.agentIds?.[0];
    return { routingMode, workflowId: 'direct', pipeline: agentId ? [agentId] : [], modes: [] };
  }

  const workflowId = requestedWorkflowId && requestedWorkflowId !== 'auto' ? requestedWorkflowId : detectWorkflow(prompt);
  const workflow = presets.workflows.find((item) => item.id === workflowId) || presets.workflows.find((item) => item.id === 'feature');
  const assigned = agents.filter((agent) => project.agentIds?.includes(agent.id));
  const modeOf = (agent) => agent.modeId || presets.roles.find((role) => role.id === agent.presetId)?.modeId;
  const pipeline = [];
  for (const mode of workflow.modes) {
    const acceptedModes = compatibleModes[mode] || [mode];
    const available = assigned.filter((item) => !pipeline.includes(item.id));
    const agent = available.find((item) => modeOf(item) === mode)
      || available.find((item) => acceptedModes.includes(modeOf(item)));
    if (agent) pipeline.push(agent.id);
  }
  if (!pipeline.length) {
    const fallback = project.masterAgentId || assigned[0]?.id;
    if (fallback) pipeline.push(fallback);
  }
  return { routingMode, workflowId: workflow.id, pipeline, modes: workflow.modes };
}
