# Quick Setup of Separate Browser Profile

## Problem

The application opens your main Chrome browser with all tabs, which is inconvenient.

## Solution ✅

We use a separate Playwright browser profile:

- Doesn't interfere with your main browser
- Saves LinkedIn authorization
- No new device notifications

## Instructions (3 Steps)

### 1. Check .env file

Make sure the settings look like this:

```env
# Separate browser profile
USER_DATA_DIR=./browser-profile
USE_EXISTING_PROFILE=true
HEADLESS=false

# Chrome settings are commented out
# CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# CHROME_USER_DATA_DIR=/Users/air/Library/Application Support/Google/Chrome
```

### 2. Test the profile

```bash
npm run test-browser
```

A separate browser window will open. Log into LinkedIn if required.

### 3. Run the application

```bash
npm run dev
```

Now the application will use a separate profile!

## What Changed

**Before**: Your Chrome opened with all tabs  
**Now**: A separate window opens only for automation

## Result

✅ Your main browser remains untouched  
✅ LinkedIn doesn't send new device notifications  
✅ Authorization is saved between runs  
✅ Quick start without re-login

## If Something Doesn't Work

1. **Browser doesn't start**:

   ```bash
   npm run playwright:install
   ```

2. **Main Chrome still opens**:
   Check that lines with `CHROME_EXECUTABLE_PATH` and `CHROME_USER_DATA_DIR` are commented out in .env

3. **Profile isn't saved**:
   Make sure `USE_EXISTING_PROFILE=true`

## Additional Info

- The `browser-profile` folder is created automatically
- You can change to `HEADLESS=true` for hidden mode
- The profile is isolated from your personal data