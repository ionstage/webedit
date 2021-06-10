/**
 * webedit v0.1.4
 * (c) 2019 iOnStage
 * Released under the MIT License.
 */

class Renderer {
  constructor() {
    this.tasks = new Map();
    this.requestID = 0;
    this.onupdate = this.onupdate.bind(this);
  }

  update(callback, ...args) {
    this.tasks.set(callback, args);
    if (this.requestID) {
      return;
    }
    this.requestID = window.requestAnimationFrame(this.onupdate);
  }

  onupdate() {
    this.tasks.forEach((args, callback) => callback.apply(null, args));
    this.tasks.clear();
    this.requestID = 0;
  }
}

class Stylist {
  constructor() {
    this.element = document.createElement('style');
  }

  activate(rules) {
    document.head.appendChild(this.element);
    rules.forEach((rule, index) => this.element.sheet.insertRule(rule, index));
  }

  deactivate() {
    document.head.removeChild(this.element);
  }
}

class Selection {
  constructor(props) {
    this.className = props.className;
    this.filter = props.filter;
    this.renderer = props.renderer;
    this.elements = [];
    this.previousElements = [];
    this.onupdate = this.onupdate.bind(this);
  }

  get addedElements() {
    return this.elements.filter(element => !this.previousElements.includes(element));
  }

  get removedElements() {
    return this.previousElements.filter(element => !this.elements.includes(element));
  }

  add(element) {
    if (this.elements.includes(element)) {
      return;
    }
    if (!this.filter.call(null, element)) {
      return;
    }
    this.elements.push(element);
    this.renderer.update(this.onupdate);
  }

  clear() {
    if (this.elements.length === 0) {
      return;
    }
    this.elements = [];
    this.renderer.update(this.onupdate);
  }

  includes(element) {
    return this.elements.includes(element);
  }

  forEach(callback) {
    this.elements.forEach(callback, this);
  }

  map(callback) {
    return this.elements.map(callback, this);
  }

  onupdate() {
    this.removedElements.forEach(element => element.classList.remove(this.className));
    this.addedElements.forEach(element => element.classList.add(this.className));
    this.previousElements = this.elements.slice();
  }
}

class DragTarget {
  constructor(props) {
    this.element = props.element;
    this.offsetLeft = props.offsetLeft;
    this.offsetTop = props.offsetTop;
    this.offsetWidth = props.offsetWidth;
    this.offsetHeight = props.offsetHeight;
    this.outerWidth = props.outerWidth;
    this.outerHeight = props.outerHeight;
  }

  static getOffset(element) {
    const transform = window.getComputedStyle(element).transform;
    const pair = transform.split(',').slice(4);
    const x = parseInt(pair[0] || 0, 10);
    const y = parseInt(pair[1] || 0, 10);
    return { x, y };
  }

  static create(element) {
    const offset = DragTarget.getOffset(element);
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return new DragTarget({
      element,
      offsetLeft: offset.x + 1,
      offsetTop: offset.y + 1,
      offsetWidth: parseInt(style.width, 10),
      offsetHeight: parseInt(style.height, 10),
      outerWidth: rect.width,
      outerHeight: rect.height,
    });
  }

  css(props) {
    Object.keys(props).forEach(key => (this.element.style[key] = props[key]));
  }

  cssLog() {
    const offset = DragTarget.getOffset(this.element);
    const style = window.getComputedStyle(this.element);
    return [
      `#${this.element.id} {`,
      `  height: ${parseInt(style.height, 10)}px;`,
      `  transform: translate(${offset.x + 1}px, ${offset.y + 1}px);`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n',
    ].join('\n');
  }

  addClass(className) {
    this.element.classList.add(className);
  }

  removeClass(className) {
    this.element.classList.remove(className);
  }

  moveTo(x, y) {
    this.element.style.transform = `translate(${x}px, ${y}px)`;
  }

  moveBy(dx, dy) {
    const offset = DragTarget.getOffset(this.element);
    this.moveTo(offset.x + 1 + dx, offset.y + 1 + dy);
  }
}

class DragStrategy {
  constructor(props) {
    this.renderer = props.renderer;
    this.onstart = this.onstart.bind(this);
    this.onmove = this.onmove.bind(this);
    this.onend = this.onend.bind(this);
  }

  /* template */
  match(_context) { return false; }

  start(targets) {
    this.renderer.update(this.onstart, targets);
  }

  move(targets, dx, dy) {
    this.renderer.update(this.onmove, targets, dx, dy);
  }

  end(targets) {
    this.renderer.update(this.onend, targets);
  }

  /* template */
  onstart(_targets) {}

  /* template */
  onmove(_targets, _dx, _dy) {}

  /* template */
  onend(_targets) {}
}

class NoopDragStrategy extends DragStrategy {
  start(_targets) { /* do nothing */ }

  move(_targets, _dx, _dy) { /* do nothing */ }

  end(_targets) { /* do nothing */ }
}

class MoveDragStrategy extends DragStrategy {
  match(context) {
    return !!context.pointedTarget;
  }

  start(_targets) { /* do nothing */ }

  onmove(targets, dx, dy) {
    for (const target of targets) {
      target.moveTo(target.offsetLeft + dx, target.offsetTop + dy);
    }
  }

  onend(targets) {
    for (const target of targets) {
      console.log(target.cssLog());
    }
  }
}

class EdgeDragStrategy extends DragStrategy {
  onstart(targets) {
    for (const target of targets) {
      target.addClass('_webedit_resizing');
    }
  }

  onend(targets) {
    for (const target of targets) {
      target.removeClass('_webedit_resizing');
      console.log(target.cssLog());
    }
  }
}

class RightEdgeDragStrategy extends EdgeDragStrategy {
  match(context) {
    if (!context.pointedTarget) {
      return false;
    }
    const outerWidth = context.pointedTarget.outerWidth;
    return outerWidth - 12 <= context.x && context.x <= outerWidth;
  }

  onmove(targets, dx, _dy) {
    for (const target of targets) {
      const width = target.offsetWidth + dx;
      target.css({ width: Math.max(width, 24) + 'px' });
    }
  }
}

class BottomEdgeDragStrategy extends EdgeDragStrategy {
  match(context) {
    if (!context.pointedTarget) {
      return false;
    }
    const outerHeight = context.pointedTarget.outerHeight;
    return outerHeight - 12 <= context.y && context.y <= outerHeight;
  }

  onmove(targets, _dx, dy) {
    for (const target of targets) {
      const height = target.offsetHeight + dy;
      target.css({ height: Math.max(height, 24) + 'px' });
    }
  }
}

class LeftEdgeDragStrategy extends EdgeDragStrategy {
  match(context) {
    if (!context.pointedTarget) {
      return false;
    }
    return context.x >= 0 && context.x <= 12;
  }

  onmove(targets, dx, _dy) {
    for (const target of targets) {
      let width = target.offsetWidth - dx;
      if (width < 24) {
        dx = target.offsetWidth - 24;
        width = 24;
      }
      target.moveTo(target.offsetLeft + dx, target.offsetTop);
      target.css({ width: width + 'px' });
    }
  }
}

class TopEdgeDragStrategy extends EdgeDragStrategy {
  match(context) {
    if (!context.pointedTarget) {
      return false;
    }
    return context.y >= 0 && context.y <= 12;
  }

  onmove(targets, _dx, dy) {
    for (const target of targets) {
      let height = target.offsetHeight - dy;
      if (height < 24) {
        dy = target.offsetHeight - 24;
        height = 24;
      }
      target.moveTo(target.offsetLeft, target.offsetTop + dy);
      target.css({ height: height + 'px' });
    }
  }
}

class MultipleEdgeDragStrategy extends EdgeDragStrategy {
  constructor(props) {
    super(props);
    this.strategies = [];
  }

  match(context) {
    return this.strategies.every(strategy => strategy.match(context));
  }

  onmove(targets, dx, dy) {
    this.strategies.forEach(strategy => strategy.onmove(targets, dx, dy));
  }
}

class BottomRightCornerDragStrategy extends MultipleEdgeDragStrategy {
  constructor(props) {
    super(props);
    this.strategies.push(new RightEdgeDragStrategy(props), new BottomEdgeDragStrategy(props));
  }
}

class BottomLeftCornerDragStrategy extends MultipleEdgeDragStrategy {
  constructor(props) {
    super(props);
    this.strategies.push(new LeftEdgeDragStrategy(props), new BottomEdgeDragStrategy(props));
  }
}

class TopRightCornerDragStrategy extends MultipleEdgeDragStrategy {
  constructor(props) {
    super(props);
    this.strategies.push(new RightEdgeDragStrategy(props), new TopEdgeDragStrategy(props));
  }
}

class TopLeftCornerDragStrategy extends MultipleEdgeDragStrategy {
  constructor(props) {
    super(props);
    this.strategies.push(new LeftEdgeDragStrategy(props), new TopEdgeDragStrategy(props));
  }
}

class DragHandler {
  constructor(props) {
    this.selection = props.selection;
    this.targets = [];
    this.pointedTarget = null;
    this.strategies = [
      new BottomRightCornerDragStrategy({ renderer: props.renderer }),
      new BottomLeftCornerDragStrategy({ renderer: props.renderer }),
      new TopRightCornerDragStrategy({ renderer: props.renderer }),
      new TopLeftCornerDragStrategy({ renderer: props.renderer }),
      new RightEdgeDragStrategy({ renderer: props.renderer }),
      new BottomEdgeDragStrategy({ renderer: props.renderer }),
      new LeftEdgeDragStrategy({ renderer: props.renderer }),
      new TopEdgeDragStrategy({ renderer: props.renderer }),
      new MoveDragStrategy({ renderer: props.renderer }),
    ];
    this.noopStrategy = new NoopDragStrategy({ renderer: props.renderer });
    this.strategy = this.noopStrategy;
  }

  arrangeSelection(context) {
    if (this.selection.includes(context.event.target)) {
      return;
    }
    if (!context.event.shiftKey) {
      this.selection.clear();
    }
    this.selection.add(context.event.target);
  }

  findTarget(element) {
    return this.targets.find(target => target.element === element) || null;
  }

  retrieveStrategy(pointedTarget, x, y) {
    const context = { pointedTarget, x, y };
    return this.strategies.find(strategy => strategy.match(context)) || this.noopStrategy;
  }

  start(context) {
    this.arrangeSelection(context);
    this.targets = this.selection.map(DragTarget.create);
    this.pointedTarget = this.findTarget(context.event.target);
    if (this.pointedTarget) {
      context.event.preventDefault();
    }
    this.strategy = this.retrieveStrategy(this.pointedTarget, context.x, context.y);
    this.strategy.start(this.targets);
  }

  move(context) {
    this.strategy.move(this.targets, context.dx, context.dy);
  }

  end() {
    this.strategy.end(this.targets);
  }
}

class Draggable {
  constructor(props) {
    this.element = props.element;
    this.onstart = props.onstart;
    this.onmove = props.onmove;
    this.onend = props.onend;
    this.onmousedown = this.onmousedown.bind(this);
    this.onmousemove = this.onmousemove.bind(this);
    this.onmouseup = this.onmouseup.bind(this);
    this.ontouchstart = this.ontouchstart.bind(this);
    this.ontouchmove = this.ontouchmove.bind(this);
    this.ontouchend = this.ontouchend.bind(this);
    this.identifier = null;
    this.startPageX = 0;
    this.startPageY = 0;
  }

  static getOffset(element) {
    const rect = element.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(document.body);
    const x = rect.left - element.scrollLeft - bodyRect.left + parseInt(bodyStyle.marginLeft, 10);
    const y = rect.top - element.scrollTop - bodyRect.top + parseInt(bodyStyle.marginTop, 10);
    return { x, y };
  }

  enable() {
    const supportsTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const type = (supportsTouch ? 'touchstart' : 'mousedown');
    this.element.addEventListener(type, this['on' + type], { passive: false });
  }

  disable() {
    const supportsTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const startType = (supportsTouch ? 'touchstart' : 'mousedown');
    const moveType = (supportsTouch ? 'touchmove' : 'mousemove');
    const endType = (supportsTouch ? 'touchend' : 'mouseup');
    this.element.removeEventListener(startType, this['on' + startType], { passive: false });
    document.removeEventListener(moveType, this['on' + moveType]);
    document.removeEventListener(endType, this['on' + endType]);
  }

  onmousedown(event) {
    const offset = Draggable.getOffset(event.target);
    const x = event.pageX - offset.x;
    const y = event.pageY - offset.y;
    this.startPageX = event.pageX;
    this.startPageY = event.pageY;
    this.onstart.call(null, { x, y, event });
    document.addEventListener('mousemove', this.onmousemove);
    document.addEventListener('mouseup', this.onmouseup);
  }

  onmousemove(event) {
    const dx = event.pageX - this.startPageX;
    const dy = event.pageY - this.startPageY;
    this.onmove.call(null, { dx, dy, event });
  }

  onmouseup(event) {
    document.removeEventListener('mousemove', this.onmousemove);
    document.removeEventListener('mouseup', this.onmouseup);
    this.onend.call(null, { event });
  }

  ontouchstart(event) {
    if (event.touches.length > 1) {
      return;
    }
    const touch = event.changedTouches[0];
    const offset = Draggable.getOffset(event.target);
    const x = touch.pageX - offset.x;
    const y = touch.pageY - offset.y;
    this.identifier = touch.identifier;
    this.startPageX = touch.pageX;
    this.startPageY = touch.pageY;
    this.onstart.call(null, { x, y, event });
    document.addEventListener('touchmove', this.ontouchmove);
    document.addEventListener('touchend', this.ontouchend);
  }

  ontouchmove(event) {
    const touch = event.changedTouches[0];
    if (touch.identifier !== this.identifier) {
      return;
    }
    const dx = touch.pageX - this.startPageX;
    const dy = touch.pageY - this.startPageY;
    this.onmove.call(null, { dx, dy, event });
  }

  ontouchend(event) {
    const touch = event.changedTouches[0];
    if (touch.identifier !== this.identifier) {
      return;
    }
    document.removeEventListener('touchmove', this.ontouchmove);
    document.removeEventListener('touchend', this.ontouchend);
    this.onend.call(null, { event });
  }
}

class KeyHandler {
  constructor(props) {
    this.selection = props.selection;
    this.renderer = props.renderer;
    this.dx = 0;
    this.dy = 0;
    this.onupdate = this.onupdate.bind(this);
  }

  input(event, dx, dy) {
    event.preventDefault();
    this.dx += dx;
    this.dy += dy;
    this.renderer.update(this.onupdate);
  }

  inputLeft(context) {
    this.input(context.event, -1, 0);
  }

  inputUp(context) {
    this.input(context.event, 0, -1);
  }

  inputRight(context) {
    this.input(context.event, 1, 0);
  }

  inputDown(context) {
    this.input(context.event, 0, 1);
  }

  onupdate() {
    this.selection.forEach(element => DragTarget.create(element).moveBy(this.dx, this.dy));
    this.dx = 0;
    this.dy = 0;
  }
}

class KeyInput {
  constructor(handlers) {
    this.handlers = handlers;
    this.onkeydown = this.onkeydown.bind(this);
  }

  enable() {
    document.body.addEventListener('keydown', this.onkeydown);
  }

  disable() {
    document.body.removeEventListener('keydown', this.onkeydown);
  }

  onkeydown(event) {
    const handler = this.handlers[event.key.toLowerCase()];
    if (handler) {
      handler({ event });
    }
  }
}

export class WebEdit {
  constructor() {
    this.renderer = new Renderer();
    this.stylist = new Stylist();
    this.selection = new Selection({
      className: '_webedit_selected',
      filter: element => element.classList.contains('_webedit_target'),
      renderer: this.renderer,
    });
    this.dragHandler = new DragHandler({
      selection: this.selection,
      renderer: this.renderer,
    });
    this.draggable = new Draggable({
      element: document,
      onstart: this.dragHandler.start.bind(this.dragHandler),
      onmove: this.dragHandler.move.bind(this.dragHandler),
      onend: this.dragHandler.end.bind(this.dragHandler),
    });
    this.keyHandler = new KeyHandler({
      selection: this.selection,
      renderer: this.renderer,
    });
    this.keyInput = new KeyInput({
      arrowleft: this.keyHandler.inputLeft.bind(this.keyHandler),
      arrowup: this.keyHandler.inputUp.bind(this.keyHandler),
      arrowright: this.keyHandler.inputRight.bind(this.keyHandler),
      arrowdown: this.keyHandler.inputDown.bind(this.keyHandler),
    });
  }

  static get CSS_RULES() {
    return [
      `._webedit_target {
        border: 1px solid #18FFFF;
        cursor: default;
        margin: -1px;
        pointer-events: auto;
      }`,
      `._webedit_target > * {
        pointer-events: none;
      }`,
      `._webedit_selected {
        border-color: #FF5252;
      }`,
      `._webedit_resizing {
        border-color: #FFAB40;
      }`,
    ];
  }

  enable() {
    this.stylist.activate(WebEdit.CSS_RULES);
    this.draggable.enable();
    this.keyInput.enable();
  }

  disable() {
    this.keyInput.disable();
    this.draggable.disable();
    this.stylist.deactivate();
  }
}
