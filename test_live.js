const jsdom = require("jsdom");
const { JSDOM } = jsdom;

JSDOM.fromURL("https://airx0000.github.io/quiz/", {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true
}).then(dom => {
  dom.window.console.error = (msg) => console.log("ERROR:", msg);
  dom.window.console.warn = (msg) => console.log("WARN:", msg);
  dom.window.console.log = (msg) => console.log("LOG:", msg);
  
  setTimeout(() => {
     console.log("After 3s, splash info:", dom.window.document.getElementById('splash-info').textContent);
     process.exit(0);
  }, 3000);
}).catch(e => console.error("Catch:", e));
