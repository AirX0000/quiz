const { JSDOM } = require('jsdom');
const fs = require('fs');
const dom = new JSDOM(`<body></body>`, { runScripts: "dangerously" });
const window = dom.window;
window.console.error = console.error;
window.console.log = console.log;
window.supabase = { createClient: () => ({ auth: { getSession: async () => ({data:{session:null}}) }, from: () => ({ select: () => ({ order: () => Promise.resolve({data:[]}) }) }) }) };
try {
  const code = fs.readFileSync('app.js', 'utf-8');
  const script = window.document.createElement('script');
  script.textContent = code;
  window.document.head.appendChild(script);
  console.log("makeBtn defined:", typeof window.makeBtn);
} catch (e) {
  console.error("Error evaluating:", e);
}
