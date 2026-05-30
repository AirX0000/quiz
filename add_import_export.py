import os

JS_ADDITION = """
// ======================================================
// IMPORT / EXPORT
// ======================================================
function exportQuiz(id) {
   const q = quizzes.find(x => x.id === id);
   const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(q, null, 2));
   const downloadAnchorNode = document.createElement('a');
   downloadAnchorNode.setAttribute("href", dataStr);
   downloadAnchorNode.setAttribute("download", q.name + ".json");
   document.body.appendChild(downloadAnchorNode);
   downloadAnchorNode.click();
   downloadAnchorNode.remove();
}

function triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const q = JSON.parse(text);
            const { data: newQuiz, error } = await supabase.from('quizzes').insert({
                teacher_id: currentUser.id,
                name: q.name + ' (Импорт)',
                description: q.description || q.desc
            }).select().single();
            
            if (newQuiz && q.questions) {
                for (let i = 0; i < q.questions.length; i++) {
                    const qq = q.questions[i];
                    await supabase.from('questions').insert({
                        quiz_id: newQuiz.id,
                        question_text: qq.question_text || qq.question,
                        answers: qq.answers,
                        correct_index: qq.correct_index !== undefined ? qq.correct_index : qq.correct,
                        keyword: qq.keyword,
                        order_index: i
                    });
                }
            }
            await fetchQuizzes();
            renderTeacher();
            toast('Квиз импортирован', 'success');
        } catch(err) {
            toast('Ошибка импорта', 'error');
        }
    };
    input.click();
}
"""

with open('/Users/air/Downloads/quiz/app.js', 'a', encoding='utf-8') as f:
    f.write(JS_ADDITION)

with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add Import button to teacher header
if 'triggerImport' not in html:
    html = html.replace('＋ Новый квиз</button>', '＋ Новый квиз</button>\n      <button class="btn btn-secondary btn-sm" onclick="triggerImport()">📥 Импорт JSON</button>')

# The JS already has renderTeacher mapped. We need to add the export button there.
with open('/Users/air/Downloads/quiz/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

if 'exportQuiz' in js and '📤 Экспорт' not in js:
    js = js.replace("onclick=\\\"openAnalytics('${q.id}')\\\">📊 Статистика</button>", "onclick=\\\"openAnalytics('${q.id}')\\\">📊 Статистика</button>\\n        <button class=\\\"btn btn-secondary btn-sm\\\" onclick=\\\"exportQuiz('${q.id}')\\\">📤 Экспорт</button>")
    with open('/Users/air/Downloads/quiz/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
