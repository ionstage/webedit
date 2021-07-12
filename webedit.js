/**
 * webedit v0.1.7
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
      offsetLeft: offset.x,
      offsetTop: offset.y,
      offsetWidth: parseInt(style.width, 10),
      offsetHeight: parseInt(style.height, 10),
      outerWidth: rect.width,
      outerHeight: rect.height,
    });
  }

  setWidth(width) {
    this.element.style.width = width + 'px';
  }

  setHeight(height) {
    this.element.style.height = height + 'px';
  }

  cssLog() {
    const offset = DragTarget.getOffset(this.element);
    const style = window.getComputedStyle(this.element);
    return [
      `#${this.element.id} {`,
      `  height: ${parseInt(style.height, 10)}px;`,
      `  transform: translate(${offset.x}px, ${offset.y}px);`,
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
    this.moveTo(this.offsetLeft + dx, this.offsetTop + dy);
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
  match(_pointedTarget, _x, _y) { return false; }

  start(pointedTarget, targets) {
    this.renderer.update(this.onstart, pointedTarget, targets);
  }

  move(pointedTarget, targets, dx, dy) {
    this.renderer.update(this.onmove, pointedTarget, targets, dx, dy);
  }

  end(pointedTarget, targets) {
    this.renderer.update(this.onend, pointedTarget, targets);
  }

  /* template */
  onstart(_pointedTarget, _targets) {}

  /* template */
  onmove(_pointedTarget, _targets, _dx, _dy) {}

  /* template */
  onend(_pointedTarget, _targets) {}
}

class NoopDragStrategy extends DragStrategy {
  start(_pointedTarget, _targets) { /* do nothing */ }

  move(_pointedTarget, _targets, _dx, _dy) { /* do nothing */ }

  end(_pointedTarget, _targets) { /* do nothing */ }
}

class MoveDragStrategy extends DragStrategy {
  match(pointedTarget, _x, _y) {
    return !!pointedTarget;
  }

  start(_pointedTarget, _targets) { /* do nothing */ }

  onmove(_pointedTarget, targets, dx, dy) {
    for (const target of targets) {
      target.moveTo(target.offsetLeft + dx, target.offsetTop + dy);
    }
  }

  onend(_pointedTarget, targets) {
    let log = '';
    for (const target of targets) {
      log += target.cssLog();
    }
    console.log(log);
  }
}

class EdgeDragStrategy extends DragStrategy {
  onstart(pointedTarget, _targets) {
    pointedTarget.addClass('_webedit_resizing');
  }

  onend(pointedTarget, _targets) {
    pointedTarget.removeClass('_webedit_resizing');
    console.log(pointedTarget.cssLog());
  }
}

class RightEdgeDragStrategy extends EdgeDragStrategy {
  match(pointedTarget, x, _y) {
    if (!pointedTarget) {
      return false;
    }
    const outerWidth = pointedTarget.outerWidth;
    return (outerWidth - 12 <= x && x <= outerWidth);
  }

  onmove(pointedTarget, _targets, dx, _dy) {
    const width = Math.max(pointedTarget.offsetWidth + dx, 24);
    pointedTarget.setWidth(width);
  }
}

class BottomEdgeDragStrategy extends EdgeDragStrategy {
  match(pointedTarget, _x, y) {
    if (!pointedTarget) {
      return false;
    }
    const outerHeight = pointedTarget.outerHeight;
    return (outerHeight - 12 <= y && y <= outerHeight);
  }

  onmove(pointedTarget, _targets, _dx, dy) {
    const height = Math.max(pointedTarget.offsetHeight + dy, 24);
    pointedTarget.setHeight(height);
  }
}

class LeftEdgeDragStrategy extends EdgeDragStrategy {
  match(pointedTarget, x, _y) {
    if (!pointedTarget) {
      return false;
    }
    return (x >= 0 && x <= 12);
  }

  onmove(pointedTarget, _targets, dx, _dy) {
    let width = pointedTarget.offsetWidth - dx;
    if (width < 24) {
      dx = pointedTarget.offsetWidth - 24;
      width = 24;
    }
    pointedTarget.moveTo(pointedTarget.offsetLeft + dx, pointedTarget.offsetTop);
    pointedTarget.setWidth(width);
  }
}

class TopEdgeDragStrategy extends EdgeDragStrategy {
  match(pointedTarget, _x, y) {
    if (!pointedTarget) {
      return false;
    }
    return (y >= 0 && y <= 12);
  }

  onmove(pointedTarget, _targets, _dx, dy) {
    let height = pointedTarget.offsetHeight - dy;
    if (height < 24) {
      dy = pointedTarget.offsetHeight - 24;
      height = 24;
    }
    pointedTarget.moveTo(pointedTarget.offsetLeft, pointedTarget.offsetTop + dy);
    pointedTarget.setHeight(height);
  }
}

class MultipleEdgeDragStrategy extends EdgeDragStrategy {
  matchRight(pointedTarget, x, y) {
    return RightEdgeDragStrategy.prototype.match.call(this, pointedTarget, x, y);
  }

  matchBottom(pointedTarget, x, y) {
    return BottomEdgeDragStrategy.prototype.match.call(this, pointedTarget, x, y);
  }

  matchLeft(pointedTarget, x, y) {
    return LeftEdgeDragStrategy.prototype.match.call(this, pointedTarget, x, y);
  }

  matchTop(pointedTarget, x, y) {
    return TopEdgeDragStrategy.prototype.match.call(this, pointedTarget, x, y);
  }

  onmoveAtRight(pointedTarget, targets, dx, dy) {
    RightEdgeDragStrategy.prototype.onmove.call(this, pointedTarget, targets, dx, dy);
  }

  onmoveAtBottom(pointedTarget, targets, dx, dy) {
    BottomEdgeDragStrategy.prototype.onmove.call(this, pointedTarget, targets, dx, dy);
  }

  onmoveAtLeft(pointedTarget, targets, dx, dy) {
    LeftEdgeDragStrategy.prototype.onmove.call(this, pointedTarget, targets, dx, dy);
  }

  onmoveAtTop(pointedTarget, targets, dx, dy) {
    TopEdgeDragStrategy.prototype.onmove.call(this, pointedTarget, targets, dx, dy);
  }
}

class BottomRightCornerDragStrategy extends MultipleEdgeDragStrategy {
  match(pointedTarget, x, y) {
    return this.matchRight(pointedTarget, x, y) && this.matchBottom(pointedTarget, x, y);
  }

  onmove(pointedTarget, targets, dx, dy) {
    this.onmoveAtRight(pointedTarget, targets, dx, dy);
    this.onmoveAtBottom(pointedTarget, targets, dx, dy);
  }
}

class BottomLeftCornerDragStrategy extends MultipleEdgeDragStrategy {
  match(pointedTarget, x, y) {
    return this.matchLeft(pointedTarget, x, y) && this.matchBottom(pointedTarget, x, y);
  }

  onmove(pointedTarget, targets, dx, dy) {
    this.onmoveAtLeft(pointedTarget, targets, dx, dy);
    this.onmoveAtBottom(pointedTarget, targets, dx, dy);
  }
}

class TopRightCornerDragStrategy extends MultipleEdgeDragStrategy {
  match(pointedTarget, x, y) {
    return this.matchRight(pointedTarget, x, y) && this.matchTop(pointedTarget, x, y);
  }

  onmove(pointedTarget, targets, dx, dy) {
    this.onmoveAtRight(pointedTarget, targets, dx, dy);
    this.onmoveAtTop(pointedTarget, targets, dx, dy);
  }
}

class TopLeftCornerDragStrategy extends MultipleEdgeDragStrategy {
  match(pointedTarget, x, y) {
    return this.matchLeft(pointedTarget, x, y) && this.matchTop(pointedTarget, x, y);
  }

  onmove(pointedTarget, _targets, dx, dy) {
    // change x and y simultaneously
    let width = pointedTarget.offsetWidth - dx;
    if (width < 24) {
      dx = pointedTarget.offsetWidth - 24;
      width = 24;
    }
    let height = pointedTarget.offsetHeight - dy;
    if (height < 24) {
      dy = pointedTarget.offsetHeight - 24;
      height = 24;
    }
    pointedTarget.moveTo(pointedTarget.offsetLeft + dx, pointedTarget.offsetTop + dy);
    pointedTarget.setWidth(width);
    pointedTarget.setHeight(height);
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

  arrangeSelection(event) {
    if (this.selection.includes(event.target)) {
      return;
    }
    if (!event.shiftKey) {
      this.selection.clear();
    }
    this.selection.add(event.target);
  }

  findTarget(element) {
    return this.targets.find(target => target.element === element) || null;
  }

  retrieveStrategy(pointedTarget, x, y) {
    return this.strategies.find(strategy => strategy.match(pointedTarget, x, y)) || this.noopStrategy;
  }

  start(x, y, event) {
    this.arrangeSelection(event);
    this.targets = this.selection.map(DragTarget.create);
    this.pointedTarget = this.findTarget(event.target);
    if (this.pointedTarget) {
      event.preventDefault();
    }
    this.strategy = this.retrieveStrategy(this.pointedTarget, x, y);
    this.strategy.start(this.pointedTarget, this.targets);
  }

  move(dx, dy) {
    this.strategy.move(this.pointedTarget, this.targets, dx, dy);
  }

  end() {
    this.strategy.end(this.pointedTarget, this.targets);
  }
}

class DragPointer {
  constructor(target, pageX, pageY, scroll) {
    this.target = target;
    this.startPageX = pageX;
    this.startPageY = pageY;
    this.startScrollX = scroll.x;
    this.startScrollY = scroll.y;
    this.startScrollWidth = scroll.width;
    this.startScrollHeight = scroll.height;
    this.dScrollX = 0;
    this.dScrollY = 0;
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
    this.onscroll = Draggable.debounce(this.onscroll.bind(this), 0);
    this.identifier = null;
    this.pointer = null;
  }

  static supportsTouch() {
    return ('ontouchstart' in window || (typeof DocumentTouch !== 'undefined' && document instanceof DocumentTouch));
  }

  static getOffset(element) {
    const rect = element.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(document.body);
    const x = rect.left - element.scrollLeft - bodyRect.left + parseInt(bodyStyle.marginLeft, 10);
    const y = rect.top - element.scrollTop - bodyRect.top + parseInt(bodyStyle.marginTop, 10);
    return { x, y };
  }

  static getScrollOffset(element) {
    let x = 0;
    let y = 0;
    let width = 0;
    let height = 0;
    element = element.parentNode;
    while (element && element !== document && element !== document.documentElement) {
      x += element.scrollLeft || 0;
      y += element.scrollTop || 0;
      width += (element.scrollWidth - element.clientWidth) || 0;
      height += (element.scrollHeight - element.clientHeight) || 0;
      element = element.parentNode;
    }
    return { x, y, width, height };
  }

  static debounce(func, delay) {
    let t = 0;
    return (...args) => {
      if (t) {
        clearTimeout(t);
      }
      t = setTimeout(() => {
        func.apply(this, args);
        t = 0;
      }, delay);
    };
  }

  enable() {
    const type = (Draggable.supportsTouch() ? 'touchstart' : 'mousedown');
    this.element.addEventListener(type, this['on' + type], { passive: false });
  }

  disable() {
    const supportsTouch = Draggable.supportsTouch();
    const startType = (supportsTouch ? 'touchstart' : 'mousedown');
    const moveType = (supportsTouch ? 'touchmove' : 'mousemove');
    const endType = (supportsTouch ? 'touchend' : 'mouseup');
    this.element.removeEventListener(startType, this['on' + startType], { passive: false });
    document.removeEventListener(moveType, this['on' + moveType]);
    document.removeEventListener(endType, this['on' + endType]);
    document.removeEventListener('scroll', this.onscroll, true);
  }

  onmousedown(event) {
    const offset = Draggable.getOffset(event.target);
    const scrollOffset = Draggable.getScrollOffset(event.target);
    const x = event.pageX - offset.x;
    const y = event.pageY - offset.y;
    this.pointer = new DragPointer(event.target, event.pageX, event.pageY, scrollOffset);
    this.onstart.call(null, x, y, event);
    document.addEventListener('mousemove', this.onmousemove);
    document.addEventListener('mouseup', this.onmouseup);
    document.addEventListener('scroll', this.onscroll, true);
  }

  onmousemove(event) {
    const dx = event.pageX - this.pointer.startPageX + this.pointer.dScrollX;
    const dy = event.pageY - this.pointer.startPageY + this.pointer.dScrollY;
    this.onmove.call(null, dx, dy);
  }

  onmouseup() {
    document.removeEventListener('mousemove', this.onmousemove);
    document.removeEventListener('mouseup', this.onmouseup);
    document.removeEventListener('scroll', this.onscroll, true);
    this.pointer = null;
    this.onend.call(null);
  }

  ontouchstart(event) {
    if (event.touches.length > 1) {
      return;
    }
    const touch = event.changedTouches[0];
    const offset = Draggable.getOffset(touch.target);
    const scrollOffset = Draggable.getScrollOffset(touch.target);
    const x = touch.pageX - offset.x;
    const y = touch.pageY - offset.y;
    this.identifier = touch.identifier;
    this.pointer = new DragPointer(touch.target, touch.pageX, touch.pageY, scrollOffset);
    this.onstart.call(null, x, y, event);
    document.addEventListener('touchmove', this.ontouchmove);
    document.addEventListener('touchend', this.ontouchend);
    document.addEventListener('scroll', this.onscroll, true);
  }

  ontouchmove(event) {
    const touch = event.changedTouches[0];
    if (touch.identifier !== this.identifier) {
      return;
    }
    const dx = touch.pageX - this.pointer.startPageX + this.pointer.dScrollX;
    const dy = touch.pageY - this.pointer.startPageY + this.pointer.dScrollY;
    this.onmove.call(null, dx, dy);
  }

  ontouchend(event) {
    const touch = event.changedTouches[0];
    if (touch.identifier !== this.identifier) {
      return;
    }
    document.removeEventListener('touchmove', this.ontouchmove);
    document.removeEventListener('touchend', this.ontouchend);
    document.removeEventListener('scroll', this.onscroll, true);
    this.pointer = null;
    this.onend.call(null);
  }

  onscroll() {
    if (!this.pointer) {
      return;
    }
    const offset = Draggable.getScrollOffset(this.pointer.target);
    const dScrollWidth = offset.width - this.pointer.startScrollWidth;
    const dScrollHeight = offset.height - this.pointer.startScrollHeight;
    this.pointer.dScrollX = offset.x - this.pointer.startScrollX - dScrollWidth;
    this.pointer.dScrollY = offset.y - this.pointer.startScrollY - dScrollHeight;
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

  inputLeft(event) {
    this.input(event, -1, 0);
  }

  inputUp(event) {
    this.input(event, 0, -1);
  }

  inputRight(event) {
    this.input(event, 1, 0);
  }

  inputDown(event) {
    this.input(event, 0, 1);
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
      handler(event);
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
