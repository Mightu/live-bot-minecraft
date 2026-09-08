const { nearestBlock, mine, goNear, place } = require('./world');
const inv = require('./inventory');

const HOSTILES = new Set(['zombie','skeleton','creeper','spider','drowned','enderman','witch','husk','phantom']);
class SurvivalAI {
  constructor(bot, config, log) {
    this.bot = bot; this.config = config; this.log = log;
    this.running = false; this.busy = false; this.home = null; this.lastGoal = 'idle';
  }
  start() { if (this.running) return; this.running = true; this.loop(); }
  stop() { this.running = false; this.bot.pathfinder.setGoal(null); }
  async loop() {
    while (this.running) {
      if (this.busy || !this.bot.entity) { await this.wait(1000); continue; }
      this.busy = true;
      try { await this.tick(); } catch (e) { this.log(`AI error: ${e.message}`); }
      this.busy = false;
      await this.wait(this.config.survival?.decisionInterval || 2000);
    }
  }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  setGoal(goal) { if (this.lastGoal !== goal) { this.lastGoal = goal; this.log(`AI goal → ${goal}`); } }
  hostileNearby() { return this.bot.nearestEntity(e => e.type === 'mob' && HOSTILES.has(e.name) && e.position.distanceTo(this.bot.entity.position) < 10); }
  async tick() {
    const hostile = this.hostileNearby();
    if (hostile) return this.fight(hostile);
    if (this.bot.food < 14) return this.findFood();
    if (!inv.has(this.bot, ['iron_sword','stone_sword','wooden_sword','diamond_sword'])) return this.collectWood();
    if (!inv.has(this.bot, ['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe'])) return this.makeStarterTools();
    if (inv.itemCount(this.bot, 'cobblestone') < 24) return this.collectStone();
    if (inv.itemCount(this.bot, 'iron_ingot') < 12 && inv.itemCount(this.bot, 'raw_iron') < 12) return this.collectIron();
    if (!this.home) return this.buildHome();
    return this.explore();
  }
  async collectWood() {
    this.setGoal('collecting wood');
    const b = nearestBlock(this.bot, ['oak_log','birch_log','spruce_log','jungle_log','acacia_log','dark_oak_log'], 64);
    if (b) { for (let i=0;i<6 && b;i++) { const x = nearestBlock(this.bot, [b.name], 32); if (!x || !(await mine(this.bot,x))) break; } }
    else await this.explore();
  }
  async makeStarterTools() {
    this.setGoal('crafting starter tools');
    await this.craft('crafting_table', 1);
    await this.craft('stick', 8);
    await this.craft('wooden_pickaxe', 1);
    await this.craft('wooden_sword', 1);
  }
  async craft(name, amount=1) {
    const id = inv.mc(this.bot).itemsByName[name]?.id; if (id == null || inv.has(this.bot,name,amount)) return;
    const recipe = this.bot.recipesFor(id, null, 1, null)[0];
    if (!recipe) return;
    try { await this.bot.craft(recipe, amount, null); } catch {}
  }
  async collectStone() {
    this.setGoal('mining stone');
    for (let i=0;i<8;i++) { const b = nearestBlock(this.bot,['stone','cobblestone'],32); if (!b || !(await mine(this.bot,b))) break; }
    await this.craft('stone_pickaxe'); await this.craft('stone_sword');
  }
  async collectIron() {
    this.setGoal('mining iron');
    const b = nearestBlock(this.bot,['iron_ore','deepslate_iron_ore'],48);
    if (b) await mine(this.bot,b); else await this.explore();
  }
  async findFood() {
    this.setGoal('finding food');
    const food = inv.findItem(this.bot,['cooked_beef','cooked_porkchop','bread','baked_potato','beef','porkchop','apple','carrot']);
    if (food) { try { await this.bot.equip(food,'hand'); await this.bot.consume(); } catch {} return; }
    const animal = this.bot.nearestEntity(e => e.type === 'mob' && ['cow','pig','sheep','chicken'].includes(e.name) && e.position.distanceTo(this.bot.entity.position)<48);
    if (animal) await this.fight(animal); else await this.explore();
  }
  async fight(target) {
    this.setGoal(`fighting ${target.name}`);
    await inv.equipBest(this.bot,'hand');
    const end = Date.now()+7000;
    while (target.isValid && target.position.distanceTo(this.bot.entity.position)<12 && Date.now()<end) {
      await goNear(this.bot,target.position,3,700);
      try { this.bot.attack(target); } catch {}
      await this.wait(550);
    }
  }
  async buildHome() {
    this.setGoal('building shelter');
    const p = this.bot.entity.position.floored(); this.home = p.clone();
    const blocks = this.bot.inventory.items().find(i => i.name.endsWith('_planks') || i.name === 'cobblestone');
    if (!blocks) return this.collectWood();
    for (let x=-2;x<=2;x++) for (let z=-2;z<=2;z++) {
      if (Math.abs(x)===2 || Math.abs(z)===2) {
        await place(this.bot, blocks.name, p.offset(x,0,z));
        if ((x!==0 || z!==-2)) await place(this.bot, blocks.name, p.offset(x,1,z));
      }
    }
    this.log(`Home established near ${p.x}, ${p.y}, ${p.z}`);
  }
  async explore() {
    this.setGoal('exploring');
    const p=this.bot.entity.position;
    await goNear(this.bot,{x:p.x+(Math.random()-.5)*32,y:p.y,z:p.z+(Math.random()-.5)*32},2,6000);
  }
}
module.exports = SurvivalAI;
