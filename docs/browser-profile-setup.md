# Setting up Browser Profile for LinkedIn Automation

## Problem

LinkedIn sends "New device registration" notifications every time the application runs because a new browser context is created each time.

## Solutions

### 1. Using a Persistent Profile (Recommended)

The application automatically creates a `browser-profile` folder to save browser data between runs.

**Settings in .env:**

```env
USER_DATA_DIR=./browser-profile
USE_EXISTING_PROFILE=true
HEADLESS=true
```

**Benefits:**

- Automatic saving of cookies and sessions
- No new device notifications
- Isolated profile only for automation

### 2. Using Your Chrome Profile

To use an existing Chrome profile:

1. **Run setup:**

   ```bash
   npm run setup-chrome
   ```

2. **Activate Chrome profile in .env:**

   ```env
   # Uncomment these lines:
   CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   CHROME_USER_DATA_DIR=/Users/[your_user]/Library/Application Support/Google/Chrome

   # For visible browser:
   HEADLESS=false
   ```

3. **IMPORTANT:** Close all Chrome windows before running automation!

**Benefits:**

- Uses your existing logins
- Full synchronization with your profile

**Drawbacks:**

- Need to close Chrome before running
- May conflict with regular browser usage

### 3. Creating a Separate Chrome Profile

Create a separate profile in Chrome for automation:

1. Open Chrome
2. Click on profile avatar → "Add"
3. Create a profile "LinkedIn Automation"
4. Log into LinkedIn in this profile
5. Find the profile path in `~/Library/Application Support/Google/Chrome/Profile X`
6. Update .env:
   ```env
   CHROME_USER_DATA_DIR=/Users/[your_user]/Library/Application Support/Google/Chrome/Profile X
   ```

## Recommendations

1. **For development (Recommended):** Use a separate Playwright profile (`USER_DATA_DIR=./browser-profile`)
2. **For production:** Use a separate Playwright profile
3. **For testing:** Use temporary profiles

## Quick Start

1. **Make sure a separate profile is configured in .env:**

   ```env
   USER_DATA_DIR=./browser-profile
   USE_EXISTING_PROFILE=true
   HEADLESS=false
   ```

2. **Run profile test:**

   ```bash
   node test-browser-profile.js
   ```

3. **Log into LinkedIn in the opened browser once**

4. **Run the main application:**
   ```bash
   npm run dev
   ```

## Troubleshooting

### LinkedIn Still Sends Notifications

1. Check that the `browser-profile` folder is created and contains files
2. Make sure `USE_EXISTING_PROFILE=true`
3. Log into LinkedIn manually once in the created profile

### Chrome Launch Errors

1. Check Chrome path: `ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
2. Make sure Chrome is closed before running
3. Check profile folder permissions

### Profile Conflicts

1. Use a separate folder for automation
2. Don't run regular Chrome simultaneously with automation
3. Create a separate macOS user profile for automation

## Security

- The `browser-profile` folder is added to `.gitignore`
- Don't commit profile data to the repository
- Use environment variables for profile paths
- Regularly clean temporary profiles