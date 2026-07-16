import React, { useState, useEffect } from 'react';

export function ErrorOverlay() {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    const origError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch (err) {
          return String(a);
        }
      }).join(' ');
      
      setErrors(e => [...e, msg].slice(-5));
      fetch('/api/log-error', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ error: msg }) }).catch(() => {});
      origError(...args);
    };
    window.onerror = (msg, url, line, col, error) => {
      const errStr = `${msg} at ${line}:${col}`;
      setErrors(e => [...e, errStr].slice(-5));
      fetch('/api/log-error', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ error: errStr }) }).catch(() => {});
    };
    
    // Also catch unhandled rejections
    window.onunhandledrejection = (event) => {
      const errStr = `Unhandled Rejection: ${event.reason}`;
      setErrors(e => [...e, errStr].slice(-5));
      fetch('/api/log-error', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ error: errStr }) }).catch(() => {});
    };
    return () => { console.error = origError; };
  }, []);
  if (errors.length === 0) return null;
  return (
    <div style={{position:'fixed', zIndex: 9999, top:0, left:0, background:'rgba(255,0,0,0.8)', color:'white', padding:10, fontSize:12, pointerEvents:'none', width:'100%'}}>
      {errors.map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}
