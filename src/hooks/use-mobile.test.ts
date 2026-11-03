// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DESKTOP_WIDTH,
  installMatchMedia,
  mediaListenerCount,
  PHONE_WIDTH,
  setScreenWidth,
} from '@/test/media'
import { useIsMobile } from './use-mobile'

installMatchMedia()

afterEach(() => {
  cleanup()
  setScreenWidth(DESKTOP_WIDTH)
})

describe('useIsMobile', () => {
  it.each([
    [PHONE_WIDTH, true],
    [767, true],
    [768, false],
    [DESKTOP_WIDTH, false],
  ])('on a screen %i px wide is %s', (width, expected) => {
    setScreenWidth(width)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(expected)
  })

  it('follows the screen when it crosses the phone width, both ways', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => setScreenWidth(PHONE_WIDTH))
    expect(result.current).toBe(true)

    act(() => setScreenWidth(DESKTOP_WIDTH))
    expect(result.current).toBe(false)
  })

  it('stops listening to the screen once unmounted', () => {
    const { unmount } = renderHook(() => useIsMobile())
    expect(mediaListenerCount()).toBe(1)

    unmount()

    expect(mediaListenerCount()).toBe(0)
  })
})
