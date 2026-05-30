import re

def fix_html_again():
    with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove redundant style="display:none;" from .page elements
    content = content.replace('class="page page-col" style="display:none;"', 'class="page page-col"')
    
    # Replace style="width:0%;" with class
    content = content.replace('style="width:0%;"', 'class="w-0"')
    
    # Replace style="display:none;" on other elements
    content = content.replace('class="login-setup-note" style="display:none;"', 'class="login-setup-note d-none"')
    content = content.replace('class="error-msg" style="display:none;"', 'class="error-msg d-none"')
    
    # Add new utility classes
    css_to_add = """
.d-none { display: none; }
.w-0 { width: 0%; }
"""
    content = content.replace('/* UTILITY CLASSES REPLACING INLINE STYLES */', '/* UTILITY CLASSES REPLACING INLINE STYLES */\n' + css_to_add)

    with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_html_again()
