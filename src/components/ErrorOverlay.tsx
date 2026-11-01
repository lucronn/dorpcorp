import React, { useState, useEffect } from 'react';

export function ErrorOverlay({ showDebug = false }: { showDebug?: boolean }) {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    const isIgnored = (msg: string) => {
      if (!msg) return true;
      const lower = msg.toLowerCase();
      return (
        lower.includes("websocket") ||
        lower.includes("[vite]") ||
        lower.includes("hmr") ||
        lower.includes("failed to connect to websocket")
      );
    };

    const origError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => {
        if (a === null || a === undefined) return String(a);
        if (typeof a !== 'object') return String(a);
        try {
          const seen = new WeakSet();
          return JSON.stringify(a, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            return value;
          });
        } catch {
          return String(a);
        }
      }).join(' ');
      
      if (!isIgnored(msg)) {
        setErrors(e => [...e, msg].slice(-5));
      }
      origError(...args);
    };

    const handleError = (event: ErrorEvent) => {
      const errStr = `${event.message || 'Error'} at ${event.lineno}:${event.colno}`;
      if (!isIgnored(errStr)) {
        setErrors(e => [...e, errStr].slice(-5));
      }
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown';
      const errStr = `Unhandled Rejection: ${reason}`;
      if (!isIgnored(errStr)) {
        setErrors(e => [...e, errStr].slice(-5));
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.error = origError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!showDebug || errors.length === 0) return null;
  return (
    <div style={{position:'fixed', zIndex: 9999, top:0, left:0, background:'rgba(255,0,0,0.85)', color:'white', padding:10, fontSize:12, pointerEvents:'none', width:'100%'}}>
      {errors.map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}
