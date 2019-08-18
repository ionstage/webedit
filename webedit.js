/**
 * webedit v0.1.0
 * (c) 2019 iOnStage
 * Released under the MIT License.
 */

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

class Renderer {
  constructor () {
    this.items = []
    this.requestID = 0
  }

  update (item) {
    this.items.push(item)
    if (this.requestID) {
      return
    }
    this.requestID = window.requestAnimationFrame(() => {
      this.items.forEach(item => this[item.func].apply(this, item.args))
      this.items = []
      this.requestID = 0
    })
  }

  addClass (element, className) {
    element.classList.add(className)
  }

  removeClass (element, className) {
    element.classList.remove(className)
  }
}

class WebEdit {
  constructor (props) {
    this.renderer = props.renderer
    this.draggable = new Draggable({
      element: document.body,
      onstart: this.onstart.bind(this),
      onmove: this.onmove.bind(this),
      onend: this.onend.bind(this)
    })
    this.keyInput = new KeyInput({
      ArrowLeft: this.onkeyinput.bind(this, 'left', -1),
      ArrowUp: this.onkeyinput.bind(this, 'top', -1),
      ArrowRight: this.onkeyinput.bind(this, 'left', 1),
      ArrowDown: this.onkeyinput.bind(this, 'top', 1)
    })
    this.requestID = 0
    this.targetElement = null
    this.context = {}
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

  onstart (context) {
    if (this.targetElement && this.targetElement !== context.event.target) {
      this.targetElement.classList.remove('_webedit_selected')
    }
    if (!context.event.target.classList.contains('_webedit_target')) {
      this.targetElement = null
      return
    }
    context.event.preventDefault()
    this.targetElement = context.event.target
    this.targetElement.classList.add('_webedit_selected')
    const style = window.getComputedStyle(this.targetElement)
    this.context.left = parseInt(style.left, 10)
    this.context.top = parseInt(style.top, 10)
    this.context.width = parseInt(style.width, 10)
    this.context.isLeftEdge = (context.x >= 0 && context.x <= 12)
    this.context.isRightEdge = (this.context.width - 12 <= context.x && context.x <= this.context.width)
    this.targetElement.style.borderLeftColor = (this.context.isLeftEdge ? 'orange' : '')
    this.targetElement.style.borderRightColor = (this.context.isRightEdge ? 'orange' : '')
  }

  onmove (context) {
    if (!this.targetElement) {
      return
    }
    let dleft = 0
    let dtop = 0
    let dwidth = 0
    if (this.context.isRightEdge) {
      dwidth = context.dx
    } else if (this.context.isLeftEdge) {
      dleft = context.dx
      dwidth = -context.dx
    } else {
      dleft = context.dx
      dtop = context.dy
    }
    if (this.requestID) {
      window.cancelAnimationFrame(this.requestID)
    }
    this.requestID = window.requestAnimationFrame(() => {
      this.targetElement.style.left = (this.context.left + dleft) + 'px'
      this.targetElement.style.top = (this.context.top + dtop) + 'px'
      this.targetElement.style.width = Math.max(this.context.width + dwidth, 24) + 'px'
      this.requestID = 0
    })
  }

  onend () {
    if (!this.targetElement) {
      return
    }
    window.requestAnimationFrame(() => {
      this.targetElement.style.borderLeftColor = ''
      this.targetElement.style.borderRightColor = ''
      this.printTarget()
    })
  }

  onkeyinput (name, diff, context) {
    if (!this.targetElement) {
      return
    }
    context.event.preventDefault()
    const style = window.getComputedStyle(this.targetElement)
    this.targetElement.style[name] = parseInt(style[name], 10) + diff + 'px'
  }
}

const main = () => {
  new WebEdit({ renderer: new Renderer() }).enable()
}

main()
