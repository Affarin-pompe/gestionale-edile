/** Width of the emulated screen when a test does not choose one. */
export const DESKTOP_WIDTH = 1280
/** A phone held upright. */
export const PHONE_WIDTH = 375

let screenWidth = DESKTOP_WIDTH

type ChangeListener =
  ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | EventListenerObject

interface Subscription {
  list: MediaQueryList
  listener: ChangeListener
}

const subscriptions = new Set<Subscription>()

// Only the width queries the app uses; any other query answers "no"
function evaluate(query: string) {
  const width = /^\(\s*(max|min)-width:\s*(\d+)px\s*\)$/.exec(query)
  if (!width) return false
  const limit = Number(width[2])
  return width[1] === 'max' ? screenWidth <= limit : screenWidth >= limit
}

function fakeMatchMedia(query: string): MediaQueryList {
  const subscribe = (listener: ChangeListener | null) => {
    if (listener) subscriptions.add({ list, listener })
  }
  const unsubscribe = (listener: ChangeListener | null) => {
    for (const s of subscriptions) {
      if (s.list === list && s.listener === listener) subscriptions.delete(s)
    }
  }
  const list: MediaQueryList = {
    media: query,
    // Live, as in a browser: it reads the current width every time
    get matches() {
      return evaluate(query)
    },
    onchange: null,
    addEventListener: (type: string, listener: ChangeListener | null) => {
      if (type === 'change') subscribe(listener)
    },
    removeEventListener: (type: string, listener: ChangeListener | null) => {
      if (type === 'change') unsubscribe(listener)
    },
    addListener: subscribe,
    removeListener: unsubscribe,
    dispatchEvent: () => false,
  }
  return list
}

/**
 * jsdom has no window.matchMedia. This one answers the width queries for the screen width set
 * with setScreenWidth (a desktop until then), and fires "change" like a browser when it changes.
 */
export function installMatchMedia() {
  window.matchMedia = fakeMatchMedia
}

/** Resizes the emulated screen; the queries whose answer changes fire "change". */
export function setScreenWidth(width: number) {
  const before = new Map([...subscriptions].map((s) => [s, s.list.matches]))
  screenWidth = width
  for (const [s, matched] of before) {
    const { matches, media } = s.list
    if (matches === matched) continue
    const event: MediaQueryListEvent = Object.assign(new Event('change'), { matches, media })
    if (typeof s.listener === 'function') s.listener.call(s.list, event)
    else s.listener.handleEvent(event)
  }
}

/** How many "change" listeners are still attached, to check that components clean up. */
export function mediaListenerCount() {
  return subscriptions.size
}
