#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get build timestamp
const buildTimestamp = new Date().toISOString();
const buildDate = new Date().toLocaleDateString();
const buildTime = new Date().toLocaleTimeString();

// Path to the build-info.ts file
const buildInfoPath = path.join(__dirname, '../src/lib/config/build-info.ts');

// Read the current file
let content = fs.readFileSync(buildInfoPath, 'utf8');

// Replace the placeholder values with actual build information
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

console.log('✅ Build info injected:', {
  timestamp: buildTimestamp,
  date: buildDate,
  time: buildTime
});
