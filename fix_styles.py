import re

def fix_html():
    with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix backdrop-filter error
    content = content.replace('backdrop-filter:blur(8px);', '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);')

    # 2. Extract inline styles to classes to resolve warnings
    replacements = [
        ('id="splash-info" style="color:var(--muted);font-size:.9rem;max-width:360px;line-height:1.6;"', 'id="splash-info" class="splash-info"'),
        ('class="page" style="display:none;flex-direction:column;"', 'class="page page-col" style="display:none;"'),
        ('class="quiz-cards" style="margin-top:1rem;"', 'class="quiz-cards mt-1"'),
        ('style="margin-left:auto;display:flex;gap:.6rem;flex-wrap:wrap;"', 'class="header-actions"'),
        ('style="font-weight:700;font-size:1.2rem;margin-bottom:.5rem;"', 'class="waiting-title"'),
        ('style="color:var(--muted);"', 'class="text-muted"'),
        ('style="font-weight:700;font-size:.9rem;white-space:nowrap;"', 'class="q-counter-text"'),
        ('style="width:0%"', 'style="width:0%;"'), # Just leave width:0% as inline, since it's dynamic
        ('style="flex:1"', 'class="flex-1"'),
        ('style="transition:stroke-dashoffset 1s linear"', 'class="timer-arc"'),
        ('style="font-size:4rem;margin-bottom:.5rem;"', 'class="results-emoji-wrap"'),
        ('style="color:var(--muted);font-size:1.2rem;margin-top:-.5rem;"', 'class="results-label-wrap"'),
        ('style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;"', 'class="results-actions"'),
        ('style="max-width:400px;"', 'class="max-w-400"'),
        ('style="max-width:460px;"', 'class="max-w-460"'),
        ('style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:.9rem 1rem;margin-bottom:1.2rem;font-size:.88rem;color:#c4b5fd;line-height:1.5;display:none;"', 'class="login-setup-note" style="display:none;"'),
        ('style="position:relative;"', 'class="relative"'),
        ('style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:1.1rem;width:auto;"', 'class="pass-toggle-btn"'),
        ('style="color:var(--red);font-size:.88rem;margin-bottom:.8rem;display:none;"', 'class="error-msg" style="display:none;"'),
        ('style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:.75rem 1rem;min-height:70px;outline:none;transition:border-color .2s;line-height:1.5;font-size:1rem;"', 'class="ed-q-box"'),
        ('style="background:var(--c1)"', 'class="bg-c1"'),
        ('style="background:var(--c2)"', 'class="bg-c2"'),
        ('style="background:var(--c3)"', 'class="bg-c3"'),
        ('style="grid-column:span 2"', 'class="col-span-2"'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    # Some display:none might still be inline, but that's standard for dynamic elements.
    # We will ignore those specific ones as they're required for JS initial state logic.

    css_to_add = """
/* UTILITY CLASSES REPLACING INLINE STYLES */
.splash-info { color: var(--muted); font-size: .9rem; max-width: 360px; line-height: 1.6; }
.page-col { flex-direction: column; }
.mt-1 { margin-top: 1rem; }
.header-actions { margin-left: auto; display: flex; gap: .6rem; flex-wrap: wrap; }
.waiting-title { font-weight: 700; font-size: 1.2rem; margin-bottom: .5rem; }
.text-muted { color: var(--muted); }
.q-counter-text { font-weight: 700; font-size: .9rem; white-space: nowrap; }
.flex-1 { flex: 1; }
.timer-arc { transition: stroke-dashoffset 1s linear; }
.results-emoji-wrap { font-size: 4rem; margin-bottom: .5rem; }
.results-label-wrap { color: var(--muted); font-size: 1.2rem; margin-top: -.5rem; }
.results-actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
.max-w-400 { max-width: 400px; width: 100%; }
.max-w-460 { max-width: 460px; width: 100%; }
.login-setup-note { background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.3); border-radius: 12px; padding: .9rem 1rem; margin-bottom: 1.2rem; font-size: .88rem; color: #c4b5fd; line-height: 1.5; }
.relative { position: relative; }
.pass-toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--muted); font-size: 1.1rem; width: auto; }
.error-msg { color: var(--red); font-size: .88rem; margin-bottom: .8rem; }
.ed-q-box { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: .75rem 1rem; min-height: 70px; outline: none; transition: border-color .2s; line-height: 1.5; font-size: 1rem; }
.bg-c1 { background: var(--c1); }
.bg-c2 { background: var(--c2); }
.bg-c3 { background: var(--c3); }
.col-span-2 { grid-column: span 2; }
</style>
"""
    content = content.replace('</style>', css_to_add)

    # To avoid the remaining `style="display:none"` warnings if the IDE is super strict,
    # we can leave them be, as JS explicitly requires them for the initial state, 
    # but the IDE linter usually forgives `style="display:none"`.

    with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_html()
