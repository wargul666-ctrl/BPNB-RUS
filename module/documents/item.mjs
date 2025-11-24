/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class Bpnb_borgItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const rollData = { ...super.getRollData() };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? '',
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // const result = await roll.evaluate();
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });

      // Обработка расходных предметов (бомб, стрел и т.д.)
      this._handleConsumable(roll);

      return roll;
    }
  }

  /**
   * Обработка расходных предметов - вычитание количества при использовании
   * @param {Roll} roll - результат броска
   * @private
   */
  async _handleConsumable(roll) {
    // Для бомб: проверяем результат броска на осечку
    if (this.name.toLowerCase().includes('бомба')) {
      const misfireRoll = new Roll('1d6');
      await misfireRoll.evaluate();
      const misfireResult = misfireRoll.total;
      
      console.log(`BPNB-RU | Проверка осечки бомбы: ${misfireResult}`);
      
      if (misfireResult === 1) {
        // КРИТИЧЕСКАЯ ОСЕЧКА: Взрыв в руке!
        await this._consumeOne();
        
        // Наносим урон персонажу: 2d6
        const damageRoll = new Roll('2d6');
        await damageRoll.evaluate();
        const damageAmount = damageRoll.total;
        
        // Получаем текущее здоровье
        const currentHealth = this.actor.system.health.value || 0;
        const newHealth = Math.max(0, currentHealth - damageAmount);
        
        // Обновляем здоровье персонажа
        await this.actor.update({ 'system.health.value': newHealth });
        
        // Отправляем чат-сообщение
        const chatData = {
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="border: 2px solid red; padding: 10px; background: #ffe6e6;">
            <strong style="color: red;">⚠️ КРИТИЧЕСКАЯ ОСЕЧКА!</strong><br/>
            Бомба взорвалась в руке ${this.actor.name}!<br/>
            <strong>Урон:</strong> ${damageAmount} (${damageRoll.formula})<br/>
            <strong>Здоровье:</strong> ${currentHealth} → ${newHealth}
          </div>`
        };
        await ChatMessage.create(chatData);
        
        ui.notifications.error(`КРИТИЧЕСКАЯ ОСЕЧКА! Бомба взорвалась в руке! Урон: ${damageAmount}`);
      } 
      else if (misfireResult === 2) {
        // Обычная осечка: бомба не взрывается, остаётся в инвентаре
        const chatData = {
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="border: 2px solid orange; padding: 10px; background: #fff3e0;">
            <strong style="color: orange;">⚡ ОСЕЧКА!</strong><br/>
            Бомба ${this.name} не взорвалась и осталась в инвентаре.
          </div>`
        };
        await ChatMessage.create(chatData);
        
        ui.notifications.warn(`Осечка! ${this.name} не взорвалась`);
      } 
      else {
        // Успешный взрыв (3-6)
        await this._consumeOne();
        
        ui.notifications.info(`${this.name} успешно использована`);
      }
    }
    // Для стрел, болтов и пуль - расходуем одну при каждом выстреле
    else if (this.name.toLowerCase().includes('стрела') || 
             this.name.toLowerCase().includes('болт') || 
             this.name.toLowerCase().includes('пуля')) {
      await this._consumeOne();
    }
  }

  /**
   * Вычитает одну единицу предмета
   * @private
   */
  async _consumeOne() {
    const currentQuantity = this.system?.quantity ?? 1;
    console.log(`BPNB-RU | Расход предмета ${this.name}, текущее количество: ${currentQuantity}`);
    
    if (currentQuantity > 1) {
      // Просто уменьшаем количество
      await this.update({ "system.quantity": currentQuantity - 1 });
      ui.notifications.info(`${this.name}: осталось ${currentQuantity - 1}`);
    } else if (currentQuantity === 1) {
      // Удаляем предмет, если это была последняя единица
      await this.delete();
      ui.notifications.warn(`${this.name}: закончилось`);
    }
  }

  /**
   * Экипировать предмет (броня, оружие и т.д.)
   * @async
   */
  async equip() {
    await this.update({ "system.equipped": true });
  }

  /**
   * Снять предмет с экипировки
   * @async
   */
  async unequip() {
    await this.update({ "system.equipped": false });
  }
}
