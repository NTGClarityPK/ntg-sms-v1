// Kill process on port 3001 (or PORT env var) before starting
const { execSync } = require('child_process');
const port = process.env.PORT || 3001;

try {
  if (process.platform === 'win32') {
    // Windows: Find and kill process using the port
    try {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = result.trim().split('\n');
      const pids = new Set();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      }
      
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`Killed process ${pid} on port ${port}`);
        } catch (e) {
          // Process might already be dead, ignore
        }
      }
    } catch (e) {
      // No process found on port, that's fine
    }
  } else {
    // Unix/Linux/Mac: Find and kill process using the port
    try {
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`Killed process ${pid} on port ${port}`);
      }
    } catch (e) {
      // No process found on port, that's fine
    }
  }
} catch (error) {
  // Ignore errors - port might not be in use
}

