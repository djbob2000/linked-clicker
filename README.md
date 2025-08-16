# LinkedIn Connection Automation

An automated LinkedIn connection system that logs into LinkedIn, navigates to the network growth section, and selectively connects with people based on mutual connection count thresholds. Built with Next.js 14 and Playwright for reliable browser automation.

## Features

- 🤖 **Automated LinkedIn Login**: Secure credential-based authentication
- 🎯 **Smart Connection Filtering**: Connect only with users meeting mutual connection thresholds
- 📊 **Real-time Monitoring**: Web dashboard with live status updates and progress tracking
- 🛡️ **Error Handling**: Comprehensive error recovery and retry mechanisms
- 📝 **Detailed Logging**: Structured logging with multiple levels and real-time display
- ⚙️ **Configurable Settings**: Environment-based configuration for all parameters
- 🏥 **Health Monitoring**: Built-in health checks and application status monitoring
- 🔒 **Production Ready**: Proper dependency injection, graceful shutdown, and security headers

## Configuration

The application uses environment variables for configuration. Copy the `.env.example` file to `.env` and adjust the values as needed:

```bash
cp .env.example .env
```

### Available Configuration Options

- `LINKEDIN_USERNAME`: Your LinkedIn email address (required)
- `LINKEDIN_PASSWORD`: Your LinkedIn password (required)
- `MIN_MUTUAL_CONNECTIONS`: Minimum mutual connections required to connect with a user (default: 100)
- `MAX_CONNECTIONS`: Maximum number of connections to make in a session (default: 150)
- `HEADLESS`: Set to "false" to run browser in visible mode for debugging (default: true)
- `TIMEOUT`: Timeout for browser operations in milliseconds (default: 30000)
- `USER_DATA_DIR`: Path to browser profile directory (default: ./browser-profile)
- `USE_EXISTING_PROFILE`: Set to "true" to use existing browser profile (default: false)
- `CHROME_EXECUTABLE_PATH`: Path to Chrome executable (optional, for custom Chrome installation)
- `CHROME_USER_DATA_DIR`: Path to Chrome user data directory (optional)
- `CONNECTION_DELAY_MS`: Delay between connection attempts in milliseconds (default: 5000)

## Architecture

The application follows a modular, service-oriented architecture:

- **Web Interface**: Next.js 14 with App Router for modern React patterns
- **Browser Automation**: Playwright for reliable LinkedIn interaction
- **Dependency Injection**: Centralized service management and initialization
- **Configuration Management**: Environment-based settings with validation
- **Logging System**: Structured logging with multiple output formats
- **Health Monitoring**: Comprehensive application health checks

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- LinkedIn account credentials

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd linkedin-automation
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install Playwright browsers**

   ```bash
   npx playwright install chromium
   ```

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your LinkedIn credentials:

   ```bash
   LINKEDIN_USERNAME=your.email@example.com
   LINKEDIN_PASSWORD=your_secure_password
   MIN_MUTUAL_CONNECTIONS=5
   MAX_CONNECTIONS=100
   ```

5. **Setup browser profile (to avoid LinkedIn notifications)**

   ```bash
   npm run test-browser
   ```

   This creates a separate browser profile to avoid interfering with your main browser and to avoid LinkedIn notifications about new devices.

   📖 **Detailed instructions**: See [BROWSER_SETUP.md](./BROWSER_SETUP.md)

6. **Run the application**

   ```bash
   npm run dev
   ```

7. **Open the dashboard**

   Navigate to [http://localhost:3000](http://localhost:3000) to access the automation dashboard.

## Configuration

### Environment Variables

| Variable                 | Description                         | Default           | Required |
| ------------------------ | ----------------------------------- | ----------------- | -------- |
| `LINKEDIN_USERNAME`      | Your LinkedIn email/username        | -                 | ✅       |
| `LINKEDIN_PASSWORD`      | Your LinkedIn password              | -                 | ✅       |
| `MIN_MUTUAL_CONNECTIONS` | Minimum mutual connections required | 0                 | ❌       |
| `MAX_CONNECTIONS`        | Maximum connections per run         | 100               | ❌       |
| `HEADLESS`               | Run browser in headless mode        | true              | ❌       |
| `TIMEOUT`                | Browser operation timeout (ms)      | 30000             | ❌       |
| `USER_DATA_DIR`          | Browser profile directory           | ./browser-profile | ❌       |
| `USE_EXISTING_PROFILE`   | Use persistent browser profile      | true              | ❌       |

### Validation

Validate your configuration:

```bash
npm run validate-config
```

## Usage

### Web Dashboard

1. Start the application: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Click "Start Automation" to begin the process
4. Monitor progress in real-time through the dashboard
5. View detailed logs and metrics

### API Endpoints

- `GET /api/health` - Application health check
- `GET /api/automation/status` - Current automation status
- `POST /api/automation/start` - Start automation
- `POST /api/automation/stop` - Stop automation
- `GET /api/automation/config` - Get configuration (non-sensitive)
- `GET /api/automation/config/validate` - Validate configuration
- `GET /api/automation/logs` - Get application logs
- `GET /api/automation/metrics` - Get automation metrics

### Health Check

Check application health:

```bash
curl http://localhost:3000/api/health
```

## Development

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── automation-dashboard.tsx
│   ├── automation-page.tsx
│   └── log-display.tsx
├── lib/                   # Utility functions
│   ├── application-startup.ts
│   ├── dependency-injection.ts
│   ├── data-validation.ts
│   ├── error-handling.ts
│   └── linkedin-parser.ts
├── services/              # Core business logic
│   ├── automation-controller.ts
│   ├── browser-service.ts
│   ├── configuration.ts
│   ├── connection-handler.ts
│   ├── login-handler.ts
│   ├── navigation-handler.ts
│   └── logging-service.ts
└── types/                 # TypeScript interfaces
    ├── automation-status.ts
    ├── configuration.ts
    ├── connection.ts
    └── logging.ts
```

### Testing

Run the test suite:

```bash
# All tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# CI mode with coverage
npm run test:ci
```

### Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run test:watch       # Run tests in watch mode
npm run health-check     # Check application health
npm run setup-chrome     # Setup Chrome profile for automation
```

## Production Deployment

### Build Process

```bash
# Production build with all checks
npm run production:build

# Start production server
npm run production:start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t linkedin-automation .

# Run container
docker run -p 3000:3000 --env-file .env linkedin-automation
```

### Environment Setup

1. Create `.env.production` with production values
2. Ensure all required environment variables are set
3. Install Playwright browsers: `npx playwright install chromium`
4. Run health checks: `npm run health-check`

See [deployment.md](./deployment.md) for detailed deployment instructions.

## Security Considerations

- **Credentials**: Never commit LinkedIn credentials to version control
- **Rate Limiting**: Respect LinkedIn's usage policies and implement appropriate delays
- **Browser Security**: Application runs browser in sandboxed environment
- **HTTPS**: Always use HTTPS in production environments
- **Access Control**: Implement proper authentication for production deployments

## Recent Updates

### v1.1.0 - Browser Stability & Connection Delays

- ✅ **Fixed chrome-extension errors**: Added browser flags to disable extensions and prevent `chrome-extension://invalid/` errors
- ✅ **Added 5-second delay**: Implemented 5-second pause between Connect button clicks to avoid rate limiting
- ✅ **Improved error filtering**: Browser console now filters out irrelevant chrome-extension error messages
- ✅ **Enhanced navigation**: Added better logging and verification for LinkedIn page navigation
- ✅ **Stability improvements**: Better error handling and retry logic for browser operations

## Troubleshooting

### Common Issues

1. **Chrome Extension Errors (FIXED)**

   The application now automatically disables browser extensions to prevent `chrome-extension://invalid/` errors. No action needed.

2. **Playwright Browser Not Found**

   ```bash
   npx playwright install chromium
   ```

3. **Configuration Validation Failed**

   ```bash
   npm run validate-config
   ```

4. **LinkedIn Login Issues**

   - Verify credentials in `.env` file
   - Check for CAPTCHA challenges
   - Ensure account is not restricted

5. **Connection Rate Limiting**

   The application now includes a 5-second delay between connection attempts to prevent LinkedIn rate limiting.

6. **Memory Issues**
   - Monitor browser memory usage
   - Implement connection limits
   - Use headless mode in production

### Logs and Monitoring

- View real-time logs in the web dashboard
- Access structured logs via `/api/automation/logs`
- Monitor application health at `/api/health`
- Check automation metrics at `/api/automation/metrics`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and personal use only. Users are responsible for complying with LinkedIn's Terms of Service and applicable laws. The authors are not responsible for any misuse of this software or any consequences resulting from its use.

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review the [deployment guide](./deployment.md)
3. Open an issue on GitHub
4. Check application logs and health status
