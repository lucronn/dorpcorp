const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`  const [sequenceInfo, setSequenceInfo] = useState<{`,
`  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  useEffect(() => {
    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (msg.includes("[DEBUG]")) {
         setDebugLogs(prev => [...prev.slice(-10), msg]);
      }
    };
  }, []);
  const [sequenceInfo, setSequenceInfo] = useState<{`
);

code = code.replace(
`      <WavelengthBackground />`,
`      <WavelengthBackground />
      <div className="fixed top-0 left-0 z-[9999] p-4 text-green-400 font-mono text-xs max-w-[50vw] pointer-events-none bg-black/80">
        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
      </div>`
);

fs.writeFileSync('src/App.tsx', code);
