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

  get size () {
    return this.elements.length
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
    this.elements.forEach(callback)
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

class DragHandler {
  constructor (props) {
    this.renderer = props.renderer
    this.selection = props.selection
    this.targetElement = null
    this.left = 0
    this.top = 0
    this.width = 0
    this.isLeftEdge = false
    this.isRightEdge = false
  }

  start (context) {
    this.selection.clear()
    this.selection.add(context.event.target)
    this.targetElement = this.selection.elements[0] || null
    if (!this.targetElement) {
      return
    }
    context.event.preventDefault()
    const style = window.getComputedStyle(this.targetElement)
    this.left = parseInt(style.left, 10)
    this.top = parseInt(style.top, 10)
    this.width = parseInt(style.width, 10)
    this.isLeftEdge = (context.x >= 0 && context.x <= 12)
    this.isRightEdge = (this.width - 12 <= context.x && context.x <= this.width)
    this.targetElement.style.borderColor = (this.isLeftEdge || this.isRightEdge ? 'orange' : '')
  }

  move (context) {
    if (!this.targetElement) {
      return
    }
    let left = this.left
    let top = this.top
    let width = this.width
    if (this.isRightEdge) {
      width += context.dx
    } else if (this.isLeftEdge) {
      left += context.dx
      width -= context.dx
    } else {
      left += context.dx
      top += context.dy
    }
    this.renderer.update(this.update, this.targetElement, left, top, Math.max(width, 24))
  }

  end () {
    if (!this.targetElement) {
      return
    }
    this.renderer.update(() => {
      this.targetElement.style.borderColor = ''
      this.printTarget()
    })
  }

  printTarget () {
    const style = window.getComputedStyle(this.targetElement)
    const output = [
      `#${this.targetElement.id} {`,
      `  left: ${parseInt(style.left, 10)}px;`,
      `  top: ${parseInt(style.top, 10)}px;`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n\n'
    ].join('\n')
    console.log(output)
  }

  update (element, left, top, width) {
    element.style.left = left + 'px'
    element.style.top = top + 'px'
    element.style.width = width + 'px'
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
      renderer: this.renderer,
      selection: this.selection
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
