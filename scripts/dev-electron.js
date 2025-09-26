const { spawn } = require('child_process');

// Wait 3 seconds for Vite to start, then launch Electron
setTimeout(() => {
  const electron = spawn('electron', ['dist/main/main.js'], {
    stdio: 'inherit',
    shell: true
  });

  electron.on('close', (code) => {
    process.exit(code);
  });
}, 3000);