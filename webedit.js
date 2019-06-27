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
  `._webedit :not(._webedit_target) {
    pointer-events: none;
  }`
]

const SUPPORTS_TOUCH = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const TYPE_START = (SUPPORTS_TOUCH ? 'touchstart' : 'mousedown')
const TYPE_MOVE = (SUPPORTS_TOUCH ? 'touchmove' : 'mousemove')
const TYPE_END = (SUPPORTS_TOUCH ? 'touchend' : 'mouseup')

const insertCSSRules = (rules) => {
  const style = document.createElement('style')
  document.head.appendChild(style)
  rules.forEach((rule, index) => style.sheet.insertRule(rule, index))
}

const createPointer = (event) => {
  const touch = (SUPPORTS_TOUCH && 'changedTouches' in event ? event.changedTouches[0] : null)
  const pageX = (touch || event).pageX
  const pageY = (touch || event).pageY
  const el = event.target
  const elRect = el.getBoundingClientRect()
  const bodyRect = document.body.getBoundingClientRect()
  const offsetLeft = elRect.left - el.scrollLeft - bodyRect.left
  const offsetTop = elRect.top - el.scrollTop - bodyRect.top
  const offsetX = pageX - offsetLeft
  const offsetY = pageY - offsetTop
  const identifier = (touch ? touch.identifier : null)
  return { pageX, pageY, offsetX, offsetY, identifier }
}

const printElements = (elements) => {
  const output = elements.reduce((s, el) => {
    const style = window.getComputedStyle(el)
    return s + [
      `#${el.id} {`,
      `  left: ${parseInt(style.left, 10)}px;`,
      `  top: ${parseInt(style.top, 10)}px;`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n\n'
    ].join('\n')
  }, '')
  console.log(output)
}

class Draggable {
  constructor (element) {
    this.element = element
    this.start = this.start.bind(this)
    this.move = this.move.bind(this)
    this.end = this.end.bind(this)
    this.onstart = null
    this.onmove = null
    this.onend = null
    this.lock = false
    this.identifier = null
    this.startPageX = 0
    this.startPageY = 0
    this.context = {}
  }

  enable (listeners) {
    this.onstart = listeners.onstart
    this.onmove = listeners.onmove
    this.onend = listeners.onend
    this.element.addEventListener(TYPE_START, this.start, { passive: false })
  }

  disable () {
    this.element.removeEventListener(TYPE_START, this.start, { passive: false })
    document.removeEventListener(TYPE_MOVE, this.move)
    document.removeEventListener(TYPE_END, this.end)
    this.onstart = null
    this.onmove = null
    this.onend = null
    this.lock = false
    this.context = {}
  }

  start (event) {
    if (this.lock) {
      return
    }
    this.lock = true
    const p = createPointer(event)
    this.identifier = p.identifier
    this.startPageX = p.pageX
    this.startPageY = p.pageY
    this.onstart.call(null, p.offsetX, p.offsetY, event, this.context)
    document.addEventListener(TYPE_MOVE, this.move)
    document.addEventListener(TYPE_END, this.end)
  }

  move (event) {
    const p = createPointer(event)
    if (this.identifier && this.identifier !== p.identifier) {
      return
    }
    const dx = p.pageX - this.startPageX
    const dy = p.pageY - this.startPageY
    this.onmove.call(null, dx, dy, event, this.context)
  }

  end (event) {
    const p = createPointer(event)
    if (this.identifier && this.identifier !== p.identifier) {
      return
    }
    document.removeEventListener(TYPE_MOVE, this.move)
    document.removeEventListener(TYPE_END, this.end)
    const dx = p.pageX - this.startPageX
    const dy = p.pageY - this.startPageY
    this.onend.call(null, dx, dy, event, this.context)
    this.lock = false
  }
}

class Editable {
  constructor (element) {
    this.draggable = new Draggable(element)
    this.requestID = 0
    this.target = null
    element.addEventListener('keydown', this.onkeydown.bind(this))
  }

  enable () {
    this.draggable.enable({
      onstart: this.onstart.bind(this),
      onmove: this.onmove.bind(this),
      onend: this.onend.bind(this)
    })
  }

  onstart (x, y, event, context) {
    const target = event.target
    this.target = (target.classList.contains('_webedit_target') ? target : null)
    if (!this.target) {
      return
    }
    event.preventDefault()
    const style = window.getComputedStyle(target)
    context.left = parseInt(style.left, 10)
    context.top = parseInt(style.top, 10)
    context.width = parseInt(style.width, 10)
    context.isLeftEdge = (x >= 0 && x <= 12)
    context.isRightEdge = (context.width - 12 <= x && x <= context.width)
    target.style.borderLeftColor = (context.isLeftEdge ? 'orange' : '')
    target.style.borderRightColor = (context.isRightEdge ? 'orange' : '')
  }

  onmove (dx, dy, event, context) {
    if (!this.target) {
      return
    }
    let dleft = 0
    let dtop = 0
    let dwidth = 0
    if (context.isRightEdge) {
      dwidth += dx
    } else if (context.isLeftEdge) {
      dleft += dx
      dwidth -= dx
    } else {
      dleft += dx
      dtop += dy
    }
    if (this.requestID) {
      window.cancelAnimationFrame(this.requestID)
    }
    this.requestID = window.requestAnimationFrame(() => {
      const style = this.target.style
      style.left = (context.left + dleft) + 'px'
      style.top = (context.top + dtop) + 'px'
      style.width = Math.max(context.width + dwidth, 24) + 'px'
      this.requestID = 0
    })
  }

  onend (dx, dy, event, context) {
    const target = this.target
    if (!target) {
      return
    }
    window.requestAnimationFrame(() => {
      const style = target.style
      style.borderLeftColor = ''
      style.borderRightColor = ''
      printElements(Array.from(document.querySelectorAll('._webedit_target')))
    })
  }

  onkeydown (event) {
    if (!this.target) {
      return
    }
    const style = window.getComputedStyle(this.target)
    switch (event.which) {
      // left
      case 37:
        event.preventDefault()
        this.target.style.left = parseInt(style.left, 10) - 1 + 'px'
        break
      // up
      case 38:
        event.preventDefault()
        this.target.style.top = parseInt(style.top, 10) - 1 + 'px'
        break
      // right
      case 39:
        event.preventDefault()
        this.target.style.left = parseInt(style.left, 10) + 1 + 'px'
        break
      // down
      case 40:
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
