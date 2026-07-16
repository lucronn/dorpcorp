const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (msg.includes("[DEBUG]")) {
         setDebugLogs(prev => [...prev.slice(-10), msg]);
      }
    };`,
`    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (msg.includes("[DEBUG]") || msg.includes("Error")) {
         setDebugLogs(prev => [...prev.slice(-15), msg]);
      }
    };
    
    const origError = console.error;
    console.error = (...args) => {
      origError(...args);
      const msg = "[ERROR] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };

    window.onerror = (message, source, lineno, colno, error) => {
      const msg = "[ERROR] " + message + " at " + source + ":" + lineno;
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };
    window.onunhandledrejection = (event) => {
      const msg = "[ERROR] Unhandled Rejection: " + (event.reason ? event.reason.toString() : 'Unknown');
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };`
);

fs.writeFileSync('src/App.tsx', code);
