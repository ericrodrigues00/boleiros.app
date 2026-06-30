import { describe, it, expect } from 'vitest'
import {
  buildKnockoutDailyReport,
  buildWhatsAppSummary,
  formatBrDayLabel,
  shiftDayKey,
  toBrDayKey,
} from './knockoutDailyAnalysis'
import type { AnalysisPick } from './groupAnalysis'
import type { KnockoutMatchInfo } from '../components/MemberKnockoutPicks.vue'

const picks: AnalysisPick[] = [
  {
    memberId: 'a',
    username: 'Ana',
    groupBets: [],
    bestThirds: [],
    matchPredictions: [
      { matchId: 'm1', homeScore: 2, awayScore: 1 },
      { matchId: 'm2', homeScore: 1, awayScore: 1 },
    ],
  },
  {
    memberId: 'b',
    username: 'Bob',
    groupBets: [],
    bestThirds: [],
    matchPredictions: [
      { matchId: 'm1', homeScore: 2, awayScore: 1 },
      { matchId: 'm2', homeScore: 0, awayScore: 2 },
    ],
  },
]

const matches: KnockoutMatchInfo[] = [
  {
    id: 'm1',
    stage: 'round_32',
    stageLabel: '16 avos',
    stageOrder: 1,
    kickoffAt: '2026-06-29T17:00:00.000Z', // 14:00 BRT previous day logic - actually 17 UTC = 14 BRT
    home: 'Brasil',
    away: 'Japão',
    homeScore: 2,
    awayScore: 1,
    status: 'finished',
  },
  {
    id: 'm2',
    stage: 'round_32',
    stageLabel: '16 avos',
    stageOrder: 1,
    kickoffAt: '2026-06-30T17:00:00.000Z',
    home: 'França',
    away: 'Suécia',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
  },
]

describe('knockoutDailyAnalysis', () => {
  it('groups matches by Brasília day', () => {
    expect(toBrDayKey('2026-06-29T17:00:00.000Z')).toBe('2026-06-29')
    expect(toBrDayKey('2026-06-30T02:00:00.000Z')).toBe('2026-06-29')
  })

  it('builds yesterday recap and today preview', () => {
    const report = buildKnockoutDailyReport(picks, matches, '2026-06-30')
    expect(report.yesterdayMatches).toHaveLength(1)
    expect(report.yesterdayMatches[0].exactHeroes).toContain('Ana')
    expect(report.todayMatches).toHaveLength(1)
    expect(report.memberStats[0].yesterdayPoints).toBeGreaterThan(0)
  })

  it('builds whatsapp summary', () => {
    const report = buildKnockoutDailyReport(picks, matches, '2026-06-30')
    const text = buildWhatsAppSummary(report, 'Bolão Teste')
    expect(text).toContain('Bolão Teste')
    expect(text).toContain('Brasil')
    expect(text).toContain('França')
  })

  it('formats day label in pt-BR', () => {
    expect(formatBrDayLabel('2026-06-30')).toMatch(/junho/i)
    expect(shiftDayKey('2026-06-30', -1)).toBe('2026-06-29')
  })
})
