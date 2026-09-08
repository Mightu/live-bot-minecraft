const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const Vec3 = require('vec3');

function nearestBlock(bot, names, maxDistance = 48) {
  return bot.findBlock({ matching: b => b && names.includes(b.name), maxDistance, count: 1 });
}
async function goNear(bot, pos, range = 2, timeout = 12000) {
  bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, range));
  await new Promise(resolve => setTimeout(resolve, timeout));
  bot.pathfinder.setGoal(null);
}
async function mine(bot, block) {
  if (!block || !bot.canDigBlock(block)) return false;
  await goNear(bot, block.position, 2, 3000);
  try { await bot.dig(block); return true; } catch { return false; }
}
async function place(bot, itemName, position) {
  const item = bot.inventory.items().find(i => i.name === itemName);
  if (!item) return false;
  const dirs = [new Vec3(0,-1,0), new Vec3(0,1,0), new Vec3(1,0,0), new Vec3(-1,0,0), new Vec3(0,0,1), new Vec3(0,0,-1)];
  for (const d of dirs) {
    const ref = bot.blockAt(position.minus(d));
    if (ref && ref.boundingBox === 'block') {
      try { await bot.equip(item, 'hand'); await bot.placeBlock(ref, d); return true; } catch {}
    }
  }
  return false;
}
module.exports = { nearestBlock, goNear, mine, place };
