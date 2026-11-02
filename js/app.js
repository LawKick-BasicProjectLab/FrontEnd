/* ═════════ 공통 ═════════ */
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MAXQ = 10;
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),2000); }
const ALL_STAGES = [];
COURSES.forEach(c => c.chapters.forEach(ch => ch.stages.forEach((s, i) => ALL_STAGES.push({c, ch, s, i}))));
const findStage = id => ALL_STAGES.find(x => x.s.id === id);
const today = () => new Date().toISOString().slice(0,10);
function hash(str){ let h=2166136261; for(const ch of 'lawkick:'+str){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(16); }

/* ═════════ 계정 & 진행 ═════════ */
let me = null;     // {email, nick, guest, rankOpt, created}
let pg = null;     // progress
function freshProgress(){ return {xp:0, coins:30, cleared:{}, seen:{}, badges:[], hist:[], visits:[]}; }
function loadProgress(){
  pg = Object.assign(freshProgress(), LS.get('lk_prog_'+me.email, {}));
  if(!pg.visits.includes(today())){ pg.visits.push(today()); }
  saveProgress();
}
function saveProgress(){ LS.set('lk_prog_'+me.email, pg); syncRank(); }
function startSession(acc){
  me = acc; LS.set('lk_session', acc.email); loadProgress(); go('home');
}
function accounts(){ return LS.get('lk_accounts', {}); }

$('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('liEmail').value.trim().toLowerCase(), pw = $('liPw').value;
  const acc = accounts()[email];
  if(!email || !pw){ $('liErr').textContent='이메일과 비밀번호를 입력해 주세요.'; return; }
  if(!acc){ $('liErr').textContent='가입된 이메일이 아니에요. 회원가입을 먼저 해 주세요.'; return; }
  if(acc.hash !== hash(pw)){ $('liErr').textContent='비밀번호가 맞지 않아요. 다시 입력해 주세요.'; return; }
  $('liErr').textContent=''; $('liPw').value='';
  startSession({email, nick:acc.nick, rankOpt:acc.rankOpt, created:acc.created});
  toast(acc.nick+'님, 다시 오셨네요!');
});
$('signupForm').addEventListener('submit', e => {
  e.preventDefault();
  const nick=$('suNick').value.trim(), email=$('suEmail').value.trim().toLowerCase(), pw=$('suPw').value, pw2=$('suPw2').value;
  const errs = {
    eNick: nick.length<2||nick.length>10 ? '닉네임은 2~10자로 입력해 주세요.' : '',
    eEmail: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '이메일 형식이 맞지 않아요.' : (accounts()[email] ? '이미 가입된 이메일이에요. 로그인해 주세요.' : ''),
    ePw: !(pw.length>=8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw)) ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : '',
    ePw2: pw!==pw2 ? '비밀번호가 서로 달라요.' : '',
    eAgree: !$('suAgree').checked ? '필수 약관에 동의해 주세요.' : ''
  };
  let ok = true; for(const k in errs){ $(k).textContent = errs[k]; if(errs[k]) ok=false; }
  if(!ok) return;
  const all = accounts();
  all[email] = {nick, hash:hash(pw), created:today(), rankOpt:$('suRank').checked};
  LS.set('lk_accounts', all);
  ['suNick','suEmail','suPw','suPw2'].forEach(id => $(id).value='');
  startSession({email, nick, rankOpt:all[email].rankOpt, created:all[email].created});
  toast('가입 완료! 30 코인을 선물로 드렸어요');
});
function guest(){
  const g = LS.get('lk_guest', null) || {created:today()};
  LS.set('lk_guest', g);
  startSession({email:'guest', nick:'게스트', guest:true, rankOpt:false, created:g.created});
}
function logout(){ LS.set('lk_session', null); me=null; pg=null; go('login'); toast('로그아웃했어요'); }
function resetMe(){
  const box = $('modal');
  box.innerHTML = `<div class="box"><h2>진행 기록을 초기화할까요?</h2><p class="sub">경험치, 코인, 클리어 기록이 모두 처음으로 돌아가요.</p><button class="btn hot" id="mYes">초기화</button><button class="btn line" id="mNo">취소</button></div>`;
  box.hidden=false;
  $('mNo').onclick=()=>box.hidden=true;
  $('mYes').onclick=()=>{ pg=freshProgress(); pg.visits=[today()]; saveProgress(); box.hidden=true; renderMy(); toast('기록을 초기화했어요'); };
}

/* ═════════ 레벨 & 보상 ═════════ */
const LVNAME = ['','법알못','계약 입문','계약 새싹','권리 지킴이','생활법률 수비수','계약 고수','생활법률 마스터'];
function level(xp){ const lv=Math.floor(xp/100)+1; return {lv, name:LVNAME[Math.min(lv,LVNAME.length-1)], next:100-xp%100, pct:xp%100}; }
function dayN(){ const a=new Date(me.created+'T00:00:00'), b=new Date(today()+'T00:00:00'); return Math.round((b-a)/864e5)+1; }
function clearedCount(){ return Object.keys(pg.cleared).length; }
function stageOpen(id){
  const x = findStage(id); if(!x) return false;
  const chs = x.c.chapters, ci = chs.indexOf(x.ch);
  if(ci>0 && !chs[ci-1].stages.every(s=>pg.cleared[s.id])) return false;
  return x.i===0 || !!pg.cleared[x.ch.stages[x.i-1].id];
}
function chapterOpen(c, ci){ return !c.chapters[ci].locked && (ci===0 || c.chapters[ci-1].stages.every(s=>pg.cleared[s.id])); }

/* ═════════ 화면 전환 ═════════ */
const TABS = {home:'home', course:'home', stage:'home', play:'home', answer:'home', feedback:'home', shorts:'shorts', rank:'rank', my:'my'};
function go(id, keep){
  if(!me && !['login','signup'].includes(id)) id='login';
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.id!==id);
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.t===TABS[id] ? 'page':'false'));
  $('tabbar').hidden = ['login','signup','play','answer'].includes(id);
  $('composer').hidden = id!=='play';
  ({home:renderHome, shorts:renderShorts, rank:renderRank, my:renderMy, play:renderPlay})[id]?.();
  if(!keep) window.scrollTo(0,0);
}

/* ═════════ 홈 ═════════ */
function nextStage(){ return ALL_STAGES.find(x => !pg.cleared[x.s.id] && stageOpen(x.s.id)); }
function courseProgress(c){ const all=c.chapters.flatMap(ch=>ch.stages); return {done:all.filter(s=>pg.cleared[s.id]).length, total:all.length}; }
function renderHome(){
  const L = level(pg.xp);
  $('hHello').textContent = `${me.nick}님, 반가워요`;
  $('hLv').textContent = `Lv.${L.lv} ${L.name}`;
  $('hDay').textContent = `${dayN()}일차`;
  $('hBar').style.width = L.pct+'%';
  $('hNext').textContent = `다음 레벨까지 ${L.next} XP`;
  $('hXp').textContent = pg.xp; $('hCoin').textContent = pg.coins; $('hClear').textContent = clearedCount()+'/'+ALL_STAGES.length;
  const n = nextStage();
  $('hContinue').hidden = !n;
  if(n){ $('hContinue').innerHTML = `<span><span class="label">이어서 하기 · ${n.c.name}</span><br><b>${n.ch.title}</b><br><span class="sub">${n.i+1}단계 ${esc(n.s.title)}</span></span><span class="go">시작 →</span>`;
         $('hContinue').onclick = () => openStageFlow(n.s.id); }
  $('hCourses').innerHTML = COURSES.map(c => { const p=courseProgress(c);
    return `<button class="course" onclick="openCourse('${c.id}')"><span class="mk">${c.mark}</span><span class="grow"><span class="label">코스 ${c.no}</span><b>${c.name}</b><span class="sub">${c.sub}</span><span class="mini"><i style="width:${p.done/p.total*100}%"></i></span></span><span class="pill ${p.done===p.total?'good':''}">${p.done}/${p.total}</span></button>`; }).join('');
}

/* ═════════ 코스 ═════════ */
let cur = {course:null, stage:null};
function openCourse(cid){
  const c = COURSES.find(x=>x.id===cid); cur.course = cid;
  $('cNo').textContent = '코스 '+c.no; $('cName').textContent = c.name; $('cSub').textContent = c.sub;
  $('cChapters').innerHTML = c.chapters.map((ch, ci) => {
    if(ch.locked) return `<div class="chap locked"><span class="label">챕터 ${ci+1}</span><h3>${ch.title}</h3><p class="sub" style="margin-top:4px">준비 중인 챕터예요.</p></div>`;
    const open = chapterOpen(c, ci);
    const nodes = ch.stages.map((s, si) => {
      const done = !!pg.cleared[s.id], op = stageOpen(s.id);
      const tag = done ? `<span class="pill good">${pg.cleared[s.id].grade}</span>` : op ? `<span class="pill">도전</span>` : `<span class="pill mute">잠김</span>`;
      return `<button class="node ${done?'clear':op?'open':''}" ${op?'':'disabled'} onclick="openStageFlow('${s.id}')"><span class="dot">${done?'✓':si+1}</span><span><b>${esc(s.title)}</b><br><span class="sub">${si+1}단계 · 보상 30 XP + 10 코인</span></span>${tag}</button>`;
    }).join('');
    return `<div class="chap ${open?'':'locked'}"><div class="row between"><span class="label">챕터 ${ci+1}</span>${open?`<button class="shortbtn" onclick="playShorts('${ch.id}')">▶ 배경지식 쇼츠</button>`:'<span class="pill mute">이전 챕터를 먼저 클리어</span>'}</div><h3 style="margin-top:4px">${ch.title}</h3><div class="path">${nodes}</div></div>`;
  }).join('');
  go('course');
}
function openStageFlow(sid){
  const x = findStage(sid); if(!stageOpen(sid)) return;
  cur.course = x.c.id;
  if(x.i===0 && !pg.seen[x.ch.id]){ playShorts(x.ch.id, () => openStage(sid)); return; }
  openStage(sid);
}

/* ═════════ 만화 ═════════ */
function charSVG(id, exp, x, y, w){
  const C = CHARS[id]; const h = w*1.2;
  const hair = {
    short:`<path d="M27 46 Q26 20 50 20 Q74 20 73 46 Q66 31 50 31 Q34 31 27 46Z" fill="${C.hair}"/>`,
    side:`<path d="M27 48 Q24 18 52 20 Q76 22 73 44 Q60 29 40 34 Q32 38 27 48Z" fill="${C.hair}"/>`,
    long:`<path d="M30 44 Q34 30 50 30 Q66 30 70 44 Q64 26 50 26 Q36 26 30 44Z" fill="${C.hair}"/>`,
    cap:`<path d="M27 46 Q30 32 50 32 Q70 32 73 46Z" fill="${C.hair}"/><path d="M24 36 Q26 15 50 15 Q74 15 76 36Z" fill="${C.cap||'#333'}"/><path d="M48 34 L86 37 L84 31 Z" fill="${C.cap||'#333'}"/>`,
    bald:`<path d="M26 52 Q25 38 30 35 L33 52Z M74 52 Q75 38 70 35 L67 52Z" fill="${C.hair}"/>`,
    slick:`<path d="M27 44 Q26 18 52 19 Q75 21 73 44 Q70 28 54 27 Q38 27 27 44Z" fill="${C.hair}"/>`
  }[C.style];
  const back = C.style==='long' ? `<path d="M25 52 Q20 18 50 18 Q80 18 75 52 L79 86 L64 84 L64 50 L36 50 L36 84 L21 86Z" fill="${C.hair}"/>` : '';
  const ink = '#2a2230';
  const eyes = {
    neutral:`<circle cx="41" cy="50" r="2.6" fill="${ink}"/><circle cx="59" cy="50" r="2.6" fill="${ink}"/>`,
    smile:`<path d="M37.5 51 Q41 46.5 44.5 51 M55.5 51 Q59 46.5 62.5 51" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    sly:`<path d="M37 49 L45 49 M55 49 L63 49" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><circle cx="43" cy="51" r="1.8" fill="${ink}"/><circle cx="61" cy="51" r="1.8" fill="${ink}"/><path d="M36 43 L45 45 M64 43 L55 45" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    worry:`<circle cx="41" cy="51" r="2.6" fill="${ink}"/><circle cx="59" cy="51" r="2.6" fill="${ink}"/><path d="M36 45 L45 42 M64 45 L55 42" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    shock:`<circle cx="41" cy="50" r="4" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="59" cy="50" r="4" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="41" cy="50" r="1.8" fill="${ink}"/><circle cx="59" cy="50" r="1.8" fill="${ink}"/><path d="M36 41 L45 40 M64 41 L55 40" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
  }[exp] || '';
  const mouth = {
    neutral:`<path d="M44 64 L56 64" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
    smile:`<path d="M42 62 Q50 70 58 62" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    sly:`<path d="M43 63 Q52 68 59 60" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    worry:`<path d="M43 67 Q50 61 57 67" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    shock:`<ellipse cx="50" cy="65" rx="4" ry="5" fill="#6b2f2f"/>`
  }[exp] || '';
  const blush = exp==='smile' ? `<circle cx="35" cy="58" r="3.5" fill="#f08a8a" opacity=".45"/><circle cx="65" cy="58" r="3.5" fill="#f08a8a" opacity=".45"/>` : '';
  const sweat = exp==='worry'||exp==='shock' ? `<path d="M74 36 Q77 42 74 45 Q71 42 74 36Z" fill="#8fc6ff"/>` : '';
  const glasses = C.glasses ? `<circle cx="41" cy="50" r="6.5" fill="none" stroke="#333" stroke-width="1.6"/><circle cx="59" cy="50" r="6.5" fill="none" stroke="#333" stroke-width="1.6"/><path d="M47.5 50 L52.5 50" stroke="#333" stroke-width="1.6"/>` : '';
  const face = C.anon ? `<text x="50" y="60" text-anchor="middle" font-size="26" font-weight="700" fill="#ffffff" font-family="sans-serif">?</text>` : eyes+mouth+blush+glasses;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 120" role="img" aria-label="${C.name}">${back}<path d="M12 120 Q14 86 50 82 Q86 86 88 120Z" fill="${C.shirt}"/><rect x="44" y="68" width="12" height="16" fill="${C.skin}"/><ellipse cx="50" cy="48" rx="23" ry="26" fill="${C.skin}"/>${hair}${face}${sweat}</svg>`;
}
function sceneBG(sc){
  const v = n => `var(--${n})`;
  return ({
    street:`<rect width="320" height="200" fill="${v('sc-sky')}"/><rect x="10" y="60" width="60" height="120" fill="${v('sc-acc')}"/><rect x="78" y="34" width="70" height="146" fill="${v('sc-acc')}" opacity=".8"/><rect x="232" y="50" width="80" height="130" fill="${v('sc-acc')}"/>${[0,1,2,3].map(i=>`<rect x="22" y="${74+i*24}" width="12" height="12" fill="${v('sc-win')}"/><rect x="46" y="${74+i*24}" width="12" height="12" fill="${v('sc-win')}"/><rect x="248" y="${64+i*26}" width="14" height="14" fill="${v('sc-win')}"/><rect x="282" y="${64+i*26}" width="14" height="14" fill="${v('sc-win')}"/>`).join('')}<rect y="176" width="320" height="24" fill="${v('sc-floor')}"/>`,
    room:`<rect width="320" height="200" fill="${v('sc-wall')}"/><rect x="214" y="22" width="78" height="64" rx="4" fill="${v('sc-sky')}" stroke="${v('sc-desk')}" stroke-width="5"/><path d="M253 22 V86 M214 54 H292" stroke="${v('sc-desk')}" stroke-width="4"/><rect y="164" width="320" height="36" fill="${v('sc-floor')}"/><rect x="18" y="138" width="46" height="34" fill="${v('sc-desk')}"/><path d="M18 150 H64" stroke="${v('sc-wall')}" stroke-width="3"/>`,
    office:`<rect width="320" height="200" fill="${v('sc-wall')}"/><rect x="20" y="18" width="70" height="46" rx="4" fill="${v('sc-shelf')}"/><rect y="150" width="320" height="50" fill="${v('sc-desk')}"/><rect x="226" y="98" width="70" height="46" rx="4" fill="${v('sc-dark')}"/><rect x="254" y="144" width="14" height="8" fill="${v('sc-dark')}"/>`,
    night:`<rect width="320" height="200" fill="${v('sc-dark')}"/><circle cx="270" cy="40" r="18" fill="#f5e7a8"/><circle cx="262" cy="34" r="16" fill="${v('sc-dark')}"/>${[[30,30],[80,58],[140,24],[200,64],[300,90]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="1.8" fill="#fff"/>`).join('')}<rect y="156" width="320" height="44" fill="${v('sc-desk')}" opacity=".85"/><rect x="24" y="112" width="58" height="40" rx="3" fill="#0b0f1d"/><rect x="28" y="116" width="50" height="32" fill="#7fb0ff" opacity=".55"/>`,
    store:`<rect width="320" height="200" fill="${v('sc-shelf')}"/>${[0,1,2].map(r=>`<rect x="0" y="${30+r*40}" width="320" height="6" fill="${v('sc-desk')}"/>${[0,1,2,3,4,5,6,7,8,9].map(i=>`<rect x="${8+i*32}" y="${12+r*40}" width="20" height="18" rx="3" fill="${['#f2a65a','#7cc4a4','#e57373','#9fb3e8','#f5d76e'][(i+r)%5]}"/>`).join('')}`).join('')}<rect y="150" width="320" height="50" fill="${v('sc-desk')}"/>`,
    phone:`<rect width="320" height="200" fill="${v('sc-sky')}"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${20+i*30}" cy="${180-i*8}" r="3" fill="${v('sc-acc')}" opacity=".5"/>`).join('')}`
  })[sc] || '';
}
function panelSVG(p){
  const [sc, chars] = p;
  let body = sceneBG(sc);
  const inside = chars.filter(c=>c[2]==='in'), out = chars.filter(c=>c[2]!=='in');
  if(sc==='phone'){
    const px = out.length ? 176 : 110;
    body += `<rect x="${px}" y="10" width="110" height="186" rx="16" fill="#1d2233"/><rect x="${px+7}" y="22" width="96" height="166" rx="9" fill="#f4f6fb"/>`;
    inside.forEach(c => body += charSVG(c[0], c[1], px+25, 30, 60));
    body += `<rect x="${px+14}" y="110" width="70" height="12" rx="6" fill="#d9deea"/><rect x="${px+26}" y="130" width="70" height="12" rx="6" fill="#9fb3e8"/><rect x="${px+14}" y="150" width="56" height="12" rx="6" fill="#d9deea"/>`;
  }
  const pos = {l:[22,170], r:[176,170], c:[95,170]};
  out.forEach(c => { const [x] = pos[c[2]] || pos.c; const w = sc==='phone' ? 140 : 130; const xx = sc==='phone' ? 20 : x; body += charSVG(c[0], c[1], xx, 200-w*1.2+8, w); });
  const names = chars.map(c=>CHARS[c[0]].name).join(', ');
  return `<svg viewBox="0 0 320 200" role="img" aria-label="장면: ${names}">${body}</svg>`;
}
function renderComic(panels){
  return panels.map(p => {
    const [, chars, cap, lines] = p;
    const sideOf = id => { const c = chars.find(x=>x[0]===id); return c && (c[2]==='r' || c[2]==='in') ? 'r' : 'l'; };
    const bubs = (lines||[]).map(([id, t]) => `<p class="bub ${sideOf(id)} ${/^\(/.test(t)?'think':''}"><b>${CHARS[id].name}</b>${esc(t)}</p>`).join('');
    return `<figure class="panel">${cap?`<figcaption class="cap">${esc(cap)}</figcaption>`:''}${panelSVG(p)}${bubs?`<div class="bubbles">${bubs}</div>`:''}</figure>`;
  }).join('');
}
function fontStep(d){ const v = Math.min(19, Math.max(14, (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--fs'))||15) + d)); document.documentElement.style.setProperty('--fs', v+'px'); LS.set('lk_fs', v); }
(() => { const v = LS.get('lk_fs', null); if(v) document.documentElement.style.setProperty('--fs', v+'px'); })();

/* ═════════ 스테이지 & 플레이 ═════════ */
let run = null;
function openStage(sid){
  const x = findStage(sid); cur.stage = sid;

  if (x && x.i === 3) {
    // 사용자의 취약 카테고리나 이메일을 인자로 전달하여 맞춤형 문제 생성 API 호출
    loadCustomQuiz(me ? me.email : 'guest', '전세 계약');
    return; // 기존 일반 스테이지 로직 대신 맞춤형 퀴즈 흐름으로 태울 때 사용
  }

  run = {sid, left:MAXQ, found:[], log:[], asked:[], tries:[], extra:0};
  $('sTag').textContent = `${x.c.name} · ${x.ch.title} · ${x.i+1}단계`;
  $('sTitle').textContent = x.s.title;
  $('sComic').innerHTML = renderComic(x.s.comic);
  $('sQ').textContent = x.s.q;
  go('stage');
}
function startPlay(){
  const x = findStage(run.sid);
  if(!run.log.length) run.log.push({who:'bot', text:`진행자예요. 대상은 지금 "${x.s.title}" 상황에 있어요.\n궁금한 걸 자유롭게 물어보세요. 숨은 단서는 2개, 질문은 ${MAXQ}번 할 수 있어요.`});
  go('play');
}
function renderPlay(){
  const s = findStage(run.sid).s, total = MAXQ + run.extra;
  $('pQ').textContent = 'Q. ' + s.q;
  $('pLeft').textContent = `남은 질문 ${run.left}/${total}`;
  $('pBar').innerHTML = Array.from({length:total}, (_, k) => `<i class="${k < total-run.left ? 'used':''}"></i>`).join('');
  $('pClues').innerHTML = s.clues.map(c => run.found.includes(c.id) ? `<div class="clue on">단서 · ${esc(c.label)}</div>` : `<div class="clue">? 숨은 단서</div>`).join('');
  $('pChat').innerHTML = run.log.map(m => m.who==='sys' ? `<div class="msg sys">${esc(m.text)}</div>` : m.who==='me' ? `<div class="msg me">${esc(m.text)}</div>` : `<div class="msg bot ${m.typing?'typing':''}"><span class="who">AI 진행자</span>${esc(m.text)}</div>`).join('');
  const busy = run.log.some(m=>m.typing);
  const hints = s.clues.filter(c=>!run.found.includes(c.id)).map(c=>c.hint);
  let chips = `<button class="chip go" onclick="toAnswer()">답 고르기 →</button>`;
  if(run.left>0) chips += hints.map(h=>`<button class="chip" onclick="ask(this.textContent)">${esc(h)}</button>`).join('');
  else chips += `<button class="chip gold" onclick="buyQuestions()">질문 +5 (20 코인)</button>`;
  $('chips').innerHTML = chips;
  $('askInput').disabled = $('askBtn').disabled = run.left<=0 || busy;
  $('askInput').placeholder = run.left<=0 ? '질문을 다 썼어요. 답을 고르거나 코인으로 질문을 추가하세요' : '진행자에게 질문하기';
  setMode();
}
function buyQuestions(){
  if(pg.coins < 20){ toast('코인이 부족해요. 단계를 클리어해서 모아 보세요'); return; }
  pg.coins -= 20; run.left += 5; run.extra += 5; saveProgress(); toast('질문 5번을 더 받았어요 (−20 코인)'); renderPlay();
}
const scrollEnd = () => requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
$('askForm').addEventListener('submit', e => { e.preventDefault(); const v=$('askInput').value.trim(); if(v){ $('askInput').value=''; ask(v); } });

async function ask(q){
  if(!run || run.left<=0 || run.log.some(m=>m.typing)) return;
  run.left--; run.asked.push(q);
  run.log.push({who:'me', text:q});
  const pend = {who:'bot', text:'생각 중…', typing:true};
  run.log.push(pend); renderPlay(); scrollEnd();
  let res = null;
  if(AI.sample){ try{ res = await aiAsk(q); }catch(e){ if(e && e.code==='not_granted') AI.sample=null; } }
  if(!res) res = localAsk(q);
  const s = findStage(run.sid).s;
  const newly = (res.clues||[]).filter(id => s.clues.some(c=>c.id===id) && !run.found.includes(id));
  pend.typing = false; pend.text = res.answer;
  newly.forEach(id => { run.found.push(id); run.log.push({who:'sys', text:'단서 발견 · '+s.clues.find(c=>c.id===id).label}); });
  if(newly.length) toast(`단서 ${run.found.length}/${s.clues.length} 발견!`);
  if(run.left===0) run.log.push({who:'bot', text:'질문을 모두 썼어요. 모은 단서로 답을 골라 보세요.'});
  renderPlay(); scrollEnd();
}
function localAsk(q){
  const s = findStage(run.sid).s, n = q.toLowerCase().replace(/\s+/g,'');
  if(/정답|답이뭐|몇번|어떻게해야|해도돼|보내도|맞아\?/.test(n)) return {answer:'정답은 직접 골라 보세요. 단서를 더 모을수록 판단이 쉬워져요.', clues:[]};
  const isDef = /뭐예요|뭐에요|뭐야|무엇|뜻|란\?|이란/.test(n);
  if(isDef) for(const [keys, txt] of GLOSSARY) if(keys.some(k=>n.includes(k.toLowerCase()))) return {answer:txt, clues:[]};
  const hit = s.clues.filter(c => c.kw.some(k => n.includes(k.toLowerCase())));
  const nw = hit.find(c => !run.found.includes(c.id));
  if(nw) return {answer:nw.reveal, clues:[nw.id]};
  if(hit.length) return {answer:'그건 이미 확인했어요. '+hit[0].reveal, clues:[]};
  for(const [keys, txt] of GLOSSARY) if(keys.some(k=>n.includes(k.toLowerCase()))) return {answer:txt, clues:[]};
  return {answer:'그 부분은 특별히 눈에 띄는 게 없어요. 서류, 돈이 오가는 방법, 상대방이 한 말 쪽을 물어보면 어떨까요?', clues:[]};
}

/* ═════════ 답 & 피드백 ═════════ */
function toAnswer(){
  const s = findStage(run.sid).s;
  $('aQ').textContent = s.q;
  $('aOpts').innerHTML = s.opts.map((o, k) => `<button class="opt" onclick="pick(${k})" ${run.tries.includes(k)?'disabled':''}>${esc(o[0])}${run.tries.includes(k)?'<br><span class="sub">이미 골랐던 답이에요</span>':''}</button>`).join('');
  go('answer');
}

async function fetchCustomQuiz(userId, weakCategory) {
  try {
    const response = await fetch('/api/quiz/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, weak_category: weakCategory })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('생성된 맞춤형 문제:', result.quiz);
      // TODO: 받아온 result.quiz 데이터를 기존 퀴즈 렌더링 함수에 주입하여 화면에 표시
    }
  } catch (error) {
    console.error('맞춤형 문제 불러오기 실패:', error);
  }
}

// js/app.js 파일 내부에 추가할 서버 전송 함수
async function submitQuizResult(stageId, category, isCorrect, triesCount) {
  try {
    const response = await window.fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: me ? me.email : 'guest', // 현재 로그인된 사용자 이메일 등
        stage_id: stageId,
        category: category,
        is_correct: isCorrect,
        tries_count: triesCount
      }),
    });
    const result = await response.json();
    if (result.success) {
      console.log('서버에 학습 기록 저장 성공:', result.data);
    }
  } catch (error) {
    console.error('서버 통신 실패:', error);
  }
}

// [팀원 B 파트] 서버에서 LLM 맞춤형 문제를 받아와 화면에 렌더링하는 함수
// [수정된 최신 버전] 서버에서 LLM 맞춤형 문제를 받아와 화면(만화/문제 화면)에 곧바로 렌더링하는 함수
async function loadCustomQuiz() {

  try {
    const userId = (typeof me !== 'undefined' && me && me.email) ? me.email : 'guest';
    
    console.log('AI 맞춤형 문제를 생성하는 중입니다...');
    toast('AI가 맞춤형 문항을 구성하고 있어요 (약간의 시간이 걸려요)...');

    // ⏳ 타임아웃을 넉넉하게 60초(60000ms)로 늘리거나 커스텀 AbortController 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    const response = await fetch('/api/quiz/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
      signal: controller.signal // 타임아웃 제어 연결
    });

    clearTimeout(timeoutId); // 응답이 오면 타이머 해제

    const result = await response.json();

    if (result.success && result.quiz) {
      const qz = result.quiz;
      console.log('맞춤형 문제 로드 성공:', qz);

      const customStageId = qz.id || 'custom_quiz_1';
      
      const customStageData = {
        id: customStageId,
        title: qz.title || 'AI 맞춤 복습 문제',
        q: qz.q,
        comic: [], 
        opts: qz.opts,
        explain: qz.explain,
        laws: qz.laws,
        clues: [
          { id: 'c1', label: '핵심 법령 확인', hint: '적용되는 법령 조항을 확인해보세요.', kw: ['법령', '조항'], fact: qz.explain, reveal: qz.explain }
        ]
      };

      ALL_STAGES.push({ c: { name: 'AI 맞춤 코스', id: 'custom' }, ch: { title: '취약점 집중 복습' }, s: customStageData, i: 0 });

      run = { sid: customStageId, left: MAXQ, found: [], log: [], asked: [], tries: [], extra: 0 };
      
      $('sTag').textContent = 'AI 맞춤형 복습 코너';
      $('sTitle').textContent = qz.title;
      $('sComic').innerHTML = '<div class="card" style="text-align:center;padding:24px"><p><b>🤖 AI 맞춤 복습 문제</b></p><p class="sub" style="margin-top:6px">이전에 틀렸던 학습 기록을 바탕으로 출제된 문제입니다.</p></div>';
      $('sQ').textContent = qz.q;
      
      go('stage');
      toast('맞춤형 문제가 준비되었어요!');

    } else {
      // 403 에러(학습 기록 부족 등)인 경우 서버가 보낸 에러 메시지 출력
      alert(result.error || '맞춤형 문제를 불러오는 데 실패했습니다. 학습을 더 진행해 주세요!');
    }

  } catch (error) {
    console.error('맞춤형 문제 통신 에러:', error);
    alert('서버와 통신 중 오류가 발생했습니다.');
  }
}

function pick(k){
  const x = findStage(run.sid), s = x.s, o = s.opts[k], right = !!o[1];
  run.tries.push(k);
  const firstTry = run.tries.length===1;
  const already = pg.cleared[s.id];
  let reward = null;

  submitQuizResult(s.id, x.c.id, right, run.tries.length);

  if(right){
    const nf = run.found.length;
    const grade = firstTry && nf===s.clues.length && run.left>=5 ? 'S' : firstTry ? 'A' : 'B';
    if(!already){
      const xp = (firstTry?30:15) + nf*5 + run.left;
      const coin = (firstTry?10:5) + nf*5;
      pg.xp += xp; pg.coins += coin;
      pg.cleared[s.id] = {grade, at:today()};
      reward = {xp, coin, grade};
    } else if(gradeRank(grade) > gradeRank(already.grade)) { already.grade = grade; }
    pg.hist.unshift({sid:s.id, grade, ok:true, at:today()}); pg.hist = pg.hist.slice(0,30);
    saveProgress();
  } else {
    pg.hist.unshift({sid:s.id, grade:'-', ok:false, at:today()}); pg.hist = pg.hist.slice(0,30); saveProgress();
  }
  renderFeedback(k, right, reward);
  go('feedback');
  aiFeedback(k, right);
  if(reward) setTimeout(() => showReward(reward, x), 450);
}
const gradeRank = g => ({S:4,A:3,B:2,C:1}[g]||0);
function renderFeedback(k, right, reward){
  const x = findStage(run.sid), s = x.s;
  $('fVerdict').className = 'verdict '+(right?'ok':'no');
  $('fVerdict').innerHTML = right ? `<div class="disp">정답이에요!</div><p>${run.tries.length===1?'한 번에 맞혔어요.':'다시 도전해서 맞혔어요.'} 찾은 단서 ${run.found.length}/${s.clues.length}</p>` : `<div class="disp">아쉬워요</div><p>왜 틀렸는지 확인하고 다시 도전해 보세요.</p>`;
  const o = s.opts[k];
  $('fMine').innerHTML = `<span class="label">내가 고른 답</span><p style="font-weight:700">${esc(o[0])}</p>${right?'':`<p class="sub">${esc(o[2])}</p>`}`;
  $('fExplain').hidden = !right; $('fLaws').hidden = false;
  $('fExplain').innerHTML = `<span class="label">자세한 해설</span><p>${esc(s.explain)}</p>`;
  $('fLaws').innerHTML = `<span class="label">${right?'법적 근거':'이 문제와 관련된 법령'}</span>` + s.laws.map(l => `<div class="law"><b>${esc(l[0])}</b><p>${esc(l[1])}</p></div>`).join('');
  $('fAi').innerHTML = `<span class="label">AI 분석 피드백</span><div class="skel" style="width:90%"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:80%"></div>`;
  const next = ALL_STAGES[ALL_STAGES.findIndex(y=>y.s.id===s.id)+1];
  let btns = '';
  if(right){
    if(next && next.c.id===x.c.id && stageOpen(next.s.id)) btns += `<button class="btn" onclick="openStageFlow('${next.s.id}')">다음 단계로</button>`;
    btns += `<button class="btn soft" onclick="openCourse('${x.c.id}')">코스 지도로</button>`;
  } else {
    btns += `<button class="btn" onclick="retry()">다시 풀기 (질문 +3)</button><button class="btn line" onclick="reveal()">정답과 해설 보기 (보상 줄어듦)</button>`;
  }
  $('fBtns').innerHTML = btns;
}
function retry(){ run.left += 3; run.extra += 3; run.log.push({who:'bot', text:'다시 도전! 질문을 3번 더 드릴게요. 아직 못 찾은 단서가 있다면 찾아보세요.'}); go('play'); }
function reveal(){
  const x = findStage(run.sid), s = x.s, k = s.opts.findIndex(o=>o[1]);
  let reward = null;
  if(!pg.cleared[s.id]){ pg.xp += 5; pg.cleared[s.id] = {grade:'C', at:today()}; reward = {xp:5, coin:0, grade:'C'}; saveProgress(); }
  run.tries.push(k);
  renderFeedback(k, true, reward);
  $('fVerdict').className = 'verdict no';
  $('fVerdict').innerHTML = `<div class="disp">정답 공개</div><p>정답과 해설을 확인하고 다음 단계로 넘어가요.</p>`;
  $('fMine').innerHTML = `<span class="label">정답</span><p style="font-weight:700">${esc(s.opts[k][0])}</p>`;
  window.scrollTo(0,0);
  aiFeedback(run.tries[0], false);
  if(reward) setTimeout(() => showReward(reward, x), 300);
}
function showReward(r, x){
  const chDone = x.ch.stages.every(s=>pg.cleared[s.id]);
  let badge = '';
  if(chDone && !pg.badges.includes(x.ch.id)){ pg.badges.push(x.ch.id); pg.coins += 50; saveProgress(); badge = `<p style="font-weight:700">챕터 클리어! 배지 "${esc(x.ch.title.split(':')[0])}"와 보너스 50 코인을 받았어요.</p>`; }
  const before = level(pg.xp - r.xp).lv, after = level(pg.xp).lv;
  $('modal').innerHTML = `<div class="box" role="dialog" aria-label="단계 보상"><span class="label">단계 클리어 보상</span><div class="disp" style="font-size:56px;color:var(--brand);line-height:1">${r.grade}</div><div class="rewards"><span>+${r.xp} XP</span>${r.coin?`<span>+${r.coin} 코인</span>`:''}</div>${after>before?`<p style="font-weight:700">레벨 업! Lv.${after} ${level(pg.xp).name}</p>`:''}${badge}<button class="btn" onclick="$('modal').hidden=true">확인</button></div>`;
  $('modal').hidden = false;
}

/* ═════════ AI ═════════ */
const AI = {sample:null, checked:false, db:null, user:null, uid:null};
(async () => {
  try{
    if(window.claude && window.claude.use){
      const [s, d, u] = await Promise.all([claude.use('sample'), claude.use('db'), claude.use('user')]);
      AI.sample = s; AI.db = d; AI.user = u;
      if(u && u.id) AI.uid = await u.id();
    }
  }catch(e){}
  AI.checked = true; setMode(); syncRank();
  if(!$('rank').hidden) renderRank();
})();
function setMode(){ const n=$('modeNote'); if(n) n.textContent = AI.sample ? 'AI 진행자 연결됨 · 자유롭게 질문해 보세요' : AI.checked ? '오프라인 모드 · 핵심 단어로 답을 찾아요' : 'AI 진행자 연결 확인 중…'; }
function stageContext(x){
  return `[코스] ${x.c.name} / ${x.ch.title} / ${x.i+1}단계 "${x.s.title}"
[만화 속 상황]
${x.s.comic.map(p => (p[2]?p[2]+' ':'') + (p[3]||[]).map(([id,t]) => CHARS[id].name+': '+t).join(' ')).join('\n')}
[문제] ${x.s.q}
[참고 법령 — 조항 번호는 이것만 인용]
${x.s.laws.map(l=>l[0]+': '+l[1]).join('\n')}`;
}
async function aiAsk(q){
  const x = findStage(run.sid), s = x.s;
  const hist = run.log.filter(m=>!m.typing && m.who!=='sys').slice(-8).map(m=>(m.who==='me'?'플레이어: ':'진행자: ')+m.text).join('\n');
  const prompt = `너는 생활법률 교육 게임 'Law-Kick'의 AI 진행자다. 플레이어(사회초년생 김대상)는 스무고개처럼 질문하며 숨은 단서를 찾아 문제를 푼다.
${stageContext(x)}
[숨은 단서]
${s.clues.map(c=>c.id+': '+c.fact).join('\n')}
[이미 찾은 단서] ${run.found.join(', ')||'없음'}
[최근 대화]
${hist}
[이번 질문] ${q}

규칙:
1. 한국어 존댓말 2~3문장. 만화 속 장면을 이어서 보여주듯 답한다.
2. 질문이 어떤 단서를 겨냥하면 그 사실을 알려주고 clues에 id를 넣는다. 막연한 질문이면 방향만 힌트로 주고 clues는 비운다.
3. 단서에 없는 새로운 위험 요소나 사실은 지어내지 않는다. 관계없는 질문엔 상황과 모순되지 않게 짧게 답한다.
4. 정답 선택지나 결론("보내면 안 돼요" 등)은 말하지 않는다. 그런 질문엔 단서를 더 모아 직접 골라 보라고 안내한다.
5. 용어 질문은 짧고 정확하게 설명한다. 법 조항 번호는 [참고 법령]에 있는 것만 쓰고, 확실하지 않은 숫자는 말하지 않는다.
JSON만 출력: {"answer":"…","clues":["a"]}`;
  const out = await AI.sample.json(prompt, {modelTier:'quick', cache:false});
  if(!out || typeof out.answer!=='string') return null;
  return {answer:out.answer, clues:Array.isArray(out.clues)?out.clues:[]};
}
async function aiFeedback(k, right){
  const x = findStage(run.sid), s = x.s;
  const missed = s.clues.filter(c=>!run.found.includes(c.id));
  let fb = null;
  if(AI.sample){
    try{
      const prompt = `너는 생활법률 교육 게임 'Law-Kick'의 학습 코치다. 플레이어의 풀이 과정을 분석해 맞춤 피드백을 준다.
${stageContext(x)}
[선택지]
${s.opts.map((o,i)=>`${i+1}. ${o[0]} ${o[1]?'(정답)':'(오답)'}`).join('\n')}
[정답 해설] ${s.explain}
[플레이어 결과] ${right?'정답':'오답'} / 고른 답: ${run.tries.map(i=>i+1).join(' → ')}번
[플레이어가 한 질문 ${run.asked.length}개] ${run.asked.map((q,i)=>`${i+1}) ${q}`).join(' / ')||'없음'}
[찾은 단서] ${s.clues.filter(c=>run.found.includes(c.id)).map(c=>c.label).join(', ')||'없음'}
[못 찾은 단서] ${missed.map(c=>c.label).join(', ')||'없음'}

규칙: 한국어 존댓말. 플레이어가 실제로 한 질문을 근거로 구체적으로 말한다. 칭찬은 사실에 근거해서만 한다. ${right?'':'오답이므로 정답 번호나 정답 내용을 직접 말하지 말고, 다시 풀 때 무엇을 확인해야 하는지만 안내한다.'} 법 조항은 [참고 법령]에 있는 것만 인용한다.
JSON만 출력: {"summary":"두 문장 총평","good":["잘한 점 최대 2개"],"improve":["보완할 점 최대 2개"],"tip":"실생활에서 바로 쓸 한 줄 팁"}`;
      fb = await AI.sample.json(prompt, {modelTier:'default', cache:false});
    }catch(e){ if(e && e.code==='not_granted') AI.sample=null; fb=null; }
  }
  if(!fb || typeof fb.summary!=='string') fb = localFeedback(right, missed, s);
  const li = a => (Array.isArray(a)?a:[]).filter(Boolean).map(t=>`<li>${esc(t)}</li>`).join('');
  $('fAi').innerHTML = `<div class="row between"><span class="label">AI 분석 피드백</span><span class="pill">${AI.sample?'AI 분석':'오프라인 분석'}</span></div>
    <p style="margin-top:8px">${esc(fb.summary)}</p>
    ${li(fb.good)?`<p style="margin-top:10px;font-weight:700;color:var(--good)">잘한 점</p><ul>${li(fb.good)}</ul>`:''}
    ${li(fb.improve)?`<p style="margin-top:10px;font-weight:700;color:var(--hot)">보완할 점</p><ul>${li(fb.improve)}</ul>`:''}
    ${fb.tip?`<p style="margin-top:10px" class="sub"><b>실전 팁</b> ${esc(fb.tip)}</p>`:''}`;
}
function localFeedback(right, missed, s){
  const used = run.asked.length, nf = run.found.length;
  const good = [], improve = [];
  if(nf===s.clues.length) good.push(`숨은 단서 ${nf}개를 모두 찾았어요. 판단에 필요한 사실을 빠짐없이 확인했어요.`);
  else if(nf>0) good.push(`단서 ${nf}개를 찾아서 판단 근거를 마련했어요.`);
  if(used>0 && used<=4) good.push(`질문 ${used}번만으로 핵심에 다가갔어요. 질문이 구체적이었어요.`);
  if(missed.length) improve.push(`놓친 단서가 있어요. "${missed[0].hint}" 같은 질문으로 확인해 보세요.`);
  if(used===0) improve.push('질문 없이 바로 답을 골랐어요. 실제 상황에서도 확인 질문을 먼저 해 보는 습관이 중요해요.');
  if(!right) improve.push('고른 답이 어떤 위험을 놓쳤는지 위 설명을 읽고, 관련 법령을 한 번 더 확인해 보세요.');
  return {summary: right ? `정답이에요. 질문 ${used}번으로 단서 ${nf}/${s.clues.length}개를 찾았어요.` : `이번엔 아쉬웠어요. 질문 ${used}번으로 단서 ${nf}/${s.clues.length}개를 찾았어요.`, good, improve, tip: `실제 상황에서도 ${s.clues.map(c=>'"'+c.label+'"').join(', ')} 같은 신호를 먼저 확인하세요.`};
}

/* ═════════ 쇼츠 ═════════ */
let reel = null;
function chapterById(id){ for(const c of COURSES) for(const ch of c.chapters) if(ch.id===id) return {c, ch}; }
function playShorts(chId, after){ const {c, ch} = chapterById(chId); openReel([{c, ch}], after); }
function playAll(){
  const list = []; COURSES.forEach(c => c.chapters.forEach((ch, ci) => { if(ch.shorts.length && (pg.seen[ch.id] || chapterOpen(c, ci))) list.push({c, ch}); }));
  if(!list.length){ toast('아직 열린 쇼츠가 없어요'); return; }
  openReel(list);
}
function openReel(list, after){
  const slides = []; list.forEach(({c, ch}) => ch.shorts.forEach((sl, i) => slides.push({c, ch, sl, i, n:ch.shorts.length})));
  reel = {slides, idx:0, t:0, paused:false, after, sound:false, timer:null, list};
  $('player').hidden = false;
  drawReel(); tickReel();
}
const DUR = 6000;
function drawReel(){
  const r = reel, cur = r.slides[r.idx], same = r.slides.filter(x=>x.ch===cur.ch);
  $('player').innerHTML = `<div class="reel c-${cur.c.id}" role="dialog" aria-label="배경지식 쇼츠">
    <div class="bars">${same.map((x,i)=>`<i><span id="bar${i}" style="width:${i<cur.i?100:0}%"></span></i>`).join('')}</div>
    <div class="top"><span>${esc(cur.c.name)} · ${esc(cur.ch.title.split(':')[0])}</span><button onclick="closeReel(true)">건너뛰기 ✕</button></div>
    <button class="tapL" aria-label="이전" onclick="stepReel(-1)"></button><button class="tapR" aria-label="다음" onclick="stepReel(1)"></button>
    <div class="slide" aria-live="polite"><div class="k">${esc(cur.sl.k)}</div><div class="big">${esc(cur.sl.big)}</div><div class="body">${esc(cur.sl.body)}</div>${cur.sl.viz?`<div class="viz">${cur.sl.viz.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`:''}</div>
    <div class="wm">Law-Kick</div>
    <div class="bottom">
      <div class="ctrl"><button onclick="togglePause()" id="rPause">${r.paused?'▶ 재생':'❚❚ 일시정지'}</button><button onclick="toggleSound()">${r.sound?'🔊 읽어주기 켬':'🔈 읽어주기'}</button></div>
      ${r.idx===r.slides.length-1 ? `<button class="btn" onclick="closeReel(true)">${r.after?'이제 문제 풀러 가기':'다 봤어요'}</button>` : ''}
    </div></div>`;
  speak(cur.sl);
}
function tickReel(){
  clearInterval(reel?.timer);
  reel.timer = setInterval(() => {
    if(!reel || reel.paused) return;
    reel.t += 100;
    const cur = reel.slides[reel.idx], b = $('bar'+cur.i);
    if(b) b.style.width = Math.min(100, reel.t/DUR*100)+'%';
    if(reel.t >= DUR){ if(reel.idx < reel.slides.length-1) stepReel(1); else { reel.paused = true; } }
  }, 100);
}
function stepReel(d){ const n = reel.idx+d; if(n<0 || n>=reel.slides.length) return; reel.idx=n; reel.t=0; drawReel(); }
function togglePause(){ reel.paused=!reel.paused; $('rPause').textContent = reel.paused?'▶ 재생':'❚❚ 일시정지'; }
function toggleSound(){ reel.sound=!reel.sound; if(!reel.sound) try{speechSynthesis.cancel()}catch(e){} drawReel(); }
function speak(sl){
  if(!reel.sound) return;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(sl.big.replace(/\n/g,' ')+'. '+sl.body); u.lang='ko-KR'; u.rate=1.05; speechSynthesis.speak(u); }catch(e){}
}
function closeReel(markSeen){
  if(!reel) return;
  clearInterval(reel.timer); try{speechSynthesis.cancel()}catch(e){}
  if(markSeen) reel.list.forEach(({ch}) => pg.seen[ch.id]=1);
  saveProgress();
  const after = reel.after; reel = null; $('player').hidden = true; $('player').innerHTML='';
  if(after) after(); else if(!$('shorts').hidden) renderShorts(); else if(!$('course').hidden) openCourse(cur.course);
}
document.addEventListener('keydown', e => { if(!reel) return; if(e.key==='ArrowRight') stepReel(1); if(e.key==='ArrowLeft') stepReel(-1); if(e.key==='Escape') closeReel(true); if(e.key===' '){ e.preventDefault(); togglePause(); } });
function renderShorts(){
  $('shList').innerHTML = COURSES.map(c => `<div class="stack" style="gap:8px"><h3>${c.name}</h3><div class="sgrid">${c.chapters.map((ch, ci) => {
    if(ch.locked) return `<div class="thumb c-${c.id} lock"><small>챕터 ${ci+1}</small><b>${esc(ch.title)}</b><small>준비 중</small></div>`;
    const open = pg.seen[ch.id] || chapterOpen(c, ci);
    return `<button class="thumb c-${c.id} ${open?'':'lock'}" ${open?`onclick="playShorts('${ch.id}')"`:'disabled'} aria-label="${esc(ch.title)} 쇼츠"><small>챕터 ${ci+1}</small>${pg.seen[ch.id]?'<span class="seen">시청함</span>':''}<b>${esc(ch.shorts[0].big.replace(/\n/g,' '))}</b><small>${open?`▶ ${ch.shorts.length}컷 · 약 ${Math.round(ch.shorts.length*DUR/1000)}초`:'🔒 이전 챕터 클리어 후'}</small></button>`;
  }).join('')}</div></div>`).join('');
}

/* ═════════ 랭킹 ═════════ */
const SAMPLE_RIVALS = [['예시) 보증금지킴이',640],['예시) 알바왕',480],['예시) 사기감별사',350],['예시) 첫출근',210],['예시) 계약새내기',90]];
async function syncRank(){
  if(!AI.db || !AI.uid || !me || me.guest || !me.rankOpt || !pg) return;
  try{ await AI.db.doc('ranking/'+AI.uid).set({nick:me.nick, xp:pg.xp, cleared:clearedCount(), at:Date.now()}); }catch(e){}
}
async function renderRank(){
  let rows = [], live = false;
  if(AI.db){
    try{
      const snap = await AI.db.collection('ranking').orderBy('xp','desc').limit(50).get();
      rows = snap.docs.map(d => { const v=d.data()||{}; return {nick:String(v.nick||'이름 없음').slice(0,10), xp:Number(v.xp)||0, mine:d.id===AI.uid}; });
      live = true;
    }catch(e){ live = false; }
  }
  if(!live){
    const accs = accounts();
    rows = Object.entries(accs).filter(([,a])=>a.rankOpt).map(([em,a]) => ({nick:a.nick, xp:(LS.get('lk_prog_'+em,{}).xp)||0, mine:me && em===me.email}));
    rows = rows.concat(SAMPLE_RIVALS.map(([n,x])=>({nick:n, xp:x, sample:true})));
  }
  if(me && (me.guest || !me.rankOpt) && !rows.some(r=>r.mine)) rows.push({nick:me.nick+' (비공개)', xp:pg.xp, mine:true});
  rows.sort((a,b)=>b.xp-a.xp);
  $('rSrc').textContent = live ? '실시간' : '이 기기';
  $('rDesc').textContent = live ? '이 링크로 Law-Kick을 이용하는 사람들의 경험치 순위예요. 랭킹 공개에 동의한 계정만 표시돼요.' : '오프라인 모드라 이 기기에서 가입한 계정과 예시 사용자로 순위를 보여줘요.';
  const top = rows.slice(0,3), order = [1,0,2];
  $('rPodium').innerHTML = rows.length ? order.filter(i=>top[i]).map(i => `<div class="${i===0?'p1':''}"><b>${i+1}</b><span>${esc(top[i].nick)}</span><span class="sub">${top[i].xp} XP</span></div>`).join('') : '';
  $('rList').innerHTML = rows.length ? rows.map((r,i) => `<div class="rank ${i<3?'top':''} ${r.mine?'mine':''}"><span class="no">${i+1}</span><span class="grow"><b>${esc(r.nick)}</b>${r.mine?' <span class="pill">나</span>':''}</span><span>${r.xp} XP</span></div>`).join('') : `<p class="sub" style="padding:12px 0">아직 랭킹에 오른 사람이 없어요. 첫 단계를 클리어하고 1등으로 올라가 보세요.</p>`;
}

/* ═════════ 마이페이지 ═════════ */
function renderMy(){
  const L = level(pg.xp);
  $('mNick').textContent = me.nick; $('mEmail').textContent = me.guest ? '게스트로 둘러보는 중이에요' : me.email;
  $('mDay').textContent = `Law-Kick ${dayN()}일차`;
  $('mLv').textContent = `Lv.${L.lv} ${L.name}`; $('mXp').textContent = pg.xp+' XP';
  $('mCoin').textContent = pg.coins; $('mClear').textContent = `${clearedCount()} / ${ALL_STAGES.length}`;
  $('mBadges').innerHTML = pg.badges.length ? pg.badges.map(id => `<span class="badge">${esc(chapterById(id).ch.title.split(':')[0])}</span>`).join('') : '<span class="sub">챕터를 모두 클리어하면 배지를 받아요.</span>';
  const done = ALL_STAGES.filter(x => pg.cleared[x.s.id]);
  $('mHist').innerHTML = done.length ? done.map(x => `<div class="hist"><span><span class="label">${x.c.name} · ${x.i+1}단계</span><br><b>${esc(x.s.title)}</b></span><span class="pill good">${pg.cleared[x.s.id].grade} 등급</span></div>`).join('') : '<p class="sub" style="padding:8px 0">아직 진행한 시나리오가 없어요. 홈에서 코스를 골라 시작해 보세요.</p>';
}

/* ═════════ 시작 ═════════ */
(() => {
  const s = LS.get('lk_session', null);
  if(s === 'guest'){ guest(); return; }
  const acc = s && accounts()[s];
  if(acc){ startSession({email:s, nick:acc.nick, rankOpt:acc.rankOpt, created:acc.created}); return; }
  go('login');
})();
