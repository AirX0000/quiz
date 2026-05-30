import re

def extract_files():
    with open('/Users/air/Downloads/quiz/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Extract CSS
    style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
    if style_match:
        css = style_match.group(1).strip()
        with open('/Users/air/Downloads/quiz/style.css', 'w', encoding='utf-8') as f:
            f.write(css)
        html = html.replace(style_match.group(0), '<link rel="stylesheet" href="style.css">')

    # Extract JS
    script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    if script_match:
        js = script_match.group(1).strip()
        with open('/Users/air/Downloads/quiz/app.js', 'w', encoding='utf-8') as f:
            f.write(js)
        
        new_scripts = (
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n'
            '<script src="app.js"></script>'
        )
        html = html.replace(script_match.group(0), new_scripts)

    # Save HTML
    with open('/Users/air/Downloads/quiz/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    extract_files()
