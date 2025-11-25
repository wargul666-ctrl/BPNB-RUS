export class BpnbGeneratorApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'bpnb-generator',
      title: 'Генератор персонажей — Black Powder & Brimstone',
      template: 'systems/bpnb-borg-ru/templates/generator/bpnb-generator-app.hbs',
      width: 900,
      height: 'auto',
      resizable: true,
      classes: ['bpnb-borg-ru', 'generator-app']
    });
  }

  constructor(options = {}) {
    super(options);
    this.classesData = [];
    this.subclassesData = [];
    this.weaponsData = {};
    this.armorData = {};
    this.itemsData = [];
    this.spellsData = [];
    this.gearData = {};
    this.namesData = {};
    this.descriptionsData = {};
    this.selectedClasses = {};
    this.selectedSubclasses = {};
  }

  async _loadData() {
    try {
      // ИСПРАВЛЕНЫ ПУТИ: используем относительный путь к JSON файлам в папке data/
      const classesResp = await fetch('/systems/bpnb-borg-ru/generator/data/classes.json');
      if (!classesResp.ok) throw new Error(`HTTP ${classesResp.status}`);
      this.classesData = await classesResp.json();
      
      const subclassesResp = await fetch('/systems/bpnb-borg-ru/generator/data/subclasses.json');
      if (!subclassesResp.ok) throw new Error(`HTTP ${subclassesResp.status}`);
      this.subclassesData = await subclassesResp.json();
      
      // Загружаем все данные для создания предметов
      const weaponsResp = await fetch('/systems/bpnb-borg-ru/generator/data/weapons.json');
      if (!weaponsResp.ok) throw new Error(`HTTP ${weaponsResp.status}`);
      this.weaponsData = await weaponsResp.json();
      
      const armorResp = await fetch('/systems/bpnb-borg-ru/generator/data/armor.json');
      if (!armorResp.ok) throw new Error(`HTTP ${armorResp.status}`);
      this.armorData = await armorResp.json();
      
      const itemsResp = await fetch('/systems/bpnb-borg-ru/generator/data/items.json');
      if (!itemsResp.ok) throw new Error(`HTTP ${itemsResp.status}`);
      this.itemsData = await itemsResp.json();
      
      const gearResp = await fetch('/systems/bpnb-borg-ru/generator/data/starting-gear.json');
      if (!gearResp.ok) throw new Error(`HTTP ${gearResp.status}`);
      this.gearData = await gearResp.json();
      
      const spellsResp = await fetch('/systems/bpnb-borg-ru/generator/data/spells.json');
      if (!spellsResp.ok) throw new Error(`HTTP ${spellsResp.status}`);
      this.spellsData = await spellsResp.json();
      
      const namesResp = await fetch('/systems/bpnb-borg-ru/generator/data/names.json');
      if (!namesResp.ok) throw new Error(`HTTP ${namesResp.status}`);
      this.namesData = await namesResp.json();
      
      const descriptionsResp = await fetch('/systems/bpnb-borg-ru/generator/data/subclass-descriptions.json');
      if (!descriptionsResp.ok) throw new Error(`HTTP ${descriptionsResp.status}`);
      this.descriptionsData = await descriptionsResp.json();
      
      console.log('BPNB-RU | Данные генератора загружены:', this.classesData, this.subclassesData);
    } catch (e) {
      console.error('BPNB-RU | Ошибка загрузки данных генератора:', e);
      ui.notifications.error('Ошибка загрузки данных генератора!');
    }
  }

  async getData(options) {
    await this._loadData();
    const data = await super.getData(options);
    
    return {
      ...data,
      classes: this.classesData,
      subclasses: this.subclassesData,
      selectedClasses: this.selectedClasses || {},
      selectedSubclasses: this.selectedSubclasses || {}
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // ОБРАБОТЧИК ВЫБОРА КЛАССА — С АВТОМАТИЧЕСКИМ УПРАВЛЕНИЕМ ПОДКЛАССАМИ
    html.on('change', 'input[name^="class_"]', (ev) => {
      const classId = ev.currentTarget.name.replace('class_', '');
      const isChecked = ev.currentTarget.checked;
      
      // Обновляем состояние класса
      this.selectedClasses[classId] = isChecked;
      
      // Если класс ОТКЛЮЧЕН — отключаем все его подклассы
      if (!isChecked) {
        this.subclassesData.forEach(subclass => {
          if (subclass.class === classId) {
            this.selectedSubclasses[subclass.id] = false;
            // Обновляем чекбокс в UI
            html.find(`input[name="subclass_${subclass.id}"]`).prop('checked', false);
          }
        });
      }
    });

    // ОБРАБОТЧИК ВЫБОРА ПОДКЛАССА — ЕСЛИ ВЫБРАН ПОДКЛАСС, АКТИВИРУЕМ ЕГО КЛАСС
    html.on('change', 'input[name^="subclass_"]', (ev) => {
      const subclassId = ev.currentTarget.name.replace('subclass_', '');
      const isChecked = ev.currentTarget.checked;
      
      this.selectedSubclasses[subclassId] = isChecked;
      
      // Если подкласс ВКЛЮЧЕН — автоматически включаем его класс
      if (isChecked) {
        const subclass = this.subclassesData.find(s => s.id === subclassId);
        if (subclass) {
          this.selectedClasses[subclass.class] = true;
          // Обновляем чекбокс класса в UI
          html.find(`input[name="class_${subclass.class}"]`).prop('checked', true);
        }
      }
    });

    // Кнопка "Создать с настройками"
    html.on('click', '#bpnb-create', (ev) => {
      ev.preventDefault();
      this._createCharacter(html, false);
    });

    // Кнопка "Полная рандомизация"
    html.on('click', '#bpnb-random-full', (ev) => {
      ev.preventDefault();
      this._createCharacter(html, true);
    });

    // Инициализация состояния
    if (Object.keys(this.selectedClasses).length === 0) {
      this.classesData.forEach(cls => {
        this.selectedClasses[cls.id] = true;
      });
    }
    if (Object.keys(this.selectedSubclasses).length === 0) {
      this.subclassesData.forEach(subcls => {
        this.selectedSubclasses[subcls.id] = true;
      });
    }
  }

  async _createCharacter(html, isFullRandom) {
    const windowContent = document.querySelector('#bpnb-generator .window-content');
    const form = windowContent ? windowContent.querySelector('form') : null;
    
    if (!form) {
      console.error('BPNB-RU | Форма не найдена!');
      ui.notifications.error('Ошибка: форма генератора не найдена!');
      return;
    }

    const nameInput = form.querySelector('#bpnb-name-input');
    let charName = nameInput?.value.trim() || '';

    if (!charName || isFullRandom) {
      charName = this._generateRandomName();
    }

    const stats = this._rollStats();

    let selectedClassId = null;
    if (isFullRandom) {
      const allClasses = this.classesData.map(c => c.id);
      selectedClassId = allClasses[Math.floor(Math.random() * allClasses.length)];
    } else {
      const checkedClasses = Object.keys(this.selectedClasses).filter(k => this.selectedClasses[k]);
      if (checkedClasses.length === 0) {
        ui.notifications.error('Выберите хотя бы один класс!');
        return;
      }
      selectedClassId = checkedClasses[Math.floor(Math.random() * checkedClasses.length)];
    }

    const classData = this.classesData.find(c => c.id === selectedClassId);
    const relevantSubclasses = this.subclassesData.filter(s => s.class === selectedClassId);
    
    let selectedSubclassId = null;
    if (isFullRandom) {
      selectedSubclassId = relevantSubclasses[Math.floor(Math.random() * relevantSubclasses.length)]?.id;
    } else {
      const checkedSubclasses = relevantSubclasses
        .map(s => s.id)
        .filter(id => this.selectedSubclasses[id]);
      selectedSubclassId = checkedSubclasses.length > 0
        ? checkedSubclasses[Math.floor(Math.random() * checkedSubclasses.length)]
        : relevantSubclasses[0]?.id;
    }

    const subclassData = this.subclassesData.find(s => s.id === selectedSubclassId);
    const health = this._calculateHealth(stats.tgh, classData);
    const gold = this._rollGold(classData);
    const description = this._getSubclassDescription(selectedSubclassId);
    
    const actorData = {
      name: charName,
      type: 'character',
      system: {
        health: { value: health, max: health },
        devils_luck: { value: 3, max: 3 },
        spell_cast_amount: { value: 0, max: 0 },
        abilities: {
          str: { value: stats.str },
          agl: { value: stats.agl },
          prs: { value: stats.prs },
          tgh: { value: stats.tgh }
        },
        attributes: {
          level: { value: 1 }
        },
        class_name: `${classData?.name || 'Неизвестный класс'} (${subclassData?.name || 'Неизвестный подкласс'})`,
        gp: gold,
        biography: description
      }
    };

    try {
      const actor = await Actor.create(actorData);
      
      // Добавляем стартовое оборудование
      await this._addStartingGear(actor, selectedSubclassId);
      
      ui.notifications.info(
        `✓ Персонаж "${charName}" создан!\n` +
        `Класс: ${classData?.name} (${subclassData?.name})\n` +
        `Здоровье: ${health}\n` +
        `Золото: ${gold} монет`
      );
      console.log('BPNB-RU | Персонаж создан:', actor);
      this.render(false);
    } catch (e) {
      console.error('Ошибка создания персонажа:', e);
      ui.notifications.error('Ошибка создания персонажа!');
    }
  }

  async _addStartingGear(actor, subclassId) {
    const subclassGear = this.gearData[subclassId];
    if (!subclassGear) return;

    const itemsToAdd = [];

    // Добавляем базовое снаряжение (одно для всех) — эти предметы нужно добавлять вручную, так как их нет в items.json
    const baseGearItems = [
      {
        name: 'Мешок',
        type: 'container',
        system: { description: 'Обычный холщовый мешок', quantity: 1, gp: 3, capacity: 10, carryWeight: 0, containerSpace: 1, items: [], equipped: false }
      },
      {
        name: 'Вода и провизия на 3 дня',
        type: 'item',
        system: { description: 'Запас еды и воды', quantity: 1 }
      },
      {
        name: 'Спальный мешок',
        type: 'item',
        system: { description: 'Спальный мешок для отдыха', quantity: 1 }
      },
      {
        name: 'Кремень и сталь',
        type: 'item',
        system: { description: 'Для разжигания огня', quantity: 1 }
      },
      {
        name: 'Верёвка 50 футов',
        type: 'item',
        system: { description: 'Прочная верёвка', quantity: 1 }
      },
      {
        name: 'Факел',
        type: 'item',
        system: { description: 'Факел для освещения', quantity: 2 }
      }
    ];

    itemsToAdd.push(...baseGearItems);

    // Обрабатываем оружие (группируем одинаковые предметы)
    if (subclassGear.weapons && subclassGear.weapons.length > 0) {
      const weaponMap = {};
      
      for (const weaponId of subclassGear.weapons) {
        const weapon = this._findWeaponById(weaponId);
        if (weapon) {
          const key = `${weapon.id}-${weapon.type}`;
          if (weaponMap[key]) {
            weaponMap[key].system.quantity += 1;
          } else {
            const itemData = this._createItemData(weapon, 'weapon');
            weaponMap[key] = itemData;
          }
        }
      }
      
      itemsToAdd.push(...Object.values(weaponMap));
    }

    // Обрабатываем броню
    if (subclassGear.armor && subclassGear.armor.length > 0) {
      for (const armorId of subclassGear.armor) {
        const armor = this.armorData.armor?.find(a => a.id === armorId);
        if (armor) {
          itemsToAdd.push(this._createItemData(armor, 'armour'));
        }
      }
    }

    // Обрабатываем предметы из items.json (группируем одинаковые)
    if (subclassGear.items && subclassGear.items.length > 0) {
      const itemMap = {};
      
      for (const itemId of subclassGear.items) {
        const item = this.itemsData.items?.find(i => i.id === itemId);
        if (item) {
          const key = `${item.id}-item`;
          if (itemMap[key]) {
            itemMap[key].quantity += 1;
          } else {
            itemMap[key] = this._createItemData(item, 'item');
          }
        }
      }
      
      itemsToAdd.push(...Object.values(itemMap));
    }

    // Добавляем спеллы для ведьм
    if (['woodwitch', 'herbalist', 'sorceress'].includes(subclassId)) {
      const spells = this._selectRandomSpells(2);
      for (const spell of spells) {
        itemsToAdd.push(this._createItemData(spell, 'spell'));
      }
    }

    // Добавляем все предметы персонажу
    if (itemsToAdd.length > 0) {
      // Логируем что будем добавлять
      itemsToAdd.forEach(item => {
        console.log(`BPNB-RU | Предмет: ${item.name}, тип: ${item.type}, quantity: ${item.system?.quantity ?? 1}`);
      });
      await actor.createEmbeddedDocuments('Item', itemsToAdd);
      console.log(`BPNB-RU | Добавлено ${itemsToAdd.length} предметов персонажу ${actor.name}`);
    }
  }

  _selectRandomSpells(count) {
    if (!this.spellsData.spells || this.spellsData.spells.length === 0) return [];
    
    const shuffled = [...this.spellsData.spells].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  _findWeaponById(weaponId) {
    // Ищем в разных категориях оружия
    if (this.weaponsData.melee) {
      const found = this.weaponsData.melee.find(w => w.id === weaponId);
      if (found) return found;
    }
    if (this.weaponsData.ranged) {
      const found = this.weaponsData.ranged.find(w => w.id === weaponId);
      if (found) return found;
    }
    if (this.weaponsData.firearms) {
      const found = this.weaponsData.firearms.find(w => w.id === weaponId);
      if (found) return found;
    }
    return null;
  }

  _createItemData(sourceItem, itemType, quantity = 1) {
    return {
      name: sourceItem.name,
      type: itemType,
      system: {
        description: sourceItem.desc || sourceItem.special || '',
        quantity: quantity
      }
    };
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  _rollAbility() {
    // Бросаем 3d6 и складываем
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      sum += Math.floor(Math.random() * 6) + 1;
    }
    
    // Конвертируем в модификатор по таблице (стр. 47)
    const baseValue = sum;
    const modifierMap = {
      3: -3, 4: -3, 5: -2, 6: -2,
      7: -1, 8: -1, 9: 0, 10: 0, 11: 0, 12: 0,
      13: 1, 14: 1, 15: 2, 16: 2, 17: 3, 18: 3
    };
    
    return modifierMap[baseValue] || 0;
  }

  _generateRandomName() {
    // Получаем все имена из загруженных данных
    const allNames = [];
    if (this.namesData.male) allNames.push(...this.namesData.male);
    if (this.namesData.female) allNames.push(...this.namesData.female);
    if (this.namesData.neutral) allNames.push(...this.namesData.neutral);
    
    // Если нет данных, используем fallback
    if (allNames.length === 0) {
      const fallbackNames = ['Артур', 'Мерлин', 'Ланселот', 'Гвейнвэр', 'Мордред', 'Персиваль', 'Кай', 'Беджер'];
      return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
    }
    
    return allNames[Math.floor(Math.random() * allNames.length)];
  }

  _rollStats() {
    const roll = (sides = 6) => {
      let sum = 0;
      for (let i = 0; i < 3; i++) {
        sum += Math.floor(Math.random() * sides) + 1;
      }
      return sum;
    };
    
    // Конвертируем в модификаторы по таблице (стр. 47 правил)
    const modifierMap = {
      3: -3, 4: -3, 5: -2, 6: -2,
      7: -1, 8: -1, 9: 0, 10: 0, 11: 0, 12: 0,
      13: 1, 14: 1, 15: 2, 16: 2, 17: 3, 18: 3
    };
    
    const abilities = {};
    for (let ability of ['str', 'agl', 'prs', 'tgh']) {
      const value = roll();
      abilities[ability] = modifierMap[value] || 0;
    }
    
    return abilities;
  }

  _calculateHealth(toughness, classData) {
    // Разные классы имеют разные формулы здоровья (см. правила стр. 47-67)
    let baseHealth = 0;
    const diceRoll = Math.floor(Math.random() * 12) + 1; // d12 по умолчанию для практиков

    switch (classData.id) {
      case 'deserter':
        baseHealth = toughness + Math.floor(Math.random() * 10) + 1; // Стойкость + d10
        break;
      case 'bounty_hunter':
        baseHealth = toughness + Math.floor(Math.random() * 8) + 1; // Стойкость + d8
        break;
      case 'witch':
        baseHealth = toughness + Math.floor(Math.random() * 6) + 1; // Стойкость + d6
        break;
      case 'adventurer':
        baseHealth = toughness + Math.floor(Math.random() * 6) + 1; // Стойкость + d6
        break;
      case 'practitioner':
        baseHealth = toughness + Math.floor(Math.random() * 12) + 1; // Стойкость + d12
        break;
      default:
        baseHealth = toughness + Math.floor(Math.random() * 8) + 1;
    }

    return Math.max(1, baseHealth); // Минимум 1 здоровье
  }

  _rollGold(classData) {
    // Разные классы получают разное золото (см. правила)
    let diceCount = 2;
    let multiplier = 10;

    switch (classData.id) {
      case 'deserter':
        diceCount = 2; // 2d6 × 10
        break;
      case 'bounty_hunter':
        diceCount = 3; // 3d6 × 10
        break;
      case 'witch':
        diceCount = 1; // 1d6 × 10
        break;
      case 'adventurer':
        diceCount = 2; // 2d6 × 10
        break;
      case 'practitioner':
        diceCount = 1; // 1d6 × 10
        break;
    }

    let sum = 0;
    for (let i = 0; i < diceCount; i++) {
      sum += Math.floor(Math.random() * 6) + 1;
    }
    
    return sum * multiplier;
  }

  _getStartingGear(classData, subclassData) {
    // Стартовое снаряжение для каждого класса/подкласса
    const gear = [];

    // БАЗОВОЕ СНАРЯЖЕНИЕ (одинаково для всех)
    const baseGear = [
      { name: 'Сумка', type: 'item', system: { description: 'Обычная холщовая сумка' } },
      { name: 'Вода и провизия на 3 дня', type: 'item', system: { description: 'Запас еды и воды' } },
      { name: 'Спальный мешок', type: 'item', system: { description: 'Спальный мешок' } },
      { name: 'Кремень и сталь', type: 'item', system: { description: 'Для разжигания огня' } },
      { name: 'Верёвка 50 футов', type: 'item', system: { description: 'Прочная верёвка' } },
      { name: 'Факелы', type: 'item', system: { description: 'Два факела' } }
    ];

    gear.push(...baseGear);

    // СПЕЦИАЛЬНОЕ СНАРЯЖЕНИЕ ДЛЯ ПОДКЛАССОВ
    if (subclassData.id === 'musketeer') {
      gear.push(
        { name: 'Мушкет', type: 'weapon', system: { description: 'Огнестрельное оружие' } },
        { name: 'Пули (10)', type: 'item', system: { description: '10 боевых пуль' } },
        { name: 'Пороховой мешочек', type: 'item', system: { description: 'Мешочек с порохом' } }
      );
    }

    // Добавьте остальные подклассы аналогично...

    return gear;
  }

  _getSubclassDescription(subclassId) {
    const subclassDesc = this.descriptionsData[subclassId];
    if (!subclassDesc) return '';
    
    return `<h2>${subclassDesc.title}</h2>\n\n<p>${subclassDesc.description.replace(/\n/g, '</p>\n<p>')}</p>`;
  }
}
