// bpnb_borg-ru.mjs — РУССКАЯ ВЕРСИЯ ОСНОВНОГО МОДУЛЯ
import { Bpnb_borgActor } from './documents/actor.mjs';
import { Bpnb_borgItem } from './documents/item.mjs';
import { Bpnb_borgActorSheet } from './sheets/actor-sheet.mjs';
import { Bpnb_borgItemSheet } from './sheets/item-sheet.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { BPNB_BORG } from './helpers/config.mjs';

Hooks.once('init', function () {
  game.bpnb_borg = {
    Bpnb_borgActor,
    Bpnb_borgItem,
    rollItemMacro,
  };

  CONFIG.BPNB_BORG = BPNB_BORG;

  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.agl.mod',
    decimals: 2,
  };

  CONFIG.Actor.documentClass = Bpnb_borgActor;
  CONFIG.Item.documentClass = Bpnb_borgItem;

  CONFIG.ActiveEffect.legacyTransferral = false;

  // РЕГИСТРИРУЕМ РУССКИЕ ЛИСТЫ ПОД НОВЫМ ID
  Actors.unregisterSheet('bpnb_borg', Bpnb_borgActorSheet);
  Actors.registerSheet('bpnb-borg-ru', Bpnb_borgActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "BPNB_BORG.SheetLabels.Actor"
  });

  Items.unregisterSheet('bpnb_borg', Bpnb_borgItemSheet);
  Items.registerSheet('bpnb-borg-ru', Bpnb_borgItemSheet, {
    types: ["item", "feature", "spell", "weapon", "armour"],
    makeDefault: true,
    label: "BPNB_BORG.SheetLabels.Item"
  });

  return preloadHandlebarsTemplates();
});

// Хелперы и макросы — оставляем как есть
Handlebars.registerHelper('toLowerCase', str => str.toLowerCase());
Handlebars.registerHelper("checkedIf", condition => condition ? "checked" : "");
Handlebars.registerHelper("xtotal", (roll) => {
  const result = roll.result.replace("+  -", "-").replace("+ -", "-");
  return result !== roll.total.toString() ? `${result} = ${roll.total}` : result;
});

Hooks.once('ready', () => {
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

async function createItemMacro(data, slot) {
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    ui.notifications.warn('You can only create macro buttons for owned Items');
    return;
  }
  const item = await Item.fromDropData(data);
  const command = `game.bpnb_borg.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'bpnb_borg.itemMacro': true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

function rollItemMacro(itemUuid) {
  const dropData = { type: 'Item', uuid: itemUuid };
  Item.fromDropData(dropData).then(item => {
    if (!item || !item.parent) {
      ui.notifications.warn(`Could not find item ${item?.name ?? itemUuid}`);
      return;
    }
    item.roll();
  });
}