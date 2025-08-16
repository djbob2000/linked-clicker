# LinkedIn Connection Automation - Deployment Guide

## Production Build Configuration

### Prerequisites

1. **Node.js**: Version 18.x or higher
2. **npm/yarn**: Latest version
3. **Environment Variables**: All required variables configured
4. **Playwright**: Browser dependencies installed

### Environment Variables

Create a `.env.production` file with the following variables:

```bash
# LinkedIn Credentials (Required)
LINKEDIN_USERNAME=your.email@example.com
LINKEDIN_PASSWORD=your_secure_password

# Connection Settings
MIN_MUTUAL_CONNECTIONS=5
MAX_CONNECTIONS=100

# Browser Settings
HEADLESS=true
TIMEOUT=30000

# Next.js Environment
NODE_ENV=production
```

### Build Process

1. **Install Dependencies**

   ```bash
   npm ci --production=false
   ```

2. **Install Playwright Browsers**

   ```bash
   npx playwright install chromium
   ```

3. **Run Tests** (Optional but recommended)

   ```bash
   npm test
   ```

4. **Build Application**

   ```bash
   npm run build
   ```

5. **Start Production Server**
   ```bash
   npm start
   ```

### Docker Deployment

Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:18-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use installed Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose

Create a `docker-compose.yml` for easy deployment:

```yaml
version: '3.8'

services:
  linkedin-automation:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - LINKEDIN_USERNAME=${LINKEDIN_USERNAME}
      - LINKEDIN_PASSWORD=${LINKEDIN_PASSWORD}
      - MIN_MUTUAL_CONNECTIONS=${MIN_MUTUAL_CONNECTIONS:-5}
      - MAX_CONNECTIONS=${MAX_CONNECTIONS:-100}
      - HEADLESS=true
      - TIMEOUT=30000
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Cloud Deployment Options

#### 1. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Note**: Vercel has limitations with Playwright. Consider using serverless functions or external automation services.

#### 2. Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

#### 3. DigitalOcean App Platform

Create `app.yaml`:

```yaml
name: linkedin-automation
services:
  - name: web
    source_dir: /
    github:
      repo: your-username/linkedin-automation
      branch: main
    run_command: npm start
    build_command: npm run build
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
    envs:
      - key: NODE_ENV
        value: production
      - key: LINKEDIN_USERNAME
        value: ${LINKEDIN_USERNAME}
      - key: LINKEDIN_PASSWORD
        value: ${LINKEDIN_PASSWORD}
      - key: MIN_MUTUAL_CONNECTIONS
        value: '5'
      - key: MAX_CONNECTIONS
        value: '100'
      - key: HEADLESS
        value: 'true'
      - key: TIMEOUT
        value: '30000'
```

### Production Monitoring

#### Health Checks

The application includes a health check endpoint at `/api/health` that verifies:

- Configuration validity
- Service initialization
- Environment variables
- Node.js version compatibility

#### Logging

Production logs are structured and include:

- Timestamp
- Log level (INFO, WARN, ERROR)
- Action details
- Error stack traces

#### Metrics

Access automation metrics at `/api/automation/metrics`:

- Success rate
- Connection counts
- Performance timing
- Progress percentage

### Security Considerations

1. **Environment Variables**: Never commit credentials to version control
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Access Control**: Restrict access to automation endpoints
5. **Browser Security**: Run browser in sandboxed environment

### Troubleshooting

#### Common Issues

1. **Playwright Browser Not Found**

   ```bash
   npx playwright install chromium
   ```

2. **Permission Denied**

   ```bash
   chmod +x node_modules/.bin/playwright
   ```

3. **Memory Issues**

   - Increase container memory limits
   - Monitor browser memory usage
   - Implement connection limits

4. **LinkedIn Rate Limiting**
   - Reduce connection frequency
   - Implement exponential backoff
   - Monitor for CAPTCHA challenges

#### Logs Analysis

Check application logs for:

```bash
# View recent logs
docker logs linkedin-automation --tail 100

# Follow logs in real-time
docker logs linkedin-automation --follow

# Filter error logs
docker logs linkedin-automation 2>&1 | grep ERROR
```

### Backup and Recovery

1. **Configuration Backup**: Store environment variables securely
2. **Log Retention**: Configure log rotation and retention
3. **State Recovery**: Implement automation state persistence
4. **Graceful Shutdown**: Handle process termination signals

### Performance Optimization

1. **Browser Settings**: Optimize Playwright configuration
2. **Memory Management**: Monitor and limit memory usage
3. **Connection Pooling**: Reuse browser instances when possible
4. **Caching**: Implement appropriate caching strategies

### Maintenance

1. **Regular Updates**: Keep dependencies updated
2. **Security Patches**: Apply security updates promptly
3. **Monitoring**: Set up alerts for failures
4. **Backup Testing**: Regularly test backup and recovery procedures
