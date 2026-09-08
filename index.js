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

let bot = null;
let ai = null;
let reconnectTimer = null;

const state = {
connected: false,
started: false,
startTime: Date.now(),
lastGoal: 'offline',
errors: [],
reconnectAttempts: 0
};

function log(message) {
console.log('[' + new Date().toISOString() + '] ' + message);
}

// Dashboard
app.get('/', (req, res) => {
const status = state.connected ? 'ONLINE' : 'OFFLINE';

res.send(
'<h1>' + (config.name || 'Minecraft') + ' Survival AI</h1>' +
'<p>Status: <b>' + status + '</b></p>' +
'<p>Goal: ' + (ai?.lastGoal || state.lastGoal) + '</p>' +
'<p><a href="/health">Health</a></p>' +
'<p><a href="/inventory">Inventory</a></p>'
);
});

app.get('/health', (req, res) => {
res.json({
status: state.connected ? 'connected' : 'disconnected',
started: state.started,
uptime: Math.floor((Date.now() - state.startTime) / 1000),
coords: bot && bot.entity ? bot.entity.position : null,
goal: ai ? ai.lastGoal : state.lastGoal,
reconnectAttempts: state.reconnectAttempts,
errors: state.errors.slice(-5)
});
});

app.get('/inventory', (req, res) => {
if (!bot) {
return res.json([]);
}

res.json(
bot.inventory.items().map(item => ({
name: item.name,
count: item.count
}))
);
});

app.post('/start', (req, res) => {
if (!state.started) {
state.started = true;
createBot();
}

res.json({
ok: true,
message: 'Bot started'
});
});

app.post('/stop', (req, res) => {
state.started = false;

if (reconnectTimer) {
clearTimeout(reconnectTimer);
reconnectTimer = null;
}

if (ai) {
try {
ai.stop();
} catch (error) {
log('Error stopping AI: ' + error.message);
}

```
ai = null;
```

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
log('Dashboard listening on ' + PORT);
});

function scheduleReconnect() {
if (!state.started) {
return;
}

if (reconnectTimer) {
return;
}

state.reconnectAttempts++;

const baseDelay = Number(
process.env.RECONNECT_DELAY ||
(config.utils && config.utils['auto-reconnect-delay']) ||
60000
);

const delay = Math.min(
baseDelay * Math.pow(2, state.reconnectAttempts - 1),
300000
);

log(
'Reconnect attempt ' +
state.reconnectAttempts +
' scheduled in ' +
Math.round(delay / 1000) +
' seconds'
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

function createBot() {
if (bot) {
log('Bot already exists');
return;
}

state.started = true;

const host =
process.env.MC_HOST ||
config.server.ip;

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
(
config['bot-account'].type === 'offline'
? 'offline'
: 'microsoft'
);

const version =
process.env.MC_VERSION ||
config.server.version ||
false;

log(
'Connecting to ' +
host +
':' +
port +
' as ' +
username
);

try {
bot = mineflayer.createBot({
host: host,
port: port,
username: username,
password: password,
auth: auth,
version: version
});


bot.loadPlugin(pathfinder);

bot.once('spawn', () => {
  state.connected = true;
  state.startTime = Date.now();
  state.reconnectAttempts = 0;

  log('Successfully joined the Minecraft server');

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

    log('Survival AI started');
  } catch (error) {
    state.errors.push(error.message);
    log('Survival AI error: ' + error.message);
  }
});

bot.on('health', () => {
  if (bot && bot.food < 8) {
    log('Low food detected');
  }
});

bot.on('chat', (username, message) => {
  if (!bot || username === bot.username) {
    return;
  }

  if (
    config.chat &&
    config.chat.respond &&
    /^(hi|hello|hey)\b/i.test(message)
  ) {
    bot.chat('Hello ' + username + '!');
  }
});

bot.on('error', error => {
  const message =
    error && error.message
      ? error.message
      : String(error);

  state.errors.push(message);
  state.errors = state.errors.slice(-10);

  log('Bot error: ' + message);
});

bot.on('kicked', reason => {
  let message;

  try {
    message =
      typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);
  } catch (error) {
    message = String(reason);
  }

  log('Kicked: ' + message);

  if (
    message.toLowerCase().includes('banned') ||
    message.toLowerCase().includes('ban')
  ) {
    log('Bot is banned. Automatic reconnection disabled.');

    state.started = false;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
});

bot.once('end', () => {
  log('Disconnected');

  state.connected = false;

  if (ai) {
    try {
      ai.stop();
    } catch (error) {
      log('AI stop error: ' + error.message);
    }

    ai = null;
  }

  bot = null;

  const autoReconnect =
    config.utils &&
    (
      config.utils['auto-reconnect'] === true ||
      config.utils.autoReconnect === true
    );

  if (state.started && autoReconnect) {
    scheduleReconnect();
  } else {
    log('Automatic reconnection disabled');
  }
});


} catch (error) {
const message =
error && error.message
? error.message
: String(error);


state.errors.push(message);
state.errors = state.errors.slice(-10);

log('Failed to create bot: ' + message);

bot = null;

if (state.started) {
  scheduleReconnect();
}


}
}

if (process.env.AUTO_START !== 'false') {
createBot();
}
