#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Script to set up Chrome profile on macOS
 * Automatically detects paths to Chrome and user profile
 */

function findChromeExecutable() {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];

  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return null;
}

function getChromeUserDataDir() {
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(homeDir, 'Library/Application Support/Google/Chrome'),
    path.join(homeDir, 'Library/Application Support/Chromium'),
    path.join(homeDir, '.config/google-chrome'),
    path.join(homeDir, '.config/chromium'),
  ];

  for (const dataDir of possiblePaths) {
    if (fs.existsSync(dataDir)) {
      return dataDir;
    }
  }

  return null;
}

function updateEnvFile() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.error('.env file not found');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  const chromeExecutable = findChromeExecutable();
  const chromeUserDataDir = getChromeUserDataDir();

  if (chromeExecutable) {
    console.log(`✅ Chrome found: ${chromeExecutable}`);

    // Update or add Chrome path
    if (envContent.includes('CHROME_EXECUTABLE_PATH=')) {
      envContent = envContent.replace(
        /# CHROME_EXECUTABLE_PATH=.*/,
        `CHROME_EXECUTABLE_PATH=${chromeExecutable}`
      );
    } else {
      envContent += `
CHROME_EXECUTABLE_PATH=${chromeExecutable}`;
    }
  } else {
    console.log('❌ Chrome not found in standard locations');
  }

  if (chromeUserDataDir) {
    console.log(`✅ Chrome profile found: ${chromeUserDataDir}`);

    // Update or add profile path
    if (envContent.includes('CHROME_USER_DATA_DIR=')) {
      envContent = envContent.replace(
        /# CHROME_USER_DATA_DIR=.*/,
        `CHROME_USER_DATA_DIR=${chromeUserDataDir}`
      );
    } else {
      envContent += `
CHROME_USER_DATA_DIR=${chromeUserDataDir}`;
    }
  } else {
    console.log('❌ Chrome profile not found');
  }

  // Write updated .env file
  fs.writeFileSync(envPath, envContent);

  console.log(`
📝 .env file updated`);
  console.log(`
🔧 To use your Chrome profile:`);
  console.log(
    '1. Uncomment CHROME_EXECUTABLE_PATH and CHROME_USER_DATA_DIR lines in .env'
  );
  console.log('2. Set HEADLESS=false for visible browser');
  console.log('3. Restart the application');

  console.log(`
⚠️  IMPORTANT: Close all Chrome windows before running automation!`);
}

// Run the script
updateEnvFile();