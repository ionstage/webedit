/**
 * webedit v0.1.0
 * (c) 2019 iOnStage
 * Released under the MIT License.
 */

class Renderer {
  constructor () {
    this.map = new Map()
    this.requestID = 0
    this.onupdate = this.onupdate.bind(this)
  }

  update (callback, ...args) {
    this.map.set(callback, args)
    if (this.requestID) {
      return
    }
    this.requestID = window.requestAnimationFrame(this.onupdate)
  }

  onupdate () {
    this.map.forEach((args, callback) => callback.apply(null, args))
    this.map.clear()
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

class DragProxy {
  constructor (props) {
    this.renderer = props.renderer
    this.isLeftEdge = false
    this.isRightEdge = false
  }

  start (targets, x) {
    if (targets.length === 0) {
      return
    }
    this.isLeftEdge = (x >= 0 && x <= 12)
    const width = targets[0].offsetWidth
    this.isRightEdge = (width - 12 <= x && x <= width)
    this.renderer.update(this.onstart, targets, this.isLeftEdge, this.isRightEdge)
  }

  move (targets, dx, dy) {
    if (targets.length === 0) {
      return
    }
    this.renderer.update(this.onmove, targets, dx, dy, this.isLeftEdge, this.isRightEdge)
  }

  end (targets) {
    if (targets.length === 0) {
      return
    }
    this.renderer.update(this.onend, targets)
  }

  onstart (targets, isLeftEdge, isRightEdge) {
    for (let target of targets) {
      target.css({ borderColor: (isLeftEdge || isRightEdge ? 'orange' : '') })
    }
  }

  onmove (targets, dx, dy, isLeftEdge, isRightEdge) {
    for (let target of targets) {
      let left = target.offsetLeft
      let top = target.offsetTop
      let width = target.offsetWidth
      if (isRightEdge) {
        width += dx
      } else if (isLeftEdge) {
        left += dx
        width -= dx
      } else {
        left += dx
        top += dy
      }
      target.css({
        left: left + 'px',
        top: top + 'px',
        width: Math.max(width, 24) + 'px'
      })
    }
  }

  onend (targets) {
    for (let target of targets) {
      target.css({ borderColor: '' })
      console.log(target.cssLog())
    }
  }
}

class DragHandler {
  constructor (props) {
    this.selection = props.selection
    this.targets = []
    this.proxy = new DragProxy({ renderer: props.renderer })
  }

  start (context) {
    this.selection.clear()
    this.selection.add(context.event.target)
    this.targets = this.selection.map(element => {
      const style = window.getComputedStyle(element)
      const offsetLeft = parseInt(style.left, 10)
      const offsetTop = parseInt(style.top, 10)
      const offsetWidth = parseInt(style.width, 10)
      return new DragTarget({ element, offsetLeft, offsetTop, offsetWidth })
    })
    if (this.targets.length > 0) {
      context.event.preventDefault()
    }
    this.proxy.start(this.targets, context.x)
  }

  move (context) {
    this.proxy.move(this.targets, context.dx, context.dy)
  }

  end () {
    this.proxy.end(this.targets)
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
