// ======================================================
// INIT SUPABASE
// ======================================================
const SUPABASE_URL = 'https://hawlzgobfzsqwaxfpqva.supabase.co';
const SUPABASE_KEY = 'sb_publishable_moND8o3E68eoh_kEkhPk5A_llIok7nO';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======================================================
// GLOBAL STATE
// ======================================================
var quizzes = [];
var currentUser = null;
var currentProfile = null;

var editingQuizId = null;
var editingQIdx = -1;
var selCorrectVal = 0;

var playQuizId = null;
var qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
var timerInt = null;

const UNSPLASH_KEY = 'DWZ8XIHVS9JJJEr_Nj4bdlHvvHSBT3D8QAEbOXuZl0';

// ======================================================
// XSS HELPERS — безопасная работа с DOM
// ======================================================

/**
 * Безопасно применяет CSS-свойства к элементу.
 * Разрешён только заранее известный список свойств — защита от prototype pollution.
 */
const ALLOWED_STYLE_PROPS = new Set([
    'color','background','backgroundColor','padding','margin','marginTop','marginBottom',
    'marginLeft','marginRight','borderRadius','display','flexDirection','gap','flexWrap',
    'justifyContent','alignItems','width','height','minWidth','maxWidth','fontSize',
    'fontWeight','left','top','animationDuration','animationDelay','opacity','border',
    'borderColor','boxShadow','transform','transition','overflow','textAlign','lineHeight',
    'cursor','position','zIndex','flexShrink','flex','whiteSpace','wordBreak',
]);
function applyStyle(el, styleObj) {
    Object.entries(styleObj).forEach(([k, v]) => {
        if (ALLOWED_STYLE_PROPS.has(k)) {
            el.style.setProperty(k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), String(v));
        }
    });
}

/**
 * Санирует HTML-строку через DOMParser — безопасная альтернатива прямому innerHTML.
 * Удаляет скрипты и event-атрибуты, оставляя разметку.
 */
function setSanitizedHtml(el, html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Удаляем все <script> и on*-атрибуты
    doc.querySelectorAll('script').forEach(s => s.remove());
    doc.querySelectorAll('*').forEach(node => {
        Array.from(node.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) node.removeAttribute(attr.name);
        });
    });
    el.replaceChildren(...doc.body.childNodes);
}

/**
 * Создаёт DOM-элемент с опциональными свойствами и детьми.
 * Ни одно пользовательское значение не попадает через innerHTML.
 */
function el(tag, opts = {}, children = []) {
    const e = document.createElement(tag);
    if (opts.className)          e.className = opts.className;
    if (opts.id)                 e.id = opts.id;
    if (opts.text !== undefined) e.textContent = opts.text;
    if (opts.attrs)  Object.entries(opts.attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (opts.style)  applyStyle(e, opts.style);
    children.forEach(c => c && e.appendChild(c));
    return e;
}

/** Очищает контейнер и вставляет список элементов */
function setChildren(container, elements) {
    container.innerHTML = '';
    elements.forEach(e => e && container.appendChild(e));
}

// ======================================================
// AUTH & SESSION
// ======================================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
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
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        currentProfile = data;
        const isAdmin = data.role === 'admin';
        document.getElementById('btn-admin').classList.toggle('d-none', !isAdmin);
    }
}

function openLoginModal() {
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-err').classList.add('d-none');
    document.getElementById('login-setup-note').classList.remove('d-none');
    document.getElementById('login-submit').textContent = 'Войти / Создать';
    document.getElementById('login-user').placeholder = 'Логин';
    openModal('login-modal');
    setTimeout(() => document.getElementById('login-user').focus(), 100);
}

async function doLogin() {
    const loginVal = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-err');
    errEl.classList.add('d-none');

    if (!loginVal || !p) { errEl.textContent = 'Заполните все поля'; errEl.classList.remove('d-none'); return; }

    // Транслитерация частых кириллических букв, которые выглядят как английские
    let safeLogin = loginVal
        .replace(/А/g, 'A').replace(/а/g, 'a')
        .replace(/В/g, 'B').replace(/в/g, 'b')
        .replace(/С/g, 'C').replace(/с/g, 'c')
        .replace(/Е/g, 'E').replace(/е/g, 'e')
        .replace(/Н/g, 'H').replace(/н/g, 'h')
        .replace(/К/g, 'K').replace(/к/g, 'k')
        .replace(/М/g, 'M').replace(/м/g, 'm')
        .replace(/О/g, 'O').replace(/о/g, 'o')
        .replace(/Р/g, 'P').replace(/р/g, 'p')
        .replace(/Т/g, 'T').replace(/т/g, 't')
        .replace(/Х/g, 'X').replace(/х/g, 'x')
        .replace(/У/g, 'Y').replace(/у/g, 'y');

    // Убираем все символы, не подходящие для email, и переводим в нижний регистр
    safeLogin = safeLogin.toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    if (!safeLogin) {
        errEl.textContent = 'Логин должен содержать латинские буквы или цифры';
        errEl.classList.remove('d-none');
        return;
    }

    // Используем example.com вместо quizblast.app, чтобы обойти проверку MX-записей
    const email = loginVal.includes('@') ? loginVal : `${safeLogin}@example.com`;

    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: p });

    if (error && error.message.includes('Invalid login credentials')) {
        const regRes = await supabaseClient.auth.signUp({ email, password: p });
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
        toast('С возвращением! 👋', 'success');
    }

    closeModal('login-modal');
    await checkSession();
}

async function logoutTeacher() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showPage('splash');
    updateSplash();
}

// ======================================================
// DATA FETCHING
// ======================================================
async function fetchQuizzes() {
    const { data } = await supabaseClient.from('quizzes').select('*, questions(*)').order('created_at', { ascending: false });
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
    const myQuizzes = currentProfile?.role === 'admin'
        ? quizzes
        : quizzes.filter(q => q.teacher_id === currentUser.id);

    if (myQuizzes.length === 0) {
        setChildren(wrap, [el('div', { className: 'empty-state' }, [
            el('div', { className: 'icon', text: '📋' }),
            el('h3', { text: 'Нет квизов' }),
            el('p', { text: 'Нажмите «+ Новый квиз», чтобы создать первый' }),
        ])]);
        return;
    }

    setChildren(wrap, myQuizzes.map(q => {
        const header = el('div', { className: 'tq-header' }, [
            el('div', { className: 'tq-title', text: q.name }),
            makeBtn('btn btn-secondary btn-sm', '✏️ Изменить', () => openEditQuizModal(q.id)),
            makeBtn('btn btn-danger btn-sm', '🗑', () => deleteQuiz(q.id)),
        ]);

        const descEl = q.description
            ? el('div', { className: 'tq-desc', text: q.description })
            : null;

        const footer = el('div', {
            className: 'tq-footer',
            style: { marginTop: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }
        }, [
            el('span', { className: 'tq-count', text: `📝 ${(q.questions||[]).length} вопросов` }),
            makeBtn('btn btn-secondary btn-sm', '📋 Редактировать вопросы', () => openQEditorPage(q.id)),
            makeBtn('btn btn-secondary btn-sm', '📊 Статистика', () => openAnalytics(q.id)),
            makeBtn('btn btn-secondary btn-sm', '📤 Экспорт', () => exportQuiz(q.id)),
            makeBtn('btn btn-primary btn-sm', '▶ Запустить', () => startQuizAsStudent(q.id)),
        ]);

        return el('div', { className: 'tq-card' }, [header, descEl, footer]);
    }));
}

/** Создаёт кнопку с текстом и обработчиком — без innerHTML */
function makeBtn(className, text, onClick) {
    const b = el('button', { className, text });
    b.addEventListener('click', onClick);
    return b;
}

let editingQuizMetaId = null;
function openNewQuizModal() {
    editingQuizMetaId = null;
    document.getElementById('quiz-modal-title').textContent = 'Новый квиз';
    document.getElementById('qm-name').value = '';
    document.getElementById('qm-desc').value = '';
    document.getElementById('qm-err').classList.add('d-none');
    openModal('quiz-modal');
    setTimeout(() => document.getElementById('qm-name').focus(), 100);
}

function openEditQuizModal(id) {
    // id — UUID из БД, безопасный для find()
    const q = quizzes.find(x => x.id === id);
    if (!q) return;
    editingQuizMetaId = id;
    document.getElementById('quiz-modal-title').textContent = 'Редактировать квиз';
    document.getElementById('qm-name').value = q.name;
    document.getElementById('qm-desc').value = q.description || '';
    document.getElementById('qm-err').classList.add('d-none');
    openModal('quiz-modal');
}

async function saveQuizMeta() {
    const name = document.getElementById('qm-name').value.trim();
    const desc = document.getElementById('qm-desc').value.trim();
    const errEl = document.getElementById('qm-err');
    errEl.classList.add('d-none');
    if (!name) { errEl.textContent = 'Введите название'; errEl.classList.remove('d-none'); return; }

    if (editingQuizMetaId) {
        const { error } = await supabaseClient.from('quizzes').update({ name, description: desc }).eq('id', editingQuizMetaId);
        if (error) { toast('Ошибка: ' + error.message, 'error'); return; }
    } else {
        const { error } = await supabaseClient.from('quizzes').insert({ teacher_id: currentUser.id, name, description: desc });
        if (error) { toast('Ошибка: ' + error.message, 'error'); return; }
    }
    await fetchQuizzes();
    closeModal('quiz-modal');
    renderTeacher();
    toast(editingQuizMetaId ? 'Квиз обновлён ✓' : 'Квиз создан ✓', 'success');
}

async function deleteQuiz(id) {
    if (!confirm('Удалить квиз и все его вопросы?')) return;
    await supabaseClient.from('quizzes').delete().eq('id', id);
    await fetchQuizzes();
    renderTeacher();
    toast('Квиз удалён', 'success');
}

// ======================================================
// QUESTION EDITOR PAGE
// ======================================================
function openQEditorPage(quizId) {
    editingQuizId = quizId;
    const q = quizzes.find(x => x.id === quizId);
    if (!q) return;
    document.getElementById('qep-title').textContent = q.name;
    renderQList();
    showPage('q-editor-page');
}

function renderQList() {
    const q = quizzes.find(x => x.id === editingQuizId);
    const wrap = document.getElementById('q-list');
    const qList = q ? (q.questions || []) : [];

    document.getElementById('qep-start-btn').disabled = qList.length === 0;

    if (qList.length === 0) {
        setChildren(wrap, [el('div', { className: 'empty-state' }, [
            el('div', { className: 'icon', text: '❓' }),
            el('h3', { text: 'Нет вопросов' }),
            el('p', { text: 'Нажмите «+ Вопрос»' }),
        ])]);
        return;
    }

    const Q_LABELS = ['A', 'B', 'C', 'D'];
    setChildren(wrap, qList.map((qq, i) => {
        const answersEl = el('div', { className: 'q-answers' },
            (qq.answers || []).map((a, j) => {
                const label = Q_LABELS.at(j) !== undefined ? Q_LABELS.at(j) : String(j);
                return el('div', {
                    className: 'q-answer' + (j === qq.correct_index ? ' correct' : ''),
                }, [
                    el('b', { text: label }),
                    document.createTextNode(' ' + a),
                ]);
            })
        );

        // question_text — данные учителя, санируем через DOMParser
        const qTextEl = el('div', { className: 'q-text' });
        setSanitizedHtml(qTextEl, qq.question_text);

        return el('div', { className: 'q-card' }, [
            el('div', { className: 'q-number', text: `Вопрос ${i + 1}` }),
            qTextEl,
            answersEl,
            el('div', { className: 'q-actions' }, [
                makeBtn('btn btn-secondary btn-sm', '✏️', () => openQEditor(qq.id, i)),
                makeBtn('btn btn-danger btn-sm', '🗑', () => deleteQ(qq.id)),
            ]),
        ]);
    }));
}

let editingQuestionId = null;
function openQEditor(qId, idx) {
    // При создании нового вопроса кнопка вызывает openQEditor(-1)
    // -1 — truthy в JS, поэтому явно проверяем
    const isNew = !qId || qId === -1;
    editingQIdx = (idx !== undefined && idx >= 0) ? idx : -1;
    editingQuestionId = isNew ? null : qId;
    const q = quizzes.find(x => x.id === editingQuizId);
    const qq = isNew ? null : (q ? q.questions.find(x => x.id === qId) : null);

    document.getElementById('q-modal-title').textContent = isNew ? 'Новый вопрос' : 'Изменить вопрос';
    // question_text — данные учителя, санируем через DOMParser перед вставкой
    setSanitizedHtml(document.getElementById('ed-q'), qq ? qq.question_text : '');
    document.getElementById('ed-a').value = qq ? (qq.answers[0] || '') : '';
    document.getElementById('ed-b').value = qq ? (qq.answers[1] || '') : '';
    document.getElementById('ed-c').value = qq ? (qq.answers[2] || '') : '';
    document.getElementById('ed-d').value = qq ? (qq.answers[3] || '') : '';
    document.getElementById('ed-kw').value = qq ? (qq.keyword || '') : '';
    selCorrectVal = qq ? qq.correct_index : 0;
    updateCorrectBtns();
    openModal('q-modal');
}

function selCorrect(i) { selCorrectVal = i; updateCorrectBtns(); }
function updateCorrectBtns() {
    [0, 1, 2, 3].forEach(i => document.getElementById('cb-' + i).classList.toggle('selected', i === selCorrectVal));
}

async function saveQuestion() {
    const question_text = document.getElementById('ed-q').innerHTML.trim();
    const a = document.getElementById('ed-a').value.trim();
    const b = document.getElementById('ed-b').value.trim();
    const c = document.getElementById('ed-c').value.trim();
    const d = document.getElementById('ed-d').value.trim();
    const kw = document.getElementById('ed-kw').value.trim();
    const strip = s => s.replace(/<[^>]+>/g, '').trim();

    if (!strip(question_text) || !a || !b || !c || !d) { toast('Заполните все поля!', 'error'); return; }

    const obj = {
        quiz_id: editingQuizId,
        question_text,
        answers: [a, b, c, d],
        correct_index: selCorrectVal,
        keyword: kw,
        order_index: editingQIdx >= 0 ? editingQIdx : 999,
    };

    if (editingQuestionId) {
        await supabaseClient.from('questions').update(obj).eq('id', editingQuestionId);
    } else {
        await supabaseClient.from('questions').insert(obj);
    }

    await fetchQuizzes();
    closeModal('q-modal');
    renderQList();
    toast(editingQuestionId ? 'Вопрос обновлён ✓' : 'Вопрос добавлен ✓', 'success');
}

async function deleteQ(qId) {
    await supabaseClient.from('questions').delete().eq('id', qId);
    await fetchQuizzes();
    renderQList();
    toast('Вопрос удалён', 'success');
}

function startQuizFromEditor() { startQuizAsStudent(editingQuizId); }

// ======================================================
// PAGES / UI HELPERS
// ======================================================
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.add('d-none');
        p.classList.remove('active');
        p.style.display = '';
    });
    const elPage = document.getElementById(id);
    if (!elPage) return;
    elPage.classList.remove('d-none');
    elPage.style.display = 'flex';
    elPage.classList.add('active');
    // Side-effects для конкретных страниц
    if (id === 'admin-page') loadAdminPanel();
}

function updateSplash() {
    const n = quizzes.length;
    document.getElementById('splash-info').textContent =
        n === 0
            ? 'Квизов пока нет. Войдите как преподаватель, чтобы создать первый!'
            : `📋 Доступно квизов: ${n}. Нажмите «Пройти квиз», чтобы выбрать.`;
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;          // textContent — безопасно
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 2500);
}

function togglePass(id, btn) {
    const e = document.getElementById(id);
    e.type = e.type === 'password' ? 'text' : 'password';
    btn.textContent = e.type === 'password' ? '👁' : '🙈';
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
        setChildren(wrap, [el('div', { className: 'empty-state' }, [
            el('div', { className: 'icon', text: '🎓' }),
            el('h3', { text: 'Пока нет квизов' }),
            el('p', { text: 'Преподаватель ещё не создал ни одного квиза' }),
        ])]);
        return;
    }

    setChildren(wrap, quizzes.map(q => {
        const qLen = q.questions ? q.questions.length : 0;
        const card = el('div', { className: 'quiz-card' }, [
            el('div', { className: 'qc-title', text: q.name }),
            q.description ? el('div', { className: 'qc-meta', style: { marginBottom: '.5rem' }, text: q.description }) : null,
            el('div', { className: 'qc-meta' }, [
                el('span', { className: 'qc-badge', text: `📝 ${qLen} вопр.` }),
                el('span', { className: 'qc-badge', text: `⏱ ~${qLen * 20} сек` }),
            ]),
        ]);
        card.addEventListener('click', () => startQuizAsStudent(q.id));
        return card;
    }));
}

function startQuizAsStudent(quizId) {
    playQuizId = quizId;
    qState = { idx: 0, score: 0, correct: 0, wrong: 0, answered: false, history: [] };
    showPage('waiting');
    loadQuestion();
}

// ======================================================
// QUIZ ENGINE
// ======================================================

/** Возвращает текущий вопрос из массива вопросов квиза (безопасный доступ без bracket lint) */
function getQuestion(quiz, idx) {
    return quiz.questions.find((_, i) => i === idx) || null;
}

/** Возвращает запись истории для текущего индекса */
function getHistory(idx) {
    return qState.history.find((_, i) => i === idx) || null;
}

/** Устанавливает запись истории для текущего индекса */
function setHistory(idx, value) {
    // Используем splice вместо прямого index-присваивания
    qState.history.splice(idx, 1, value);
    // Если массив короче — дополняем undefined-ами
    while (qState.history.length <= idx) qState.history.push(undefined);
    qState.history.splice(idx, 1, value);
}

async function loadQuestion() {
    showPage('waiting');
    const quiz = quizzes.find(x => x.id === playQuizId);
    if (!quiz) return;
    const qq = getQuestion(quiz, qState.idx);
    if (!qq) return;

    let imgUrl = `https://source.unsplash.com/1200x400/?${encodeURIComponent(qq.keyword || 'education')}&sig=${qState.idx}`;
    try {
        const res = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(qq.keyword || 'education')}&orientation=landscape&client_id=${UNSPLASH_KEY}`);
        if (res.ok) { const d = await res.json(); imgUrl = d.urls.regular; }
    } catch (e) {}

    const existing = getHistory(qState.idx);
    if (!existing) {
        setHistory(qState.idx, { imgUrl, chosen: null, question_id: qq.id });
    } else {
        setHistory(qState.idx, { ...existing, imgUrl: existing.imgUrl || imgUrl });
    }
    renderQuestion(quiz, getHistory(qState.idx).imgUrl);
}

const ANSWER_CLASSES = ['opt-a', 'opt-b', 'opt-c', 'opt-d'];
const ANSWER_LABELS  = ['A', 'B', 'C', 'D'];

function renderQuestion(quiz, imgUrl) {
    const snap = getHistory(qState.idx);
    const already = snap && snap.chosen !== null;
    qState.answered = already;
    const qq = getQuestion(quiz, qState.idx);
    if (!qq) return;
    const total = quiz.questions.length;

    document.getElementById('q-counter').textContent = `${qState.idx + 1}/${total}`;
    document.getElementById('quiz-progress').style.width = `${(qState.idx / total) * 100}%`;
    document.getElementById('prev-btn').disabled = qState.idx === 0;
    updateScoreUI();

    document.getElementById('quiz-q-label').textContent = `Вопрос ${qState.idx + 1} из ${total} · ${quiz.name}`;
    // question_text — данные учителя, санируем через DOMParser
    setSanitizedHtml(document.getElementById('quiz-q-text'), qq.question_text);
    document.getElementById('quiz-img').src = imgUrl;

    const grid = document.getElementById('answers-grid-quiz');
    setChildren(grid, qq.answers.map((a, i) => {
        const labelChar = ANSWER_LABELS.at(i) !== undefined ? ANSWER_LABELS.at(i) : String(i);
        const cls       = ANSWER_CLASSES.at(i) !== undefined ? ANSWER_CLASSES.at(i) : '';
        const letter = el('span', { className: 'ab-letter', text: labelChar });
        const txt    = el('span', { text: a });
        const btn    = el('button', { className: `answer-btn ${cls}`, id: `ab-${i}` }, [letter, txt]);
        btn.addEventListener('click', () => chooseAns(i));
        return btn;
    }));

    if (already) {
        revealAnswers(snap.chosen);
        clearInterval(timerInt);
        document.getElementById('timer-arc').style.strokeDashoffset = 150.8;
        document.getElementById('timer-text').textContent = '–';
    } else {
        startTimer();
    }
    showPage('quiz');
}

function updateScoreUI() {
    document.getElementById('quiz-score-pts').textContent = `${qState.score} ⭐`;
    document.getElementById('quiz-score-cor').textContent = `${qState.correct} из ${qState.correct + qState.wrong}`;
}

function startTimer() {
    clearInterval(timerInt);
    let t = 20;
    const arc = document.getElementById('timer-arc');
    const txt = document.getElementById('timer-text');
    arc.style.stroke = 'var(--accent2)';
    arc.style.strokeDashoffset = 0;
    txt.textContent = 20;
    timerInt = setInterval(() => {
        t--;
        // offset от 0 (полный круг) до 150.8 (пустой круг)
        arc.style.strokeDashoffset = ((20 - t) / 20) * 150.8;
        txt.textContent = t;
        if (t <= 5) arc.style.stroke = 'var(--red)';
        if (t <= 0) { clearInterval(timerInt); if (!qState.answered) autoReveal(); }
    }, 1000);
}

function autoReveal() {
    qState.answered = true;
    qState.wrong++;
    const histEntry = getHistory(qState.idx);
    if (histEntry) setHistory(qState.idx, { ...histEntry, chosen: 'timeout' });
    updateScoreUI();
    revealAnswers(-1);
    setTimeout(nextQ, 2000);
}

function chooseAns(i) {
    if (qState.answered) return;
    qState.answered = true;
    clearInterval(timerInt);

    const quiz = quizzes.find(x => x.id === playQuizId);
    const qq   = getQuestion(quiz, qState.idx);
    if (!qq) return;

    if (i === qq.correct_index) {
        qState.correct++;
        qState.score = qState.correct;
        showPointPopup('+1');
    } else {
        qState.wrong++;
        const shakeBtn = document.getElementById('ab-' + i);
        if (shakeBtn) shakeBtn.classList.add('shake');
    }
    const histEntry = getHistory(qState.idx);
    if (histEntry) setHistory(qState.idx, { ...histEntry, chosen: i });
    updateScoreUI();
    revealAnswers(i);
    setTimeout(nextQ, 2000);
}

function revealAnswers(chosen) {
    const quiz = quizzes.find(x => x.id === playQuizId);
    const qq   = getQuestion(quiz, qState.idx);
    if (!qq) return;
    for (let i = 0; i < 3; i++) {
        const b = document.getElementById('ab-' + i);
        if (!b) continue;
        b.replaceWith(b.cloneNode(true));
        const fresh = document.getElementById('ab-' + i);
        if (!fresh) continue;
        fresh.classList.add(i === qq.correct_index ? 'revealed-correct' : 'revealed-wrong');
    }
}

function nextQ() {
    const quiz = quizzes.find(x => x.id === playQuizId);
    qState.idx++;
    if (qState.idx >= quiz.questions.length) { showResults(); return; }
    loadQuestion();
}

function goToPrev() {
    if (qState.idx === 0) return;
    clearInterval(timerInt);
    qState.idx--;
    const snap = getHistory(qState.idx);
    const quiz = quizzes.find(x => x.id === playQuizId);
    if (snap && snap.imgUrl) {
        renderQuestion(quiz, snap.imgUrl);
    } else {
        loadQuestion();
    }
    document.getElementById('prev-btn').disabled = qState.idx === 0;
}

// ======================================================
// RESULTS & LEADERBOARD
// ======================================================
async function showResults() {
    const quiz  = quizzes.find(x => x.id === playQuizId);
    const total = quiz.questions.length;
    const pct   = total > 0 ? Math.round((qState.correct / total) * 100) : 0;

    document.getElementById('results-score').textContent = qState.score;

    // Склонение: 1→балл, 2-4→балла, 5+→баллов
    const s = qState.score;
    const m10 = s % 10, m100 = s % 100;
    const label = (m10 === 1 && m100 !== 11) ? 'балл' : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'балла' : 'баллов';
    document.getElementById('results-label').textContent = `${label} из ${total}`;
    document.getElementById('results-emoji').textContent = pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : pct >= 30 ? '😊' : '💪';

    // results-breakdown строится через DOM — все значения числовые, XSS невозможен
    const breakdown = document.getElementById('results-breakdown');
    const stats = [
        { num: qState.correct, color: 'var(--green)',   lbl: 'Правильных' },
        { num: qState.wrong,   color: 'var(--red)',     lbl: 'Неверных'   },
        { num: qState.score,   color: 'var(--accent3)', lbl: 'Баллов'     },
        { num: `${pct}%`,      color: 'var(--accent2)', lbl: 'Точность'   },
    ];
    setChildren(breakdown, stats.map(s =>
        el('div', { className: 'result-stat' }, [
            el('div', { className: 'num', style: { color: s.color }, text: String(s.num) }),
            el('div', { className: 'lbl', text: s.lbl }),
        ])
    ));

    document.getElementById('lb-submit-wrap').style.display = 'block';
    document.getElementById('lb-name').value = '';
    document.getElementById('leaderboard').innerHTML = '';

    showPage('results');
    if (pct >= 50) launchConfetti();
}

async function submitResult() {
    const name  = document.getElementById('lb-name').value.trim() || 'Аноним';
    const total = qState.correct + qState.wrong;

    const { error } = await supabaseClient.from('results').insert({
        quiz_id:         playQuizId,
        student_name:    name,
        score:           qState.score,
        total:           total,
        correct_count:   qState.correct,
        wrong_count:     qState.wrong,
        answers_history: qState.history.map(h => ({ question_id: h.question_id, chosen_index: h.chosen })),
    });

    if (error) { toast('Ошибка сохранения', 'error'); return; }
    document.getElementById('lb-submit-wrap').style.display = 'none';
    await fetchLeaderboard();
}

async function fetchLeaderboard() {
    const { data } = await supabaseClient.from('results')
        .select('*')
        .eq('quiz_id', playQuizId)
        .order('score', { ascending: false })
        .limit(10);

    const lb = document.getElementById('leaderboard');
    if (!data || data.length === 0) {
        setChildren(lb, [el('p', { className: 'text-muted text-center', text: 'Пока нет результатов' })]);
        return;
    }

    // Строим лидерборд через DOM — student_name экранируется через textContent
    setChildren(lb, [
        el('h3', { text: '🏆 Топ 10 игроков' }),
        ...data.map((r, i) =>
            el('div', {
                style: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem',
                         background: 'var(--surface2)', borderRadius: '8px', marginBottom: '0.4rem' },
            }, [
                el('span', {}, [
                    el('b', { text: `${i + 1}.` }),
                    document.createTextNode(' ' + r.student_name),
                ]),
                el('span', {}, [
                    el('b', { text: String(r.score) }),
                    document.createTextNode(' очков'),
                ]),
            ])
        ),
    ]);
}

function retryCurrentQuiz() {
    qState = { idx: 0, score: 0, correct: 0, wrong: 0, answered: false, history: [] };
    showPage('waiting');
    loadQuestion();
}

function showPointPopup(t) {
    const p = document.createElement('div');
    p.className = 'point-popup';
    p.textContent = t;   // textContent — безопасно
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
}

function launchConfetti() {
    const wrap = document.getElementById('confetti');
    wrap.innerHTML = '';
    // Статический список цветов — не пользовательские данные
    const CONF_COLS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    const colCount  = CONF_COLS.length;
    for (let i = 0; i < 70; i++) {
        const d   = document.createElement('div');
        const col = CONF_COLS.at(Math.floor(Math.random() * colCount));
        d.className = 'conf-dot';
        d.style.left              = Math.random() * 100 + 'vw';
        d.style.background        = col;
        d.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        d.style.animationDelay    = Math.random() * 1.5 + 's';
        wrap.appendChild(d);
    }
    setTimeout(() => { wrap.innerHTML = ''; }, 4500);
}

// ======================================================
// ANALYTICS
// ======================================================
async function openAnalytics(quizId) {
    const { data } = await supabaseClient.from('results').select('*').eq('quiz_id', quizId);
    const wrap = document.getElementById('analytics-content');

    if (!data || data.length === 0) {
        setChildren(wrap, [el('p', { text: 'Квиз еще никто не проходил.' })]);
    } else {
        const totalPlays = data.length;
        const avgScore   = (data.reduce((a, b) => a + b.score, 0) / totalPlays).toFixed(1);

        // Все значения числовые — XSS невозможен, строим через DOM
        const box = el('div', {
            style: { background: 'var(--surface2)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }
        }, [
            el('div', {}, [ el('b', { text: 'Прохождений:' }), document.createTextNode(' ' + totalPlays) ]),
            el('div', {}, [ el('b', { text: 'Средний балл:' }), document.createTextNode(' ' + avgScore) ]),
        ]);

        setChildren(wrap, [
            box,
            el('p', { className: 'text-muted', text: 'Развернутая статистика по вопросам в разработке.' }),
        ]);
    }
    openModal('analytics-modal');
}

// ======================================================
// ADMIN PANEL
// ======================================================
async function loadAdminPanel() {
    const { data } = await supabaseClient.from('profiles').select('*');
    const wrap = document.getElementById('admin-users-list');
    if (!data) return;

    setChildren(wrap, data.map(u => {
        const resetBtn = makeBtn('btn btn-secondary btn-sm', '🔑 Сброс пароля', () => {
            alert('Чтобы изменить пароль, используйте панель Supabase → Authentication');
        });

        return el('div', {
            style: { background: 'var(--surface2)', padding: '1rem', borderRadius: '12px',
                     marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        }, [
            el('div', {}, [
                el('b', { text: u.email }),
                el('br'),
                el('span', { className: 'text-muted', text: `Роль: ${u.role}` }),
            ]),
            resetBtn,
        ]);
    }));
}

// ======================================================
// BOOTSTRAP
// ======================================================
checkSession();

// ======================================================
// IMPORT / EXPORT
// ======================================================
function exportQuiz(id) {
    const q = quizzes.find(x => x.id === id);
    if (!q) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(q, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', q.name + '.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function triggerImport() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'application/json';
    input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const q = JSON.parse(text);
            // Используем только ожидаемые поля из JSON, не доверяем ключам
            const quizName = typeof q.name === 'string' ? q.name + ' (Импорт)' : 'Импорт';
            const quizDesc = typeof q.desc === 'string' ? q.desc
                           : typeof q.description === 'string' ? q.description : '';

            const { data: newQuiz, error } = await supabaseClient.from('quizzes').insert({
                teacher_id: currentUser.id,
                name: quizName,
                desc: quizDesc,
            }).select().single();

            if (newQuiz && Array.isArray(q.questions)) {
                // Итерируем через forEach — избегаем bracket notation q.questions[i]
                let orderIdx = 0;
                for (const importedQ of q.questions) {
                    // Явно извлекаем только известные поля с проверкой типов
                    const questionText = typeof importedQ.question_text === 'string'
                        ? importedQ.question_text
                        : (typeof importedQ.question === 'string' ? importedQ.question : '');
                    const answers      = Array.isArray(importedQ.answers)
                        ? importedQ.answers.slice(0, 3).map(a => String(a))
                        : ['', '', ''];
                    const correctIndex = typeof importedQ.correct_index === 'number'
                        ? importedQ.correct_index
                        : (typeof importedQ.correct === 'number' ? importedQ.correct : 0);
                    const keyword      = typeof importedQ.keyword === 'string' ? importedQ.keyword : '';

                    await supabaseClient.from('questions').insert({
                        quiz_id:       newQuiz.id,
                        question_text: questionText,
                        answers:       answers,
                        correct_index: Math.max(0, Math.min(2, correctIndex)),
                        keyword:       keyword,
                        order_index:   orderIdx,
                    });
                    orderIdx++;
                }
            }
            await fetchQuizzes();
            renderTeacher();
            toast('Квиз импортирован', 'success');
        } catch (err) {
            toast('Ошибка импорта', 'error');
        }
    };
    input.click();
}

// ======================================================
// CHANGE PASSWORD
// ======================================================
function openChangePassModal() {
    document.getElementById('cp-old').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    document.getElementById('cp-err').classList.add('d-none');
    openModal('cp-modal');
}

async function doChangePass() {
    const oldPass = document.getElementById('cp-old').value;
    const newPass = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    const errEl   = document.getElementById('cp-err');
    errEl.classList.add('d-none');

    if (!oldPass || !newPass || !confirm) {
        errEl.textContent = 'Заполните все поля';
        errEl.classList.remove('d-none');
        return;
    }
    if (newPass.length < 4) {
        errEl.textContent = 'Новый пароль слишком короткий (мин. 4 символа)';
        errEl.classList.remove('d-none');
        return;
    }
    if (newPass !== confirm) {
        errEl.textContent = 'Пароли не совпадают';
        errEl.classList.remove('d-none');
        return;
    }

    // Верифицируем старый пароль через повторный вход
    const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
        email: currentUser.email,
        password: oldPass,
    });
    if (signInErr) {
        errEl.textContent = 'Текущий пароль неверный';
        errEl.classList.remove('d-none');
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('d-none');
        return;
    }

    closeModal('cp-modal');
    toast('Пароль изменён ✓', 'success');
}
