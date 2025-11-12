import {
  onManageActiveEffect,
  prepareActiveEffectCategories, // ЭТО БЫЛО ЗАБЫТО — СЕЙЧАС ВСЁ РАБОТАЕТ
} from "../helpers/effects.mjs";

/**
 * РУССКИЙ ЛИСТ ПРЕДМЕТА — ПОЛНОСТЬЮ РАБОЧИЙ
 * Для BPNB BORG RU + Foundry v13
 */
export class Bpnb_borgItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bpnb-borg-ru", "sheet", "item"],
      width: 560,
      height: 520,
      tabs: [{
        navSelector: ".sheet-tabs",
        contentSelector: ".sheet-body",
        initial: "description"
      }]
    });
  }

  get template() {
    const path = "systems/bpnb-borg-ru/templates/item";
    const templates = {
      weapon: `${path}/item-weapon-sheet.hbs`,
      armour: `${path}/item-armour-sheet.hbs`,
      item: `${path}/item-item-sheet.hbs`,
      feature: `${path}/item-feature-sheet.hbs`,
      spell: `${path}/item-spell-sheet.hbs`
    };
    return templates[this.item.type] || templates.item;
  }

  getData() {
    const context = super.getData();
    context.system = context.item.system;
    context.flags = context.item.flags;
    context.rollData = this.item.getRollData();

    // АКТИВНЫЕ ЭФФЕКТЫ — ТЕПЕРЬ РАБОТАЮТ!
    context.effects = prepareActiveEffectCategories(this.item.effects);

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    html.on("click", ".effect-control", (ev) => {
      onManageActiveEffect(ev, this.item);
    });
  }
}