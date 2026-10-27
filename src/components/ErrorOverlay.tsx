import React, { useState, useEffect } from 'react';
import { reportClientError, isIgnoredErrorMessage } from '../utils/telemetry';

export function ErrorOverlay({ showDebug = false }: { showDebug?: boolean }) {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
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
      
      if (!isIgnoredErrorMessage(msg)) {
        setErrors(e => [...e, msg].slice(-5));
        reportClientError(msg, 'console.error').catch(() => {});
      }
      origError(...args);
    };

    const handleError = (event: ErrorEvent) => {
      const errStr = `${event.message || 'Error'} at ${event.lineno}:${event.colno}`;
      if (!isIgnoredErrorMessage(errStr)) {
        setErrors(e => [...e, errStr].slice(-5));
        reportClientError(event.error || errStr, 'window.error').catch(() => {});
      }
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown';
      const errStr = `Unhandled Rejection: ${reason}`;
      if (!isIgnoredErrorMessage(errStr)) {
        setErrors(e => [...e, errStr].slice(-5));
        reportClientError(event.reason || errStr, 'window.unhandledrejection').catch(() => {});
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
