import {
  onManageActiveEffect,
  prepareActiveEffectCategories, // ЭТО БЫЛО ЗАБЫТО — СЕЙЧАС ВСЁ РАБОТАЕТ
} from "../helpers/effects.mjs";

/**
 * РУССКИЙ ЛИСТ ПРЕДМЕТА — ПОЛНОСТЬЮ РАБОЧИЙ
 * Для BPNB BORG RU + Foundry v13
 */
export class Bpnb_borgItemSheet extends foundry.appv1.sheets.ItemSheet {
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
    // Поддержка quantity в обоих местах: на корневом уровне и в system
    const qty = this.item.system?.quantity ?? this.item.quantity ?? 1;
    context.quantity = qty;
    // Убедимся что system.quantity тоже установлено
    if (context.system) {
      context.system.quantity = context.system.quantity ?? qty;
    }

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

    // Обработчик кнопок количества
    html.on("click", "[data-action='decrease-quantity']", (ev) => {
      ev.preventDefault();
      console.log("BPNB-RU | Нажата кнопка уменьшить количество");
      const currentQty = this.item.system?.quantity ?? this.item.quantity ?? 1;
      console.log("BPNB-RU | Текущее количество:", currentQty);
      if (currentQty > 1) {
        console.log("BPNB-RU | Обновляем количество на:", currentQty - 1);
        this.item.update({ "system.quantity": currentQty - 1 });
      }
    });

    html.on("click", "[data-action='increase-quantity']", (ev) => {
      ev.preventDefault();
      console.log("BPNB-RU | Нажата кнопка увеличить количество");
      const currentQty = this.item.system?.quantity ?? this.item.quantity ?? 1;
      console.log("BPNB-RU | Текущее количество:", currentQty);
      console.log("BPNB-RU | Обновляем количество на:", currentQty + 1);
      this.item.update({ "system.quantity": currentQty + 1 });
    });
  }
}