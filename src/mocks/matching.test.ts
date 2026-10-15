import { describe, expect, it } from 'vitest'
import { recallFixtures } from './data/recalls'
import { itemWords, matchItemName } from './matching'

describe('itemWords', () => {
  it('drops short words, numbers and stopwords', () => {
    expect(itemWords('Organic Baby Spinach 5 oz')).toEqual(['baby', 'spinach'])
  })
})

describe('matchItemName', () => {
  const numbers = (name: string) => matchItemName(name, recallFixtures).map((r) => r.recallingFirm)

  it('matches when at least half the meaningful words appear', () => {
    expect(numbers('Harbor Bay smoked salmon')).toEqual(['Harbor Bay Seafood Co.'])
    expect(numbers('baby spinach')).toEqual(['Brightfield Farms, LLC'])
  })

  it('does not match generic items to unrelated recalls', () => {
    expect(numbers('Whole milk')).toEqual([])
    expect(numbers('Bananas')).toEqual([])
    expect(numbers('5 oz')).toEqual([])
    expect(numbers('Paper towels')).toEqual([])
  })
})
