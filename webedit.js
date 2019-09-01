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

  update (func, ...args) {
    this.map.set(func, args)
    if (this.requestID) {
      return
    }
    this.requestID = window.requestAnimationFrame(this.onupdate)
  }

  onupdate () {
    this.map.forEach((args, func) => func.apply(null, args))
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
    this.onselect = props.onselect
    this.targetElement = null
    this.left = 0
    this.top = 0
    this.width = 0
    this.isLeftEdge = false
    this.isRightEdge = false
  }

  start (context) {
    if (this.targetElement && this.targetElement !== context.event.target) {
      this.targetElement.classList.remove('_webedit_selected')
    }
    if (!context.event.target.classList.contains('_webedit_target')) {
      this.targetElement = null
      this.onselect(null)
      return
    }
    context.event.preventDefault()
    this.targetElement = context.event.target
    this.onselect(this.targetElement)
    this.targetElement.classList.add('_webedit_selected')
    const style = window.getComputedStyle(this.targetElement)
    this.left = parseInt(style.left, 10)
    this.top = parseInt(style.top, 10)
    this.width = parseInt(style.width, 10)
    this.isLeftEdge = (context.x >= 0 && context.x <= 12)
    this.isRightEdge = (this.width - 12 <= context.x && context.x <= this.width)
    this.targetElement.style.borderLeftColor = (this.isLeftEdge ? 'orange' : '')
    this.targetElement.style.borderRightColor = (this.isRightEdge ? 'orange' : '')
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
      this.targetElement.style.borderLeftColor = ''
      this.targetElement.style.borderRightColor = ''
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
  constructor (props) {
    this.renderer = props.renderer
    this.dragHandler = new DragHandler({
      renderer: this.renderer,
      onselect: this.onselect.bind(this)
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
    this.selectedElement = null
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

  onselect (element) {
    this.selectedElement = element
  }

  onkeyinput (name, diff, context) {
    if (!this.selectedElement) {
      return
    }
    context.event.preventDefault()
    const style = window.getComputedStyle(this.selectedElement)
    this.selectedElement.style[name] = parseInt(style[name], 10) + diff + 'px'
  }
}

const main = () => {
  new WebEdit({ renderer: new Renderer() }).enable()
}

main()
