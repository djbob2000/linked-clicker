# Setting up a Separate Browser Profile

## Problem

The application opens your main browser with all tabs, which is inconvenient.

## Solution

We use a separate Playwright browser profile that:

- Doesn't interfere with your main browser
- Saves LinkedIn authorization between runs
- Is isolated from your personal data

## Quick Setup

### 1. Check configuration in .env

```env
# Separate browser profile (recommended)
USER_DATA_DIR=./browser-profile
USE_EXISTING_PROFILE=true
HEADLESS=false

# Chrome settings are commented out
# CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# CHROME_USER_DATA_DIR=/Users/air/Library/Application Support/Google/Chrome
```

### 2. Test the browser profile

```bash
npm run test-browser
```

### 3. Log into LinkedIn

When the browser opens:

1. Go to linkedin.com (if not opened automatically)
2. Log into your LinkedIn account
3. Wait for the test to complete

### 4. Run the main application

```bash
npm run dev
```

## What Happens

1. **Separate Profile**: A `./browser-profile` folder is created with browser data
2. **Session Saving**: Cookies and authorization are saved between runs
3. **Isolation**: Your main browser remains untouched

## Benefits

✅ Doesn't interfere with your main browser  
✅ Saves LinkedIn authorization  
✅ Quick startup without re-login  
✅ Isolated environment for automation  
✅ No "New device registration" notifications

## Troubleshooting

### Browser doesn't start

```bash
# Install Playwright browsers
npm run playwright:install
```

### Profile isn't saved

Check that .env has:

```env
USE_EXISTING_PROFILE=true
```

### Main browser still opens

Make sure these lines are commented out:

```env
# CHROME_EXECUTABLE_PATH=...
# CHROME_USER_DATA_DIR=...
```

## Additional Settings

### Headless mode

```env
HEADLESS=true
```

### Different profile folder

```env
USER_DATA_DIR=./my-custom-profile
```

### Operation timeout

```env
TIMEOUT=60000
```