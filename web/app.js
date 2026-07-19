import { officeStage } from './office-stage.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (path, options = {}) => {
  const init = { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } };
  if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const viewInfo = {
  office: ['TODAY\'S OFFICE', '오피스'], board: ['WORKFLOW', '작업 보드'],
  history: ['ARCHIVE', '기록 검색'], agents: ['YOUR TEAM', '에이전트'], projects: ['WORKSPACES', '프로젝트'],
  schedules: ['AUTOMATION', '예약 작업'], usage: ['ACTIVITY', '사용 통계'], settings: ['LOCAL CONFIG', '설정'],
};
let state = { agents: [], cards: [], schedules: [], settings: {}, presets: {roles:[],tasks:[]} };
let page = 'office';

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
const agentOf = (id) => state.agents.find((a) => a.id === id);
const presetOf = (id) => state.presets.roles.find((preset) => preset.id === id);
const cardsOf = (id) => state.cards.filter((c) => c.agentId === id);
const liveCard = (id) => cardsOf(id).find((c) => c.status === 'running') || cardsOf(id).find((c) => c.status === 'review');
const shortTime = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

async function load() {
  const [next,presets] = await Promise.all([api('/api/state'),api('/api/presets')]);
  state = { ...next, presets };
  render();
}

function navigate(next) {
  page = next; $$('.nav').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  [$('#eyebrow').textContent, $('#page-title').textContent] = viewInfo[page];
  $('#new-task').hidden = page === 'settings'; render();
}

function stats() {
  return `<div class="stats"><div class="stat"><span>에이전트</span><b>${state.agents.length}</b></div><div class="stat"><span>실행/대기</span><b>${state.cards.filter(c=>c.status==='running'||c.status==='queued').length}</b></div><div class="stat"><span>검토 대기</span><b>${state.cards.filter(c=>c.status==='review').length}</b></div><div class="stat"><span>완료</span><b>${state.cards.filter(c=>c.status==='done').length}</b></div></div>`;
}

function render() {
  officeStage.unmount();
  const root = $('#page');
  if (page === 'office') root.innerHTML = officeView();
  if (page === 'board') root.innerHTML = boardView();
  if (page === 'history') root.innerHTML = historyView();
  if (page === 'agents') root.innerHTML = agentsView();
  if (page === 'projects') root.innerHTML = projectsView();
  if (page === 'schedules') root.innerHTML = schedulesView();
  if (page === 'usage') root.innerHTML = usageView();
  if (page === 'settings') root.innerHTML = settingsView();
  bindPage();
}

function officeView() {
  const active=state.cards.filter(c=>c.status==='running'||c.status==='queued').length,review=state.cards.filter(c=>c.status==='review').length;
  const readiness=[
    {ok:Boolean(state.settings.defaultWorkdir||(state.settings.projects||[]).length),label:'작업 폴더'},
    {ok:Boolean(state.agents.length),label:'에이전트'},
    {ok:Boolean(state.agents.length&&state.agents.every(a=>a.presetId||a.systemPrompt)),label:'역할 지시'},
    {ok:Boolean(state.settings.adapters?.codex?.executable||state.settings.adapters?.custom?.executable),label:'실행 어댑터'},
  ];
  const readyCount=readiness.filter(item=>item.ok).length;
  const shelf=(status,label)=>{const rows=state.cards.filter(c=>c.status===status).slice(0,6);return `<section class="office-shelf"><h3><span>${label}</span><b>${state.cards.filter(c=>c.status===status).length}</b></h3><div class="office-shelf-list">${rows.map(c=>`<button class="office-mini-card" data-card="${c.id}">${esc(c.title)}</button>`).join('')||'<div class="office-shelf-empty">비어 있음</div>'}</div></section>`;};
  return `<div class="office-dashboard"><section class="office-readiness"><div><b>시작 준비 ${readyCount}/4</b><span>${readyCount===4?'바로 작업을 맡길 수 있습니다.':'빠진 항목을 누르면 해당 설정으로 이동합니다.'}</span></div><div class="readiness-items">${readiness.map((item,i)=>`<button data-ready="${i}" class="${item.ok?'ok':''}">${item.ok?'✓':'○'} ${item.label}</button>`).join('')}</div></section><div class="office-statusbar"><div><h3>Local Agent Office</h3><p>에이전트가 쉬고, 이동하고, 작업하는 실시간 공간</p></div><div class="office-live-summary"><span>출근 <b>${state.agents.length}</b></span><span>작업/대기 <b>${active}</b></span><span>검토 <b>${review}</b></span></div></div><div class="office-canvas-frame"><button class="office-add-agent" id="office-add-agent">＋ 에이전트 생성</button><canvas id="office-stage" aria-label="에이전트 가상 오피스"></canvas></div><div class="office-roster">${state.agents.map(a=>{const preset=presetOf(a.presetId);return `<button class="office-agent-chip" data-agent="${a.id}"><i style="background:${a.color}"></i><span><b>${esc(a.name)}</b><small>${esc(preset?.name||a.role||'역할 미지정')}</small></span></button>`;}).join('')}</div><section class="office-launcher"><div class="launcher-main"><select id="office-agent">${state.agents.map(a=>`<option value="${a.id}">${esc(a.name)} · ${esc(presetOf(a.presetId)?.name||a.role||a.adapter)}</option>`).join('')||'<option value="">에이전트가 필요합니다</option>'}</select><textarea id="office-prompt" placeholder="할 일을 적고 Enter로 바로 착수 · Shift+Enter 줄바꿈"></textarea><button class="launcher-settings" id="office-task-options" title="상세 작업 만들기">⚙</button><button class="primary" id="office-send" ${state.agents.length?'':'disabled'}>보내기</button></div><div class="launcher-hints"><span>로컬 실행</span><span>${esc(state.settings.defaultWorkdir||'기본 작업 폴더')}</span><span>완료 후 검토 대기</span></div></section><div class="office-shelves">${shelf('todo','TO-DO 선반')}${shelf('review','REVIEW 선반')}${shelf('done','DONE 선반')}</div></div>`;
}

const columns = [['todo','할 일'],['queued','대기열'],['running','작업 중'],['review','검토'],['done','완료']];
function boardView() {
  return `<div class="board">${columns.map(([key,label]) => { const list=state.cards.filter(c=>c.status===key); return `<section class="column"><div class="column-head"><span>${label}</span><span class="count">${list.length}</span></div>${list.map(cardHtml).join('') || '<div class="empty" style="padding:35px 4px;font-size:11px">비어 있음</div>'}</section>`; }).join('')}</div>`;
}
function cardHtml(c) { const a=agentOf(c.agentId)||{name:'삭제된 에이전트',color:'#999'}; return `<article class="card" data-card="${c.id}"><h3>${esc(c.title)}</h3><div class="card-meta"><span class="mini-agent"><i style="background:${a.color}"></i>${esc(a.name)}</span><span>${shortTime(c.updatedAt)}</span></div></article>`; }

function historyView(){return `<section class="panel"><div class="row"><div class="field"><label>제목·지시·로그 검색</label><input id="history-query" placeholder="검색어를 입력하세요"></div><div class="field"><label>상태</label><select id="history-status"><option value="">전체</option>${columns.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></div></div></section><div id="history-results" class="history-list">${historyResults('', '')}</div>`;}
function historyResults(query,status){const q=query.trim().toLowerCase();const rows=state.cards.filter(c=>(!status||c.status===status)&&(!q||`${c.title}\n${c.prompt}\n${c.output}\n${(c.followups||[]).map(f=>f.text).join('\n')}`.toLowerCase().includes(q)));return rows.map(c=>{const a=agentOf(c.agentId)||{};const snippet=(c.output||c.prompt||'').replace(/\s+/g,' ').slice(0,180);return `<article class="panel history-item" data-card="${c.id}"><div><span class="status-pill ${c.status}">${esc(c.status)}</span><h3>${esc(c.title)}</h3><p>${esc(snippet)}</p></div><div class="history-meta">${esc(a.name||'알 수 없음')}<br>${shortTime(c.updatedAt)}</div></article>`;}).join('')||'<div class="empty">일치하는 작업 기록이 없습니다.</div>';}

function projectsView(){const rows=state.settings.projects||[];return `<div class="settings"><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>작업 폴더 프리셋</h3><p style="margin:0;color:var(--muted);font-size:11px">새 작업과 예약에서 반복해서 사용할 폴더를 저장합니다.</p></div><button class="primary" id="add-project">＋ 프로젝트</button></div></section>${rows.map(p=>`<section class="panel project-card"><div><h3>${esc(p.name)}</h3><p>${esc(p.description||'설명 없음')}</p><code>${esc(p.path)}</code></div><div class="actions"><button class="secondary task-project" data-path="${esc(p.path)}">작업 만들기</button><button class="danger delete-project" data-id="${p.id}">삭제</button></div></section>`).join('')||'<div class="empty"><div class="big">▰</div><b>저장된 프로젝트가 없습니다</b><p>자주 사용하는 저장소나 문서 폴더를 등록하세요.</p></div>'}</div>`;}

function agentsView() {
  return `<section class="panel"><h3>역할 프리셋</h3><p>프리셋으로 새 직원을 만들거나 기존 직원의 역할·기본 지시·색상을 한 번에 교체할 수 있습니다.</p><div class="preset-row">${state.presets.roles.map(r=>`<button class="preset-agent" data-preset="${r.id}"><i style="background:${r.color}"></i><b>${esc(r.name)}</b><span>${esc(r.role)}</span><em>새 에이전트 만들기</em></button>`).join('')}</div></section><div class="agent-grid" style="margin-top:14px">${state.agents.map(a=>{const preset=presetOf(a.presetId);return `<article class="panel agent-card"><div class="agent-line"><div class="avatar" style="background:${a.color};color:${a.color}"><span style="color:#fff">${esc(a.name.slice(0,2).toUpperCase())}</span></div><div><b>${esc(a.name)}</b><small>${esc(a.adapter)}${a.model?' · '+esc(a.model):''}</small></div></div><span class="role-badge ${preset?'assigned':'custom'}">${preset?'프리셋 · '+esc(preset.name):a.systemPrompt?'사용자 역할':'역할 미지정'}</span><p>${esc(a.role||'역할 프리셋을 지정해 이 에이전트의 전문성을 정하세요.')}</p><div class="actions"><button class="primary role-agent" data-id="${a.id}">${preset?'역할 변경':'역할 지정'}</button><button class="secondary edit-agent" data-id="${a.id}">세부 편집</button><button class="secondary task-agent" data-id="${a.id}">작업 맡기기</button><button class="danger delete-agent" data-id="${a.id}">삭제</button></div></article>`;}).join('')}<button class="panel agent-card" id="add-agent" style="border-style:dashed;cursor:pointer;min-height:180px;color:var(--muted);font-weight:800">＋ 빈 에이전트</button></div>`;
}

function schedulesView(){const rows=state.schedules||[],days=['일','월','화','수','목','금','토'];const label=s=>s.type==='interval'?`${s.intervalMinutes}분 간격`:s.type==='daily'?`매일 ${s.time}`:s.type==='weekly'?`매주 ${days[s.weekday]}요일 ${s.time}`:`1회 · ${shortTime(s.runAt)}`;return `<div class="settings"><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>자동 실행</h3><p style="margin:0;color:var(--muted);font-size:11px">한 번, 간격, 매일, 매주 규칙으로 작업 카드를 만듭니다.</p></div><button class="primary" id="add-schedule">＋ 예약</button></div></section>${rows.map(s=>`<section class="panel"><div style="display:flex;justify-content:space-between;gap:16px"><div><h3>${esc(s.name)}</h3><p>${label(s)} · 다음 ${s.nextRunAt?shortTime(s.nextRunAt):'없음'}${s.error?` · 오류: ${esc(s.error)}`:''}</p></div><div class="actions"><button class="secondary run-schedule" data-id="${s.id}">지금 실행</button><button class="danger delete-schedule" data-id="${s.id}">삭제</button></div></div></section>`).join('')||'<div class="empty"><div class="big">◷</div><b>예약 작업이 없습니다</b><p>반복 리포트나 정기 점검을 자동화할 수 있습니다.</p></div>'}</div>`;}

function usageView(){const rows={};let input=0,output=0,duration=0,runs=0;for(const c of state.cards){const a=agentOf(c.agentId)?.name||'알 수 없음';rows[a]||={tokens:0,duration:0,runs:0};for(const run of [...(c.runs||[]),c]){if(run.finishedAt){runs++;rows[a].runs++;}const d=Number(run.durationMs||0);duration+=d;rows[a].duration+=d;for(const e of run.events||[]){const u=e.data?.usage;if(u){input+=Number(u.input_tokens||0);output+=Number(u.output_tokens||0);rows[a].tokens+=Number(u.input_tokens||0)+Number(u.output_tokens||0);}}}}const max=Math.max(1,...Object.values(rows).map(r=>r.tokens));return `${`<div class="stats"><div class="stat"><span>완료 실행</span><b>${runs}</b></div><div class="stat"><span>입력 토큰</span><b>${input.toLocaleString()}</b></div><div class="stat"><span>출력 토큰</span><b>${output.toLocaleString()}</b></div><div class="stat"><span>실행 시간</span><b>${Math.round(duration/60000)}m</b></div></div>`}<section class="panel"><h3>에이전트별 활동</h3><p>앱을 통해 실행한 기록 기준입니다.</p>${Object.entries(rows).map(([name,r])=>`<div class="usage-row"><span>${esc(name)} · ${r.runs}회</span><div><i style="width:${Math.max(3,r.tokens/max*100)}%"></i></div><b>${r.tokens.toLocaleString()} tok</b></div>`).join('')||'<div class="empty">아직 실행 기록이 없습니다.</div>'}</section>`;}

function settingsView() {
  const s=state.settings, a=s.adapters||{};
  const detected=s.detected||{};
  return `<div class="settings"><section class="panel"><h3>실행 환경</h3><p>모든 설정은 이 PC에만 저장됩니다. 마지막 자동 감지: ${detected.checkedAt?shortTime(detected.checkedAt):'아직 없음'}</p><div class="row"><div class="field"><label>동시 실행 수</label><input id="set-concurrency" type="number" min="1" max="8" value="${s.concurrency||2}"></div><div class="field"><label>기본 작업 폴더</label><div class="input-action"><input id="set-workdir" value="${esc(s.defaultWorkdir||'')}" placeholder="C:\\workspace"><button type="button" class="secondary" id="pick-default-folder">찾기</button></div></div></div></section><section class="panel"><h3>Windows 데스크톱</h3><p>앱 창을 닫으면 트레이에 유지됩니다.</p><div class="actions"><button class="secondary" id="toggle-autostart" disabled>자동 시작 확인 중…</button></div></section>${['codex','claude','custom'].map(k=>adapterPanel(k,a[k]||{})).join('')}<button class="primary" id="save-settings">설정 저장</button></div>`;
}
function adapterPanel(key,a){return `<section class="panel"><h3>${esc(a.label||key)} 어댑터</h3><p>명령은 셸을 통하지 않고 직접 실행됩니다.</p><div class="field"><label>실행 파일</label><input id="${key}-exe" value="${esc(a.executable||'')}" placeholder="${key}"></div><div class="field"><label>인자 · 한 줄에 하나</label><textarea id="${key}-args">${esc((a.args||[]).join('\n'))}</textarea><span class="hint">사용 가능: {prompt}, {workdir}, {model}</span></div></section>`;}

function bindPage() {
  if(page==='office'&&$('#office-stage'))officeStage.mount($('#office-stage'),state.agents,state.cards,id=>openAgent(id));
  $$('.office-agent-chip').forEach(el=>el.onclick=()=>openAgent(el.dataset.agent));
  $$('.readiness-items button').forEach(el=>el.onclick=()=>{const target=Number(el.dataset.ready);if(target===0)navigate('projects');else if(target===1||target===2)navigate('agents');else navigate('settings');});
  $$('.desk').forEach(el=>el.onclick=()=>openAgent(el.dataset.agent));
  $$('.office-mini-card').forEach(el=>el.onclick=()=>openCard(el.dataset.card));
  $('#office-add-agent')?.addEventListener('click',()=>openAgent());
  $('#office-task-options')?.addEventListener('click',()=>openTask($('#office-agent')?.value||''));
  const quickPrompt=$('#office-prompt');
  const sendQuick=async()=>{const prompt=quickPrompt?.value.trim(),agentId=$('#office-agent')?.value;if(!prompt||!agentId)return;try{const card=await api('/api/cards',{method:'POST',body:{title:prompt.split(/\r?\n/)[0].slice(0,64),prompt,agentId,workdir:state.settings.defaultWorkdir||''}});quickPrompt.value='';await api(`/api/cards/${card.id}/run`,{method:'POST'});await load();}catch(e){toast(e.message);}};
  $('#office-send')?.addEventListener('click',sendQuick);
  quickPrompt?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQuick();}});
  $$('.card').forEach(el=>el.onclick=()=>openCard(el.dataset.card));
  $('#empty-agent')?.addEventListener('click',()=>openAgent()); $('#add-agent')?.addEventListener('click',()=>openAgent());
  $$('.preset-agent').forEach(el=>el.onclick=()=>openAgent('',el.dataset.preset));
  $$('.edit-agent').forEach(el=>el.onclick=()=>openAgent(el.dataset.id));
  $$('.role-agent').forEach(el=>el.onclick=()=>openRoleAssign(el.dataset.id));
  $$('.task-agent').forEach(el=>el.onclick=()=>openTask(el.dataset.id));
  $$('.delete-agent').forEach(el=>el.onclick=async()=>{if(confirm('이 에이전트를 삭제할까요?')){await act(()=>api('/api/agents/'+el.dataset.id,{method:'DELETE'}));await load();}});
  const historyQuery=$('#history-query'),historyStatus=$('#history-status');
  const filterHistory=()=>{const box=$('#history-results');if(!box)return;box.innerHTML=historyResults(historyQuery?.value||'',historyStatus?.value||'');$$('.history-item',box).forEach(el=>el.onclick=()=>openCard(el.dataset.card));};
  historyQuery?.addEventListener('input',filterHistory);historyStatus?.addEventListener('change',filterHistory);
  $('#add-project')?.addEventListener('click',openProject);
  $$('.task-project').forEach(el=>el.onclick=()=>openTask('',el.dataset.path));
  $$('.delete-project').forEach(el=>el.onclick=async()=>{if(confirm('이 프로젝트 프리셋을 삭제할까요?')){await act(()=>api('/api/projects/'+el.dataset.id,{method:'DELETE'}));await load();}});
  $('#add-schedule')?.addEventListener('click',openSchedule);
  $$('.run-schedule').forEach(el=>el.onclick=async()=>{await act(()=>api('/api/schedules/'+el.dataset.id+'/run',{method:'POST'}));toast('예약 작업을 실행 대기열에 추가했습니다.');await load();});
  $$('.delete-schedule').forEach(el=>el.onclick=async()=>{if(confirm('이 예약을 삭제할까요?')){await act(()=>api('/api/schedules/'+el.dataset.id,{method:'DELETE'}));await load();}});
  $('#save-settings')?.addEventListener('click',saveSettings);
  $('#pick-default-folder')?.addEventListener('click',async()=>{try{const result=await api('/api/pick-folder',{method:'POST'});if(result.path)$('#set-workdir').value=result.path;}catch(e){toast(e.message);}});
  if($('#toggle-autostart'))loadDesktopSettings();
}

async function loadDesktopSettings(){const btn=$('#toggle-autostart');if(!btn)return;try{let current=await api('/api/desktop');if(!current.supported){btn.textContent='브라우저 모드에서는 자동 시작을 설정할 수 없습니다';return;}const paint=()=>{btn.disabled=false;btn.textContent=current.autostart?'✓ Windows 시작 시 자동 실행':'Windows 자동 시작 켜기';};paint();btn.onclick=async()=>{current=await api('/api/desktop/autostart',{method:'POST',body:{on:!current.autostart}});paint();toast(current.autostart?'자동 시작을 켰습니다.':'자동 시작을 껐습니다.');};}catch(e){btn.textContent=e.message;}}

function openProject(){showModal('WORKSPACE','프로젝트 추가',`<div class="field"><label>이름</label><input id="project-name" placeholder="내 앱"></div><div class="field"><label>폴더</label><div class="input-action"><input id="project-path" placeholder="C:\\workspace\\my-app"><button type="button" class="secondary" id="pick-project-folder">찾기</button></div></div><div class="field"><label>설명</label><input id="project-description" placeholder="프로젝트 용도나 주의사항"></div><div class="actions"><button class="primary" type="submit">저장</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{await api('/api/projects',{method:'POST',body:{name:$('#project-name').value,path:$('#project-path').value,description:$('#project-description').value}});$('#modal').close();await load();});$('#pick-project-folder').onclick=async()=>{try{const result=await api('/api/pick-folder',{method:'POST'});if(result.path)$('#project-path').value=result.path;}catch(e){toast(e.message);}};}

function openSchedule(){if(!state.agents.length){toast('먼저 에이전트를 만들어 주세요.');navigate('agents');return;}const next=new Date(Date.now()+3600000);next.setSeconds(0,0);const local=new Date(next.getTime()-next.getTimezoneOffset()*60000).toISOString().slice(0,16);const projects=state.settings.projects||[];showModal('AUTOMATION','예약 작업 만들기',`<div class="field"><label>이름</label><input id="sch-name" placeholder="매일 프로젝트 상태 점검"></div><div class="row"><div class="field"><label>에이전트</label><select id="sch-agent">${state.agents.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label>방식</label><select id="sch-type"><option value="once">한 번</option><option value="interval">반복 간격</option><option value="daily">매일</option><option value="weekly">매주</option></select></div></div><div class="row"><div class="field"><label>1회 실행 시각</label><input id="sch-at" type="datetime-local" value="${local}"></div><div class="field"><label>반복 간격(분)</label><input id="sch-interval" type="number" min="1" value="60"></div></div><div class="row"><div class="field"><label>매일/매주 시각</label><input id="sch-time" type="time" value="09:00"></div><div class="field"><label>요일</label><select id="sch-weekday">${['일','월','화','수','목','금','토'].map((d,i)=>`<option value="${i}" ${i===1?'selected':''}>${d}요일</option>`).join('')}</select></div></div><div class="field"><label>프로젝트</label><select id="sch-project"><option value="">기본 작업 폴더</option>${projects.map(p=>`<option value="${esc(p.path)}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>작업 폴더</label><input id="sch-workdir" value="${esc(state.settings.defaultWorkdir||'')}"></div><div class="field"><label>작업 지시</label><textarea id="sch-prompt" placeholder="정기적으로 수행할 작업과 완료 조건"></textarea></div><div class="actions"><button class="primary" type="submit">예약 저장</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{await api('/api/schedules',{method:'POST',body:{name:$('#sch-name').value,agentId:$('#sch-agent').value,type:$('#sch-type').value,runAt:new Date($('#sch-at').value).toISOString(),intervalMinutes:$('#sch-interval').value,time:$('#sch-time').value,weekday:$('#sch-weekday').value,workdir:$('#sch-workdir').value,prompt:$('#sch-prompt').value}});$('#modal').close();await load();});$('#sch-project').onchange=()=>{if($('#sch-project').value)$('#sch-workdir').value=$('#sch-project').value;};}

function showModal(kicker,title,html,onSubmit) {
  $('#modal-kicker').textContent=kicker; $('#modal-title').textContent=title; $('#modal-body').innerHTML=html;
  const form=$('#modal-form'); form.onsubmit=async(e)=>{e.preventDefault();if(e.submitter?.value==='cancel'){$('#modal').close();return;}await onSubmit?.(e);};
  $$('[value="cancel"]',$('#modal-body')).forEach(button=>{button.type='button';button.onclick=()=>$('#modal').close();});
  $('#modal').showModal();
}

function openAgent(id,presetId='') {
  const preset=state.presets.roles.find(r=>r.id===presetId);
  const a=agentOf(id)||(preset?{name:preset.name,role:preset.role,adapter:'codex',model:'',color:preset.color,systemPrompt:preset.prompt,presetId:preset.id}:{name:'',role:'',adapter:'codex',model:'',color:'#6958d9',systemPrompt:'',presetId:''});
  const selected=presetId||a.presetId||'';
  showModal('TEAM MEMBER',id?'에이전트 편집':'새 에이전트',`<div class="prompt-guide"><b>기본 역할 지시란?</b><span>이 에이전트가 모든 작업에서 지킬 전문성·원칙입니다. 역할 프리셋을 고르면 역할·색상·기본 지시가 실제 에이전트 설정에 적용됩니다.</span></div><div class="field"><label>역할 프리셋</label><select id="a-preset"><option value="">사용자 직접 설정</option>${state.presets.roles.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${esc(r.name)} · ${esc(r.role)}</option>`).join('')}</select><span class="hint">프리셋을 바꾸면 아래 역할·색상·기본 지시가 교체됩니다.</span></div><div class="row"><div class="field"><label>이름</label><input id="a-name" value="${esc(a.name)}" required></div><div class="field"><label>역할</label><input id="a-role" value="${esc(a.role)}" placeholder="개발자, 리서처…"></div></div><div class="row"><div class="field"><label>어댑터</label><select id="a-adapter">${['codex','claude','custom'].map(v=>`<option ${a.adapter===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>모델 (선택)</label><input id="a-model" value="${esc(a.model)}"></div></div><div class="field"><label>색상</label><input id="a-color" type="color" value="${a.color}"></div><div class="field"><label>기본 역할 지시</label><textarea id="a-prompt" placeholder="비워도 됩니다. 역할 프리셋을 사용하면 자동으로 채워집니다.">${esc(a.systemPrompt)}</textarea><span class="hint">실행할 때 이 지시가 모든 작업 프롬프트 앞에 자동으로 결합됩니다.</span></div><div class="actions"><button class="primary" type="submit">${id?'변경 저장':'에이전트 생성'}</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{await act(()=>api('/api/agents',{method:'POST',body:{id,name:$('#a-name').value,role:$('#a-role').value,adapter:$('#a-adapter').value,model:$('#a-model').value,color:$('#a-color').value,systemPrompt:$('#a-prompt').value,presetId:$('#a-preset').value}}));$('#modal').close();await load();});
  $('#a-preset').onchange=()=>{const role=presetOf($('#a-preset').value);if(!role)return;$('#a-role').value=role.role;$('#a-color').value=role.color;$('#a-prompt').value=role.prompt;if(!id&&!$('#a-name').value.trim())$('#a-name').value=role.name;};
}

function openRoleAssign(id){
  const agent=agentOf(id);if(!agent)return;
  showModal('ROLE ASSIGNMENT',`${agent.name} 역할 지정`,`<div class="prompt-guide"><b>역할을 선택하면 무엇이 바뀌나요?</b><span>에이전트 이름과 CLI 연결은 유지하고, 역할 설명·기본 역할 지시·캐릭터 색상을 선택한 프리셋으로 교체합니다.</span></div><div class="role-choice-list">${state.presets.roles.map(r=>`<label class="role-choice"><input type="radio" name="role-choice" value="${r.id}" ${agent.presetId===r.id?'checked':''}><i style="background:${r.color}"></i><span><b>${esc(r.name)}</b><small>${esc(r.role)}</small><em>${esc(r.prompt)}</em></span></label>`).join('')}</div><label class="check-row"><input id="keep-agent-color" type="checkbox"> 현재 캐릭터 색상 유지</label><div class="actions"><button class="primary" type="submit">역할 적용</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{const chosen=$('input[name="role-choice"]:checked');if(!chosen){toast('적용할 역할을 선택하세요.');return;}await api(`/api/agents/${id}/preset`,{method:'POST',body:{presetId:chosen.value,keepColor:$('#keep-agent-color').checked}});$('#modal').close();await load();toast(`${agent.name}에게 역할을 적용했습니다.`);});
}

function openTask(agentId='',presetWorkdir='') {
  if(!state.agents.length){toast('먼저 에이전트를 만들어 주세요.');navigate('agents');return;}
  const s=state.settings, projects=s.projects||[], workdir=presetWorkdir||s.defaultWorkdir||'';
  showModal('NEW ASSIGNMENT','새 작업',`<div class="prompt-guide"><b>이번 작업 상세 지시</b><span>목표·제약·완료 조건을 적으세요. 아래 템플릿을 선택하면 권장 구조를 자동으로 채웁니다.</span></div><div class="field"><label>작업 제목</label><input id="t-title" required placeholder="무엇을 맡길까요?"></div><div class="row"><div class="field"><label>에이전트</label><select id="t-agent">${state.agents.map(a=>`<option value="${a.id}" ${a.id===agentId?'selected':''}>${esc(a.name)} · ${esc(presetOf(a.presetId)?.name||a.role||a.adapter)}</option>`).join('')}</select></div><div class="field"><label>작업 템플릿</label><select id="t-template"><option value="">직접 작성</option>${state.presets.tasks.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div></div><div class="field"><label>프로젝트 프리셋</label><select id="t-project"><option value="">직접 지정</option>${projects.map(p=>`<option value="${esc(p.path)}" ${p.path===workdir?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>작업 폴더</label><div class="input-action"><input id="t-workdir" value="${esc(workdir)}" placeholder="에이전트가 작업할 폴더"><button type="button" class="secondary" id="pick-task-folder">찾기</button></div></div><div class="field"><label>상세 지시</label><textarea id="t-prompt" required placeholder="목표, 제약, 완료 조건을 적어주세요."></textarea></div><label class="check-row"><input id="t-run-now" type="checkbox" checked> 만든 뒤 바로 실행하기</label><div class="actions"><button class="primary" type="submit">작업 만들기</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{const card=await act(()=>api('/api/cards',{method:'POST',body:{title:$('#t-title').value,agentId:$('#t-agent').value,workdir:$('#t-workdir').value,prompt:$('#t-prompt').value}}));const runNow=$('#t-run-now').checked;if(runNow){try{await api(`/api/cards/${card.id}/run`,{method:'POST'});}catch(e){toast(`작업은 저장했지만 실행하지 못했습니다: ${e.message}`);}}$('#modal').close();await load();navigate(runNow?'office':'board');});
  $('#t-template').onchange=()=>{const template=state.presets.tasks.find(t=>t.id===$('#t-template').value);if(template)$('#t-prompt').value=template.template;};
  $('#t-project').onchange=()=>{if($('#t-project').value)$('#t-workdir').value=$('#t-project').value;};
  $('#pick-task-folder').onclick=async()=>{try{const result=await api('/api/pick-folder',{method:'POST'});if(result.path)$('#t-workdir').value=result.path;}catch(e){toast(e.message);}};
}

function openCard(id) {
  const c=state.cards.find(x=>x.id===id); if(!c)return; const a=agentOf(c.agentId)||{};
  const busy=c.status==='running'||c.status==='queued';
  const controls=c.status==='todo'?`<button type="button" class="primary" data-act="run">▶ 실행</button>`:busy?`<button type="button" class="danger" data-act="stop">■ ${c.status==='queued'?'대기 취소':'중지'}</button>`:c.status==='review'?`<button type="button" class="primary" data-act="done">✓ 완료</button><button type="button" class="secondary" data-act="run">↻ 다시 실행</button>`:`<button type="button" class="secondary" data-act="move">할 일로 이동</button>`;
  const duration=c.durationMs!=null?` · ${(c.durationMs/1000).toFixed(1)}초`:'';
  showModal(esc(a.name||'AGENT'),c.title,`${c.error?`<div class="error-box">${esc(c.error)}</div>`:''}<div class="field"><label>작업 지시</label><div style="font-size:12px;line-height:1.6;white-space:pre-wrap">${esc(c.prompt)}</div><span class="hint">상태: ${esc(c.status)}${duration} · 이전 실행 ${(c.runs||[]).length}회${c.sessionId?' · 세션 '+esc(c.sessionId.slice(0,8)):''}</span></div><div class="field"><label>실행 로그</label><div class="log" id="card-log">${esc(c.output||'아직 실행 로그가 없습니다.')}</div></div>${c.status==='review'?`<div class="field"><label>후속 지시 후 같은 세션 계속</label><textarea id="followup-text" placeholder="수정하거나 추가로 확인할 내용을 입력하세요."></textarea></div>`:''}<div class="field"><label>이번 실행 산출물</label><div id="artifact-list" class="artifact-list">확인 중…</div><pre id="artifact-preview" class="log" hidden></pre></div><div class="actions">${controls}${c.status==='review'?'<button type="button" class="secondary" data-act="followup">＋ 후속 실행</button>':''}<button type="button" class="secondary" data-act="edit" ${busy?'disabled':''}>편집</button><button type="button" class="danger" data-act="delete" ${busy?'disabled':''}>삭제</button><button class="secondary" value="cancel">닫기</button></div>`,null);
  loadArtifacts(id);
  $$('[data-act]',$('#modal-body')).forEach(b=>b.onclick=async()=>{const action=b.dataset.act;try{if(action==='edit'){openCardEdit(id);return;}if(action==='delete'&&!confirm('이 작업과 로그를 삭제할까요?'))return;if(action==='delete')await api('/api/cards/'+id,{method:'DELETE'});else if(action==='move')await api(`/api/cards/${id}/move`,{method:'POST',body:{status:'todo'}});else if(action==='followup')await api(`/api/cards/${id}/followup`,{method:'POST',body:{text:$('#followup-text').value}});else await api(`/api/cards/${id}/${action}`,{method:'POST'});$('#modal').close();await load();}catch(e){toast(e.message);}});
}

async function loadArtifacts(id){const box=$('#artifact-list');if(!box)return;try{const rows=await api('/api/artifacts?cardId='+encodeURIComponent(id));box.innerHTML=rows.length?rows.slice(0,30).map(f=>`<div><button type="button" class="artifact-file" data-path="${esc(f.path)}">${esc(f.path)}</button><span>${Math.max(1,Math.round(f.size/1024))} KB <button type="button" class="artifact-reveal" data-path="${esc(f.path)}" title="파일 위치 열기">↗</button></span></div>`).join(''):'변경된 파일이 없습니다.';$$('.artifact-file',box).forEach(btn=>btn.onclick=async()=>{const preview=$('#artifact-preview');try{const file=await api('/api/artifact?cardId='+encodeURIComponent(id)+'&path='+encodeURIComponent(btn.dataset.path));preview.hidden=false;preview.textContent=file.content;}catch(e){toast(e.message);}});$$('.artifact-reveal',box).forEach(btn=>btn.onclick=async()=>{try{await api('/api/artifact/open',{method:'POST',body:{cardId:id,path:btn.dataset.path}});}catch(e){toast(e.message);}});}catch(e){box.textContent=e.message;}}

function openCardEdit(id){const c=state.cards.find(x=>x.id===id);if(!c)return;showModal('EDIT TASK','작업 편집',`<div class="field"><label>제목</label><input id="edit-title" value="${esc(c.title)}"></div><div class="field"><label>작업 폴더</label><input id="edit-workdir" value="${esc(c.workdir||'')}"></div><div class="field"><label>작업 지시</label><textarea id="edit-prompt">${esc(c.prompt)}</textarea></div><div class="actions"><button class="primary" type="submit">저장</button><button class="secondary" value="cancel">취소</button></div>`,async()=>{await api('/api/cards/'+id,{method:'PUT',body:{title:$('#edit-title').value,workdir:$('#edit-workdir').value,prompt:$('#edit-prompt').value}});$('#modal').close();await load();});}

async function saveSettings(){const adapters={};for(const k of ['codex','claude','custom'])adapters[k]={executable:$(`#${k}-exe`).value,args:$(`#${k}-args`).value.split('\n').map(v=>v.trim()).filter(Boolean)};await act(()=>api('/api/settings',{method:'PUT',body:{concurrency:$('#set-concurrency').value,defaultWorkdir:$('#set-workdir').value,adapters}}));await load();toast('설정을 저장했습니다.');}
async function act(fn){try{return await fn();}catch(e){toast(e.message);throw e;}}

$$('.nav').forEach(b=>b.onclick=()=>navigate(b.dataset.page)); $('#new-task').onclick=()=>openTask();
$('#modal-close').onclick=()=>$('#modal').close();
const events=new EventSource('/api/events');
events.onopen=()=>{$('#server-dot').classList.add('ok');$('#server-label').textContent='서버 연결됨';};
events.onerror=()=>{$('#server-dot').classList.remove('ok');$('#server-label').textContent='재연결 중';};
events.addEventListener('card',async(e)=>{const card=JSON.parse(e.data);const i=state.cards.findIndex(c=>c.id===card.id);if(i>=0)state.cards[i]=card;else state.cards.unshift(card);render();if($('#card-log')&&card.output)$('#card-log').textContent=card.output;});
events.addEventListener('log',e=>{const d=JSON.parse(e.data),log=$('#card-log');if(log){log.textContent=(log.textContent==='아직 실행 로그가 없습니다.'?'':log.textContent)+d.text;log.scrollTop=log.scrollHeight;}});
events.addEventListener('reload',load);
load().catch(e=>toast(e.message));
