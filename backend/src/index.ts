import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

export interface PendingMessage {
  id: string;
  channel: 'telegram' | 'discord';
  chatId: string | number;
  text: string;
  timestamp: number;
}

const queue: PendingMessage[] = [];
const clients: express.Response[] = [];

// Broadcast a new message to all connected SSE clients (browsers)
function broadcast(msg: PendingMessage) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(msg)}\n\n`);
  });
}

// ── TELEGRAM BOT ────────────────────────────────────────────────────────────
let bot: Telegraf | null = null;
if (TELEGRAM_TOKEN) {
  bot = new Telegraf(TELEGRAM_TOKEN);
  
  bot.on('text', (ctx) => {
    console.log(`[Telegram] Received generic text from ${ctx.chat.id}: ${ctx.message.text}`);
    const msg: PendingMessage = {
      id: Math.random().toString(36).substring(7),
      channel: 'telegram',
      chatId: ctx.chat.id,
      text: ctx.message.text,
      timestamp: Date.now()
    };
    
    // If no browsers are connected, queue it. Otherwise send immediately.
    if (clients.length === 0) {
      queue.push(msg);
      console.log(`[Queue] Saved message ${msg.id} (No active WebClaw browsers)`);
    } else {
      broadcast(msg);
      console.log(`[Queue] Broadcasted message ${msg.id} to ${clients.length} browsers`);
    }
  });

  bot.launch()
    .then(() => console.log('Telegram bot active. Listening for messages...'))
    .catch(err => console.error('Telegram bot failed to start:', err));

  // Enable graceful stop
  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
} else {
  console.log('No TELEGRAM_TOKEN found. Telegram integration disabled.');
}

// ── EXPRESS API ROUTES ──────────────────────────────────────────────────────

// SSE endpoint for WebClaw frontend to connect to
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  clients.push(res);
  console.log(`[SSE] Browser connected. Total active connections: ${clients.length}`);
  
  // Flush any pending messages that arrived while browser was closed
  while (queue.length > 0) {
    const msg = queue.shift();
    if (msg) res.write(`data: ${JSON.stringify(msg)}\n\n`);
  }

  req.on('close', () => {
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
    console.log(`[SSE] Browser disconnected. Total active connections: ${clients.length}`);
  });
});

// Endpoint for WebClaw frontend to send the finalized LLM response back
app.post('/api/reply', async (req, res) => {
  const { channel, chatId, text } = req.body;
  
  console.log(`[Reply] Sending message to ${channel} chat ${chatId}`);

  if (channel === 'telegram' && bot) {
    try {
      await bot.telegram.sendMessage(chatId, text);
      res.json({ success: true });
    } catch (err) {
      console.error('[Reply] Error sending Telegram message:', err);
      res.status(500).json({ error: String(err) });
    }
  } else {
    res.status(400).json({ error: 'Channel not configured or unknown' });
  }
});

// Basic healthcheck
app.get('/health', (req, res) => res.send('WebClaw Backend OK'));

app.listen(PORT, () => {
  console.log(`WebClaw thin backend running on http://localhost:${PORT}`);
});
