const minecraftData = require('minecraft-data');

function itemCount(bot, names) {
  const wanted = Array.isArray(names) ? names : [names];
  return bot.inventory.items().filter(i => wanted.includes(i.name)).reduce((n, i) => n + i.count, 0);
}
function has(bot, names, amount = 1) { return itemCount(bot, names) >= amount; }
function findItem(bot, names) {
  const wanted = Array.isArray(names) ? names : [names];
  return bot.inventory.items().find(i => wanted.includes(i.name));
}
async function equipBest(bot, slot = 'hand') {
  const priorities = ['netherite_sword','diamond_sword','iron_sword','stone_sword','wooden_sword','diamond_pickaxe','iron_pickaxe','stone_pickaxe','wooden_pickaxe'];
  const item = bot.inventory.items().sort((a,b) => priorities.indexOf(a.name) - priorities.indexOf(b.name)).find(i => priorities.includes(i.name));
  if (item) await bot.equip(item, slot).catch(() => {});
}
function mc(bot) { return minecraftData(bot.version); }
module.exports = { itemCount, has, findItem, equipBest, mc };
