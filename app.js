const SIZE=8;
const TYPES=[{cls:'b1'},{cls:'b2'},{cls:'b3'},{cls:'b4'},{cls:'b5'},{cls:'b6'}];
const LEVEL_TARGETS=[18,30,42,56,72];
const TOTAL_TIME=150;
const API_BASE=location.protocol==='file:'?'http://127.0.0.1:3000':'';
let board=[],selected=null,level=0,progress=0,timeLeft=TOTAL_TIME,timer=null,locked=false,pendingRankTime=null,dragStart=null,pointerMoved=false,activePointerId=null;
const boardEl=document.getElementById('board');
const levelText=document.getElementById('levelText');
const timeText=document.getElementById('timeText');
const goalText=document.getElementById('goalText');
const progressBar=document.getElementById('progressBar');
const rankDateText=document.getElementById('rankDateText');
const rankPreview=document.getElementById('rankPreview');
const rankList=document.getElementById('rankList');
const fxLayer=document.getElementById('fxLayer');
function randType(){return Math.floor(Math.random()*TYPES.length)}
function berryMarkup(){return '<div class="berry"><span class="arm left"></span><span class="arm right"></span><span class="leg left"></span><span class="leg right"></span><div class="fruit"></div><div class="shine"></div><div class="calyx"></div><div class="face"><span class="eye left"></span><span class="eye right"></span><span class="mouth"></span></div><div class="blush left"></div><div class="blush right"></div></div>'}
function formatTime(sec){const m=String(Math.floor(sec/60)).padStart(2,'0');const s=String(sec%60).padStart(2,'0');return `${m}:${s}`}
function isAdjacent(a,b){return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1}
function getUserId(){let id=localStorage.getItem('blueberry_user_id');if(!id){id='u_'+Math.random().toString(36).slice(2,10);localStorage.setItem('blueberry_user_id',id)}return id}
function isValidPhone(phone){return /^1\d{10}$/.test(phone)}
async function fetchTodayRankings(){const res=await fetch(`${API_BASE}/api/rankings/today`);if(!res.ok)throw new Error('排行榜获取失败');return res.json()}
async function submitScore(nickname,phone,usedSeconds){const res=await fetch(`${API_BASE}/api/score`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:getUserId(),nickname,phone,usedSeconds})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'成绩提交失败');return data}
async function refreshRankings(){try{const data=await fetchTodayRankings();rankDateText.textContent=`统计日期：${data.date}`;renderRankPreview(data.preview||[]);renderRankList(data.top10||[])}catch(e){rankDateText.textContent='排行榜加载失败';rankPreview.innerHTML='<div class="rank-item"><span>加载失败</span><strong>--</strong></div>';rankList.innerHTML='<div class="list-item"><span>加载失败</span><strong>--</strong></div>'}}
function makeBoard(){board=[];for(let r=0;r<SIZE;r++){board[r]=[];for(let c=0;c<SIZE;c++){let t;do{t=randType()}while((c>=2&&board[r][c-1]===t&&board[r][c-2]===t)||(r>=2&&board[r-1][c]===t&&board[r-2][c]===t));board[r][c]=t}}}
function render(){boardEl.innerHTML='';for(let r=0;r<SIZE;r++){for(let c=0;c<SIZE;c++){const btn=document.createElement('button');btn.className=`cell ${TYPES[board[r][c]].cls}`;if(selected&&selected.r===r&&selected.c===c)btn.classList.add('selected');btn.dataset.row=r;btn.dataset.col=c;btn.innerHTML=berryMarkup();btn.addEventListener('click',onCellClick);boardEl.appendChild(btn)}}updateHud()}
function updateHud(){levelText.textContent=`${level+1} / 5`;goalText.textContent=`${Math.min(progress,LEVEL_TARGETS[level])} / ${LEVEL_TARGETS[level]}`;timeText.textContent=formatTime(timeLeft);timeText.style.color=timeLeft<=30?'#ef6d8f':'#f4a542';progressBar.style.width=`${Math.min(progress/LEVEL_TARGETS[level]*100,100)}%`}
function swap(r1,c1,r2,c2){const t=board[r1][c1];board[r1][c1]=board[r2][c2];board[r2][c2]=t}
function findMatches(){const found=new Set();for(let r=0;r<SIZE;r++){let count=1;for(let c=1;c<=SIZE;c++){if(c<SIZE&&board[r][c]===board[r][c-1])count++;else{if(count>=3)for(let k=0;k<count;k++)found.add(`${r},${c-1-k}`);count=1}}}for(let c=0;c<SIZE;c++){let count=1;for(let r=1;r<=SIZE;r++){if(r<SIZE&&board[r][c]===board[r-1][c])count++;else{if(count>=3)for(let k=0;k<count;k++)found.add(`${r-1-k},${c}`);count=1}}}return [...found].map(v=>{const [r,c]=v.split(',').map(Number);return {r,c}})}
function dropDown(){for(let c=0;c<SIZE;c++){const col=[];for(let r=SIZE-1;r>=0;r--)if(board[r][c]!==-1)col.push(board[r][c]);while(col.length<SIZE)col.push(randType());for(let r=SIZE-1,i=0;r>=0;r--,i++)board[r][c]=col[i]}}
function cellCenter(r,c){const rect=boardEl.getBoundingClientRect();const size=rect.width/SIZE;return{x:c*size+size/2,y:r*size+size/2}}
function spawnFx(type,payload){if(!fxLayer)return;const el=document.createElement('div');el.className=type;if(type==='fx-line'){el.style.left='0px';el.style.top=`${payload.y}px`;el.style.width=`${boardEl.getBoundingClientRect().width}px`}else{el.style.left=`${payload.x}px`;el.style.top=`${payload.y}px`}fxLayer.appendChild(el);setTimeout(()=>el.remove(),800)}
function playMatchEffects(matches){if(!matches.length)return;const rows=new Map(),cols=new Map();matches.forEach(({r,c})=>{rows.set(r,(rows.get(r)||0)+1);cols.set(c,(cols.get(c)||0)+1)});if(matches.length>=5){const m=matches[Math.floor(matches.length/2)];spawnFx('fx-freeze',cellCenter(m.r,m.c));return}for(const [r,count] of rows){if(count>=4){spawnFx('fx-line',{y:cellCenter(r,0).y});return}}for(const [c,count] of cols){if(count>=4){const m=matches.find(v=>v.c===c)||matches[0];spawnFx('fx-burst',cellCenter(m.r,m.c));return}}const m=matches[Math.floor(matches.length/2)];spawnFx('fx-burst',cellCenter(m.r,m.c))}
function processBoard(){locked=true;let removed=0;while(true){const matches=findMatches();if(!matches.length)break;playMatchEffects(matches);removed+=matches.length;matches.forEach(({r,c})=>board[r][c]=-1);dropDown()}progress+=removed;render();checkLevel();locked=false}
function tryMove(from,to){if(locked)return;if(from.r===to.r&&from.c===to.c){selected=to;render();return}swap(from.r,from.c,to.r,to.c);selected=null;const matches=findMatches();if(!matches.length){swap(from.r,from.c,to.r,to.c);selected=to;render();return}processBoard()}
function onCellClick(e){if(locked||pointerMoved)return;const r=Number(e.currentTarget.dataset.row),c=Number(e.currentTarget.dataset.col);if(!selected){selected={r,c};render();return}const from=selected;tryMove(from,{r,c})}
function updateViewportUnit(){document.documentElement.style.setProperty('--vh',`${window.innerHeight*0.01}px`)}
function lockPageScroll(e){if(e.cancelable)e.preventDefault()}
function onPointerDown(e){const cell=e.target.closest('.cell');if(!cell||locked)return;activePointerId=e.pointerId;pointerMoved=false;dragStart={r:Number(cell.dataset.row),c:Number(cell.dataset.col),x:e.clientX,y:e.clientY};selected={r:dragStart.r,c:dragStart.c};if(boardEl.setPointerCapture){try{boardEl.setPointerCapture(e.pointerId)}catch(_){}}render()}
function onPointerMove(e){if(!dragStart||locked||e.pointerId!==activePointerId)return;const dx=e.clientX-dragStart.x;const dy=e.clientY-dragStart.y;const absX=Math.abs(dx),absY=Math.abs(dy);if(Math.max(absX,absY)>=6){pointerMoved=true;if(e.cancelable)e.preventDefault()}}
function onPointerUp(e){if(!dragStart||locked||(activePointerId!==null&&e.pointerId!==activePointerId)){dragStart=null;activePointerId=null;pointerMoved=false;return}const dx=e.clientX-dragStart.x;const dy=e.clientY-dragStart.y;const absX=Math.abs(dx),absY=Math.abs(dy);if(Math.max(absX,absY)<10){dragStart=null;activePointerId=null;pointerMoved=false;return}let to={r:dragStart.r,c:dragStart.c};if(absX>absY)to.c+=dx>0?1:-1;else to.r+=dy>0?1:-1;if(to.r<0||to.r>=SIZE||to.c<0||to.c>=SIZE){dragStart=null;activePointerId=null;pointerMoved=false;selected=null;render();return}tryMove({r:dragStart.r,c:dragStart.c},to);dragStart=null;activePointerId=null;pointerMoved=false}
function onPointerCancel(){dragStart=null;activePointerId=null;pointerMoved=false}
function ensurePlayable(){let tries=0;while(!hasPossibleMove()&&tries<30){makeBoard();tries++}}
function hasPossibleMove(){for(let r=0;r<SIZE;r++){for(let c=0;c<SIZE;c++){for(const [dr,dc] of [[0,1],[1,0]]){const nr=r+dr,nc=c+dc;if(nr>=SIZE||nc>=SIZE)continue;swap(r,c,nr,nc);const ok=findMatches().length>0;swap(r,c,nr,nc);if(ok)return true}}}return false}
function rankItemHtml(item,i){const name=item.nickname||'蓝莓玩家';const phone=item.phone_masked||'--';return `<div class="rank-left"><div class="rank-main">${i+1}. ${phone}</div><div class="rank-sub">昵称：${name}</div></div><strong>${formatTime(item.used_seconds)}</strong>`}
function renderRankPreview(arr){if(!arr.length){rankPreview.innerHTML='<div class="rank-item"><span>暂无通关记录</span><strong>--</strong></div>';return}rankPreview.innerHTML=arr.map((item,i)=>`<div class="rank-item">${rankItemHtml(item,i)}</div>`).join('')}
function renderRankList(arr){if(!arr.length){rankList.innerHTML='<div class="list-item"><span>暂无记录</span><span>--</span></div>';return}rankList.innerHTML=arr.map((item,i)=>`<div class="list-item">${rankItemHtml(item,i)}</div>`).join('')}
function showMessage(title,body){document.getElementById('messageTitle').textContent=title;document.getElementById('messageBody').textContent=body;document.getElementById('messageOverlay').classList.remove('hidden')}
function hideMessage(){document.getElementById('messageOverlay').classList.add('hidden')}
function openRules(){document.getElementById('rulesOverlay').classList.remove('hidden')}
function closeRules(){document.getElementById('rulesOverlay').classList.add('hidden')}
function openRank(){document.getElementById('rankOverlay').classList.remove('hidden')}
function closeRank(){document.getElementById('rankOverlay').classList.add('hidden')}
function setFormError(text){document.getElementById('formError').textContent=text||''}
function openNameOverlay(sec){pendingRankTime=sec;document.getElementById('nicknameInput').value='';document.getElementById('phoneInput').value='';setFormError('');document.getElementById('nameOverlay').classList.remove('hidden')}
function closeNameOverlay(){document.getElementById('nameOverlay').classList.add('hidden')}
async function saveRankFromInput(){const name=(document.getElementById('nicknameInput').value||'').trim()||'蓝莓玩家';const phone=(document.getElementById('phoneInput').value||'').replace(/\D/g,'').trim();if(pendingRankTime===null)return;if(!isValidPhone(phone)){setFormError('请输入正确的 11 位手机号');return}setFormError('');const scoreTime=pendingRankTime;try{const result=await submitScore(name,phone,scoreTime);pendingRankTime=null;closeNameOverlay();await refreshRankings();const rankText=result.rank?`当前排名第 ${result.rank} 名。`:'';showMessage('成绩已保存',`你的通关时间 ${formatTime(scoreTime)} 已进入今日排行榜。${rankText}`)}catch(error){const msg=error&&error.message==='Failed to fetch'?'无法连接排行榜服务，请确认页面通过 http://127.0.0.1:3000/ 打开，或稍后重试':(error.message||'成绩提交失败，请稍后再试');setFormError(msg)}}
function skipRankSave(){pendingRankTime=null;closeNameOverlay();showMessage('已完成挑战','本次通关未保存到排行榜，你仍可重新开始继续挑战。')}
function checkLevel(){if(progress<LEVEL_TARGETS[level]){updateHud();return}if(level<LEVEL_TARGETS.length-1){level++;progress=0;makeBoard();ensurePlayable();render();showMessage('蓝莓过关',`进入第 ${level+1} 关，目标是消除 ${LEVEL_TARGETS[level]} 个蓝莓棋子。`);return}clearInterval(timer);locked=true;openNameOverlay(TOTAL_TIME-timeLeft)}
function startGame(){clearInterval(timer);level=0;progress=0;timeLeft=TOTAL_TIME;selected=null;locked=false;pendingRankTime=null;closeNameOverlay();makeBoard();ensurePlayable();render();timer=setInterval(()=>{timeLeft--;updateHud();if(timeLeft<=0){clearInterval(timer);locked=true;showMessage('时间到','3 分钟已到，本局挑战结束。点击“重新开始”可以重新挑战。')}},1000)}
window.render_game_to_text=()=>JSON.stringify({mode:locked?'locked':'playing',boardSize:{rows:SIZE,cols:SIZE},level:level+1,levelTarget:LEVEL_TARGETS[level],progress,timeLeft,selected,board,coordinateSystem:'origin top-left; row increases downward; col increases rightward'});
window.advanceTime=ms=>{const ticks=Math.max(1,Math.floor(ms/1000));for(let i=0;i<ticks;i++)if(timeLeft>0&&!locked)timeLeft--;updateHud()};
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('ruleBtn').addEventListener('click',openRules);
document.getElementById('rankBtn').addEventListener('click',openRank);
const openRulesQuickBtn=document.getElementById('openRulesQuick');if(openRulesQuickBtn)openRulesQuickBtn.addEventListener('click',openRules);
const closeRulesBtn=document.getElementById('closeRules');if(closeRulesBtn)closeRulesBtn.addEventListener('click',closeRules);
const closeRulesX=document.getElementById('closeRulesX');if(closeRulesX)closeRulesX.addEventListener('click',closeRules);
const closeRankBtn=document.getElementById('closeRank');if(closeRankBtn)closeRankBtn.addEventListener('click',closeRank);
const closeRankX=document.getElementById('closeRankX');if(closeRankX)closeRankX.addEventListener('click',closeRank);
const closeNameX=document.getElementById('closeNameX');if(closeNameX)closeNameX.addEventListener('click',closeNameOverlay);
const closeMessageX=document.getElementById('closeMessageX');if(closeMessageX)closeMessageX.addEventListener('click',hideMessage);
const messageOkBtn=document.getElementById('messageOk');if(messageOkBtn)messageOkBtn.addEventListener('click',hideMessage);
document.getElementById('saveRankBtn').addEventListener('click',saveRankFromInput);
document.getElementById('skipRankBtn').addEventListener('click',skipRankSave);
document.getElementById('nicknameInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('phoneInput').focus()});
document.getElementById('phoneInput').addEventListener('keydown',e=>{if(e.key==='Enter')saveRankFromInput()});
document.getElementById('rulesOverlay').addEventListener('click',e=>{if(e.target.id==='rulesOverlay')closeRules()});
document.getElementById('rankOverlay').addEventListener('click',e=>{if(e.target.id==='rankOverlay')closeRank()});
document.getElementById('messageOverlay').addEventListener('click',e=>{if(e.target.id==='messageOverlay')hideMessage()});
document.getElementById('nameOverlay').addEventListener('click',e=>{if(e.target.id==='nameOverlay')closeNameOverlay()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideMessage();closeRules();closeRank();closeNameOverlay();}});
function bindOverlayClose(id,closer){const el=document.getElementById(id);if(!el)return;['click','pointerdown','mousedown','touchstart'].forEach(evt=>{el.addEventListener(evt,e=>{if(e.target===el)closer();});});}
bindOverlayClose('messageOverlay',hideMessage);
bindOverlayClose('rulesOverlay',closeRules);
bindOverlayClose('rankOverlay',closeRank);
bindOverlayClose('nameOverlay',closeNameOverlay);
updateViewportUnit();
window.addEventListener('resize',updateViewportUnit);
window.addEventListener('orientationchange',updateViewportUnit);
document.addEventListener('touchmove',lockPageScroll,{passive:false});
boardEl.addEventListener('pointerdown',onPointerDown);
boardEl.addEventListener('pointermove',onPointerMove);
boardEl.addEventListener('pointerup',onPointerUp);
boardEl.addEventListener('pointercancel',onPointerCancel);
boardEl.addEventListener('pointerleave',()=>{});
refreshRankings();
startGame();
