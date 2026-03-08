#!/usr/bin/env node
// ClawOS — Native Messaging Host Installer
// Run: node install.js
// This registers the host with Chrome/Chromium so WebClaw extension can call it.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const EXTENSION_ID = 'YOUR_WEBCLAW_EXTENSION_ID'; // Replace after publishing extension

const hostName = 'ai.webclaw.os_agent';
const hostScript = path.resolve(__dirname, 'index.js');

const manifest = {
  name: hostName,
  description: 'WebClaw OS Agent — on-demand local command bridge',
  path: process.execPath, // path to node
  type: 'stdio',
  allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
};

// Actually call index.js via node
// We need a wrapper shell script so Chrome can execute it directly
const wrapperScript = path.resolve(__dirname, 'webclaw-os');
const wrapperContent = `#!/bin/bash\nexec node "${hostScript}" "$@"\n`;

fs.writeFileSync(wrapperScript, wrapperContent);
fs.chmodSync(wrapperScript, 0o755);

// Update manifest to point to wrapper instead of raw node
manifest.path = wrapperScript;

const manifestJson = JSON.stringify(manifest, null, 2);

let manifestDir;
if (os.platform() === 'darwin') {
  manifestDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
} else if (os.platform() === 'linux') {
  manifestDir = path.join(os.homedir(), '.config/google-chrome/NativeMessagingHosts');
} else {
  console.error('Windows requires a Registry key — see https://developer.chrome.com/docs/extensions/mv3/nativeMessaging');
  process.exit(1);
}

fs.mkdirSync(manifestDir, { recursive: true });
const manifestPath = path.join(manifestDir, `${hostName}.json`);
fs.writeFileSync(manifestPath, manifestJson);

console.log(`✅ ClawOS Native Messaging Host installed!`);
console.log(`   Manifest: ${manifestPath}`);
console.log(`   Host:     ${wrapperScript}`);
console.log(`\n⚠️  Remember to replace EXTENSION_ID in install.js with your actual extension ID.`);
console.log(`   Find it at: chrome://extensions (copy the ID of WebClaw)`);
