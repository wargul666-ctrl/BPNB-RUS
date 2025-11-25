import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { attackRollDialog, attackRollDialogV2, defendRollDialog } from '../roll_dialog.mjs';

/**
 * КЛАСС ЛИСТА ПЕРСОНАЖА ДЛЯ РУССКОЙ ЛОКАЛИЗАЦИИ
 * Наследуется от стандартного ActorSheet Foundry VTT
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class Bpnb_borgActorSheet extends foundry.appv1.sheets.ActorSheet {

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

    // Сначала найдем все предметы которые находятся в контейнерах
    const itemsInContainers = new Set();
    for (let i of context.items) {
      if (i.type === 'container' && i.system.items && i.system.items.length > 0) {
        i.system.items.forEach(itemId => itemsInContainers.add(itemId));
      }
    }

    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      if (i.type === 'item') {
        // Не добавляем если предмет уже в контейнере
        if (!itemsInContainers.has(i._id)) {
          gear.push(i);
        }
      } else if (i.type === 'feature') {
        features.push(i);
      } else if (i.type === 'spell') {
        spells.push(i);
      } else if (i.type === 'weapon') {
        // Оружие тоже может быть в контейнере
        if (!itemsInContainers.has(i._id)) {
          weapons.push(i);
        }
      } else if (i.type === 'armour') {
        // Броня тоже может быть в контейнере
        if (!itemsInContainers.has(i._id)) {
          armour.push(i);
        }
      } else if (i.type === 'container') {
        // Контейнеры тоже добавляем в gear как предметы
        // Загружаем вложенные предметы контейнера через массив items в system
        if (i.system.items && i.system.items.length > 0) {
          const containerItems = i.system.items.map(itemId => {
            const item = context.items.find(item => item._id === itemId);
            return item;
          }).filter(item => !!item);
          i.itemsData = containerItems;
          // Рассчитываем текущий вес содержимого
          i.system.totalContainerSpace = containerItems.reduce((sum, item) => {
            return sum + ((item.system.containerSpace || 1) * (item.system.quantity || 1));
          }, 0);
        } else {
          i.itemsData = [];
          i.system.totalContainerSpace = 0;
        }
        gear.push(i);
      }
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

    // РАЗВЕРНУТЬ/СВЕРНУТЬ КОНТЕЙНЕР
    html.on('click', '.container-toggle', (ev) => {
      ev.preventDefault();
      const button = $(ev.currentTarget);
      const containerRow = button.closest('.container-item');
      const nestedItems = containerRow.nextAll('.nested-item');
      const icon = button.find('i');
      
      if (nestedItems.first().is(':visible')) {
        nestedItems.slideUp(200);
        icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
      } else {
        nestedItems.slideDown(200);
        icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
      }
    });

    // === ТОЛЬКО ЕСЛИ ЛИСТ РЕДАКТИРУЕМЫЙ ===
    if (!this.isEditable) return;

    // ДОБАВИТЬ ПРЕДМЕТ
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // УДАЛИТЬ ПРЕДМЕТ
    html.on('click', '.item-delete', async (ev) => {
      const itemId = $(ev.currentTarget).parents('.item').data('itemId');
      const item = this.actor.items.get(itemId);
      if (!item) return;

      // Если предмет в контейнере - удалить из контейнера
      const container = this.actor.items.find(c => 
        c.type === 'container' && (c.system.items || []).includes(itemId)
      );
      
      if (container) {
        await container.removeItem(itemId);
        ui.notifications.info(`${item.name} извлечено из ${container.name}`);
      }
      
      await item.delete();
    });

    // ПЕРЕКЛЮЧИТЬ ЭКИПИРОВКУ
    html.on('click', '.item-equipped-toggle', async (ev) => {
      ev.preventDefault();
      const itemId = $(ev.currentTarget).data('itemId');
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const isEquipped = item.system?.equipped ?? false;
      
      if (isEquipped) {
        // Снять с экипировки
        await item.unequip();
      } else {
        // Экипировать
        if (item.type === 'armour') {
          // Для брони: ищем другую экипированную броню и снимаем её
          for (const otherItem of this.actor.items) {
            if (otherItem.type === 'armour' && otherItem.id !== item.id && otherItem.system.equipped) {
              await otherItem.unequip();
            }
          }
        }
        else if (item.type === 'weapon') {
          // Для оружия: максимум 2 экипированных предмета (две руки)
          const equippedWeapons = this.actor.items.filter(
            i => i.type === 'weapon' && i.system.equipped && i.id !== item.id
          );
          
          if (equippedWeapons.length >= 2) {
            ui.notifications.warn(`У вас уже 2 оружия в руках! Сначала снимите одно.`);
            return;
          }
        }
        
        await item.equip();
      }
      
      // Обновляем кнопку
      const button = $(ev.currentTarget);
      if (item.system.equipped) {
        button.addClass("equipped");
      } else {
        button.removeClass("equipped");
      }
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

    // ДРАГ-Н-ДРОП ДЛЯ МАКРОСОВ И ПЕРЕМЕЩЕНИЯ В КОНТЕЙНЕРЫ
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });

      // Drag-over для контейнеров
      html.on('dragover', '[data-droppable="true"]', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        $(ev.currentTarget).addClass('drag-over');
      });

      // Drag-leave для контейнеров
      html.on('dragleave', '[data-droppable="true"]', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        $(ev.currentTarget).removeClass('drag-over');
      });

      // Drop в контейнер - используем нативный обработчик для доступа к dataTransfer
      const droppables = html.find('[data-droppable="true"]');
      const self = this; // Сохраняем контекст для use inside addEventListener
      droppables.each((index, element) => {
        element.addEventListener('drop', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          $(element).removeClass('drag-over');
          
          try {
            const containerId = element.getAttribute('data-item-id');
            console.log('BPNB-RU | Drop event triggered on container:', containerId);
            
            // Получаем данные из dataTransfer
            let draggedData = null;
            
            if (ev.dataTransfer) {
              console.log('BPNB-RU | dataTransfer exists');
              console.log('BPNB-RU | dataTransfer types:', ev.dataTransfer.types);
              
              // Пробуем text/plain
              try {
                const dragText = ev.dataTransfer.getData('text/plain');
                console.log('BPNB-RU | dragText:', dragText);
                if (dragText && dragText.trim()) {
                  draggedData = JSON.parse(dragText);
                  console.log('BPNB-RU | Parsed dragText:', draggedData);
                }
              } catch (e) {
                console.warn('BPNB-RU | Failed to parse text/plain:', e.message);
              }
              
              // Если не получили, пробуем application/json
              if (!draggedData) {
                try {
                  const dragJson = ev.dataTransfer.getData('application/json');
                  console.log('BPNB-RU | dragJson:', dragJson);
                  if (dragJson && dragJson.trim()) {
                    draggedData = JSON.parse(dragJson);
                    console.log('BPNB-RU | Parsed dragJson:', draggedData);
                  }
                } catch (e) {
                  console.warn('BPNB-RU | Failed to parse application/json:', e.message);
                }
              }
            } else {
              console.warn('BPNB-RU | No dataTransfer available');
            }
            
            console.log('BPNB-RU | Final draggedData:', draggedData);
            
            // Если получили данные с UUID и это Item
            if (draggedData && draggedData.type === 'Item' && draggedData.uuid) {
              console.log('BPNB-RU | Calling _handleDropItem with:', containerId, draggedData.uuid);
              await self._handleDropItem(containerId, draggedData.uuid);
            } else {
              console.warn('BPNB-RU | Invalid draggedData or missing uuid:', draggedData);
            }
          } catch (error) {
            console.error('BPNB-RU | Ошибка при обработке drop:', error);
          }
        }, false);
      });
    }
  }

  /**
   * Обработать drop предмета в контейнер
   */
  async _handleDropItem(containerId, itemUuid) {
    try {
      const container = this.actor.items.get(containerId);
      if (!container || container.type !== 'container') {
        console.warn('Container not found or not a container type:', containerId);
        return;
      }

      // Извлекаем ID предмета из UUID
      const itemId = itemUuid.split('.').pop();
      const item = this.actor.items.get(itemId);
      
      if (!item) {
        console.warn('Item not found:', itemId);
        ui.notifications.warn('Не удалось найти предмет');
        return;
      }

      if (item.id === containerId) {
        ui.notifications.warn('Контейнер не может содержать сам себя');
        return;
      }

      // Проверяем место в контейнере
      const currentSpace = (container.system.totalContainerSpace || 0) + (item.system.containerSpace || 1);
      if (currentSpace > (container.system.capacity || 10)) {
        ui.notifications.warn(`${container.name} переполнен! Нет места для ${item.name}`);
        return;
      }

      // Добавляем предмет в контейнер
      await container.addItem(item.id);
      ui.notifications.info(`${item.name} добавлено в ${container.name}`);
    } catch (e) {
      console.error('Ошибка при добавлении предмета в контейнер:', e);
      ui.notifications.error('Ошибка при добавлении предмета в контейнер');
    }
  }

  /* ============================================= */
  // СОЗДАНИЕ НОВОГО ПРЕДМЕТА ЧЕРЕЗ КНОПКУ "+"
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const name = game.i18n.localize("DOCUMENT.New").replace("{type}", game.i18n.localize(`TYPES.Item.${type}`));
    const itemData = { name, type, system: foundry.utils.duplicate(header.dataset) };
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

  /* ============================================= */
  // DRAG-DROP: перемещение предметов в контейнеры
  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return super._onDrop(event);
    }

    // Если это перемещение предмета из инвентаря
    if (data.type === 'Item') {
      const draggedItemId = data.uuid.split('.').pop();
      
      // Проверяем если перетащили на область инвентаря (не контейнер) из контейнера
      // В этом случае сначала пробуем извлечь из контейнера
      const item = this.actor.items.get(draggedItemId);
      if (item) {
        const container = this.actor.items.find(c => 
          c.type === 'container' && (c.system.items || []).includes(draggedItemId)
        );
        
        // Если drop произошел НЕ на контейнер, но предмет в контейнере - извлекаем
        const targetContainer = event.target.closest('.container-item');
        if (!targetContainer && container) {
          // Извлекаем из контейнера
          await container.removeItem(draggedItemId);
          ui.notifications.info(`${item.name} извлечено из ${container.name}`);
          return false;
        }
      }
      
      // Проверяем если перетащили в контейнер
      const targetElement = event.target.closest('.container-item');
      
      if (targetElement) {
        const containerId = targetElement.dataset.itemId;
        const container = this.actor.items.get(containerId);
        
        if (container && container.type === 'container') {
          // Добавляем предмет в контейнер
          await container.addItem(draggedItemId);
          ui.notifications.info(`${this.actor.items.get(draggedItemId)?.name} добавлено в ${container.name}`);
          return false;
        }
      }
    }

    return super._onDrop(event);
  }
}