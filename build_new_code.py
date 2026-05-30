import os
import re

URL = 'https://hawlzgobfzsqwaxfpqva.supabase.co'
KEY = 'sb_publishable_moND8o3E68eoh_kEkhPk5A_llIok7nO'

# --- HTML Modifications ---
def modify_html():
    with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Add Admin Button to Teacher Header
    if 'id="btn-admin"' not in html:
        teacher_header = '<button class="btn btn-primary btn-sm" onclick="openNewQuizModal()">＋ Новый квиз</button>'
        admin_btn = '<button id="btn-admin" class="btn btn-accent3 btn-sm d-none" onclick="showPage(\'admin-page\')">👑 Админ-панель</button>'
        html = html.replace(teacher_header, admin_btn + '\n      ' + teacher_header)

    # Add Admin Page HTML
    if 'id="admin-page"' not in html:
        admin_page = """
<!-- ===== ADMIN DASHBOARD ===== -->
<div id="admin-page" class="page page-col d-none">
  <div class="page-header">
    <button class="back-btn" onclick="showPage('teacher')">← Назад</button>
    <h1>Админ-панель</h1>
  </div>
  <div id="admin-users-list" class="quiz-cards mt-1"></div>
</div>
"""
        html = html.replace('<!-- ===== QUESTION EDITOR PAGE ===== -->', admin_page + '\n<!-- ===== QUESTION EDITOR PAGE ===== -->')

    # Add Import/Export/Analytics buttons to Teacher Quiz Card placeholder (will be rendered via JS, so nothing to add in HTML directly here)

    # Add Leaderboard to Results Page
    if 'id="leaderboard"' not in html:
        results_actions = '<div class="results-actions">'
        leaderboard_html = """
  <div class="form-group mt-1 max-w-400" id="lb-submit-wrap" style="margin: 0 auto 1.5rem auto;">
    <input type="text" id="lb-name" placeholder="Твое имя для рейтинга" class="ed-q-box" style="margin-bottom:0.5rem;width:100%;text-align:center;">
    <button class="btn btn-primary" onclick="submitResult()" style="width:100%;">Сохранить результат</button>
  </div>
  <div id="leaderboard" class="max-w-400" style="margin: 0 auto 2rem auto; text-align:left;"></div>
"""
        html = html.replace(results_actions, leaderboard_html + '\n  ' + results_actions)

    # Add Analytics Modal
    if 'id="analytics-modal"' not in html:
        analytics_modal = """
<!-- ANALYTICS -->
<div class="modal-overlay hidden" id="analytics-modal">
  <div class="modal max-w-460">
    <h2>📊 Аналитика квиза</h2>
    <div id="analytics-content" style="margin-bottom:1rem; max-height: 50vh; overflow-y:auto;"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal('analytics-modal')">Закрыть</button>
    </div>
  </div>
</div>
"""
        html = html.replace('<!-- CHANGE PASS -->', analytics_modal + '\n<!-- CHANGE PASS -->')

    # Add Toast for generalized errors
    html = html.replace('d-none"', 'd-none') # Clean up any trailing quote artifacts
    
    with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

modify_html()
