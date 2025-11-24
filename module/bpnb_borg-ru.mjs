// bpnb_borg-ru.mjs — РУССКАЯ ВЕРСИЯ ОСНОВНОГО МОДУЛЯ
// Подавляем deprecated warnings для V1 Framework (будет обновлено в v16)
globalThis.SUPPRESS_FOUNDRY_DEPRECATION_WARNINGS = true;

import { Bpnb_borgActor } from './documents/actor.mjs';
import { Bpnb_borgItem } from './documents/item.mjs';
import { Bpnb_borgActorSheet } from './sheets/actor-sheet.mjs';
import { Bpnb_borgItemSheet } from './sheets/item-sheet.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { BPNB_BORG } from './helpers/config.mjs';
import { BpnbGeneratorApp } from './generator/generator-app.mjs';

Hooks.once('init', function () {
  // Register a separate namespace for the Russian translation to avoid
  // clobbering the original English module (game.bpnb_borg).
  game['bpnb-borg-ru'] = {
    Bpnb_borgActor,
    Bpnb_borgItem,
    rollItemMacro,
    BpnbGeneratorApp,
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
  foundry.documents.collections.Actors.unregisterSheet('bpnb_borg', Bpnb_borgActorSheet);
  foundry.documents.collections.Actors.registerSheet('bpnb-borg-ru', Bpnb_borgActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "BPNB_BORG.SheetLabels.Actor"
  });

  foundry.documents.collections.Items.unregisterSheet('bpnb_borg', Bpnb_borgItemSheet);
  foundry.documents.collections.Items.registerSheet('bpnb-borg-ru', Bpnb_borgItemSheet, {
    types: ["item", "feature", "spell", "weapon", "armour"],
    makeDefault: true,
    label: "BPNB_BORG.SheetLabels.Item"
  });

  return preloadHandlebarsTemplates();
});

// Хелперы Handlebars
Handlebars.registerHelper('toLowerCase', str => str.toLowerCase());
Handlebars.registerHelper("checkedIf", condition => condition ? "checked" : "");
Handlebars.registerHelper("xtotal", (roll) => {
  const result = roll.result.replace("+  -", "-").replace("+ -", "-");
  return result !== roll.total.toString() ? `${result} = ${roll.total}` : result;
});

Hooks.once('ready', () => {
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
  
  // ДОБАВИТЬ КНОПКУ ГЕНЕРАТОРА — ТОЛЬКО В САЙДБАР
  if (game.user.isGM) {
    const addGeneratorButton = () => {
      // Ищем элемент .directory-header ТОЛЬКО внутри #sidebar
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return false;
      
      // Ищем header актёров именно в сайдбаре
      const actorHeader = sidebar.querySelector('#actors .directory-header');
      
      if (!actorHeader) return false;
      
      // Проверяем, нет ли уже кнопки (удаляем старую, если есть)
      const oldBtn = actorHeader.querySelector('#bpnb-generator-button');
      if (oldBtn) oldBtn.remove();
      
      // Ищем .header-actions внутри header
      const headerActions = actorHeader.querySelector('.header-actions');
      if (!headerActions) return false;
      
      // Создаём кнопку
      const btn = document.createElement('button');
      btn.id = 'bpnb-generator-button';
      btn.className = 'create-entry';
      btn.type = 'button';
      btn.title = 'Открыть генератор персонажей';
      btn.innerHTML = '<i class="fas fa-user-plus"></i><span>Генератор</span>';
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        new BpnbGeneratorApp().render(true);
      });
      
      // Добавляем в header-actions ТОЛЬКО в сайдбаре
      headerActions.appendChild(btn);
      console.log('✓ BPNB-RU | Кнопка генератора добавлена в сайдбар');
      return true;
    };
    
    // Первоначальная добавка с задержкой
    setTimeout(() => {
      if (!addGeneratorButton()) {
        const retryInterval = setInterval(() => {
          if (addGeneratorButton()) {
            clearInterval(retryInterval);
          }
        }, 500);
        
        setTimeout(() => clearInterval(retryInterval), 5000);
      }
    }, 1000);
    
    // Переподключаем кнопку при каждом обновлении сайдбара
    Hooks.on('renderSidebarTab', (app, html, data) => {
      if (app.constructor.name === 'ActorDirectory') {
        addGeneratorButton();
      }
    });

    // Переподключаем кнопку при создании нового актора (когда генератор создаёт персонажа)
    Hooks.on('createActor', () => {
      setTimeout(() => addGeneratorButton(), 50);
    });

    // Переподключаем кнопку при удалении актора
    Hooks.on('deleteActor', () => {
      setTimeout(() => addGeneratorButton(), 50);
    });
  }
});

async function createItemMacro(data, slot) {
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    ui.notifications.warn('You can only create macro buttons for owned Items');
    return;
  }
  const item = await Item.fromDropData(data);
  const command = `game['bpnb-borg-ru'].rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'bpnb-borg-ru.itemMacro': true }
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