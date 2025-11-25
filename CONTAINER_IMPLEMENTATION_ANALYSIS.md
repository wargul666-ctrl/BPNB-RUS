# Container/Bag Implementation Analysis - BPNB-RUS vs Original Systems

## Summary

This document analyzes the container/bag implementation in **BPNB-RUS** (your Russian localization) and compares it to reference implementations. The key finding is that **BPNB-RUS is the original implementer of containers** - they don't exist in the base `MrTheBino/bpnb-borg` system.

---

## 1. Template.json - Schema Definition

### Your Implementation (BPNB-RUS)

**File:** `template.json`

```json
"Item": {
  "types": ["item", "feature", "spell", "weapon", "armour", "container"],
  "templates": {
    "base": {
      "description": "",
      "gp": 0
    }
  },
  "container": {
    "templates": ["base"],
    "capacity": 10,           // Maximum items this container holds
    "weight": 0,              // Container's own weight
    "carryWeight": 0,         // Current weight of contents
    "containerSpace": 1,      // Space this container takes up in other containers
    "quantity": 1,            // Stack quantity
    "equipped": false,        // Is it being worn/carried
    "items": [],              // Array of item IDs inside
    "sheet": {
      "template": "systems/bpnb-borg-ru/templates/item/item-container-sheet.hbs"
    }
  }
}
```

### Key Differences from Original BPNB-borg

**MrTheBino/bpnb-borg does NOT have:**
- No `container` item type at all
- No nested item support
- No capacity system

---

## 2. Item Document Class - Core Methods

### File: `module/documents/item.mjs`

#### Container-Specific Methods

```javascript
/**
 * Add item to container
 * @param {string} itemId - ID of item to add
 */
async addItem(itemId) {
  if (this.type !== 'container') return;
  
  const items = this.system.items || [];
  if (!items.includes(itemId)) {
    await this.update({ "system.items": [...items, itemId] });
  }
}

/**
 * Remove item from container
 * @param {string} itemId - ID of item to remove
 */
async removeItem(itemId) {
  if (this.type !== 'container') return;
  
  const items = this.system.items || [];
  const filtered = items.filter(id => id !== itemId);
  await this.update({ "system.items": filtered });
}

/**
 * Get all items currently in this container
 */
getContainerItems() {
  if (this.type !== 'container' || !this.actor) return [];
  
  const itemIds = this.system.items || [];
  return itemIds.map(id => this.actor.items.get(id)).filter(item => !!item);
}

/**
 * Get the container this item is in (if any)
 */
getContainer() {
  if (!this.actor) return null;
  
  return this.actor.items.find(item => 
    item.type === 'container' && 
    (item.system.items || []).includes(this.id)
  );
}
```

### Other Useful Methods

```javascript
async equip() {
  await this.update({ "system.equipped": true });
}

async unequip() {
  await this.update({ "system.equipped": false });
}
```

---

## 3. Actor Sheet - Data Preparation

### File: `module/sheets/actor-sheet.mjs` - `_prepareItems()` Method

```javascript
_prepareItems(context) {
  const gear = [];
  const features = [];
  const spells = [];
  const weapons = [];
  const armour = [];

  for (let i of context.items) {
    i.img = i.img || Item.DEFAULT_ICON;

    if (i.type === 'item') {
      gear.push(i);
    } else if (i.type === 'feature') {
      features.push(i);
    } else if (i.type === 'spell') {
      spells.push(i);
    } else if (i.type === 'weapon') {
      weapons.push(i);
    } else if (i.type === 'armour') {
      armour.push(i);
    } 
    // ==================== CONTAINER HANDLING ====================
    else if (i.type === 'container') {
      // Load nested items from the items array in system
      if (i.system.items && i.system.items.length > 0) {
        // Map item IDs to actual item objects from context
        const containerItems = i.system.items.map(itemId => {
          const item = context.items.find(item => item._id === itemId);
          return item;
        }).filter(item => !!item);
        
        // Attach items data to container for template rendering
        i.itemsData = containerItems;
        
        // Calculate total space used by contents
        // Each item takes up: containerSpace × quantity
        i.system.totalContainerSpace = containerItems.reduce((sum, item) => {
          return sum + ((item.system.containerSpace || 1) * (item.system.quantity || 1));
        }, 0);
      } else {
        i.itemsData = [];
        i.system.totalContainerSpace = 0;
      }
      
      // Add container to gear list (displays on character sheet)
      gear.push(i);
    }
  }

  context.gear = gear;
  context.features = features;
  context.spells = spells;
  context.weapons = weapons;
  context.armour = armour;
}
```

**What This Does:**
1. Creates a nested mapping between item IDs stored in `system.items` and actual item objects
2. Calculates current space usage by summing `(containerSpace × quantity)` for all nested items
3. Attaches the resolved items to `i.itemsData` for the template to render
4. Determines if capacity is exceeded for UI display

---

## 4. HTML Templates

### Item Sheet: `templates/item/item-container-sheet.hbs`

```handlebars
<form class="{{cssClass}}" autocomplete="off">
  <header class="sheet-header">
    <img class="profile-img" src="{{item.img}}" data-edit="img" title="{{item.name}}" />
    <div class="header-fields">
      <h1 class="charname">
        <input name="name" type="text" value="{{item.name}}" 
               placeholder="{{localize 'BPNB_BORG.Container.Name'}}" />
      </h1>
      <div class="quantity-controls">
        <button type="button" class="quantity-btn" data-action="decrease-quantity">−</button>
        <input type="number" name="system.quantity" class="quantity-input" 
               value="{{system.quantity}}" min="1" data-dtype="Number" />
        <button type="button" class="quantity-btn" data-action="increase-quantity">+</button>
      </div>
    </div>
  </header>

  <section>
    <div class="grid grid-2col">
      <div class="resource">
        <label class="resource-label">{{localize "BPNB_BORG.Container.Capacity"}}</label>
        <input type="number" name="system.capacity" value="{{system.capacity}}" data-dtype="Number" />
      </div>
      <div class="resource">
        <label class="resource-label">{{localize "BPNB_BORG.Item.Weight"}}</label>
        <input type="number" name="system.carryWeight" value="{{system.carryWeight}}" data-dtype="Number" />
      </div>
    </div>
    <div class="grid grid-2col">
      <div class="resource">
        <label class="resource-label">{{localize "BPNB_BORG.Container.ContainerItems"}}</label>
        <input type="number" name="system.containerSpace" value="{{system.containerSpace}}" data-dtype="Number" />
      </div>
      <div class="resource">
        <label class="resource-label">{{localize "BPNB_BORG.Item.GP"}}</label>
        <input type="text" name="system.gp" value="{{system.gp}}" data-dtype="Number" />
      </div>
    </div>
  </section>

  {{!-- Sheet Tab Navigation --}}
  <nav class="sheet-tabs tabs" data-group="primary">
    <a class="item" data-tab="description">{{localize "BPNB_BORG.Item.Description"}}</a>
  </nav>

  {{!-- Sheet Body --}}
  <section class="sheet-body">
    <div class="tab" data-group="primary" data-tab="description">
      {{editor system.description target="system.description" rollData=rollData button=true owner=owner editable=editable}}
    </div>
  </section>
</form>
```

### Actor Sheet Items Partial: `templates/actor/parts/actor-items.hbs`

**Key Sections:**

```handlebars
{{#if (eq item.type "container")}}
<li class="item flexrow container-item" data-item-id="{{item._id}}" data-droppable="true">
  <div class="item-name">
    <div class="item-image">
      <img src="{{item.img}}" title="{{item.name}}" width="24" height="24" alt="{{item.name}}"/>
    </div>
    <!-- Collapse/expand toggle button -->
    <button type="button" class="container-toggle" data-item-id="{{item._id}}" 
            title="Раскрыть/свернуть">
      <i class="fas fa-chevron-right"></i>
    </button>
    <h4 class="rollable" data-item-id="{{item._id}}">{{item.name}}</h4>
    <!-- Display current/max capacity -->
    {{#if (gt item.system.totalContainerSpace 0)}}
      <span class="item-prop">({{item.system.totalContainerSpace}}/{{item.system.capacity}})</span>
    {{/if}}
  </div>
  <div class="item-controls">
    <a class="item-control item-edit" title="{{localize 'BPNB_BORG.Edit'}}">
      <i class="fas fa-edit"></i>
    </a>
    <a class="item-control item-delete" title="{{localize 'BPNB_BORG.Delete'}}">
      <i class="fas fa-trash"></i>
    </a>
  </div>
</li>

<!-- Render nested items (hidden by default, shown via toggle) -->
{{#if item.itemsData}}
  {{#each item.itemsData as |nestedItem|}}
  <li class="item flexrow nested-item" data-item-id="{{nestedItem._id}}" 
      style="margin-left: 30px; display: none;">
    <div class="item-name">
      <div class="item-image">
        <img src="{{nestedItem.img}}" title="{{nestedItem.name}}" width="20" height="20" alt=""/>
      </div>
      <h4 class="rollable" data-item-id="{{nestedItem._id}}">{{nestedItem.name}}</h4>
    </div>
    <div class="item-prop">
      {{#if (gt nestedItem.system.quantity 1)}}
        <span>({{nestedItem.system.quantity}})</span>
      {{/if}}
    </div>
    <div class="item-controls">
      <a class="item-control item-edit" title="{{localize 'BPNB_BORG.Edit'}}">
        <i class="fas fa-edit"></i>
      </a>
      <a class="item-control item-delete" title="{{localize 'BPNB_BORG.Delete'}}">
        <i class="fas fa-trash"></i>
      </a>
    </div>
  </li>
  {{/each}}
{{/if}}
{{/if}}
```

**Template Structure:**
1. Containers have `data-droppable="true"` attribute for drop detection
2. Toggle button with chevron icon controls visibility of nested items
3. Nested items are rendered as separate `<li>` elements with `nested-item` class
4. Capacity display shows current/max format: `(5/10)`
5. Nested items are initially `display: none` and toggled via jQuery

---

## 5. Drag-and-Drop Implementation

### File: `module/sheets/actor-sheet.mjs` - `activateListeners()` Method

#### Part 1: Initial Drag Setup

```javascript
if (this.actor.isOwner) {
  const handler = (ev) => this._onDragStart(ev);
  
  // Make all items draggable
  html.find('li.item').each((i, li) => {
    if (li.classList.contains('inventory-header')) return;
    li.setAttribute('draggable', true);
    li.addEventListener('dragstart', handler, false);
  });
```

#### Part 2: Drag-Over Visual Feedback

```javascript
  // Drag-over for containers - visual highlight
  html.on('dragover', '[data-droppable="true"]', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    $(ev.currentTarget).addClass('drag-over');  // CSS class for highlight
  });

  // Drag-leave - remove highlight
  html.on('dragleave', '[data-droppable="true"]', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    $(ev.currentTarget).removeClass('drag-over');
  });
```

#### Part 3: Drop Handler - Native Event Listener

**Critical Detail:** Uses native `addEventListener` because jQuery doesn't properly handle `dataTransfer`

```javascript
  const droppables = html.find('[data-droppable="true"]');
  droppables.each((index, element) => {
    element.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      $(element).removeClass('drag-over');
      
      try {
        const containerId = element.getAttribute('data-item-id');
        console.log('BPNB-RU | Drop event triggered on container:', containerId);
        
        // Get data from dataTransfer
        let draggedData = null;
        
        if (ev.dataTransfer) {
          console.log('BPNB-RU | dataTransfer exists');
          console.log('BPNB-RU | dataTransfer types:', ev.dataTransfer.types);
          
          // Try text/plain first
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
          
          // If not found, try application/json
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
        
        // If we got data with UUID that's an Item type
        if (draggedData && draggedData.type === 'Item' && draggedData.uuid) {
          console.log('BPNB-RU | Calling _handleDropItem with:', containerId, draggedData.uuid);
          await this._handleDropItem(containerId, draggedData.uuid);
        } else {
          console.warn('BPNB-RU | Invalid draggedData or missing uuid:', draggedData);
        }
      } catch (error) {
        console.error('BPNB-RU | Ошибка при обработке drop:', error);
      }
    }, false);
  });
}
```

#### Part 4: Handle Drop Item Function

```javascript
async _handleDropItem(containerId, itemUuid) {
  try {
    const container = this.actor.items.get(containerId);
    if (!container || container.type !== 'container') {
      console.warn('Container not found or not a container type:', containerId);
      return;
    }

    // Extract item ID from UUID (UUID format: "Actor.xyz.Item.itemId")
    const itemId = itemUuid.split('.').pop();
    const item = this.actor.items.get(itemId);
    
    if (!item) {
      console.warn('Item not found:', itemId);
      ui.notifications.warn('Не удалось найти предмет');
      return;
    }

    // Prevent container from containing itself
    if (item.id === containerId) {
      ui.notifications.warn('Контейнер не может содержать сам себя');
      return;
    }

    // Check if there's space
    const currentSpace = (container.system.totalContainerSpace || 0) + 
                        (item.system.containerSpace || 1);
    if (currentSpace > (container.system.capacity || 10)) {
      ui.notifications.warn(`${container.name} переполнен! Нет места для ${item.name}`);
      return;
    }

    // Add item to container
    await container.addItem(item.id);
    ui.notifications.info(`${item.name} добавлено в ${container.name}`);
  } catch (e) {
    console.error('Ошибка при добавлении предмета в контейнер:', e);
    ui.notifications.error('Ошибка при добавлении предмета в контейнер');
  }
}
```

---

## 6. Container Toggle (Show/Hide Contents)

### File: `module/sheets/actor-sheet.mjs` - `activateListeners()` Method

```javascript
// Toggle container visibility
html.on('click', '.container-toggle', (ev) => {
  ev.preventDefault();
  const button = $(ev.currentTarget);
  const containerRow = button.closest('.container-item');
  const nestedItems = containerRow.nextAll('.nested-item');  // Gets all following .nested-item elements
  const icon = button.find('i');
  
  if (nestedItems.first().is(':visible')) {
    // Hide items
    nestedItems.slideUp(200);
    icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
  } else {
    // Show items
    nestedItems.slideDown(200);
    icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
  }
});
```

**How It Works:**
1. Finds all `.nested-item` elements that follow the container in the DOM
2. Uses jQuery's `.slideUp()`/`.slideDown()` for smooth animation
3. Toggles chevron icon direction
4. Works because nested items are rendered immediately after the container in the template

---

## 7. Item Deletion with Container Cleanup

### File: `module/sheets/actor-sheet.mjs` - `activateListeners()` Method

```javascript
html.on('click', '.item-delete', async (ev) => {
  const itemId = $(ev.currentTarget).parents('.item').data('itemId');
  const item = this.actor.items.get(itemId);
  if (!item) return;

  // If item is in a container, remove it from there first
  const container = this.actor.items.find(c => 
    c.type === 'container' && (c.system.items || []).includes(itemId)
  );
  
  if (container) {
    await container.removeItem(itemId);
    ui.notifications.info(`${item.name} извлечено из ${container.name}`);
  }
  
  await item.delete();
});
```

---

## 8. Key Insights & Design Patterns

### What Makes Their Implementation Work

1. **ID-Based Storage**: Containers store item IDs in a simple array (`system.items: []`), not full item clones
   - Prevents data duplication
   - Allows single source of truth for each item

2. **Lazy Resolution in Templates**: 
   - Server-side: `_prepareItems()` resolves IDs to item objects and attaches to `itemsData`
   - Template: Simply iterates over `itemsData` - already resolved

3. **Space Calculation**:
   - Formula: `total_space = sum((item.containerSpace × item.quantity))`
   - Quantity matters! A stack of 5 arrows takes 5× the space

4. **Native Drag-and-Drop**:
   - Uses native HTML5 `dragstart`/`dragover`/`drop` events
   - **Critical**: Must use native `addEventListener` for drop because jQuery doesn't expose `dataTransfer`
   - Extracts item UUID from drag data and resolves to ID

5. **DOM Structure**:
   - Nested items rendered as sequential `<li>` elements after container
   - CSS/jQuery uses DOM position to group related items
   - `containerRow.nextAll('.nested-item')` gets all following siblings until next non-nested item

6. **Validation**:
   - Prevents self-containment
   - Prevents overflow
   - Validates item/container existence before operations

### Potential Issues in Current Implementation

1. **No Circular Container Prevention**: If you drag Container A into Container B, then drag Container B into A, you could create a cycle
2. **No Maximum Nesting Level**: Could potentially nest containers infinitely deep
3. **Simple Capacity Check**: Only checks quantity of the item being added, not already-contained stacks

---

## 9. CSS Styling Reference

The implementation uses:
- `.container-item` - Main container row (draggable)
- `.nested-item` - Items inside container (initially hidden)
- `.drag-over` - Visual highlight when dragging over container
- `.container-toggle` - Button to expand/collapse

---

## 10. Comparison with Original BPNB-borg

| Feature | BPNB-RUS | Original BPNB-borg |
|---------|----------|-------------------|
| Container type | ✅ Yes | ❌ No |
| Drag-drop to containers | ✅ Yes | ❌ No |
| Nested item display | ✅ Yes | ❌ No |
| Capacity system | ✅ Yes | ❌ No |
| Item space calculation | ✅ Yes | ❌ No |
| Container toggle UI | ✅ Yes | ❌ No |

**Conclusion:** BPNB-RUS is a significantly enhanced version that introduces the entire container system from scratch.

