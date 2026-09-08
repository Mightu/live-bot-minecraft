'use strict';

const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const express = require('express');
const minecraftData = require('minecraft-data');
const config = require('./settings.json');
const SurvivalAI = require('./modules/survival');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Reconnection settings
const RECONNECT_DELAY = Math.max(
Number(process.env.RECONNECT_DELAY || config.utils?.['auto-reconnect-delay'] || 30000),
10000
);

let bot = null;
let ai = null;
let reconnectTimer = null;

const state = {
connected: false,
started: false,
startTime: Date.now(),
lastGoal: 'offline',
errors: [],
reconnectAttempts: 0,
lastActivity: Date.now()
};

function log(msg) {
console.log(`[${new Date().toISOString()}] ${msg}`);
state.lastActivity = Date.now();
}

// --------------------
// Railway Dashboard
// --------------------

app.get('/', (req, res) => {
res.send(`     <h1>${config.name || 'Minecraft'} Survival AI</h1>     <p>Status: <b>${state.connected ? 'ONLINE' : 'OFFLINE'}</b></p>     <p>Goal: ${ai?.lastGoal || state.lastGoal}</p>     <p>Reconnect attempts: ${state.reconnectAttempts}</p>     <p><a href="/health">JSON Status</a></p>     <p><a href="/inventory">Inventory</a></p>
  `);
});

app.get('/health', (req, res) => {
res.json({
status: state.connected ? 'connected' : 'disconnected',
started: state.started,
uptime: Math.floor((Date.now() - state.startTime) / 1000),
coords: bot?.entity?.position || null,
goal: ai?.lastGoal || state.lastGoal,
reconnectAttempts: state.reconnectAttempts,
errors: state.errors.slice(-5)
});
});

app.get('/inventory', (req, res) => {
res.json(
bot
? bot.inventory.items().map(i => ({
name: i.name,
count: i.count
}))
: []
);
});

app.post('/start', (req, res) => {
if (!state.started) {
createBot();
}

res.json({
ok: true,
message: 'Bot start requested'
});
});

app.post('/stop', (req, res) => {
log('Stopping bot from dashboard...');

state.started = false;

clearTimeout(reconnectTimer);
reconnectTimer = null;

if (ai) {
ai.stop();
ai = null;
}

if (bot) {
bot.quit('Stopped from dashboard');
}

res.json({
ok: true,
message: 'Bot stopped'
});
});

app.listen(PORT, () => {
log(`Dashboard listening on ${PORT}`);
});

// --------------------
// Reconnection System
// --------------------

function scheduleReconnect() {
// Do not reconnect if manually stopped
if (!state.started) {
log('Bot is stopped. Reconnection cancelled.');
return;
}

// Prevent multiple reconnect timers
if (reconnectTimer) {
log('Reconnect already scheduled.');
return;
}

state.reconnectAttempts++;

// Exponential backoff to prevent server throttling
const delay = Math.min(
RECONNECT_DELAY * Math.pow(2, state.reconnectAttempts - 1),
300000
);

log(
`Reconnect attempt ${state.reconnectAttempts} scheduled in ${Math.round(
      delay / 1000
    )} seconds...`
);

reconnectTimer = setTimeout(() => {
reconnectTimer = null;

```
if (state.started && !bot) {
  createBot();
}
```

}, delay);
}

// --------------------
// Minecraft Bot
// --------------------

function createBot() {
// Prevent duplicate bots
if (bot) {
log('Bot already exists. Connection request ignored.');
return;
}

// Prevent connection attempts while manually stopped
if (!state.started) {
state.started = true;
}

const host = process.env.MC_HOST || config.server.ip;

const port = Number(
process.env.MC_PORT ||
config.server.port ||
25565
);

const username =
process.env.MC_USERNAME ||
config['bot-account'].username;

const password =
process.env.MC_PASSWORD ||
config['bot-account'].password;

const auth =
process.env.MC_AUTH ||
(config['bot-account'].type === 'offline'
? 'offline'
: 'microsoft');

const version =
process.env.MC_VERSION ||
config.server.version ||
false;

log(
`Connecting to ${host}:${port} as ${username}...`
);

try {
bot = mineflayer.createBot({
host,
port,
username,
password,
auth,
version
});

```
bot.loadPlugin(pathfinder);

bot.once('spawn', () => {
  state.connected = true;
  state.startTime = Date.now();
  state.reconnectAttempts = 0;

  log('Successfully joined the Minecraft server.');

  const movements = new Movements(
    bot,
    minecraftData(bot.version)
  );

  movements.canDig = true;
  movements.allow1by1towers = false;

  bot.pathfinder.setMovements(movements);

  try {
    ai = new SurvivalAI(bot, config, log);
    ai.start();

    log('Survival AI started.');
  } catch (error) {
    state.errors.push(error.message);
    log(`Survival AI error: ${error.message}`);
  }
});

bot.on('health', () => {
  if (bot && bot.food < 8) {
    log('Low food detected.');
  }
});

bot.on('chat', (username, message) => {
  if (!bot || username === bot.username) {
    return;
  }

  if (
    config.chat?.respond &&
    /^(hi|hello|hey)\b/i.test(message)
  ) {
    bot.chat(`Hello ${username}!`);
  }
});

bot.on('error', error => {
  const message = error?.message || String(error);

  state.errors.push(message);
  state.errors = state.errors.slice(-10);

  log(`Bot error: ${message}`);
});

bot.on('kicked', reason => {
  let message;

  try {
    message =
      typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);
  } catch {
    message = String(reason);
  }

  log(`Kicked: ${message}`);

  // Detect bans and avoid rapid reconnecting
  if (
    message.toLowerCase().includes('banned') ||
    message.toLowerCase().includes('ban')
  ) {
    log(
      'Bot appears to be banned. Automatic reconnection will be disabled.'
    );

    state.started = false;

    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
});

bot.once('end', () => {
  log('Disconnected from Minecraft server.');

  state.connected = false;

  if (ai) {
    try {
      ai.stop();
    } catch (error) {
      log(`AI stop error: ${error.message}`);
    }

    ai = null;
  }

  bot = null;

  const autoReconnect =
    config.utils?.['auto-reconnect'] === true ||
    config.utils?.autoReconnect === true;

  if (state.started && autoReconnect) {
    scheduleReconnect();
  } else {
    log('Automatic reconnection disabled.');
  }
});
```

} catch (error) {
const message = error?.message || String(error);

```
state.errors.push(message);
state.errors = state.errors.slice(-10);

log(`Failed to create bot: ${message}`);

bot = null;

if (state.started) {
  scheduleReconnect();
}
```

}
}

// --------------------
// Auto Start
// --------------------

if (process.env.AUTO_START !== 'false') {
createBot();
}
