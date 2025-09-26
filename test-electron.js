const { spawn } = require('child_process');

console.log('Starting Vite dev server...');
const vite = spawn('npm', ['run', 'dev:renderer'], {
  stdio: 'pipe',
  shell: true
});

vite.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('Vite:', output);
  
  // When Vite is ready, start Electron
  if (output.includes('ready in')) {
    console.log('Vite is ready, starting Electron...');
    setTimeout(() => {
      const electron = spawn('electron', ['dist/main/main.js'], {
        stdio: 'inherit',
        shell: true
      });
      
      electron.on('close', (code) => {
        console.log('Electron closed with code:', code);
        vite.kill();
        process.exit(code);
      });
    }, 1000);
  }
});

vite.stderr.on('data', (data) => {
  console.error('Vite error:', data.toString());
});

process.on('SIGINT', () => {
  vite.kill();
  process.exit();
});