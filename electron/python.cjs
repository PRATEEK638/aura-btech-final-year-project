const { spawn } = require('node:child_process');
function pythonAnalysis(script, payload, {check=()=>{}}={}) {
  return new Promise((resolve, reject) => {
    check();
    const child = spawn('python', ['-I', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let settled = false;
    const finish = (error, data) => { if (settled) return; settled = true; clearTimeout(timer); clearInterval(cancellation); error ? reject(error) : resolve(data); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Python analysis timed out.')); }, 8000);
    const cancellation=setInterval(()=>{try{check();}catch(e){child.kill();finish(e);}},25);
    child.on('error', () => finish(new Error('Python 3 is unavailable. Install Python and restart Aura.')));
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 250000) { child.kill(); finish(new Error('Python output too large.')); } });
    child.stdin.on('error', () => {});
    child.on('close', code => {
      try { const result = JSON.parse(output); if (code !== 0 || !result.ok) throw new Error(result.error || 'Python analysis failed.'); finish(null, result.data); }
      catch (error) { finish(new Error(error.message || 'Python analysis failed.')); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
module.exports = { pythonAnalysis };
