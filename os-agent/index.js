#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════╗
// ║   ClawOS — WebClaw Native Messaging Host                     ║
// ║   On-demand OS bridge. NOT a daemon — wakes up per session.  ║
// ║   Install: node install.js                                   ║
// ║   Run with: webclaw-os [--yolo]                              ║
// ╚══════════════════════════════════════════════════════════════╝

const { execSync, exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const YOLO_MODE = process.argv.includes('--yolo');

if (YOLO_MODE) {
  process.stderr.write('[ClawOS] 🔥 YOLO MODE — commands execute without approval!\n');
} else {
  process.stderr.write('[ClawOS] 🛡 SAFE MODE — each command requires your approval.\n');
}

// ── Native Messaging Protocol ────────────────────────────────────────────────
// Chrome sends messages as: [4 bytes length (LE uint32)] + [JSON string]

function readNativeMessage(callback) {
  let lengthBuf = Buffer.alloc(0);
  process.stdin.on('data', (chunk) => {
    lengthBuf = Buffer.concat([lengthBuf, chunk]);
    if (lengthBuf.length < 4) return;

    const msgLength = lengthBuf.readUInt32LE(0);
    if (lengthBuf.length < 4 + msgLength) return;

    const msgJson = lengthBuf.slice(4, 4 + msgLength).toString('utf-8');
    lengthBuf = lengthBuf.slice(4 + msgLength); // consume
    try {
      callback(JSON.parse(msgJson));
    } catch (e) {
      sendNativeMessage({ success: false, error: 'JSON parse error' });
    }
  });
}

function sendNativeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf  = Buffer.from(json, 'utf-8');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32LE(buf.length, 0);
  process.stdout.write(lengthBuf);
  process.stdout.write(buf);
}

// ── Approval Gate ────────────────────────────────────────────────────────────
async function askApproval(label, commandStr) {
  if (YOLO_MODE) return true;

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(
      `\n[ClawOS] WebClaw wants to: ${label}\n  » ${commandStr}\n  Allow? [y/N] `,
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      }
    );
  });
}

// ── Command Handlers ─────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const { id, type } = msg;

  if (type === 'PING') {
    sendNativeMessage({ id, success: true, result: 'pong', yolo: YOLO_MODE });
    return;
  }

  if (type === 'OS_RUN') {
    const { command, cwd } = msg;
    const approved = await askApproval('Run Shell Command', command);
    if (!approved) {
      sendNativeMessage({ id, success: false, error: 'User denied execution.' });
      return;
    }
    try {
      const output = execSync(command, { cwd: cwd ?? process.env.HOME, timeout: 30000, encoding: 'utf-8' });
      sendNativeMessage({ id, success: true, result: output.slice(0, 8192) });
    } catch (err) {
      sendNativeMessage({ id, success: false, error: err.message.slice(0, 2048) });
    }
    return;
  }

  if (type === 'OS_READ') {
    const { filePath } = msg;
    const resolved = path.resolve(filePath);
    const approved = await askApproval('Read File', resolved);
    if (!approved) {
      sendNativeMessage({ id, success: false, error: 'User denied.' });
      return;
    }
    try {
      const content = fs.readFileSync(resolved, 'utf-8');
      sendNativeMessage({ id, success: true, result: content.slice(0, 32768) });
    } catch (err) {
      sendNativeMessage({ id, success: false, error: err.message });
    }
    return;
  }

  if (type === 'OS_WRITE') {
    const { filePath, content } = msg;
    const resolved = path.resolve(filePath);
    const approved = await askApproval(`Write File (${content.length} chars)`, resolved);
    if (!approved) {
      sendNativeMessage({ id, success: false, error: 'User denied.' });
      return;
    }
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf-8');
      sendNativeMessage({ id, success: true, result: `Written ${content.length} chars to ${resolved}` });
    } catch (err) {
      sendNativeMessage({ id, success: false, error: err.message });
    }
    return;
  }

  sendNativeMessage({ id, success: false, error: `Unknown message type: ${type}` });
}

// ── Start ────────────────────────────────────────────────────────────────────
readNativeMessage(handleMessage);
process.stderr.write('[ClawOS] Listening for messages from WebClaw...\n');
