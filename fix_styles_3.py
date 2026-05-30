import os
import re

UTILS = """
/* NEW UTILS */
.lb-wrap { margin: 0 auto 1.5rem auto; }
.lb-input { margin-bottom: 0.5rem; width: 100%; text-align: center; }
.w-100 { width: 100%; }
.lb-container { margin: 0 auto 2rem auto; text-align: left; }
.analytics-box { margin-bottom: 1rem; max-height: 50vh; overflow-y: auto; }
"""

with open('/Users/air/Downloads/quiz/style.css', 'a', encoding='utf-8') as f:
    f.write(UTILS)

with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('style="margin: 0 auto 1.5rem auto;"', '')
html = html.replace('class="form-group mt-1 max-w-400"', 'class="form-group mt-1 max-w-400 lb-wrap"')

html = html.replace('class="ed-q-box" style="margin-bottom:0.5rem;width:100%;text-align:center;"', 'class="ed-q-box lb-input"')
html = html.replace('style="width:100%;"', 'class="w-100"')

html = html.replace('style="margin: 0 auto 2rem auto; text-align:left;"', '')
html = html.replace('id="leaderboard" class="max-w-400"', 'id="leaderboard" class="max-w-400 lb-container"')

html = html.replace('style="margin-bottom:1rem; max-height: 50vh; overflow-y:auto;"', 'class="analytics-box"')

# a11y labels
html = html.replace('<label>Текущий пароль</label><input type="password" id="cp-old">', '<label for="cp-old">Текущий пароль</label><input type="password" id="cp-old" placeholder="Текущий пароль">')
html = html.replace('<label>Новый пароль</label><input type="password" id="cp-new"', '<label for="cp-new">Новый пароль</label><input type="password" id="cp-new"')
html = html.replace('<label>Повторите</label><input type="password" id="cp-confirm">', '<label for="cp-confirm">Повторите</label><input type="password" id="cp-confirm" placeholder="Повторите пароль">')

html = html.replace('<label>Название квиза</label><input type="text" id="qm-name"', '<label for="qm-name">Название квиза</label><input type="text" id="qm-name"')
html = html.replace('<label>Описание (необязательно)</label><input type="text" id="qm-desc"', '<label for="qm-desc">Описание (необязательно)</label><input type="text" id="qm-desc"')
html = html.replace('<label>Текст вопроса</label>', '<label for="ed-q">Текст вопроса</label>')

# Fix broken quotes
html = html.replace('class="error-msg d-none>', 'class="error-msg d-none">')

with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
