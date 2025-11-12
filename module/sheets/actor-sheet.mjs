import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { attackRollDialog, attackRollDialogV2, defendRollDialog } from '../roll_dialog.mjs';

/**
 * КЛАСС ЛИСТА ПЕРСОНАЖА ДЛЯ РУССКОЙ ЛОКАЛИЗАЦИИ
 * Наследуется от стандартного ActorSheet Foundry VTT
 * @extends {ActorSheet}
 */
export class Bpnb_borgActorSheet extends ActorSheet {

  /** @override */
  // НАСТРОЙКИ ПО УМОЛЧАНИЮ — ШИРИНА, ВЫСОТА, КЛАССЫ, ГЛАВНЫЙ ШАБЛОН
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['bpnb_borg', 'sheet', 'actor'],
      width: 800,        // Увеличил, чтобы всё влезло красиво
      height: 850,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'features',  // Открываем вкладку "Основное"
        },
      ],
      // ГЛАВНОЕ ИСПРАВЛЕНИЕ: УКАЗЫВАЕМ РУССКИЙ ШАБЛОН!
      template: "systems/bpnb-borg-ru/templates/actor/actor-character-sheet.hbs",
    });
  }

  /** @override */
  // ЭТО САМАЯ ВАЖНАЯ СТРОКА — ОНА ПЕРЕКРЫВАЕТ ХАРДКОД И ЗАСТАВЛЯЕТ ГРУЗИТЬ РУССКИЕ ШАБЛОНЫ
  get template() {
    if (this.actor.type === "npc") {
      return "systems/bpnb-borg-ru/templates/actor/actor-npc-sheet.hbs";
    }
    return "systems/bpnb-borg-ru/templates/actor/actor-character-sheet.hbs";
  }

  /* ============================================= */
  /** @override */
  // ПОДГОТОВКА ДАННЫХ ДЛЯ ОТОБРАЖЕНИЯ В ЛИСТЕ
  getData() {
    const context = super.getData();
    const actorData = context.data;

    // Делаем удобный доступ к системе и флагам
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Подготовка данных в зависимости от типа (персонаж или NPC)
    if (actorData.type === 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }
    if (actorData.type === 'npc') {
      this._prepareItems(context);
    }

    // Данные для TinyMCE (встроенный редактор)
    context.rollData = context.actor.getRollData();

    // Активные эффекты — группируем красиво
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());

    return context;
  }

  /* ============================================= */
  // ПЕРЕВОД НАЗВАНИЙ ХАРАКТЕРИСТИК (Сила, Ловкость и т.д.)
  _prepareCharacterData(context) {
    for (let [key, ability] of Object.entries(context.system.abilities)) {
      // Используем ключи из ru.json: BPNB_BORG.Ability.Str.long → "Сила"
      ability.labelKey = `BPNB_BORG.Ability.${key.charAt(0).toUpperCase() + key.slice(1)}.long`;
      ability.label = game.i18n.localize(ability.labelKey);
    }
  }

  /* ============================================= */
  // РАЗДЕЛЕНИЕ ПРЕДМЕТОВ ПО КАТЕГОРИЯМ: оружие, броня, заклинания и т.д.
  _prepareItems(context) {
    const gear = [];
    const features = [];
    const spells = [];
    const weapons = [];
    const armour = [];

    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      if (i.type === 'item') gear.push(i);
      else if (i.type === 'feature') features.push(i);
      else if (i.type === 'spell') spells.push(i);
      else if (i.type === 'weapon') weapons.push(i);
      else if (i.type === 'armour') armour.push(i);
    }

    context.gear = gear;
    context.features = features;
    context.spells = spells;
    context.weapons = weapons;
    context.armour = armour;
  }

  /* ============================================= */
  /** @override */
  // ПОДКЛЮЧЕНИЕ ВСЕХ КЛИКОВ И СОБЫТИЙ НА ЛИСТЕ
  activateListeners(html) {
    super.activateListeners(html);

    // КНОПКА: КОРОТКИЙ ОТДЫХ → кидает 1d4 хила
    html.on('click', '#action_short_rest', () => {
      const roll = new Roll("1d4", this.actor.getRollData());
      roll.evaluate().then(r => r.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("BPNB_BORG.Rest.Short") + " — Восстановлено:",
      }));
    });

    // КНОПКА: ДОЛГИЙ ОТДЫХ → кидает 1d6 хила
    html.on('click', '#action_long_rest', () => {
      const roll = new Roll("1d6", this.actor.getRollData());
      roll.evaluate().then(r => r.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("BPNB_BORG.Rest.Long") + " — Восстановлено:",
      }));
    });

    // КНОПКА: ЗАЩИТА → открывает диалог броска защиты
    html.on('click', '#action_defend', () => {
      defendRollDialog(this.actor, this.actor.system.abilities.agl.value);
    });

    // РЕДАКТИРОВАНИЕ ПРЕДМЕТА
    html.on('click', '.item-edit', (ev) => {
      const itemId = $(ev.currentTarget).parents('.item').data('itemId');
      this.actor.items.get(itemId)?.sheet.render(true);
    });

    // ОТПРАВКА ОПИСАНИЯ ПРЕДМЕТА В ЧАТ
    html.on('click', '.post-item-description', (ev) => {
      const itemId = $(ev.currentTarget).parents('.item').data('itemId');
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const content = `<h2>${item.name}</h2><p>${item.system.description || ""}</p>`;
      ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      });
    });

    // ИЗМЕНЕНИЕ КОЛИЧЕСТВА ПАТРОНОВ
    html.on('change', '.item-ammunition', (ev) => {
      const itemId = $(ev.currentTarget).parents('.item').data('itemId');
      const item = this.actor.items.get(itemId);
      const value = parseInt(ev.currentTarget.value);
      if (!isNaN(value)) item.update({ "system.ammunition": value });
    });

    // === ТОЛЬКО ЕСЛИ ЛИСТ РЕДАКТИРУЕМЫЙ ===
    if (!this.isEditable) return;

    // ДОБАВИТЬ ПРЕДМЕТ
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // УДАЛИТЬ ПРЕДМЕТ
    html.on('click', '.item-delete', (ev) => {
      const itemId = $(ev.currentTarget).parents('.item').data('itemId');
      this.actor.items.get(itemId)?.delete();
    });

    // УПРАВЛЕНИЕ АКТИВНЫМИ ЭФФЕКТАМИ
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document = row.dataset.parentId === this.actor.id
        ? this.actor
        : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // БРОСОК ПО ХАРАКТЕРИСТИКЕ ИЛИ ПРЕДМЕТУ
    html.on('click', '.rollable', this._onRoll.bind(this));

    // ДРАГ-Н-ДРОП ДЛЯ МАКРОСОВ
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /* ============================================= */
  // СОЗДАНИЕ НОВОГО ПРЕДМЕТА ЧЕРЕЗ КНОПКУ "+"
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const name = game.i18n.localize("DOCUMENT.New").replace("{type}", game.i18n.localize(`TYPES.Item.${type}`));
    const itemData = { name, type, system: duplicate(header.dataset) };
    delete itemData.system.type;
    return await Item.create(itemData, { parent: this.actor });
  }

  /* ============================================= */
  // ОБРАБОТКА ВСЕХ БРОСКОВ (оружие, заклинания, характеристики)
  _onRoll(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const dataset = el.dataset;

    // Бросок оружия
    if (dataset.rollType === 'weapon') {
      const item = this.actor.items.get(dataset.itemId);
      if (!item) return;

      let formula = "d20 + ";
      let label = item.name;

      if (item.system.ranged) {
        formula += this.actor.system.abilities.prs.value;
        label += ` (${game.i18n.localize("BPNB_BORG.Item.Weapon.Ranged")})`;
      } else {
        formula += this.actor.system.abilities.str.value;
        label += ` (${game.i18n.localize("BPNB_BORG.Item.Weapon.Melee")})`;
      }

      attackRollDialogV2(this.actor, dataset.itemId, formula, label, item.system.damage);
    }

    // Бросок заклинания
    else if (dataset.rollType === 'spell') {
      const item = this.actor.items.get(dataset.itemId);
      if (!item) return;

      const formula = `d20 + ${this.actor.system.abilities.prs.value}`;
      const label = `${item.name} (${game.i18n.localize("BPNB_BORG.Item.Spell.Spells")})`;
      attackRollDialog(this.actor, dataset.itemId, formula, label);
    }

    // Простой бросок по характеристике
    else if (dataset.roll) {
      attackRollDialog(this.actor, null, dataset.roll, dataset.label);
    }
  }
}