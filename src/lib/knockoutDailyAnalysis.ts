import { calculateMatchPoints } from './scoring'
import type { AnalysisPick } from './groupAnalysis'
import type { KnockoutMatchInfo } from '../components/MemberKnockoutPicks.vue'

const BR_TZ = 'America/Sao_Paulo'

export type PredictionStatus = 'exact' | 'result' | 'miss' | 'pending' | 'no_pick'

export type MemberMatchRow = {
  memberId: string
  username: string
  homeScore: number | null
  awayScore: number | null
  points: number | null
  status: PredictionStatus
}

export type MatchDayBlock = {
  matchId: string
  home: string
  away: string
  stageLabel: string
  kickoffAt: string
  kickoffTime: string
  homeScore: number | null
  awayScore: number | null
  finished: boolean
  predictions: MemberMatchRow[]
  pickCount: number
  missingCount: number
  topPrediction: { home: number; away: number; count: number; pct: number } | null
  exactHeroes: string[]
}

export type MemberDayStats = {
  memberId: string
  username: string
  yesterdayPoints: number
  exactCount: number
  resultCount: number
  missCount: number
  todayPicks: number
  todayMissing: number
}

export type KnockoutDailyReport = {
  dayKey: string
  dayLabel: string
  yesterdayKey: string | null
  yesterdayLabel: string | null
  yesterdayMatches: MatchDayBlock[]
  todayMatches: MatchDayBlock[]
  memberStats: MemberDayStats[]
  highlights: string[]
  totalYesterdayPoints: number
  totalExactScores: number
  boldestPick: { username: string; match: string; score: string } | null
  consensusKing: { username: string; match: string; score: string } | null
}

export function toBrDayKey(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function todayBrDayKey(now = new Date()): string {
  return toBrDayKey(now)
}

export function shiftDayKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0))
  return dt.toISOString().slice(0, 10)
}

export function formatBrDayLabel(dayKey: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dayKey}T12:00:00-03:00`))
}

export function formatKickoffTimeBr(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function predictionStatus(
  pred: { homeScore: number; awayScore: number } | null,
  homeScore: number | null,
  awayScore: number | null,
  finished: boolean,
): { status: PredictionStatus; points: number | null } {
  if (!pred) return { status: 'no_pick', points: null }
  if (!finished || homeScore == null || awayScore == null) {
    return { status: 'pending', points: null }
  }
  const points = calculateMatchPoints(pred.homeScore, pred.awayScore, homeScore, awayScore)
  if (points === 10) return { status: 'exact', points }
  if (points === 5) return { status: 'result', points }
  return { status: 'miss', points: 0 }
}

function topPrediction(
  rows: MemberMatchRow[],
): { home: number; away: number; count: number; pct: number } | null {
  const withPick = rows.filter((r) => r.homeScore != null && r.awayScore != null)
  if (withPick.length === 0) return null

  const counts = new Map<string, number>()
  for (const r of withPick) {
    const key = `${r.homeScore}-${r.awayScore}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const [bestKey, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const [home, away] = bestKey.split('-').map(Number)
  return {
    home,
    away,
    count,
    pct: Math.round((count / withPick.length) * 100),
  }
}

function buildMatchBlock(
  match: KnockoutMatchInfo,
  picks: AnalysisPick[],
): MatchDayBlock {
  const finished = match.status === 'finished' && match.homeScore != null && match.awayScore != null

  const predictions: MemberMatchRow[] = picks.map((pick) => {
    const pred = pick.matchPredictions?.find((p) => p.matchId === match.id) ?? null
    const { status, points } = predictionStatus(
      pred,
      match.homeScore,
      match.awayScore,
      finished,
    )
    return {
      memberId: pick.memberId,
      username: pick.username,
      homeScore: pred?.homeScore ?? null,
      awayScore: pred?.awayScore ?? null,
      points,
      status,
    }
  })

  const pickCount = predictions.filter((p) => p.status !== 'no_pick').length
  const exactHeroes = predictions.filter((p) => p.status === 'exact').map((p) => p.username)

  return {
    matchId: match.id,
    home: match.home,
    away: match.away,
    stageLabel: match.stageLabel,
    kickoffAt: match.kickoffAt,
    kickoffTime: formatKickoffTimeBr(match.kickoffAt),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    finished,
    predictions,
    pickCount,
    missingCount: predictions.length - pickCount,
    topPrediction: topPrediction(predictions),
    exactHeroes,
  }
}

export function listMatchDays(matches: KnockoutMatchInfo[]): string[] {
  const days = new Set(matches.map((m) => toBrDayKey(m.kickoffAt)))
  return [...days].sort()
}

export function buildKnockoutDailyReport(
  picks: AnalysisPick[],
  matches: KnockoutMatchInfo[],
  dayKey: string,
): KnockoutDailyReport {
  const yesterdayKey = shiftDayKey(dayKey, -1)
  const hasYesterday = matches.some((m) => toBrDayKey(m.kickoffAt) === yesterdayKey)
  const yesterdayMatches = matches
    .filter((m) => toBrDayKey(m.kickoffAt) === yesterdayKey)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
    .map((m) => buildMatchBlock(m, picks))

  const todayMatches = matches
    .filter((m) => toBrDayKey(m.kickoffAt) === dayKey)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
    .map((m) => buildMatchBlock(m, picks))

  const memberStats: MemberDayStats[] = picks.map((pick) => {
    let yesterdayPoints = 0
    let exactCount = 0
    let resultCount = 0
    let missCount = 0
    let todayPicks = 0
    let todayMissing = 0

    for (const block of yesterdayMatches) {
      const row = block.predictions.find((p) => p.memberId === pick.memberId)
      if (!row || row.status === 'no_pick') continue
      if (row.points != null) yesterdayPoints += row.points
      if (row.status === 'exact') exactCount++
      else if (row.status === 'result') resultCount++
      else if (row.status === 'miss') missCount++
    }

    for (const block of todayMatches) {
      const row = block.predictions.find((p) => p.memberId === pick.memberId)
      if (row?.status === 'no_pick') todayMissing++
      else todayPicks++
    }

    return {
      memberId: pick.memberId,
      username: pick.username,
      yesterdayPoints,
      exactCount,
      resultCount,
      missCount,
      todayPicks,
      todayMissing,
    }
  })

  memberStats.sort(
    (a, b) => b.yesterdayPoints - a.yesterdayPoints || b.exactCount - a.exactCount,
  )

  const totalYesterdayPoints = memberStats.reduce((s, m) => s + m.yesterdayPoints, 0)
  const totalExactScores = memberStats.reduce((s, m) => s + m.exactCount, 0)

  const highlights: string[] = []
  const dayLabel = formatBrDayLabel(dayKey)
  const yesterdayLabel = hasYesterday ? formatBrDayLabel(yesterdayKey) : null

  if (yesterdayMatches.length === 0 && todayMatches.length === 0) {
    highlights.push('Nenhum jogo do mata-mata neste dia ou no dia anterior.')
  }

  if (yesterdayMatches.length > 0) {
    const finishedCount = yesterdayMatches.filter((m) => m.finished).length
    if (finishedCount === 0) {
      highlights.push(`${yesterdayMatches.length} jogo(s) ontem ainda sem resultado oficial.`)
    } else {
      const top = memberStats.find((m) => m.yesterdayPoints > 0)
      if (top) {
        highlights.push(
          `${top.username} liderou ontem com ${top.yesterdayPoints} pts (${top.exactCount} placar(es) exato(s)).`,
        )
      }
      const allExact = yesterdayMatches.flatMap((m) =>
        m.exactHeroes.map((u) => ({ u, match: `${m.home} × ${m.away}` })),
      )
      if (allExact.length > 0) {
        highlights.push(`${allExact.length} placar(es) exato(s) cravados ontem no bolão.`)
      }
    }
  }

  if (todayMatches.length > 0) {
    const totalMissing = todayMatches.reduce((s, m) => s + m.missingCount, 0)
    if (totalMissing > 0) {
      highlights.push(`${totalMissing} palpite(s) ainda faltando para os jogos de hoje.`)
    }
    const consensus = todayMatches.find((m) => m.topPrediction && m.topPrediction.pct >= 50)
    if (consensus?.topPrediction) {
      highlights.push(
        `Consenso forte hoje: ${consensus.topPrediction.pct}% apostaram ${consensus.topPrediction.home}×${consensus.topPrediction.away} em ${consensus.home} × ${consensus.away}.`,
      )
    }
  }

  let boldestPick: KnockoutDailyReport['boldestPick'] = null
  for (const block of todayMatches) {
    if (!block.topPrediction || block.pickCount < 3) continue
    for (const row of block.predictions) {
      if (row.status === 'no_pick' || row.homeScore == null || row.awayScore == null) continue
      const key = `${row.homeScore}-${row.awayScore}`
      const topKey = `${block.topPrediction.home}-${block.topPrediction.away}`
      if (key !== topKey && block.topPrediction.pct >= 40) {
        boldestPick = {
          username: row.username,
          match: `${block.home} × ${block.away}`,
          score: `${row.homeScore}×${row.awayScore}`,
        }
        break
      }
    }
    if (boldestPick) break
  }

  let consensusKing: KnockoutDailyReport['consensusKing'] = null
  for (const block of todayMatches) {
    if (!block.topPrediction || block.topPrediction.count < 2) continue
    const matchLabel = `${block.home} × ${block.away}`
    const score = `${block.topPrediction.home}×${block.topPrediction.away}`
    for (const row of block.predictions) {
      if (row.homeScore === block.topPrediction.home && row.awayScore === block.topPrediction.away) {
        consensusKing = { username: row.username, match: matchLabel, score }
        break
      }
    }
    if (consensusKing) break
  }

  return {
    dayKey,
    dayLabel,
    yesterdayKey: hasYesterday ? yesterdayKey : null,
    yesterdayLabel,
    yesterdayMatches,
    todayMatches,
    memberStats,
    highlights,
    totalYesterdayPoints,
    totalExactScores,
    boldestPick,
    consensusKing,
  }
}

export function buildWhatsAppSummary(report: KnockoutDailyReport, poolName: string): string {
  const lines: string[] = []
  lines.push(`⚽ *${poolName} — Replay do Mata-Mata*`)
  lines.push(`📅 ${report.dayLabel}`)
  lines.push('')

  if (report.yesterdayMatches.length > 0) {
    lines.push(`*ONTEM${report.yesterdayLabel ? ` (${report.yesterdayLabel})` : ''}*`)
    for (const m of report.yesterdayMatches) {
      const result =
        m.finished && m.homeScore != null
          ? ` → *${m.homeScore}×${m.awayScore}*`
          : ' → aguardando resultado'
      lines.push(`• ${m.home} × ${m.away}${result}`)
      for (const p of m.predictions.filter((x) => x.status !== 'no_pick')) {
        const icon =
          p.status === 'exact' ? '✅' : p.status === 'result' ? '🟡' : p.status === 'miss' ? '❌' : '⏳'
        const pts = p.points != null ? ` (+${p.points})` : ''
        lines.push(`  ${icon} ${p.username}: ${p.homeScore}×${p.awayScore}${pts}`)
      }
    }
    lines.push('')
    const top3 = report.memberStats.filter((m) => m.yesterdayPoints > 0).slice(0, 3)
    if (top3.length > 0) {
      lines.push('*Ranking do dia anterior*')
      top3.forEach((m, i) => lines.push(`${i + 1}. ${m.username} — ${m.yesterdayPoints} pts`))
      lines.push('')
    }
  }

  if (report.todayMatches.length > 0) {
    lines.push(`*HOJE — PALPITES*`)
    for (const m of report.todayMatches) {
      lines.push(`• ${m.kickoffTime} — ${m.home} × ${m.away}`)
      if (m.topPrediction) {
        lines.push(
          `  📊 Placar mais votado: ${m.topPrediction.home}×${m.topPrediction.away} (${m.topPrediction.pct}%)`,
        )
      }
      for (const p of m.predictions.filter((x) => x.status !== 'no_pick')) {
        lines.push(`  ${p.username}: ${p.homeScore}×${p.awayScore}`)
      }
      if (m.missingCount > 0) {
        const missing = m.predictions.filter((x) => x.status === 'no_pick').map((x) => x.username)
        lines.push(`  ⚠️ Sem palpite: ${missing.join(', ')}`)
      }
    }
  }

  if (report.highlights.length > 0) {
    lines.push('')
    lines.push('*Destaques*')
    report.highlights.forEach((h) => lines.push(`• ${h}`))
  }

  lines.push('')
  lines.push('boleiros.app 🏆')
  return lines.join('\n')
}
