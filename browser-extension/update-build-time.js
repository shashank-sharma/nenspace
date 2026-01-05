#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get current timestamp
const now = new Date();
const buildTimestamp = now.toISOString();
const buildDate = now.toLocaleDateString();
const buildTime = now.toLocaleTimeString();

// Path to the build-info.ts file
const buildInfoPath = path.join(__dirname, 'src/lib/config/build-info.ts');

// Read the current file
let content = fs.readFileSync(buildInfoPath, 'utf8');

// Replace the timestamp values
content = content.replace(
  /buildTimestamp: '[^']*'/,
  `buildTimestamp: '${buildTimestamp}'`
);

content = content.replace(
  /buildDate: '[^']*'/,
  `buildDate: '${buildDate}'`
);

content = content.replace(
  /buildTime: '[^']*'/,
  `buildTime: '${buildTime}'`
);

// Write the updated file
fs.writeFileSync(buildInfoPath, content);

console.log('✅ Build timestamp updated:', {
  timestamp: buildTimestamp,
  date: buildDate,
  time: buildTime
});
