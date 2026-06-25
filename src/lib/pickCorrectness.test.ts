import { describe, it, expect } from 'vitest'
import {
  hasAnyGroupResults,
  isFirstCorrect,
  isSecondCorrect,
  isThirdAdvancing,
} from './pickCorrectness'

const results = [
  {
    groupId: 'g-a',
    firstTeamId: 'mx',
    secondTeamId: 'br',
    thirdTeamId: 'za',
    advancingAsThird: true,
  },
]

describe('pickCorrectness', () => {
  it('detects confirmed group results', () => {
    expect(hasAnyGroupResults(results)).toBe(true)
    expect(hasAnyGroupResults([])).toBe(false)
  })

  it('marks correct first and second picks', () => {
    expect(isFirstCorrect('g-a', 'mx', results)).toBe(true)
    expect(isFirstCorrect('g-a', 'br', results)).toBe(false)
    expect(isSecondCorrect('g-a', 'br', results)).toBe(true)
  })

  it('marks advancing third picks', () => {
    expect(isThirdAdvancing('za', results)).toBe(true)
    expect(isThirdAdvancing('br', results)).toBe(false)
  })
})
