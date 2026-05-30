// ======================================================
// DATA
// ======================================================
let quizzes = JSON.parse(localStorage.getItem('qb_quizzes') || '[]');
// quizzes[i] = { id, name, desc, questions: [{question,answers,correct,keyword}] }

function saveAll() { localStorage.setItem('qb_quizzes', JSON.stringify(quizzes)); }

// current editing context
let editingQuizId = null;
let editingQIdx = -1;
let selCorrectVal = 0;

// current playing context
let playQuizId = null;
let qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
let timerInt = null;

const UNSPLASH_KEY = 'DWZ8XIHVS9JJJEr_Nj4bdlHvvHSBT3D8QAEbOXuZl0';

// ======================================================
// PAGES
// ======================================================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => { p.style.display='none'; p.classList.remove('active'); });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('active');
}

// ======================================================
// SPLASH
// ======================================================
function updateSplash() {
  const n = quizzes.length;
  document.getElementById('splash-info').textContent =
    n === 0 ? 'Квизов пока нет. Войдите как преподаватель, чтобы создать первый!'
            : `📋 Доступно квизов: ${n}. Нажмите «Пройти квиз», чтобы выбрать.`;
}

// ======================================================
// STUDENT HOME
// ======================================================
function showStudentHome() {
  renderStudentCards();
  showPage('student-home');
}

function renderStudentCards() {
  const wrap = document.getElementById('student-quiz-cards');
  if (quizzes.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">🎓</div><h3>Пока нет квизов</h3><p>Преподаватель ещё не создал ни одного квиза</p></div>`;
    return;
  }
  wrap.innerHTML = quizzes.map(q => `
    <div class="quiz-card" onclick="startQuizAsStudent('${q.id}')">
      <div class="qc-title">${q.name}</div>
      ${q.desc ? `<div class="qc-meta" style="margin-bottom:.5rem;">${q.desc}</div>` : ''}
      <div class="qc-meta">
        <span class="qc-badge">📝 ${q.questions.length} вопр.</span>
        <span class="qc-badge">⏱ ~${q.questions.length * 20} сек</span>
      </div>
    </div>
  `).join('');
}

function startQuizAsStudent(quizId) {
  playQuizId = quizId;
  qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
  loadQuestion();
}

// ======================================================
// AUTH
// ======================================================
async function hashStr(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
const getCreds = () => JSON.parse(localStorage.getItem('qb_creds') || 'null');

function openLoginModal() {
  const creds = getCreds();
  document.getElementById('login-setup-note').style.display = creds ? 'none' : 'block';
  document.getElementById('login-submit').textContent = creds ? 'Войти' : 'Создать и войти';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').style.display = 'none';
  openModal('login-modal');
  setTimeout(() => document.getElementById('login-user').focus(), 100);
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!u || !p) { errEl.textContent='Заполните все поля'; errEl.style.display='block'; return; }
  const creds = getCreds();
  const h = await hashStr(p);
  if (!creds) {
    if (p.length < 4) { errEl.textContent='Пароль минимум 4 символа'; errEl.style.display='block'; return; }
    localStorage.setItem('qb_creds', JSON.stringify({username:u, password:h}));
    closeModal('login-modal'); renderTeacher(); showPage('teacher');
    toast('Аккаунт создан! 🎉', 'success');
  } else {
    if (creds.username===u && creds.password===h) {
      closeModal('login-modal'); renderTeacher(); showPage('teacher');
      toast(`С возвращением, ${u}! 👋`, 'success');
    } else { errEl.textContent='Неверный логин или пароль'; errEl.style.display='block'; }
  }
}

function logoutTeacher() { showPage('splash'); updateSplash(); }

function openChangePassModal() {
  ['cp-old','cp-new','cp-confirm'].forEach(id => document.getElementById(id).value='');
  document.getElementById('cp-err').style.display='none';
  openModal('cp-modal');
}

async function doChangePass() {
  const oldP=document.getElementById('cp-old').value, newP=document.getElementById('cp-new').value, conf=document.getElementById('cp-confirm').value;
  const errEl=document.getElementById('cp-err'); errEl.style.display='none';
  const creds=getCreds(); const oh=await hashStr(oldP);
  if(creds.password!==oh){errEl.textContent='Текущий пароль неверен';errEl.style.display='block';return;}
  if(newP.length<4){errEl.textContent='Мин. 4 символа';errEl.style.display='block';return;}
  if(newP!==conf){errEl.textContent='Пароли не совпадают';errEl.style.display='block';return;}
  localStorage.setItem('qb_creds', JSON.stringify({username:creds.username, password:await hashStr(newP)}));
  closeModal('cp-modal'); toast('Пароль изменён ✓','success');
}

function togglePass(id,btn){const el=document.getElementById(id);el.type=el.type==='password'?'text':'password';btn.textContent=el.type==='password'?'👁':'🙈';}

// ======================================================
// TEACHER: QUIZ MANAGEMENT
// ======================================================
function renderTeacher() {
  const wrap = document.getElementById('teacher-quiz-list');
  if (quizzes.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>Нет квизов</h3><p>Нажмите «+ Новый квиз», чтобы создать первый</p></div>`;
    return;
  }
  wrap.innerHTML = quizzes.map(q => `
    <div class="tq-card">
      <div class="tq-header">
        <div class="tq-title">${q.name}</div>
        <button class="btn btn-secondary btn-sm" onclick="openEditQuizModal('${q.id}')">✏️ Изменить</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuiz('${q.id}')">🗑</button>
      </div>
      ${q.desc ? `<div class="tq-desc">${q.desc}</div>` : ''}
      <div class="tq-footer">
        <span class="tq-count">📝 ${q.questions.length} вопросов</span>
        <button class="btn btn-secondary btn-sm" onclick="openQEditorPage('${q.id}')">📋 Редактировать вопросы</button>
        <button class="btn btn-primary btn-sm" onclick="startQuizAsStudent('${q.id}');showPage('waiting')">▶ Запустить</button>
      </div>
    </div>
  `).join('');
}

let editingQuizMetaId = null;
function openNewQuizModal() {
  editingQuizMetaId = null;
  document.getElementById('quiz-modal-title').textContent = 'Новый квиз';
  document.getElementById('qm-name').value = '';
  document.getElementById('qm-desc').value = '';
  document.getElementById('qm-err').style.display = 'none';
  openModal('quiz-modal');
  setTimeout(()=>document.getElementById('qm-name').focus(),100);
}
function openEditQuizModal(id) {
  const q = quizzes.find(x=>x.id===id);
  editingQuizMetaId = id;
  document.getElementById('quiz-modal-title').textContent = 'Редактировать квиз';
  document.getElementById('qm-name').value = q.name;
  document.getElementById('qm-desc').value = q.desc || '';
  document.getElementById('qm-err').style.display = 'none';
  openModal('quiz-modal');
}
function saveQuizMeta() {
  const name = document.getElementById('qm-name').value.trim();
  const desc = document.getElementById('qm-desc').value.trim();
  const errEl = document.getElementById('qm-err'); errEl.style.display='none';
  if (!name) { errEl.textContent='Введите название'; errEl.style.display='block'; return; }
  if (editingQuizMetaId) {
    const q = quizzes.find(x=>x.id===editingQuizMetaId);
    q.name=name; q.desc=desc;
  } else {
    quizzes.push({ id: uid(), name, desc, questions:[] });
  }
  saveAll(); closeModal('quiz-modal'); renderTeacher();
  toast(editingQuizMetaId ? 'Квиз обновлён ✓' : 'Квиз создан ✓', 'success');
}
function deleteQuiz(id) {
  if (!confirm('Удалить квиз и все его вопросы?')) return;
  quizzes = quizzes.filter(x=>x.id!==id);
  saveAll(); renderTeacher(); toast('Квиз удалён','success');
}

// ======================================================
// QUESTION EDITOR PAGE
// ======================================================
function openQEditorPage(quizId) {
  editingQuizId = quizId;
  const q = quizzes.find(x=>x.id===quizId);
  document.getElementById('qep-title').textContent = q.name;
  renderQList();
  showPage('q-editor-page');
}

function renderQList() {
  const q = quizzes.find(x=>x.id===editingQuizId);
  const wrap = document.getElementById('q-list');
  document.getElementById('qep-start-btn').disabled = q.questions.length === 0;
  if (q.questions.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">❓</div><h3>Нет вопросов</h3><p>Нажмите «+ Вопрос»</p></div>`;
    return;
  }
  wrap.innerHTML = q.questions.map((qq,i) => `
    <div class="q-card">
      <div class="q-number">Вопрос ${i+1}</div>
      <div class="q-text">${qq.question}</div>
      <div class="q-answers">
        ${qq.answers.map((a,j)=>`<div class="q-answer ${j===qq.correct?'correct':''}"><b>${'ABC'[j]}</b> ${a}</div>`).join('')}
      </div>
      <div class="q-actions">
        <button class="btn btn-secondary btn-sm" onclick="openQEditor(${i})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQ(${i})">🗑</button>
      </div>
    </div>
  `).join('');
}

function openQEditor(idx) {
  editingQIdx = idx;
  const q = quizzes.find(x=>x.id===editingQuizId);
  const qq = idx >= 0 ? q.questions[idx] : null;
  document.getElementById('q-modal-title').textContent = idx >= 0 ? 'Изменить вопрос' : 'Новый вопрос';
  document.getElementById('ed-q').innerHTML = qq ? qq.question : '';
  document.getElementById('ed-a').value = qq ? qq.answers[0] : '';
  document.getElementById('ed-b').value = qq ? qq.answers[1] : '';
  document.getElementById('ed-c').value = qq ? qq.answers[2] : '';
  document.getElementById('ed-kw').value = qq ? (qq.keyword||'') : '';
  selCorrectVal = qq ? qq.correct : 0;
  updateCorrectBtns();
  openModal('q-modal');
}

function selCorrect(i) { selCorrectVal=i; updateCorrectBtns(); }
function updateCorrectBtns() {
  [0,1,2].forEach(i=>document.getElementById('cb-'+i).classList.toggle('selected',i===selCorrectVal));
}

function saveQuestion() {
  const question = document.getElementById('ed-q').innerHTML.trim();
  const a=document.getElementById('ed-a').value.trim();
  const b=document.getElementById('ed-b').value.trim();
  const c=document.getElementById('ed-c').value.trim();
  const kw=document.getElementById('ed-kw').value.trim();
  const strip=s=>s.replace(/<[^>]+>/g,'').trim();
  if(!strip(question)||!a||!b||!c){toast('Заполните все поля!','error');return;}
  const q = quizzes.find(x=>x.id===editingQuizId);
  const obj={question,answers:[a,b,c],correct:selCorrectVal,keyword:kw};
  if(editingQIdx>=0) q.questions[editingQIdx]=obj; else q.questions.push(obj);
  saveAll(); closeModal('q-modal'); renderQList();
  toast(editingQIdx>=0?'Вопрос обновлён ✓':'Вопрос добавлен ✓','success');
}

function deleteQ(i) {
  const q=quizzes.find(x=>x.id===editingQuizId);
  q.questions.splice(i,1); saveAll(); renderQList(); toast('Вопрос удалён','success');
}

function startQuizFromEditor() {
  startQuizAsStudent(editingQuizId);
}

// ======================================================
// QUIZ ENGINE
// ======================================================
async function loadQuestion() {
  showPage('waiting');
  const quiz = quizzes.find(x=>x.id===playQuizId);
  const qq = quiz.questions[qState.idx];
  let imgUrl = `https://source.unsplash.com/1200x400/?${encodeURIComponent(qq.keyword||'education')}&sig=${qState.idx}`;
  try {
    const res = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(qq.keyword||'education')}&orientation=landscape&client_id=${UNSPLASH_KEY}`);
    if(res.ok){const d=await res.json();imgUrl=d.urls.regular;}
  } catch(e){}
  if(!qState.history[qState.idx]) qState.history[qState.idx]={imgUrl,chosen:null};
  else qState.history[qState.idx].imgUrl = qState.history[qState.idx].imgUrl||imgUrl;
  renderQuestion(quiz, qState.history[qState.idx].imgUrl);
}

function renderQuestion(quiz, imgUrl) {
  const snap = qState.history[qState.idx];
  const already = snap && snap.chosen !== null;
  qState.answered = already;
  const qq = quiz.questions[qState.idx];
  const total = quiz.questions.length;

  document.getElementById('q-counter').textContent = `${qState.idx+1}/${total}`;
  document.getElementById('quiz-progress').style.width = `${(qState.idx/total)*100}%`;
  document.getElementById('prev-btn').disabled = qState.idx===0;
  updateScoreUI();
  document.getElementById('quiz-q-label').textContent = `Вопрос ${qState.idx+1} из ${total} · ${quiz.name}`;
  document.getElementById('quiz-q-text').innerHTML = qq.question;
  document.getElementById('quiz-img').src = imgUrl;

  const grid = document.getElementById('answers-grid-quiz');
  grid.innerHTML = qq.answers.map((a,i)=>`
    <button class="answer-btn opt-${'abc'[i]}" onclick="chooseAns(${i})" id="ab-${i}">
      <span class="ab-letter">${'ABC'[i]}</span><span>${a}</span>
    </button>
  `).join('');

  if(already){ revealAnswers(snap.chosen); clearInterval(timerInt); document.getElementById('timer-arc').style.strokeDashoffset=150.8; document.getElementById('timer-text').textContent='–'; }
  else startTimer();
  showPage('quiz');
}

function updateScoreUI() {
  document.getElementById('quiz-score-pts').textContent = `${qState.score} ⭐`;
  document.getElementById('quiz-score-cor').textContent = `${qState.correct} из ${qState.correct+qState.wrong}`;
}

function startTimer() {
  clearInterval(timerInt);
  let t=20;
  const arc=document.getElementById('timer-arc'), txt=document.getElementById('timer-text');
  arc.style.stroke='var(--accent2)';
  arc.style.strokeDashoffset=0; txt.textContent=20;
  timerInt = setInterval(()=>{
    t--;
    arc.style.strokeDashoffset = 150.8-(t/20)*150.8;
    txt.textContent=t;
    if(t<=5) arc.style.stroke='var(--red)';
    if(t<=0){clearInterval(timerInt);if(!qState.answered)autoReveal();}
  },1000);
}

function autoReveal() {
  qState.answered=true; qState.wrong++;
  qState.history[qState.idx].chosen='timeout';
  updateScoreUI(); revealAnswers(-1);
  setTimeout(nextQ, 2000);
}

function chooseAns(i) {
  if(qState.answered) return;
  qState.answered=true; clearInterval(timerInt);
  const quiz=quizzes.find(x=>x.id===playQuizId);
  const qq=quiz.questions[qState.idx];
  if(i===qq.correct){qState.score++;qState.correct++;showPointPopup('+1');}
  else{qState.wrong++;document.getElementById('ab-'+i).classList.add('shake');}
  qState.history[qState.idx].chosen=i;
  updateScoreUI(); revealAnswers(i);
  setTimeout(nextQ,2000);
}

function revealAnswers(chosen) {
  const quiz=quizzes.find(x=>x.id===playQuizId);
  const qq=quiz.questions[qState.idx];
  for(let i=0;i<3;i++){
    const b=document.getElementById('ab-'+i); if(!b) continue;
    b.onclick=null;
    if(i===qq.correct) b.classList.add('revealed-correct');
    else b.classList.add('revealed-wrong');
  }
}

function nextQ() {
  const quiz=quizzes.find(x=>x.id===playQuizId);
  qState.idx++;
  if(qState.idx>=quiz.questions.length){showResults();return;}
  loadQuestion();
}

function goToPrev() {
  if(qState.idx===0) return;
  clearInterval(timerInt); qState.idx--;
  const snap=qState.history[qState.idx];
  const quiz=quizzes.find(x=>x.id===playQuizId);
  renderQuestion(quiz, snap ? snap.imgUrl : '');
  document.getElementById('prev-btn').disabled = qState.idx===0;
}

function showResults() {
  const quiz=quizzes.find(x=>x.id===playQuizId);
  const total=quiz.questions.length;
  const pct=Math.round((qState.correct/total)*100);
  document.getElementById('results-score').textContent=qState.score;
  document.getElementById('results-label').textContent=`балл${qState.score===1?'':qState.score<5?'а':'ов'} из ${total}`;
  document.getElementById('results-emoji').textContent=pct>=80?'🏆':pct>=50?'🎉':pct>=30?'😊':'💪';
  document.getElementById('results-breakdown').innerHTML=`
    <div class="result-stat"><div class="num" style="color:var(--green)">${qState.correct}</div><div class="lbl">Правильных</div></div>
    <div class="result-stat"><div class="num" style="color:var(--red)">${qState.wrong}</div><div class="lbl">Неверных</div></div>
    <div class="result-stat"><div class="num" style="color:var(--accent3)">${qState.score}</div><div class="lbl">Баллов</div></div>
    <div class="result-stat"><div class="num" style="color:var(--accent2)">${pct}%</div><div class="lbl">Точность</div></div>
  `;
  showPage('results');
  if(pct>=50) launchConfetti();
}

function retryCurrentQuiz() {
  qState={idx:0,score:0,correct:0,wrong:0,answered:false,history:[]};
  loadQuestion();
}

function showPointPopup(t) {
  const p=document.createElement('div'); p.className='point-popup'; p.textContent=t;
  document.body.appendChild(p); setTimeout(()=>p.remove(),1100);
}

function launchConfetti() {
  const wrap=document.getElementById('confetti'); wrap.innerHTML='';
  const cols=['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899'];
  for(let i=0;i<70;i++){
    const d=document.createElement('div'); d.className='conf-dot';
    d.style.left=Math.random()*100+'vw'; d.style.background=cols[Math.floor(Math.random()*cols.length)];
    d.style.animationDuration=(1.5+Math.random()*2)+'s'; d.style.animationDelay=Math.random()*1.5+'s';
    wrap.appendChild(d);
  } setTimeout(()=>wrap.innerHTML='',4500);
}

// ======================================================
// UTILS
// ======================================================
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function toast(msg,type='success'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),2500);}

// ======================================================
// INIT
// ======================================================
// Migrate old single-quiz format if needed
(function migrate(){
  const old=localStorage.getItem('qb_questions');
  if(old && quizzes.length===0){
    try{
      const qs=JSON.parse(old);
      if(qs.length>0){quizzes.push({id:uid(),name:'Мой первый квиз',desc:'Перенесено из старой версии',questions:qs});saveAll();}
    }catch(e){}
  }
})();

// Sample quizzes if empty
if(quizzes.length===0){
  quizzes=[
    {id:uid(),name:'🌍 География',desc:'Страны, столицы и природа',questions:[
      {question:'Столица <b>Франции</b>?',answers:['Лондон','Берлин','Париж'],correct:2,keyword:'paris eiffel tower'},
      {question:'Самый большой океан?',answers:['Атлантический','<b>Тихий</b>','Индийский'],correct:1,keyword:'pacific ocean'},
      {question:'Столица Японии?',answers:['Осака','Киото','Токио'],correct:2,keyword:'tokyo japan'},
    ]},
    {id:uid(),name:'🔬 Наука',desc:'Физика, химия, биология',questions:[
      {question:'Какая планета ближайшая к Солнцу?',answers:['Земля','Меркурий','Венера'],correct:1,keyword:'mercury planet'},
      {question:'Сколько цветов у радуги?',answers:['5','7','9'],correct:1,keyword:'rainbow colorful'},
    ]},
  ];
  saveAll();
}

updateSplash();