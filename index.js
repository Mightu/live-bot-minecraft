'use strict';
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const express = require('express');
const minecraftData = require('minecraft-data');
const config = require('./settings.json');
const SurvivalAI = require('./modules/survival');

const app = express(); app.use(express.json());
const PORT = process.env.PORT || 5000;
let bot = null, ai = null, reconnectTimer = null;
const state = { connected:false, started:false, startTime:Date.now(), lastGoal:'offline', errors:[] };
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); state.lastActivity=Date.now(); }

app.get('/', (req,res)=>res.send(`<h1>${config.name} Survival AI</h1><p>Status: <b>${state.connected?'ONLINE':'OFFLINE'}</b></p><p>Goal: ${state.lastGoal}</p><p><a href='/health'>JSON status</a></p>`));
app.get('/health',(req,res)=>res.json({status:state.connected?'connected':'disconnected', uptime:Math.floor((Date.now()-state.startTime)/1000), coords:bot?.entity?.position||null, goal:ai?.lastGoal||state.lastGoal, errors:state.errors.slice(-5)}));
app.get('/inventory',(req,res)=>res.json(bot?bot.inventory.items().map(i=>({name:i.name,count:i.count})):[]));
app.post('/start',(req,res)=>{ if(!state.started) createBot(); res.json({ok:true}); });
app.post('/stop',(req,res)=>{ state.started=false; ai?.stop(); if(bot) bot.quit('Stopped from dashboard'); res.json({ok:true}); });
app.listen(PORT,()=>log(`Dashboard listening on ${PORT}`));

function createBot() {
  if (bot) return;
  state.started=true;
  bot = mineflayer.createBot({
    host: process.env.MC_HOST || config.server.ip,
    port: Number(process.env.MC_PORT || config.server.port),
    username: process.env.MC_USERNAME || config['bot-account'].username,
    password: process.env.MC_PASSWORD || config['bot-account'].password,
    auth: config['bot-account'].type === 'offline' ? 'offline' : 'microsoft',
    version: config.server.version
  });
  bot.loadPlugin(pathfinder);
  bot.once('spawn',()=>{
    state.connected=true; state.startTime=Date.now();
    const movements = new Movements(bot, minecraftData(bot.version));
    movements.canDig=true; movements.allow1by1towers=false; bot.pathfinder.setMovements(movements);
    ai = new SurvivalAI(bot, config, log); ai.start(); log('Survival AI started');
  });
  bot.on('health',()=>{ if(bot.food<8) log('Low food detected'); });
  bot.on('chat',(username,message)=>{
    if(username===bot.username) return;
    if(config.chat?.respond && /^hi|hello/i.test(message)) bot.chat(`Hello ${username}!`);
  });
  bot.on('error',e=>{ state.errors.push(e.message); log(`Bot error: ${e.message}`); });
  bot.on('kicked',r=>log(`Kicked: ${String(r)}`));
  bot.on('end',()=>{
    log('Disconnected'); state.connected=false; ai?.stop(); ai=null; bot=null;
    if(state.started && config.utils.auto-reconnect) {
      clearTimeout(reconnectTimer); reconnectTimer=setTimeout(createBot, config.utils['auto-reconnect-delay']||5000);
    }
  });
}

if (process.env.AUTO_START !== 'false') createBot();
