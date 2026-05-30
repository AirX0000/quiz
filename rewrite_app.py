import os

JS_CONTENT = """// ======================================================
// INIT SUPABASE
// ======================================================
const SUPABASE_URL = 'https://hawlzgobfzsqwaxfpqva.supabase.co';
const SUPABASE_KEY = 'sb_publishable_moND8o3E68eoh_kEkhPk5A_llIok7nO';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======================================================
// GLOBAL STATE
// ======================================================
let quizzes = [];
let currentUser = null;
let currentProfile = null;

let editingQuizId = null;
let editingQIdx = -1;
let selCorrectVal = 0;

let playQuizId = null;
let qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
let timerInt = null;

const UNSPLASH_KEY = 'DWZ8XIHVS9JJJEr_Nj4bdlHvvHSBT3D8QAEbOXuZl0';

// ======================================================
// AUTH & SESSION
// ======================================================
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await fetchProfile();
        await fetchQuizzes();
        renderTeacher();
        showPage('teacher');
    } else {
        await fetchQuizzes();
        updateSplash();
        showPage('splash');
    }
}

async function fetchProfile() {
    if (!currentUser) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        currentProfile = data;
        if (data.role === 'admin') {
            document.getElementById('btn-admin').classList.remove('d-none');
        } else {
            document.getElementById('btn-admin').classList.add('d-none');
        }
    }
}

function openLoginModal() {
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-err').classList.add('d-none');
    document.getElementById('login-setup-note').classList.remove('d-none');
    document.getElementById('login-submit').textContent = 'Войти / Создать';
    document.getElementById('login-user').placeholder = 'Email';
    openModal('login-modal');
    setTimeout(() => document.getElementById('login-user').focus(), 100);
}

async function doLogin() {
    const email = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-err');
    errEl.classList.add('d-none');
    
    if (!email || !p) { errEl.textContent='Заполните все поля'; errEl.classList.remove('d-none'); return; }
    
    // Пытаемся войти
    let { data, error } = await supabase.auth.signInWithPassword({ email, password: p });
    
    if (error && error.message.includes('Invalid login credentials')) {
        // Если неверные учетные данные, попробуем зарегистрировать
        const regRes = await supabase.auth.signUp({ email, password: p });
        if (regRes.error) {
            errEl.textContent = regRes.error.message;
            errEl.classList.remove('d-none');
            return;
        }
        data = regRes.data;
        toast('Аккаунт создан! 🎉', 'success');
    } else if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('d-none');
        return;
    } else {
        toast(`С возвращением! 👋`, 'success');
    }
    
    closeModal('login-modal');
    await checkSession();
}

async function logoutTeacher() { 
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showPage('splash'); 
    updateSplash(); 
}

// ======================================================
// DATA FETCHING
// ======================================================
async function fetchQuizzes() {
    const { data, error } = await supabase.from('quizzes').select('*, questions(*)').order('created_at', { ascending: false });
    if (data) quizzes = data;
    updateSplash();
}

// ======================================================
// TEACHER: QUIZ MANAGEMENT
// ======================================================
function renderTeacher() {
    const wrap = document.getElementById('teacher-quiz-list');
    if (!currentUser) return;
    
    // Показывать все квизы админу, а учителю только свои
    const myQuizzes = currentProfile?.role === 'admin' ? quizzes : quizzes.filter(q => q.teacher_id === currentUser.id);
    
    if (myQuizzes.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>Нет квизов</h3><p>Нажмите «+ Новый квиз», чтобы создать первый</p></div>`;
        return;
    }
    wrap.innerHTML = myQuizzes.map(q => `
    <div class="tq-card">
        <div class="tq-header">
        <div class="tq-title">${q.name}</div>
        <button class="btn btn-secondary btn-sm" onclick="openEditQuizModal('${q.id}')">✏️ Изменить</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuiz('${q.id}')">🗑</button>
        </div>
        ${q.desc ? `<div class="tq-desc">${q.desc}</div>` : ''}
        <div class="tq-footer" style="margin-top:0.8rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
        <span class="tq-count">📝 ${(q.questions||[]).length} вопросов</span>
        <button class="btn btn-secondary btn-sm" onclick="openQEditorPage('${q.id}')">📋 Редактировать вопросы</button>
        <button class="btn btn-secondary btn-sm" onclick="openAnalytics('${q.id}')">📊 Статистика</button>
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
    document.getElementById('qm-err').classList.add('d-none');
    openModal('quiz-modal');
    setTimeout(()=>document.getElementById('qm-name').focus(),100);
}
function openEditQuizModal(id) {
    const q = quizzes.find(x=>x.id===id);
    editingQuizMetaId = id;
    document.getElementById('quiz-modal-title').textContent = 'Редактировать квиз';
    document.getElementById('qm-name').value = q.name;
    document.getElementById('qm-desc').value = q.desc || '';
    document.getElementById('qm-err').classList.add('d-none');
    openModal('quiz-modal');
}
async function saveQuizMeta() {
    const name = document.getElementById('qm-name').value.trim();
    const desc = document.getElementById('qm-desc').value.trim();
    const errEl = document.getElementById('qm-err'); errEl.classList.add('d-none');
    if (!name) { errEl.textContent='Введите название'; errEl.classList.remove('d-none'); return; }
    
    if (editingQuizMetaId) {
        const { error } = await supabase.from('quizzes').update({ name, description: desc }).eq('id', editingQuizMetaId);
        if (error) { toast('Ошибка: ' + error.message, 'error'); return; }
    } else {
        const { error } = await supabase.from('quizzes').insert({ teacher_id: currentUser.id, name, description: desc });
        if (error) { toast('Ошибка: ' + error.message, 'error'); return; }
    }
    await fetchQuizzes();
    closeModal('quiz-modal'); renderTeacher();
    toast(editingQuizMetaId ? 'Квиз обновлён ✓' : 'Квиз создан ✓', 'success');
}
async function deleteQuiz(id) {
    if (!confirm('Удалить квиз и все его вопросы?')) return;
    await supabase.from('quizzes').delete().eq('id', id);
    await fetchQuizzes();
    renderTeacher(); toast('Квиз удалён','success');
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
    const qList = q.questions || [];
    document.getElementById('qep-start-btn').disabled = qList.length === 0;
    if (qList.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><div class="icon">❓</div><h3>Нет вопросов</h3><p>Нажмите «+ Вопрос»</p></div>`;
        return;
    }
    wrap.innerHTML = qList.map((qq,i) => `
    <div class="q-card">
        <div class="q-number">Вопрос ${i+1}</div>
        <div class="q-text">${qq.question_text}</div>
        <div class="q-answers">
        ${qq.answers.map((a,j)=>`<div class="q-answer ${j===qq.correct_index?'correct':''}"><b>${'ABC'[j]}</b> ${a}</div>`).join('')}
        </div>
        <div class="q-actions">
        <button class="btn btn-secondary btn-sm" onclick="openQEditor('${qq.id}', ${i})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQ('${qq.id}')">🗑</button>
        </div>
    </div>
    `).join('');
}

let editingQuestionId = null;
function openQEditor(qId, idx) {
    editingQIdx = idx;
    editingQuestionId = qId;
    const q = quizzes.find(x=>x.id===editingQuizId);
    const qq = qId ? q.questions.find(x=>x.id===qId) : null;
    
    document.getElementById('q-modal-title').textContent = qId ? 'Изменить вопрос' : 'Новый вопрос';
    document.getElementById('ed-q').innerHTML = qq ? qq.question_text : '';
    document.getElementById('ed-a').value = qq ? qq.answers[0] : '';
    document.getElementById('ed-b').value = qq ? qq.answers[1] : '';
    document.getElementById('ed-c').value = qq ? qq.answers[2] : '';
    document.getElementById('ed-kw').value = qq ? (qq.keyword||'') : '';
    selCorrectVal = qq ? qq.correct_index : 0;
    updateCorrectBtns();
    openModal('q-modal');
}

function selCorrect(i) { selCorrectVal=i; updateCorrectBtns(); }
function updateCorrectBtns() {
    [0,1,2].forEach(i=>document.getElementById('cb-'+i).classList.toggle('selected',i===selCorrectVal));
}

async function saveQuestion() {
    const question_text = document.getElementById('ed-q').innerHTML.trim();
    const a=document.getElementById('ed-a').value.trim();
    const b=document.getElementById('ed-b').value.trim();
    const c=document.getElementById('ed-c').value.trim();
    const kw=document.getElementById('ed-kw').value.trim();
    const strip=s=>s.replace(/<[^>]+>/g,'').trim();
    
    if(!strip(question_text)||!a||!b||!c){toast('Заполните все поля!','error');return;}
    
    const obj={quiz_id: editingQuizId, question_text, answers: [a,b,c], correct_index: selCorrectVal, keyword: kw, order_index: editingQIdx >= 0 ? editingQIdx : 999};
    
    if (editingQuestionId) {
        await supabase.from('questions').update(obj).eq('id', editingQuestionId);
    } else {
        await supabase.from('questions').insert(obj);
    }
    
    await fetchQuizzes();
    closeModal('q-modal'); renderQList();
    toast(editingQuestionId?'Вопрос обновлён ✓':'Вопрос добавлен ✓','success');
}

async function deleteQ(qId) {
    await supabase.from('questions').delete().eq('id', qId);
    await fetchQuizzes(); renderQList(); toast('Вопрос удалён','success');
}

function startQuizFromEditor() { startQuizAsStudent(editingQuizId); }

// ======================================================
// PAGES / UI HELPERS
// ======================================================
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => { p.classList.add('d-none'); p.classList.remove('active'); });
    const el = document.getElementById(id);
    el.classList.remove('d-none');
    // We add flex back, actually since classes handle it, removing d-none is enough for page-col which has display:flex
    el.style.display = 'flex'; 
    el.classList.add('active');
}

function updateSplash() {
    const n = quizzes.length;
    document.getElementById('splash-info').textContent =
    n === 0 ? 'Квизов пока нет. Войдите как преподаватель, чтобы создать первый!'
            : `📋 Доступно квизов: ${n}. Нажмите «Пройти квиз», чтобы выбрать.`;
}

function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function toast(msg,type='success'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),2500);}

function togglePass(id,btn){const el=document.getElementById(id);el.type=el.type==='password'?'text':'password';btn.textContent=el.type==='password'?'👁':'🙈';}

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
    wrap.innerHTML = quizzes.map(q => {
        const qLen = q.questions ? q.questions.length : 0;
        return `
    <div class="quiz-card" onclick="startQuizAsStudent('${q.id}')">
        <div class="qc-title">${q.name}</div>
        ${q.desc ? `<div class="qc-meta" style="margin-bottom:.5rem;">${q.description || q.desc}</div>` : ''}
        <div class="qc-meta">
        <span class="qc-badge">📝 ${qLen} вопр.</span>
        <span class="qc-badge">⏱ ~${qLen * 20} сек</span>
        </div>
    </div>
    `}).join('');
}

function startQuizAsStudent(quizId) {
    playQuizId = quizId;
    qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
    loadQuestion();
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
    if(!qState.history[qState.idx]) qState.history[qState.idx]={imgUrl,chosen:null, question_id: qq.id};
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
    document.getElementById('quiz-q-text').innerHTML = qq.question_text;
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
    if(i===qq.correct_index){qState.score++;qState.correct++;showPointPopup('+1');}
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
    if(i===qq.correct_index) b.classList.add('revealed-correct');
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

// ======================================================
// RESULTS & LEADERBOARD
// ======================================================
async function showResults() {
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
    
    // Сбрасываем UI лидерборда
    document.getElementById('lb-submit-wrap').style.display = 'block';
    document.getElementById('lb-name').value = '';
    document.getElementById('leaderboard').innerHTML = '';
    
    showPage('results');
    if(pct>=50) launchConfetti();
}

async function submitResult() {
    const name = document.getElementById('lb-name').value.trim() || 'Аноним';
    const total = qState.correct + qState.wrong;
    
    // Сохраняем в Supabase
    const { error } = await supabase.from('results').insert({
        quiz_id: playQuizId,
        student_name: name,
        score: qState.score,
        total: total,
        correct_count: qState.correct,
        wrong_count: qState.wrong,
        answers_history: qState.history.map(h => ({ question_id: h.question_id, chosen_index: h.chosen }))
    });
    
    if (error) { toast('Ошибка сохранения', 'error'); return; }
    
    document.getElementById('lb-submit-wrap').style.display = 'none';
    await fetchLeaderboard();
}

async function fetchLeaderboard() {
    const { data, error } = await supabase.from('results')
        .select('*')
        .eq('quiz_id', playQuizId)
        .order('score', { ascending: false })
        .limit(10);
        
    const lb = document.getElementById('leaderboard');
    if (!data || data.length === 0) {
        lb.innerHTML = '<p class="text-muted text-center">Пока нет результатов</p>';
        return;
    }
    
    lb.innerHTML = `<h3>🏆 Топ 10 игроков</h3>` + data.map((r, i) => `
        <div style="display:flex; justify-content:space-between; padding:0.5rem; background:var(--surface2); border-radius:8px; margin-bottom:0.4rem;">
            <span><b>${i+1}.</b> ${r.student_name}</span>
            <span><b>${r.score}</b> очков</span>
        </div>
    `).join('');
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
// ANALYTICS & IMPORT/EXPORT
// ======================================================
async function openAnalytics(quizId) {
    const { data } = await supabase.from('results').select('*').eq('quiz_id', quizId);
    const wrap = document.getElementById('analytics-content');
    
    if (!data || data.length === 0) {
        wrap.innerHTML = '<p>Квиз еще никто не проходил.</p>';
    } else {
        const totalPlays = data.length;
        const avgScore = (data.reduce((a,b)=>a+b.score, 0) / totalPlays).toFixed(1);
        wrap.innerHTML = `
            <div style="background:var(--surface2); padding:1rem; border-radius:12px; margin-bottom:1rem;">
                <div><b>Прохождений:</b> ${totalPlays}</div>
                <div><b>Средний балл:</b> ${avgScore}</div>
            </div>
            <p class="text-muted">Развернутая статистика по вопросам в разработке.</p>
        `;
    }
    openModal('analytics-modal');
}

// ======================================================
// ADMIN PANEL
// ======================================================
async function loadAdminPanel() {
    const { data, error } = await supabase.from('profiles').select('*');
    const wrap = document.getElementById('admin-users-list');
    
    if (!data) return;
    
    wrap.innerHTML = data.map(u => `
        <div style="background:var(--surface2); padding:1rem; border-radius:12px; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <b>${u.email}</b><br>
                <span class="text-muted">Роль: ${u.role}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="alert('Чтобы изменить пароль, используйте панель Supabase -> Authentication')">🔑 Сброс пароля</button>
        </div>
    `).join('');
}

// Переопределяем showPage для обработки админки
const originalShowPage = showPage;
window.showPage = function(id) {
    originalShowPage(id);
    if (id === 'admin-page') {
        loadAdminPanel();
    }
};

// ======================================================
// BOOTSTRAP
// ======================================================
checkSession();
"""

with open('/Users/air/Downloads/quiz/app.js', 'w', encoding='utf-8') as f:
    f.write(JS_CONTENT)
