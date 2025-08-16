// Simple test script to verify API endpoints work
const http = require('http');

async function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');

  const endpoints = [
    { path: '/api/health', method: 'GET', name: 'Health Check' },
    {
      path: '/api/automation/status',
      method: 'GET',
      name: 'Automation Status',
    },
    {
      path: '/api/automation/config',
      method: 'GET',
      name: 'Configuration Info',
    },
    {
      path: '/api/automation/config/validate',
      method: 'GET',
      name: 'Configuration Validation',
    },
    {
      path: '/api/automation/metrics',
      method: 'GET',
      name: 'Automation Metrics',
    },
    { path: '/api/automation/logs', method: 'GET', name: 'Automation Logs' },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(
        `Testing ${endpoint.name} (${endpoint.method} ${endpoint.path})...`
      );
      const result = await testEndpoint(endpoint.path, endpoint.method);
      console.log(`✓ Status: ${result.status}`);
      console.log(`✓ Response: ${JSON.stringify(result.data, null, 2)}\n`);
    } catch (error) {
      console.log(`✗ Error: ${error.message}\n`);
    }
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };
