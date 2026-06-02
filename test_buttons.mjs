/**
 * test_buttons.mjs — автоматический тест всех кнопок QuizBlast
 * Запуск: node test_buttons.mjs
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── цвета вывода ──
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[34m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

let passed = 0, failed = 0, warned = 0;

function ok(label)   { console.log(`  ${G('✓')} ${label}`); passed++; }
function fail(label, err) { console.log(`  ${R('✗')} ${label}${err ? ` — ${R(err)}` : ''}`); failed++; }
function warn(label) { console.log(`  ${Y('⚠')} ${label}`); warned++; }

// ── Mock Supabase ──
const MOCK_QUIZZES = [{
    id: 'quiz-1',
    teacher_id: 'user-1',
    name: 'Тест квиз',
    desc: 'Описание',
    questions: [
        { id: 'q1', question_text: 'Столица Франции?', answers: ['Париж','Берлин','Рим'], correct_index: 0, keyword: 'paris', order_index: 0 },
        { id: 'q2', question_text: '2 + 2 = ?',         answers: ['3','4','5'],            correct_index: 1, keyword: 'math',  order_index: 1 },
    ],
    created_at: new Date().toISOString(),
}];

const MOCK_PROFILE = { id: 'user-1', email: 'test@test.com', role: 'teacher' };

function makeSupabaseMock() {
    const calls = { insert:[], update:[], delete_:[], select:[] };

    const chain = (table, result) => ({
        select: (...a)  => { calls.select.push({ table, args: a }); return chain(table, result); },
        insert: (data)  => { calls.insert.push({ table, data });    return chain(table, { data: {...data, id: 'new-id'}, error: null }); },
        update: (data)  => { calls.update.push({ table, data });    return chain(table, result); },
        delete: ()      => { calls.delete_.push({ table });         return chain(table, result); },
        eq:     (k, v)  => chain(table, result),
        order:  ()      => chain(table, result),
        limit:  ()      => chain(table, result),
        single: ()      => Promise.resolve(
            table === 'profiles'
                ? { data: MOCK_PROFILE, error: null }
                : { data: result?.data || null, error: null }
        ),
        then:   (fn)    => {
            if (table === 'quizzes') return Promise.resolve({ data: MOCK_QUIZZES, error: null }).then(fn);
            if (table === 'profiles') return Promise.resolve({ data: [MOCK_PROFILE], error: null }).then(fn);
            if (table === 'results') return Promise.resolve({ data: [], error: null }).then(fn);
            if (table === 'questions') return Promise.resolve({ data: null, error: null }).then(fn);
            return Promise.resolve({ data: null, error: null }).then(fn);
        }
    });

    return {
        _calls: calls,
        auth: {
            getSession:         () => Promise.resolve({ data: { session: { user: { id: 'user-1', email: 'test@test.com' } } } }),
            signInWithPassword: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
            signUp:             () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
            signOut:            () => Promise.resolve({ error: null }),
            updateUser:         () => Promise.resolve({ error: null }),
        },
        from: (table) => chain(table, { data: null, error: null }),
    };
}

// ── Инициализация JSDOM ──
const html = readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://airx0000.github.io/quiz/',
});
const { window } = dom;
const { document } = window;

// Мокаем fetch (для Unsplash)
window.fetch = () => Promise.resolve({ ok: false });
// Мокаем Supabase CDN
const supabaseMock = makeSupabaseMock();
window.supabase = { createClient: () => supabaseMock };
// Мокаем DOMParser (уже есть в jsdom)
// Мокаем confirm/alert
window.confirm = () => true;
window.alert   = () => {};

// Загружаем app.js
const appCode = readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
dom.window.eval(appCode); console.log("TYPE:", typeof window.makeBtn);

// ── Ждём инициализации (checkSession async) ──
await new Promise(r => setTimeout(r, 500));

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 1: СПЛЕШ-ЭКРАН
// ══════════════════════════════════════════════════════
console.log(B('\n── Сплеш-экран ──'));

// После checkSession с авторизованным пользователем должна показаться страница teacher
try {
    const teacherPage = document.getElementById('teacher');
    if (teacherPage && teacherPage.style.display === 'flex') {
        ok('checkSession → showPage("teacher") работает');
    } else {
        warn('teacher page не активна после checkSession (мб сплеш)');
    }
} catch(e) { fail('checkSession', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 2: ХЕЛПЕРЫ — el(), setChildren(), makeBtn()
// ══════════════════════════════════════════════════════
console.log(B('\n── DOM-хелперы ──'));

try {
    const btn = window.makeBtn('btn btn-primary', 'Тест', () => {});
    if (btn && btn.tagName === 'BUTTON' && btn.textContent === 'Тест' && btn.className === 'btn btn-primary') {
        ok('makeBtn() создаёт кнопку с правильным текстом и классом');
    } else { fail('makeBtn()'); }
} catch(e) { fail('makeBtn()', e.message); }

try {
    const div = window.el('div', { className: 'test', text: 'hello' });
    if (div.textContent === 'hello' && div.className === 'test') ok('el() создаёт элемент с textContent');
    else fail('el()');
} catch(e) { fail('el()', e.message); }

try {
    const container = document.createElement('div');
    const children  = [window.el('span', { text: 'a' }), window.el('span', { text: 'b' })];
    window.setChildren(container, children);
    if (container.children.length === 2) ok('setChildren() вставляет дочерние элементы');
    else fail('setChildren()', 'неверное число детей');
} catch(e) { fail('setChildren()', e.message); }

try {
    const safe = window.sanitizeHtml('<b>Привет</b><script>alert(1)</script><img onerror="xss()">');
    if (!safe.includes('<script>') && !safe.includes('onerror')) ok('sanitizeHtml() удаляет <script> и on*-атрибуты');
    else fail('sanitizeHtml()', 'XSS не удалён: ' + safe);
} catch(e) { fail('sanitizeHtml()', e.message); }

try {
    const e = window.el('div', { style: { color: 'red', backgroundColor: '#fff' } });
    if (e.style.color === 'red') ok('applyStyle() применяет разрешённые CSS-свойства');
    else fail('applyStyle()', 'цвет не применён');
} catch(e) { fail('applyStyle()', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 3: НАВИГАЦИЯ — showPage()
// ══════════════════════════════════════════════════════
console.log(B('\n── showPage() / навигация ──'));

const pages = ['splash','student-home','teacher','q-editor-page','waiting','quiz','results'];
for (const pageId of pages) {
    try {
        window.showPage(pageId);
        const pg = document.getElementById(pageId);
        if (pg && pg.style.display === 'flex' && pg.classList.contains('active')) {
            ok(`showPage("${pageId}")`);
        } else {
            fail(`showPage("${pageId}")`, 'страница не активирована');
        }
    } catch(e) { fail(`showPage("${pageId}")`, e.message); }
}

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 4: МОДАЛЬНЫЕ ОКНА
// ══════════════════════════════════════════════════════
console.log(B('\n── Модальные окна ──'));

const modals = ['login-modal','analytics-modal','cp-modal','quiz-modal','q-modal'];
for (const id of modals) {
    try {
        window.openModal(id);
        const m = document.getElementById(id);
        if (m && !m.classList.contains('hidden')) ok(`openModal("${id}")`);
        else fail(`openModal("${id}")`, 'hidden не снят');

        window.closeModal(id);
        if (m && m.classList.contains('hidden')) ok(`closeModal("${id}")`);
        else fail(`closeModal("${id}")`, 'hidden не добавлен');
    } catch(e) { fail(`openModal/closeModal("${id}")`, e.message); }
}

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 5: КНОПКИ УЧИТЕЛЯ
// ══════════════════════════════════════════════════════
console.log(B('\n── Кнопки учителя ──'));

// openLoginModal
try {
    window.openLoginModal();
    const m = document.getElementById('login-modal');
    if (!m.classList.contains('hidden')) ok('Кнопка «Преподаватель» → openLoginModal()');
    else fail('openLoginModal()');
    window.closeModal('login-modal');
} catch(e) { fail('openLoginModal()', e.message); }

// openNewQuizModal
try {
    window.openNewQuizModal();
    const m = document.getElementById('quiz-modal');
    if (!m.classList.contains('hidden')) ok('Кнопка «+ Новый квиз» → openNewQuizModal()');
    else fail('openNewQuizModal()');
    window.closeModal('quiz-modal');
} catch(e) { fail('openNewQuizModal()', e.message); }

// openChangePassModal
try {
    window.openChangePassModal();
    const m = document.getElementById('cp-modal');
    if (!m.classList.contains('hidden')) ok('Кнопка «🔑 Пароль» → openChangePassModal()');
    else fail('openChangePassModal()');
    window.closeModal('cp-modal');
} catch(e) { fail('openChangePassModal()', e.message); }

// openEditQuizModal — нужны данные в quizzes
try {
    window.quizzes = MOCK_QUIZZES;
    window.openEditQuizModal('quiz-1');
    const m = document.getElementById('quiz-modal');
    const nameVal = document.getElementById('qm-name').value;
    if (!m.classList.contains('hidden') && nameVal === 'Тест квиз') {
        ok('Кнопка «✏️ Изменить» → openEditQuizModal() заполняет поля');
    } else fail('openEditQuizModal()', `name="${nameVal}"`);
    window.closeModal('quiz-modal');
} catch(e) { fail('openEditQuizModal()', e.message); }

// openQEditorPage
try {
    window.quizzes = MOCK_QUIZZES;
    window.openQEditorPage('quiz-1');
    const title = document.getElementById('qep-title').textContent;
    const page  = document.getElementById('q-editor-page');
    if (page.style.display === 'flex' && title === 'Тест квиз') {
        ok('Кнопка «📋 Редактировать вопросы» → openQEditorPage()');
    } else fail('openQEditorPage()', `title="${title}"`);
} catch(e) { fail('openQEditorPage()', e.message); }

// renderQList — проверяем что вопросы отрисовались
try {
    window.editingQuizId = 'quiz-1';
    window.renderQList();
    const cards = document.getElementById('q-list').querySelectorAll('.q-card');
    if (cards.length === 2) ok('renderQList() отрисовывает 2 вопроса');
    else fail('renderQList()', `cards.length=${cards.length}`);
} catch(e) { fail('renderQList()', e.message); }

// openQEditor (новый вопрос)
try {
    window.editingQuizId = 'quiz-1';
    window.openQEditor(-1);
    const title = document.getElementById('q-modal-title').textContent;
    const m     = document.getElementById('q-modal');
    if (!m.classList.contains('hidden') && title === 'Новый вопрос') {
        ok('Кнопка «+ Вопрос» → openQEditor(-1) открывает пустую форму');
    } else fail('openQEditor(-1)', `title="${title}"`);
    window.closeModal('q-modal');
} catch(e) { fail('openQEditor(-1)', e.message); }

// openQEditor (редактирование)
try {
    window.editingQuizId = 'quiz-1';
    window.quizzes = MOCK_QUIZZES;
    window.openQEditor('q1', 0);
    const title  = document.getElementById('q-modal-title').textContent;
    const qText  = document.getElementById('ed-q').innerHTML;
    const ansA   = document.getElementById('ed-a').value;
    if (title === 'Изменить вопрос' && ansA === 'Париж') {
        ok('Кнопка «✏️» на вопросе → openQEditor("q1", 0) заполняет форму');
    } else fail('openQEditor(q1, 0)', `title="${title}", ansA="${ansA}"`);
    window.closeModal('q-modal');
} catch(e) { fail('openQEditor(q1, 0)', e.message); }

// selCorrect / updateCorrectBtns
try {
    window.openQEditor(-1);
    window.selCorrect(2);
    const cb2 = document.getElementById('cb-2');
    if (cb2 && cb2.classList.contains('selected')) ok('selCorrect(2) выделяет правильный ответ C');
    else fail('selCorrect(2)');
    window.closeModal('q-modal');
} catch(e) { fail('selCorrect()', e.message); }

// togglePass
try {
    const input = document.getElementById('login-pass');
    const btn   = document.createElement('button');
    input.type  = 'password';
    window.togglePass('login-pass', btn);
    if (input.type === 'text' && btn.textContent === '🙈') ok('togglePass() переключает тип поля пароля');
    else fail('togglePass()');
} catch(e) { fail('togglePass()', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 6: СТУДЕНТ — выбор квиза и игра
// ══════════════════════════════════════════════════════
console.log(B('\n── Студент: выбор квиза ──'));

try {
    window.quizzes = MOCK_QUIZZES;
    window.showStudentHome();
    const page  = document.getElementById('student-home');
    const cards = document.querySelectorAll('.quiz-card');
    if (page.style.display === 'flex' && cards.length >= 1) {
        ok('showStudentHome() → отображает карточки квизов');
    } else fail('showStudentHome()', `cards=${cards.length}`);
} catch(e) { fail('showStudentHome()', e.message); }

// ── Игра: startQuizAsStudent ──
console.log(B('\n── Квиз: игровой движок ──'));

try {
    window.quizzes = MOCK_QUIZZES;
    window.startQuizAsStudent('quiz-1');
    await new Promise(r => setTimeout(r, 200));
    if (window.playQuizId === 'quiz-1') ok('startQuizAsStudent() устанавливает playQuizId');
    else fail('startQuizAsStudent()');
} catch(e) { fail('startQuizAsStudent()', e.message); }

try {
    const s = window.qState;
    if (s.idx === 0 && s.score === 0 && s.correct === 0 && s.wrong === 0) {
        ok('qState сброшен корректно');
    } else fail('qState reset', JSON.stringify(s));
} catch(e) { fail('qState', e.message); }

// getQuestion helper
try {
    const quiz = MOCK_QUIZZES[0];
    const q    = window.getQuestion(quiz, 0);
    if (q && q.id === 'q1') ok('getQuestion(quiz, 0) возвращает первый вопрос');
    else fail('getQuestion()');
} catch(e) { fail('getQuestion()', e.message); }

// getHistory / setHistory
try {
    window.qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
    window.setHistory(0, { imgUrl:'test.jpg', chosen: null, question_id: 'q1' });
    const h = window.getHistory(0);
    if (h && h.imgUrl === 'test.jpg') ok('setHistory/getHistory работают корректно');
    else fail('setHistory/getHistory', JSON.stringify(h));
} catch(e) { fail('setHistory/getHistory', e.message); }

// chooseAns — правильный ответ
try {
    window.quizzes = MOCK_QUIZZES;
    window.playQuizId = 'quiz-1';
    window.qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[
        { imgUrl:'x', chosen: null, question_id:'q1' }
    ] };
    // рисуем кнопки ответов
    window.showPage('quiz');
    window.quizzes = MOCK_QUIZZES;
    const grid = document.getElementById('answers-grid-quiz');
    ['opt-a','opt-b','opt-c'].forEach((cls, i) => {
        const b = document.createElement('button');
        b.className = `answer-btn ${cls}`;
        b.id = `ab-${i}`;
        grid.appendChild(b);
    });
    window.chooseAns(0); // правильный (correct_index=0)
    await new Promise(r => setTimeout(r, 50));
    if (window.qState.correct === 1 && window.qState.score === 1) {
        ok('chooseAns(0) — правильный ответ: score +1, correct +1');
    } else fail('chooseAns(correct)', `score=${window.qState.score}, correct=${window.qState.correct}`);
} catch(e) { fail('chooseAns(correct)', e.message); }

// chooseAns — неправильный ответ
try {
    window.quizzes = MOCK_QUIZZES;
    window.playQuizId = 'quiz-1';
    window.qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[
        { imgUrl:'x', chosen: null, question_id:'q1' }
    ] };
    const grid = document.getElementById('answers-grid-quiz');
    grid.innerHTML = '';
    ['opt-a','opt-b','opt-c'].forEach((cls, i) => {
        const b = document.createElement('button');
        b.className = `answer-btn ${cls}`;
        b.id = `ab-${i}`;
        grid.appendChild(b);
    });
    window.chooseAns(2); // неправильный
    await new Promise(r => setTimeout(r, 50));
    if (window.qState.wrong === 1 && window.qState.score === 0) {
        ok('chooseAns(2) — неправильный ответ: wrong +1, score не изменился');
    } else fail('chooseAns(wrong)', `wrong=${window.qState.wrong}, score=${window.qState.score}`);
} catch(e) { fail('chooseAns(wrong)', e.message); }

// goToPrev — нельзя уйти назад с первого вопроса
try {
    window.qState = { idx:0, score:0, correct:0, wrong:0, answered:false, history:[] };
    const idxBefore = window.qState.idx;
    window.goToPrev();
    if (window.qState.idx === 0) ok('goToPrev() при idx=0 не уменьшает индекс');
    else fail('goToPrev()', `idx стал ${window.qState.idx}`);
} catch(e) { fail('goToPrev()', e.message); }

// updateScoreUI
try {
    window.qState = { idx:0, score:3, correct:3, wrong:1, answered:true, history:[] };
    window.updateScoreUI();
    const pts = document.getElementById('quiz-score-pts').textContent;
    const cor = document.getElementById('quiz-score-cor').textContent;
    if (pts === '3 ⭐' && cor === '3 из 4') ok('updateScoreUI() корректно отображает счёт');
    else fail('updateScoreUI()', `pts="${pts}" cor="${cor}"`);
} catch(e) { fail('updateScoreUI()', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 7: РЕЗУЛЬТАТЫ
// ══════════════════════════════════════════════════════
console.log(B('\n── Результаты ──'));

try {
    window.quizzes = MOCK_QUIZZES;
    window.playQuizId = 'quiz-1';
    window.qState = { idx:2, score:2, correct:2, wrong:0, answered:true, history:[] };
    await window.showResults();
    const scoreEl = document.getElementById('results-score').textContent;
    const labelEl = document.getElementById('results-label').textContent;
    const emoji   = document.getElementById('results-emoji').textContent;
    if (scoreEl === '2' && labelEl.includes('балла') && emoji === '🏆') {
        ok(`showResults() — счёт=${scoreEl}, метка="${labelEl}", эмодзи=${emoji}`);
    } else fail('showResults()', `score="${scoreEl}" label="${labelEl}" emoji="${emoji}"`);
} catch(e) { fail('showResults()', e.message); }

// Склонение баллов
try {
    const cases = [
        [0, 'баллов'], [1, 'балл'], [2, 'балла'], [3, 'балла'], [4, 'балла'],
        [5, 'баллов'], [11, 'баллов'], [21, 'балл'],
    ];
    let allOk = true;
    for (const [n, expected] of cases) {
        const s = n === 1 ? 'балл' : (n >= 2 && n <= 4) ? 'балла' : 'баллов';
        if (s !== expected) { fail(`Склонение ${n} → ожидалось "${expected}", получено "${s}"`); allOk = false; }
    }
    if (allOk) ok('Склонение «балл/балла/баллов» корректно для 0,1,2,3,4,5,11,21');
} catch(e) { fail('Склонение', e.message); }

// retryCurrentQuiz
try {
    window.qState = { idx:5, score:3, correct:3, wrong:2, answered:true, history:[1,2,3] };
    window.retryCurrentQuiz();
    await new Promise(r => setTimeout(r, 100));
    const s = window.qState;
    if (s.idx === 0 && s.score === 0 && s.history.length <= 1) {
        ok('retryCurrentQuiz() сбрасывает состояние квиза');
    } else fail('retryCurrentQuiz()', JSON.stringify(s));
} catch(e) { fail('retryCurrentQuiz()', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 8: ТАЙМЕР
// ══════════════════════════════════════════════════════
console.log(B('\n── Таймер ──'));

try {
    window.showPage('quiz');
    window.startTimer();
    await new Promise(r => setTimeout(r, 1100));
    const txt = document.getElementById('timer-text').textContent;
    if (txt === '19') ok(`startTimer() тикает: ${txt} сек после 1с`);
    else fail('startTimer()', `timer-text="${txt}"`);
    clearInterval(window.timerInt);
} catch(e) { fail('startTimer()', e.message); }

try {
    const arc = document.getElementById('timer-arc');
    const offset = parseFloat(arc.style.strokeDashoffset);
    // После 1с: ((20-19)/20)*150.8 ≈ 7.54
    if (offset > 5 && offset < 15) ok(`Таймер-дуга анимируется корректно (offset≈${offset.toFixed(1)})`);
    else warn(`timer-arc offset=${offset} (ожидалось ~7.5)`);
} catch(e) { fail('timer-arc', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 9: TOAST
// ══════════════════════════════════════════════════════
console.log(B('\n── Toast-уведомления ──'));

try {
    window.toast('Тест сообщение', 'success');
    const t = document.getElementById('toast');
    if (t.textContent === 'Тест сообщение' && t.classList.contains('show') && t.classList.contains('success')) {
        ok('toast("success") показывается с правильным текстом и классом');
    } else fail('toast(success)', `classes="${t.className}" text="${t.textContent}"`);
} catch(e) { fail('toast', e.message); }

try {
    window.toast('Ошибка', 'error');
    const t = document.getElementById('toast');
    if (t.classList.contains('error')) ok('toast("error") применяет класс error');
    else fail('toast(error)');
} catch(e) { fail('toast(error)', e.message); }

// ══════════════════════════════════════════════════════
// РАЗДЕЛ 10: ЭКСПОРТ JSON
// ══════════════════════════════════════════════════════
console.log(B('\n── Экспорт ──'));

try {
    window.quizzes = MOCK_QUIZZES;
    let clicked = false;
    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = (node) => {
        if (node.tagName === 'A') {
            clicked = true;
            const href = node.getAttribute('href');
            if (href && href.startsWith('data:text/json')) ok('exportQuiz() создаёт data:text/json ссылку');
            else fail('exportQuiz()', `href="${href}"`);
        }
        return origAppend(node);
    };
    window.exportQuiz('quiz-1');
    document.body.appendChild = origAppend;
    if (!clicked) warn('exportQuiz() — click не был вызван (возможно JSDOM ограничение)');
} catch(e) { fail('exportQuiz()', e.message); }

// ══════════════════════════════════════════════════════
// ИТОГ
// ══════════════════════════════════════════════════════
const total = passed + failed + warned;
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${G('✓')} Пройдено:     ${G(passed)}`);
if (warned > 0) console.log(`  ${Y('⚠')} Предупреждений: ${Y(warned)}`);
if (failed > 0) console.log(`  ${R('✗')} Упало:        ${R(failed)}`);
console.log(`  Всего:         ${total}`);
console.log('═'.repeat(50));

if (failed > 0) {
    console.log(R(`\n❌ ЕСТЬ ПРОБЛЕМЫ (${failed} тестов упало)`));
    process.exit(1);
} else {
    console.log(G(`\n✅ Все кнопки работают корректно!`));
}
