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

const SUPPORTS_TOUCH = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const TYPE_START = (SUPPORTS_TOUCH ? 'touchstart' : 'mousedown')
const TYPE_MOVE = (SUPPORTS_TOUCH ? 'touchmove' : 'mousemove')
const TYPE_END = (SUPPORTS_TOUCH ? 'touchend' : 'mouseup')

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
    this.start = this.start.bind(this)
    this.move = this.move.bind(this)
    this.end = this.end.bind(this)
    this.identifier = null
    this.startPageX = 0
    this.startPageY = 0
    this.element.addEventListener(TYPE_START, this.start, { passive: false })
  }

  static createPointer (event) {
    const touch = ('changedTouches' in event ? event.changedTouches[0] : null)
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

  start (event) {
    if ('touches' in event && event.touches.length > 1) {
      return
    }
    const p = Draggable.createPointer(event)
    this.identifier = p.identifier
    this.startPageX = p.pageX
    this.startPageY = p.pageY
    this.onstart.call(null, p.offsetX, p.offsetY, event)
    document.addEventListener(TYPE_MOVE, this.move)
    document.addEventListener(TYPE_END, this.end)
  }

  move (event) {
    const p = Draggable.createPointer(event)
    if (this.identifier && this.identifier !== p.identifier) {
      return
    }
    const dx = p.pageX - this.startPageX
    const dy = p.pageY - this.startPageY
    this.onmove.call(null, dx, dy, event)
  }

  end (event) {
    const p = Draggable.createPointer(event)
    if (this.identifier && this.identifier !== p.identifier) {
      return
    }
    document.removeEventListener(TYPE_MOVE, this.move)
    document.removeEventListener(TYPE_END, this.end)
    const dx = p.pageX - this.startPageX
    const dy = p.pageY - this.startPageY
    this.onend.call(null, dx, dy, event)
  }
}

class Editable {
  constructor (element) {
    const onstart = this.onstart.bind(this)
    const onmove = this.onmove.bind(this)
    const onend = this.onend.bind(this)
    this.draggable = new Draggable({ element, onstart, onmove, onend })
    this.requestID = 0
    this.target = null
    this.context = {}
    element.addEventListener('keydown', this.onkeydown.bind(this))
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

  onstart (x, y, event) {
    if (this.target && this.target !== event.target) {
      this.target.classList.remove('_webedit_selected')
    }
    if (!event.target.classList.contains('_webedit_target')) {
      this.target = null
      return
    }
    event.preventDefault()
    this.target = event.target
    this.target.classList.add('_webedit_selected')
    const style = window.getComputedStyle(this.target)
    this.context.left = parseInt(style.left, 10)
    this.context.top = parseInt(style.top, 10)
    this.context.width = parseInt(style.width, 10)
    this.context.isLeftEdge = (x >= 0 && x <= 12)
    this.context.isRightEdge = (this.context.width - 12 <= x && x <= this.context.width)
    this.target.style.borderLeftColor = (this.context.isLeftEdge ? 'orange' : '')
    this.target.style.borderRightColor = (this.context.isRightEdge ? 'orange' : '')
  }

  onmove (dx, dy, event) {
    if (!this.target) {
      return
    }
    let dleft = 0
    let dtop = 0
    let dwidth = 0
    if (this.context.isRightEdge) {
      dwidth += dx
    } else if (this.context.isLeftEdge) {
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
      this.target.style.left = (this.context.left + dleft) + 'px'
      this.target.style.top = (this.context.top + dtop) + 'px'
      this.target.style.width = Math.max(this.context.width + dwidth, 24) + 'px'
      this.requestID = 0
    })
  }

  onend (dx, dy, event) {
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
  new Editable(document.body)
}

main()
