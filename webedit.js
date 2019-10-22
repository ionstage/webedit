/**
 * webedit v0.1.0
 * (c) 2019 iOnStage
 * Released under the MIT License.
 */

class Renderer {
  constructor () {
    this.tasks = new Map()
    this.requestID = 0
    this.onupdate = this.onupdate.bind(this)
  }

  update (callback, ...args) {
    this.tasks.set(callback, args)
    if (this.requestID) {
      return
    }
    this.requestID = window.requestAnimationFrame(this.onupdate)
  }

  onupdate () {
    this.tasks.forEach((args, callback) => callback.apply(null, args))
    this.tasks.clear()
    this.requestID = 0
  }
}

class Draggable {
  constructor (props) {
    this.element = props.element
    this.onstart = props.onstart
    this.onmove = props.onmove
    this.onend = props.onend
    this.onmousedown = this.onmousedown.bind(this)
    this.onmousemove = this.onmousemove.bind(this)
    this.onmouseup = this.onmouseup.bind(this)
    this.ontouchstart = this.ontouchstart.bind(this)
    this.ontouchmove = this.ontouchmove.bind(this)
    this.ontouchend = this.ontouchend.bind(this)
    this.identifier = null
    this.startPageX = 0
    this.startPageY = 0
  }

  static getOffset (element) {
    const rect = element.getBoundingClientRect()
    const bodyRect = document.body.getBoundingClientRect()
    const x = rect.left - element.scrollLeft - bodyRect.left
    const y = rect.top - element.scrollTop - bodyRect.top
    return { x, y }
  }

  enable () {
    const supportsTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    const type = (supportsTouch ? 'touchstart' : 'mousedown')
    this.element.addEventListener(type, this['on' + type], { passive: false })
  }

  onmousedown (event) {
    const offset = Draggable.getOffset(event.target)
    const x = event.pageX - offset.x
    const y = event.pageY - offset.y
    this.startPageX = event.pageX
    this.startPageY = event.pageY
    this.onstart.call(null, { x, y, event })
    document.addEventListener('mousemove', this.onmousemove)
    document.addEventListener('mouseup', this.onmouseup)
  }

  onmousemove (event) {
    const dx = event.pageX - this.startPageX
    const dy = event.pageY - this.startPageY
    this.onmove.call(null, { dx, dy, event })
  }

  onmouseup (event) {
    document.removeEventListener('mousemove', this.onmousemove)
    document.removeEventListener('mouseup', this.onmouseup)
    this.onend.call(null, { event })
  }

  ontouchstart (event) {
    if (event.touches.length > 1) {
      return
    }
    const touch = event.changedTouches[0]
    const offset = Draggable.getOffset(event.target)
    const x = touch.pageX - offset.x
    const y = touch.pageY - offset.y
    this.identifier = touch.identifier
    this.startPageX = touch.pageX
    this.startPageY = touch.pageY
    this.onstart.call(null, { x, y, event })
    document.addEventListener('touchmove', this.ontouchmove)
    document.addEventListener('touchend', this.ontouchend)
  }

  ontouchmove (event) {
    const touch = event.changedTouches[0]
    if (touch.identifier !== this.identifier) {
      return
    }
    const dx = touch.pageX - this.startPageX
    const dy = touch.pageY - this.startPageY
    this.onmove.call(null, { dx, dy, event })
  }

  ontouchend (event) {
    const touch = event.changedTouches[0]
    if (touch.identifier !== this.identifier) {
      return
    }
    document.removeEventListener('touchmove', this.ontouchmove)
    document.removeEventListener('touchend', this.ontouchend)
    this.onend.call(null, { event })
  }
}

class Selection {
  constructor (props) {
    this.className = props.className
    this.filter = props.filter
    this.renderer = props.renderer
    this.elements = []
    this.previousElements = []
    this.onupdate = this.onupdate.bind(this)
  }

  get addedElements () {
    return this.elements.filter(element => !this.previousElements.includes(element))
  }

  get removedElements () {
    return this.previousElements.filter(element => !this.elements.includes(element))
  }

  add (element) {
    if (this.elements.includes(element)) {
      return
    }
    if (!this.filter.call(null, element)) {
      return
    }
    this.elements.push(element)
    this.renderer.update(this.onupdate)
  }

  clear () {
    if (this.elements.length === 0) {
      return
    }
    this.elements = []
    this.renderer.update(this.onupdate)
  }

  forEach (callback) {
    this.elements.forEach(callback, this)
  }

  map (callback) {
    return this.elements.map(callback, this)
  }

  onupdate () {
    this.removedElements.forEach(element => element.classList.remove(this.className))
    this.addedElements.forEach(element => element.classList.add(this.className))
    this.previousElements = this.elements.slice()
  }
}

class KeyInput {
  constructor (handlers) {
    this.handlers = handlers
  }

  enable () {
    document.body.addEventListener('keydown', this.onkeydown.bind(this))
  }

  onkeydown (event) {
    const handler = this.handlers[event.key]
    if (handler) {
      handler({ event })
    }
  }
}

class DragTarget {
  constructor (props) {
    this.element = props.element
    this.offsetLeft = props.offsetLeft
    this.offsetTop = props.offsetTop
    this.offsetWidth = props.offsetWidth
    this.outerWidth = props.outerWidth
  }

  static create (element) {
    const style = window.getComputedStyle(element)
    const offsetLeft = parseInt(style.left, 10)
    const offsetTop = parseInt(style.top, 10)
    const offsetWidth = parseInt(style.width, 10)
    const rect = element.getBoundingClientRect()
    const outerWidth = rect.width
    return new DragTarget({ element, offsetLeft, offsetTop, offsetWidth, outerWidth })
  }

  css (props) {
    Object.keys(props).forEach(key => (this.element.style[key] = props[key]))
  }

  cssLog () {
    const style = window.getComputedStyle(this.element)
    return [
      `#${this.element.id} {`,
      `  left: ${parseInt(style.left, 10)}px;`,
      `  top: ${parseInt(style.top, 10)}px;`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n'
    ].join('\n')
  }
}

class DragStrategy {
  constructor (props) {
    this.renderer = props.renderer
  }

  /* template */
  match (_context) { return false }

  start (targets) {
    this.renderer.update(this.onstart, targets)
  }

  move (targets, dx, dy) {
    this.renderer.update(this.onmove, targets, dx, dy)
  }

  end (targets) {
    this.renderer.update(this.onend, targets)
  }

  /* template */
  onstart (_targets) {}

  /* template */
  onmove (_targets, _dx, _dy) {}

  /* template */
  onend (_targets) {}
}

class NoopDragStrategy extends DragStrategy {
  start (_targets) { /* do nothing */ }

  move (_targets, _dx, _dy) { /* do nothing */ }

  end (_targets) { /* do nothing */ }
}

class MoveDragStrategy extends DragStrategy {
  match (context) {
    return !!context.pointedTarget
  }

  start (_targets) { /* do nothing */ }

  onmove (targets, dx, dy) {
    for (const target of targets) {
      const left = target.offsetLeft + dx
      const top = target.offsetTop + dy
      target.css({
        left: left + 'px',
        top: top + 'px'
      })
    }
  }

  onend (targets) {
    for (const target of targets) {
      console.log(target.cssLog())
    }
  }
}

class EdgeDragStrategy extends DragStrategy {
  onstart (targets) {
    for (const target of targets) {
      target.css({ borderColor: 'orange' })
    }
  }

  onend (targets) {
    for (const target of targets) {
      target.css({ borderColor: '' })
      console.log(target.cssLog())
    }
  }
}

class RightEdgeDragStrategy extends EdgeDragStrategy {
  match (context) {
    if (!context.pointedTarget) {
      return false
    }
    const width = context.pointedTarget.offsetWidth
    return width - 12 <= context.x && context.x <= width
  }

  onmove (targets, dx, _dy) {
    for (const target of targets) {
      const width = target.offsetWidth + dx
      target.css({
        width: Math.max(width, 24) + 'px'
      })
    }
  }
}

class LeftEdgeDragStrategy extends EdgeDragStrategy {
  match (context) {
    if (!context.pointedTarget) {
      return false
    }
    return context.x >= 0 && context.x <= 12
  }

  onmove (targets, dx, _dy) {
    for (const target of targets) {
      let width = target.offsetWidth - dx
      if (width < 24) {
        dx = target.offsetWidth - 24
        width = 24
      }
      const left = target.offsetLeft + dx
      target.css({
        left: left + 'px',
        width: width + 'px'
      })
    }
  }
}

class DragHandler {
  constructor (props) {
    this.selection = props.selection
    this.targets = []
    this.pointedTarget = null
    this.strategies = [
      new RightEdgeDragStrategy({ renderer: props.renderer }),
      new LeftEdgeDragStrategy({ renderer: props.renderer }),
      new MoveDragStrategy({ renderer: props.renderer })
    ]
    this.noopStrategy = new NoopDragStrategy({ renderer: props.renderer })
    this.strategy = this.noopStrategy
  }

  findTarget (element) {
    return this.targets.find(target => target.element === element) || null
  }

  retrieveStrategy (pointedTarget, x) {
    const context = { pointedTarget, x }
    return this.strategies.find(strategy => strategy.match(context)) || this.noopStrategy
  }

  start (context) {
    this.selection.clear()
    this.selection.add(context.event.target)
    this.targets = this.selection.map(DragTarget.create)
    this.pointedTarget = this.findTarget(context.event.target)
    if (this.pointedTarget) {
      context.event.preventDefault()
    }
    this.strategy = this.retrieveStrategy(this.pointedTarget, context.x)
    this.strategy.start(this.targets)
  }

  move (context) {
    this.strategy.move(this.targets, context.dx, context.dy)
  }

  end () {
    this.strategy.end(this.targets)
  }
}

class WebEdit {
  constructor () {
    this.renderer = new Renderer()
    this.selection = new Selection({
      className: '_webedit_selected',
      filter: element => element.classList.contains('_webedit_target'),
      renderer: this.renderer
    })
    this.dragHandler = new DragHandler({
      selection: this.selection,
      renderer: this.renderer
    })
    this.draggable = new Draggable({
      element: document.body,
      onstart: this.dragHandler.start.bind(this.dragHandler),
      onmove: this.dragHandler.move.bind(this.dragHandler),
      onend: this.dragHandler.end.bind(this.dragHandler)
    })
    this.keyInput = new KeyInput({
      ArrowLeft: this.onkeyinput.bind(this, 'left', -1),
      ArrowUp: this.onkeyinput.bind(this, 'top', -1),
      ArrowRight: this.onkeyinput.bind(this, 'left', 1),
      ArrowDown: this.onkeyinput.bind(this, 'top', 1)
    })
  }

  static get CSS_RULES () {
    return [
      `._webedit ._webedit_target {
        border: 1px solid cyan;
        margin: -1px;
        pointer-events: auto;
      }`,
      `._webedit ._webedit_selected {
        border-color: red;
      }`,
      `._webedit :not(._webedit_target) {
        pointer-events: none;
      }`
    ]
  }

  static insertCSSRules (rules) {
    const style = document.createElement('style')
    document.head.appendChild(style)
    rules.forEach((rule, index) => style.sheet.insertRule(rule, index))
  }

  enable () {
    WebEdit.insertCSSRules(WebEdit.CSS_RULES)
    document.body.classList.add('_webedit')
    this.draggable.enable()
    this.keyInput.enable()
  }

  onkeyinput (name, diff, context) {
    context.event.preventDefault()
    this.selection.forEach(element => {
      const style = window.getComputedStyle(element)
      element.style[name] = parseInt(style[name], 10) + diff + 'px'
    })
  }
}

const main = () => {
  new WebEdit().enable()
}

main()
