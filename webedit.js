/**
 * webedit v0.1.0
 * (c) 2019 iOnStage
 * Released under the MIT License.
 */

const CSS_RULES = [
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

const insertCSSRules = (rules) => {
  const style = document.createElement('style')
  document.head.appendChild(style)
  rules.forEach((rule, index) => style.sheet.insertRule(rule, index))
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

class Editable {
  constructor (element) {
    const onstart = this.onstart.bind(this)
    const onmove = this.onmove.bind(this)
    const onend = this.onend.bind(this)
    this.element = element
    this.draggable = new Draggable({ element, onstart, onmove, onend })
    this.requestID = 0
    this.target = null
    this.context = {}
  }

  static printElement (element) {
    const style = window.getComputedStyle(element)
    const output = [
      `#${element.id} {`,
      `  left: ${parseInt(style.left, 10)}px;`,
      `  top: ${parseInt(style.top, 10)}px;`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n\n'
    ].join('\n')
    console.log(output)
  }

  enable () {
    this.draggable.enable()
    this.element.addEventListener('keydown', this.onkeydown.bind(this))
  }

  onstart (context) {
    if (this.target && this.target !== context.event.target) {
      this.target.classList.remove('_webedit_selected')
    }
    if (!context.event.target.classList.contains('_webedit_target')) {
      this.target = null
      return
    }
    context.event.preventDefault()
    this.target = context.event.target
    this.target.classList.add('_webedit_selected')
    const style = window.getComputedStyle(this.target)
    this.context.left = parseInt(style.left, 10)
    this.context.top = parseInt(style.top, 10)
    this.context.width = parseInt(style.width, 10)
    this.context.isLeftEdge = (context.x >= 0 && context.x <= 12)
    this.context.isRightEdge = (this.context.width - 12 <= context.x && context.x <= this.context.width)
    this.target.style.borderLeftColor = (this.context.isLeftEdge ? 'orange' : '')
    this.target.style.borderRightColor = (this.context.isRightEdge ? 'orange' : '')
  }

  onmove (context) {
    if (!this.target) {
      return
    }
    let dleft = 0
    let dtop = 0
    let dwidth = 0
    if (this.context.isRightEdge) {
      dwidth += context.dx
    } else if (this.context.isLeftEdge) {
      dleft += context.dx
      dwidth -= context.dx
    } else {
      dleft += context.dx
      dtop += context.dy
    }
    if (this.requestID) {
      window.cancelAnimationFrame(this.requestID)
    }
    this.requestID = window.requestAnimationFrame(() => {
      this.target.style.left = (this.context.left + dleft) + 'px'
      this.target.style.top = (this.context.top + dtop) + 'px'
      this.target.style.width = Math.max(this.context.width + dwidth, 24) + 'px'
      this.requestID = 0
    })
  }

  onend () {
    if (!this.target) {
      return
    }
    window.requestAnimationFrame(() => {
      this.target.style.borderLeftColor = ''
      this.target.style.borderRightColor = ''
      Editable.printElement(this.target)
    })
  }

  onkeydown (event) {
    if (!this.target) {
      return
    }
    const style = window.getComputedStyle(this.target)
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        this.target.style.left = parseInt(style.left, 10) - 1 + 'px'
        break
      case 'ArrowUp':
        event.preventDefault()
        this.target.style.top = parseInt(style.top, 10) - 1 + 'px'
        break
      case 'ArrowRight':
        event.preventDefault()
        this.target.style.left = parseInt(style.left, 10) + 1 + 'px'
        break
      case 'ArrowDown':
        event.preventDefault()
        this.target.style.top = parseInt(style.top, 10) + 1 + 'px'
        break
    }
  }
}

const main = () => {
  insertCSSRules(CSS_RULES)
  document.body.classList.add('_webedit')
  new Editable(document.body).enable()
}

main()
