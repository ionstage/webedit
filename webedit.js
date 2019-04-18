const GRID_IMAGE_URI = [
  'data:image/svg+xml;utf8,<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">',
  '<defs>',
  '<pattern id="smallGrid" width="24" height="24" patternUnits="userSpaceOnUse">',
  '<path d="M 24 0 L 0 0 0 24" fill="none" stroke="gray" stroke-width="0.5" />',
  '</pattern>',
  '<pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">',
  '<rect width="120" height="120" fill="url(#smallGrid)" />',
  '<path d="M 120 0 L 0 0 0 120" fill="none" stroke="gray" stroke-width="1" />',
  '</pattern>',
  '</defs>',
  '<rect width="100%" height="100%" fill="url(#grid)" />',
  '</svg>'
].join('')

const CSS_RULES = [
  `._webedit ._webedit_container {
    background-image: url('${GRID_IMAGE_URI}');
    background-position: right 0.5px bottom 0.5px;
  }`,
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
  const offsetLeft = el.getBoundingClientRect().left - el.scrollLeft - document.body.getBoundingClientRect().left
  const offsetTop = el.getBoundingClientRect().top - el.scrollTop - document.body.getBoundingClientRect().top
  const offsetX = pageX - offsetLeft
  const offsetY = pageY - offsetTop
  const identifier = (touch ? touch.identifier : null)
  return { pageX, pageY, offsetX, offsetY, identifier }
}

const printTargets = () => {
  const nodes = Array.from(document.querySelectorAll('._webedit_target'))
  if (nodes.length === 0) {
    return
  }
  const output = nodes.reduce((s, node) => {
    const style = window.getComputedStyle(node)
    return s + [
      `#${node.id} {`,
      `  height: ${parseInt(style.height, 10)}px;`,
      `  left: ${parseInt(style.left, 10)}px;`,
      `  top: ${parseInt(style.top, 10)}px;`,
      `  width: ${parseInt(style.width, 10)}px;`,
      '}\n\n'
    ].join('\n')
  }, '')
  console.log(output)
}

const setInitialTargetsSize = () => {
  const nodes = Array.from(document.querySelectorAll('._webedit_target'))
  if (nodes.length === 0) {
    return
  }
  nodes.forEach((node) => {
    if (parseInt(window.getComputedStyle(node).width, 10) !== 0) {
      return
    }
    if (!(node.firstChild instanceof SVGElement)) {
      return
    }
    const baseVal = node.firstChild.viewBox.baseVal
    node.style.width = baseVal.width.toFixed(3) + 'px'
    node.style.height = baseVal.height.toFixed(3) + 'px'
  })
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
    context.target = (target.classList.contains('_webedit_target') ? target : null)
    if (!context.target) {
      return
    }
    event.preventDefault()
    const style = window.getComputedStyle(target)
    context.left = parseInt(style.left, 10)
    context.top = parseInt(style.top, 10)
    context.width = parseInt(style.width, 10)
    context.height = parseInt(style.height, 10)
    context.isLeftEdge = (x >= 0 && x <= 12)
    context.isRightEdge = (context.width - 12 <= x && x <= context.width)
    context.isTopEdge = (y >= 0 && y <= 12)
    context.isBottomEdge = (context.height - 12 <= y && y <= context.height)
    target.style.borderLeftColor = (context.isLeftEdge ? 'orange' : '')
    target.style.borderRightColor = (context.isRightEdge ? 'orange' : '')
    target.style.borderTopColor = (context.isTopEdge ? 'orange' : '')
    target.style.borderBottomColor = (context.isBottomEdge ? 'orange' : '')
  }

  onmove (dx, dy, event, context) {
    if (!context.target) {
      return
    }
    let dleft = 0
    let dwidth = 0
    if (context.isRightEdge) {
      dwidth += dx
    } else if (context.isLeftEdge) {
      dleft += dx
      dwidth -= dx
    } else {
      if (!context.isBottomEdge && !context.isTopEdge) {
        dleft += dx
      }
    }
    let dtop = 0
    let dheight = 0
    if (context.isBottomEdge) {
      dheight += dy
    } else if (context.isTopEdge) {
      dtop += dy
      dheight -= dy
    } else {
      if (!context.isRightEdge && !context.isLeftEdge) {
        dtop += dy
      }
    }
    const style = context.target.style
    style.left = (context.left + dleft) + 'px'
    style.top = (context.top + dtop) + 'px'
    style.width = Math.max(context.width + dwidth, 24) + 'px'
    style.height = Math.max(context.height + dheight, 24) + 'px'
  }

  onend (dx, dy, event, context) {
    const target = context.target
    if (!target) {
      return
    }
    const rate = context.height / context.width
    const width = parseInt(window.getComputedStyle(target).width, 10)
    const style = target.style
    style.height = (width * rate) + 'px'
    style.borderLeftColor = ''
    style.borderRightColor = ''
    style.borderTopColor = ''
    style.borderBottomColor = ''
    printTargets()
  }
}

const main = () => {
  insertCSSRules(CSS_RULES)
  document.body.classList.add('_webedit')
  setInitialTargetsSize()
  new Editable(document.body).enable()
}

main()
