const { spawn } = require('child_process');
const waitOn = require('wait-on');

async function startElectron() {
  try {
    // Wait for Vite dev server to be ready
    console.log('Waiting for Vite dev server...');
    await waitOn({
      resources: ['http://localhost:3002'],
      delay: 1000,
      timeout: 30000,
      interval: 1000,
    });

    console.log('Vite dev server is ready, starting Electron...');
    
    const electron = spawn('electron', ['dist/main/main.js'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    electron.on('close', (code) => {
      console.log(`Electron process exited with code ${code}`);
      process.exit(code);
    });

    electron.on('error', (error) => {
      console.error('Failed to start Electron:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start development environment:', error);
    process.exit(1);
  }
}

startElectron();