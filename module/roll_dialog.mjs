function addShowDicePromise(promises, roll) {
  if (game.dice3d) {
    // we pass synchronize=true so DSN dice appear on all players' screens
    promises.push(game.dice3d.showForRoll(roll, game.user, true, null, false));
  }
}

export async function attackRollDialogV2(actor,itemId,data_roll,label,damage){
    let rollDRFormula = 12;
    let rollDamageFormula = damage;
    let rollArmorFormula = null;
    const item = actor.items.get(itemId);
    const actorRollData = actor.getRollData();
    console.log("label:" + label)
    if (!label){
      label = "Roll"
    }
      
    //const isRanged = itemRollData.weaponType === "ranged";
    //const ability = isRanged ? "presence" : "strength";
    //const attackRoll = new Roll(`d20+diceModifier`, actorRollData);
    const rollFormula = data_roll;

    //await attackRoll.evaluate();
    //await showDice(attackRoll);
    
    const cardTitle = "RollDialog";
    const rollResult = {
        actor,
        rollFormula,
        cardTitle,
        item,
        label,
        rollDRFormula,
        rollDamageFormula,
        rollArmorFormula
      };
      const html = await foundry.applications.handlebars.renderTemplate(
        "systems/bpnb-borg/templates/dialogs/attack_roll_dialog.hbs",
        rollResult
      );

      return new Promise((resolve) => {
        new Dialog({
          title: "Roll Dialog",
          content: html,
          buttons: {
            roll: {
              icon: '<i class="fas fa-dice-d20"></i>',
              label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
              callback: (html) => attackDialogCallbackV2(actor, html),
            },
          },
          default: "roll",
          close: () => resolve(null),
        }).render(true);
      });
}

export async function defendRollDialog(actor,modifier){
  const actorRollData = actor.getRollData();
  let label = "Defend Roll";
  const rollFormula = `1d20 + ${modifier}`;

  const rollResult = {
    actor,
    label,
    rollFormula
  };
  const html = await foundry.applications.handlebars.renderTemplate(
    "systems/bpnb-borg/templates/dialogs/defend_dialog.hbs",
    rollResult
  );

  return new Promise((resolve) => {
    new Dialog({
      title: "Defend Roll Dialog",
      content: html,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
          callback: (html) => defendRollCallback(actor, html),
        },
      },
      default: "roll",
      close: () => resolve(null),
    }).render(true);
  });
}

export async function attackRollDialog(actor,itemId,data_roll,label){
    let attackDR = 12;
    const item = actor.items.get(itemId);
    const actorRollData = actor.getRollData();
    console.log("label:" + label)
    if (!label){
      label = "Roll"
    }
    
    //const isRanged = itemRollData.weaponType === "ranged";
    //const ability = isRanged ? "presence" : "strength";
    //const attackRoll = new Roll(`d20+diceModifier`, actorRollData);
    const rollFormula = data_roll;

    //await attackRoll.evaluate();
    //await showDice(attackRoll);
    
    const cardTitle = "RollDialog";
    const rollResult = {
        actor,
        rollFormula,
        cardTitle,
        item,
        label
      };
      const html = await foundry.applications.handlebars.renderTemplate(
        "systems/bpnb-borg/templates/dialogs/roll_dialog.hbs",
        rollResult
      );

      return new Promise((resolve) => {
        new Dialog({
          title: "Roll Dialog",
          content: html,
          buttons: {
            roll: {
              icon: '<i class="fas fa-dice-d20"></i>',
              label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
              callback: (html) => attackDialogCallback(actor, html),
            },
          },
          default: "roll",
          close: () => resolve(null),
        }).render(true);
      });
}

async function attackDialogCallbackV2(actor, html) {
  const form = html[0].querySelector("form");
  const itemId = form.itemid.value;
  const rollFormula = form.rollFormula.value;
  const rollDamageFormnula = form.rollDamageFormula.value;
  const rollArmorFormula = form.rollArmorFormula.value;
  const rollDRFormula = form.rollDRFormula.value;
  const label = form.rollLabel.value;
  const actorRollData = actor.getRollData();

  let attackResult = 0;
  let damageResult = 0;
  let armorResult = 0;

  let isHit = false;
  let isFumble = false;
  let isCrit = false;

  const dicePromises = [];

  const attackRoll = new Roll(rollFormula, actorRollData);
  await attackRoll.evaluate();
  const d20Result = attackRoll.terms[0].results[0].result;
  addShowDicePromise(dicePromises, attackRoll);

  let attackOutcome = game.i18n.localize('BPNB_BORG.Labels.Attack_Miss');

  if(d20Result == 1){
    isFumble = true
    attackOutcome = game.i18n.localize('BPNB_BORG.Labels.Attack_Fumble');
  }
  else if(d20Result == 20){
    isCrit = true
    isHit = true
    attackOutcome = game.i18n.localize('BPNB_BORG.Labels.Attack_Crit');
  }
  else if(attackRoll.total >= rollDRFormula) {
    isHit = true;
  }

  
  let damageRoll = null;
  let armorRoll = null;
  let totalDamage = 0;

  if(isHit){
    attackOutcome = game.i18n.localize('BPNB_BORG.Labels.Attack_Hit');
    damageRoll = new Roll(rollDamageFormnula, actorRollData);
    await damageRoll.evaluate();
    addShowDicePromise(dicePromises, damageRoll);
    damageResult = damageRoll.total;
    if(isCrit){
      damageResult = damageResult * 2;
    }

    totalDamage = damageResult
    if (rollArmorFormula) {
      armorRoll = new Roll(rollArmorFormula, actorRollData);
      await armorRoll.evaluate();
      armorResult = armorRoll.total;
      addShowDicePromise(dicePromises, armorRoll);

      totalDamage = totalDamage - armorResult;
      if (totalDamage < 0) {
        totalDamage = 0;
      }
    }  
  }
  

  if (dicePromises) {
      await Promise.all(dicePromises);
  }

  let attackDR = parseInt(rollDRFormula);
  let attackFormula = attackRoll.formula;
  const rollResult = {
    actor,
    isHit,
    attackDR,
    attackFormula,
    attackRoll,
    attackOutcome,
    damageRoll,
    damageResult,
    totalDamage,
    armorRoll,
    label
  }
  renderAttackRollCard(actor,rollResult)
}

async function renderAttackRollCard(actor, rollResult) {
  const html = await renderTemplate(
    "systems/bpnb-borg/templates/chat/attack-roll-card.hbs",
    rollResult
  );
  ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

async function renderDefendRollCard(actor, rollResult) {
  const html = await renderTemplate(
    "systems/bpnb-borg/templates/chat/defend-roll-card.hbs",
    rollResult
  );
  ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

async function attackDialogCallback(actor, html) {
  const form = html[0].querySelector("form");
  const itemId = form.itemid.value;
  const rollFormula = form.rollFormula.value;
  const rollLabel = form.rollLabel.value;
  const actorRollData = actor.getRollData();

  const attackRoll = new Roll(rollFormula, actorRollData);
  await attackRoll.evaluate();

  attackRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: rollLabel,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

async function defendRollCallback(actor,html){
  const form = html[0].querySelector("form");
  const rollFormula = form.rollFormula.value;
  const defendDR = form.rollDR.value;
  const actorRollData = actor.getRollData();
  const label = form.rollLabel.value;

  const dicePromises = [];
  const defendRoll = new Roll(rollFormula, actorRollData);
  await defendRoll.evaluate();
  addShowDicePromise(dicePromises, defendRoll);

  let d20Result = defendRoll.terms[0].results[0].result;

  let resultTitle = "";
  let resultBody = null;

  if(d20Result == 20){
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Critical_Success');
    resultBody = game.i18n.localize('BPNB_BORG.Labels.Defend_Critical_Success_Action');
  }
  else if(d20Result == 1){
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Fumble');
    resultBody = game.i18n.localize('BPNB_BORG.Labels.Defend_Fumble_Action');
  }
  else if(defendRoll.total >= defendDR){
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Success');
  }else{
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Got_Hit');
  }

  await Promise.all(dicePromises);

  const rollResult = {
    actor,
    label,
    resultTitle,
    resultBody,
    defendRoll,
    defendDR
  }
  renderDefendRollCard(actor,rollResult)
}