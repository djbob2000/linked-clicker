# How to Avoid LinkedIn "New Device Registration" Notifications

## Problem

Every time the LinkedIn automation runs, LinkedIn sends an email "New device registration for Remember me" because the application creates a new browser context.

## Quick Solution

### 1. Automatic Setup (Recommended)

```bash
# Set up a persistent browser profile
npm run setup-chrome

# Run the application
npm run dev
```

The application will automatically create a `browser-profile` folder and save browser data between runs.

### 2. Using Your Chrome Profile

If you want to use an existing Chrome profile:

1. **Set up Chrome paths:**

   ```bash
   npm run setup-chrome
   ```

2. **Activate in .env file:**

   ```env
   # Uncomment these lines:
   CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   CHROME_USER_DATA_DIR=/Users/[your_user]/Library/Application Support/Google/Chrome

   # For visible browser:
   HEADLESS=false
   ```

3. **IMPORTANT:** Close all Chrome windows before running automation!

## What Happens

- ✅ Cookies and sessions are saved between runs
- ✅ LinkedIn recognizes the browser as a "familiar device"
- ✅ No new device notifications
- ✅ Automatic login without re-authentication

## Verification

1. Run the application for the first time
2. Log into LinkedIn (if required)
3. Stop the application
4. Run again - login should be automatic
5. Check your email - there should be no new notifications

## Troubleshooting

### Notifications Still Arrive

If notifications still arrive:

1. Make sure the `browser-profile` folder is created and contains files
2. Check settings in .env:
   ```env
   USER_DATA_DIR=./browser-profile
   USE_EXISTING_PROFILE=true
   ```
3. Log into LinkedIn manually once in the created profile

### Navigation Issues After Login

If the system doesn't navigate to the network growth page after login:

1. **Check logs:** The system now logs page URLs for debugging
2. **Manual check:** Open browser in visible mode:
   ```env
   HEADLESS=false
   ```
3. **Navigation testing:**
   ```bash
   node test-navigation-fix.js
   ```

### Network Errors (ERR_FAILED, ERR_ABORTED)

These errors are usually related to ad blockers or LinkedIn network issues:

- ✅ **Normal:** Ad and analytics loading errors don't affect operation
- ⚠️ **Problem:** If errors affect main LinkedIn pages
- 🔧 **Solution:** Use a browser profile without extensions

Detailed documentation: [browser-profile-setup.md](./browser-profile-setup.md)