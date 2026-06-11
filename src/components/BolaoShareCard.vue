<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  averagePoolSimilarity,
  computePositionStats,
  computeThirdVotes,
  type AnalysisGroup,
  type AnalysisPick,
  type AnalysisTeam,
} from '../lib/groupAnalysis'
import { toFlagEmoji } from '../lib/flags'
import type { Member } from '../types'

const props = defineProps<{
  poolName: string
  members: Member[]
  picks: AnalysisPick[]
  groups: AnalysisGroup[]
  teams: AnalysisTeam[]
  loading: boolean
}>()

// ── canvas setup ─────────────────────────────────────────────────────────────
const W = 1080
const H = 1350
const PAD = 72
const GAP = 20
const RADIUS = 18

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendering = ref(false)
const copied = ref(false)

// ── computed card data ────────────────────────────────────────────────────────
const activePicks = computed(() => props.picks.filter((p) => p.groupBets.length > 0))

const cardData = computed(() => {
  const totalPpl = props.members.length
  const completed = props.picks.filter((p) => p.groupBets.length === 12 && p.bestThirds.length === 8).length
  const avgSim = averagePoolSimilarity(activePicks.value)

  const firstStats = computePositionStats(activePicks.value, props.teams, 'first')
  const topFirst = firstStats[0]
    ? { team: firstStats[0].team, flag: firstStats[0].flag, pct: firstStats[0].pct, group: firstStats[0].group }
    : null

  const thirdStats = computeThirdVotes(activePicks.value, props.teams)
  const topThird = thirdStats[0] ? { team: thirdStats[0].team, flag: thirdStats[0].flag, count: thirdStats[0].count } : null

  const scorerCounts = new Map<string, number>()
  for (const m of props.members) {
    const p = m.top_scorer_pick?.trim()
    if (p) scorerCounts.set(p, (scorerCounts.get(p) ?? 0) + 1)
  }
  const topScorerEntry = [...scorerCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const topScorer = topScorerEntry
    ? { player: topScorerEntry[0], count: topScorerEntry[1], pct: totalPpl > 0 ? Math.round((topScorerEntry[1] / totalPpl) * 100) : 0 }
    : null

  const allPositionStats = [
    ...computePositionStats(activePicks.value, props.teams, 'first'),
    ...computePositionStats(activePicks.value, props.teams, 'second'),
  ]
  const rareEntry = allPositionStats.find((s) => s.count === 1)
  const rarePick = rareEntry
    ? { team: rareEntry.team, flag: rareEntry.flag, group: rareEntry.group, position: rareEntry.position, by: rareEntry.voters[0] }
    : null

  return { poolName: props.poolName, totalPpl, completed, avgSim, topFirst, topThird, topScorer, rarePick }
})

// ── canvas drawing ────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function emojiFont(size: number) {
  return `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
}

function drawStatBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string,
  bgColor: string,
) {
  ctx.fillStyle = bgColor
  rr(ctx, x, y, w, h, RADIUS)
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  rr(ctx, x, y, w, h, RADIUS)
  ctx.stroke()
}

async function draw(canvas: HTMLCanvasElement) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')!
  const d = cardData.value

  ctx.clearRect(0, 0, W, H)

  // ── background ──
  ctx.fillStyle = '#0f1419'
  ctx.fillRect(0, 0, W, H)

  const g1 = ctx.createRadialGradient(180, 0, 0, 180, 0, 900)
  g1.addColorStop(0, 'rgba(200,245,66,0.22)')
  g1.addColorStop(0.55, 'rgba(200,245,66,0.06)')
  g1.addColorStop(1, 'rgba(200,245,66,0)')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)

  const g2 = ctx.createRadialGradient(W - 120, H, 0, W - 120, H, 850)
  g2.addColorStop(0, 'rgba(232,196,104,0.22)')
  g2.addColorStop(0.55, 'rgba(232,196,104,0.06)')
  g2.addColorStop(1, 'rgba(232,196,104,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)

  // dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.028)'
  for (let gx = PAD; gx < W - PAD + 1; gx += 50) {
    for (let gy = PAD; gy < H - PAD + 1; gy += 50) {
      ctx.beginPath()
      ctx.arc(gx, gy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // large year watermark
  ctx.font = `800 420px "Syne",sans-serif`
  ctx.fillStyle = 'rgba(200,245,66,0.038)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('26', W / 2 + 60, 430)

  // ── top bar ──
  ctx.textBaseline = 'alphabetic'
  ctx.font = `500 30px "DM Sans",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  const bw = ctx.measureText('boleiros').width
  ctx.fillText('boleiros', PAD, 90)
  ctx.fillStyle = '#c8f542'
  ctx.fillText('.app', PAD + bw, 90)

  ctx.font = `600 26px "DM Sans",sans-serif`
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillText('COPA 2026', W - PAD, 90)

  // ── pool name ──
  ctx.font = `500 26px "DM Sans",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.fillText('BOLÃO', PAD, 168)

  ctx.font = `800 90px "Syne",sans-serif`
  ctx.fillStyle = '#ffffff'
  const nameLines = wrapText(ctx, d.poolName.toUpperCase(), W - PAD * 2).slice(0, 2)
  let nameY = 275
  for (const line of nameLines) {
    ctx.fillText(line, PAD, nameY)
    nameY += 104
  }

  // accent deco line
  const lineY = nameLines.length > 1 ? 420 : 316
  const lg = ctx.createLinearGradient(PAD, 0, PAD + 140, 0)
  lg.addColorStop(0, '#c8f542')
  lg.addColorStop(1, 'rgba(200,245,66,0)')
  ctx.fillStyle = lg
  ctx.fillRect(PAD, lineY + 20, 140, 5)

  // ── stats section ──
  const STATS_Y = lineY + 68
  const HALF = (W - PAD * 2 - GAP) / 2

  // Block 1 – participants / similarity (two-col)
  const B1H = 150
  drawStatBlock(ctx, PAD, STATS_Y, HALF, B1H, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.05)')
  ctx.font = `800 72px "Syne",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = '#c8f542'
  ctx.fillText(String(d.totalPpl), PAD + 22, STATS_Y + 88)
  ctx.font = `500 22px "DM Sans",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.48)'
  ctx.fillText('participantes', PAD + 22, STATS_Y + 124)

  const rx = PAD + HALF + GAP
  drawStatBlock(ctx, rx, STATS_Y, HALF, B1H, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.05)')
  ctx.font = `800 72px "Syne",sans-serif`
  ctx.fillStyle = '#e8c468'
  ctx.fillText(`${d.avgSim}%`, rx + 22, STATS_Y + 88)
  ctx.font = `500 22px "DM Sans",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.48)'
  ctx.fillText('palpites iguais', rx + 22, STATS_Y + 124)

  // Block 2 – most-voted team
  const B2Y = STATS_Y + B1H + GAP
  const B2H = 165
  drawStatBlock(ctx, PAD, B2Y, W - PAD * 2, B2H, 'rgba(200,245,66,0.16)', 'rgba(200,245,66,0.05)')

  ctx.font = `500 22px "DM Sans",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText('Favorito do grupo', PAD + 28, B2Y + 40)

  if (d.topFirst) {
    const flag = toFlagEmoji(d.topFirst.flag)
    const flagX = PAD + 28
    const nameX = flagX + 68
    ctx.font = emojiFont(52)
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(flag, flagX, B2Y + 110)
    ctx.font = `700 54px "Syne",sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(d.topFirst.team, nameX, B2Y + 110)
    ctx.font = `400 20px "DM Sans",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.44)'
    ctx.fillText(`${d.topFirst.pct}% do grupo escolheu como 1º no Grupo ${d.topFirst.group}`, PAD + 28, B2Y + 148)
  } else {
    ctx.font = `500 38px "Syne",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillText('Aguardando palpites…', PAD + 28, B2Y + 110)
  }

  // Block 3 – artilheiro
  const B3Y = B2Y + B2H + GAP
  const B3H = 165
  drawStatBlock(ctx, PAD, B3Y, W - PAD * 2, B3H, 'rgba(232,196,104,0.22)', 'rgba(232,196,104,0.06)')

  ctx.font = `500 22px "DM Sans",sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText('⚽ Artilheiro da galera', PAD + 28, B3Y + 40)

  if (d.topScorer) {
    ctx.font = `700 56px "Syne",sans-serif`
    ctx.fillStyle = '#e8c468'
    const nameMaxW = W - PAD * 2 - 56
    const scorerLines = wrapText(ctx, d.topScorer.player, nameMaxW).slice(0, 1)
    ctx.fillText(scorerLines[0], PAD + 28, B3Y + 110)
    ctx.font = `400 20px "DM Sans",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.44)'
    ctx.fillText(
      `escolhido por ${d.topScorer.count} de ${d.totalPpl} pessoas (${d.topScorer.pct}%)`,
      PAD + 28,
      B3Y + 148,
    )
  } else {
    ctx.font = `500 38px "Syne",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillText('Aguardando palpites…', PAD + 28, B3Y + 110)
  }

  // Block 4 – rarest pick
  const B4Y = B3Y + B3H + GAP
  const B4H = 148
  if (d.rarePick) {
    drawStatBlock(ctx, PAD, B4Y, W - PAD * 2, B4H, 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.03)')
    ctx.font = `500 22px "DM Sans",sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('🔥 Palpite mais ousado', PAD + 28, B4Y + 40)
    const flag2 = toFlagEmoji(d.rarePick.flag)
    ctx.font = emojiFont(42)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(flag2, PAD + 28, B4Y + 104)
    const flag2W = ctx.measureText(flag2).width
    ctx.font = `600 42px "Syne",sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(
      ` ${d.rarePick.team} — ${d.rarePick.position} Gr. ${d.rarePick.group}`,
      PAD + 28 + flag2W,
      B4Y + 104,
    )
    ctx.font = `400 20px "DM Sans",sans-serif`
    ctx.fillStyle = '#e8c468'
    ctx.fillText(`Só ${d.rarePick.by} acredita nesse palpite`, PAD + 28, B4Y + 136)
  }

  // ── bottom bar ──
  const BOT = H - 72
  const lineGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  lineGrad.addColorStop(0, 'rgba(255,255,255,0)')
  lineGrad.addColorStop(0.2, 'rgba(255,255,255,0.12)')
  lineGrad.addColorStop(0.8, 'rgba(255,255,255,0.12)')
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lineGrad
  ctx.fillRect(PAD, BOT - 16, W - PAD * 2, 1)

  ctx.font = `500 24px "DM Sans",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const botText = 'boleiros.app · Copa do Mundo 2026'
  const btw = ctx.measureText(botText).width
  // Split for color
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillText('boleiros', W / 2 - btw / 2 + ctx.measureText('boleiros').width / 2, BOT + 10)
  const bltw = ctx.measureText('boleiros').width
  ctx.fillStyle = '#c8f542'
  ctx.fillText('.app', W / 2 - btw / 2 + bltw + ctx.measureText('.app').width / 2, BOT + 10)
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillText(
    ' · Copa do Mundo 2026',
    W / 2 - btw / 2 + bltw + ctx.measureText('.app · Copa do Mundo 2026').width / 2 + ctx.measureText('.app').width / 2,
    BOT + 10,
  )
  // Simpler: just draw the full string right-aligned from a calculated start
  ctx.textAlign = 'left'
  const startX = W / 2 - btw / 2
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillText('boleiros', startX, BOT + 10)
  ctx.fillStyle = '#c8f542'
  ctx.fillText('.app', startX + ctx.measureText('boleiros').width, BOT + 10)
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillText(
    ' · Copa do Mundo 2026',
    startX + ctx.measureText('boleiros.app').width,
    BOT + 10,
  )
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
async function render() {
  if (!canvasRef.value || props.loading) return
  rendering.value = true
  try {
    await draw(canvasRef.value)
  } finally {
    rendering.value = false
  }
}

onMounted(() => render())
watch([cardData, () => props.loading], () => render())

// ── export ────────────────────────────────────────────────────────────────────
async function downloadImage() {
  if (!canvasRef.value) return
  const link = document.createElement('a')
  const slug = props.poolName.replace(/\s+/g, '-').toLowerCase().slice(0, 40)
  link.download = `boleiros-${slug}.png`
  link.href = canvasRef.value.toDataURL('image/png')
  link.click()
}

async function copyImage() {
  if (!canvasRef.value) return
  try {
    canvasRef.value.toBlob(async (blob) => {
      if (!blob) return
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      copied.value = true
      setTimeout(() => (copied.value = false), 2200)
    }, 'image/png')
  } catch {
    // fallback: just download
    downloadImage()
  }
}
</script>

<template>
  <div class="share-wrap">
    <div class="share-header">
      <div>
        <h2 class="share-title">Compartilhar bolão</h2>
        <p class="share-sub">
          Gere uma imagem para animar os amigos antes da Copa começar.
        </p>
      </div>
    </div>

    <div v-if="loading" class="share-loading">Carregando dados do bolão...</div>

    <template v-else>
      <div class="canvas-preview-wrap">
        <div class="canvas-preview">
          <canvas ref="canvasRef" :width="W" :height="H" />
          <div v-if="rendering" class="canvas-overlay">Gerando…</div>
        </div>
      </div>

      <div class="share-actions">
        <button class="btn btn-primary share-btn" @click="downloadImage">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Baixar imagem
        </button>

        <button class="btn btn-ghost share-btn" @click="copyImage">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {{ copied ? 'Copiado!' : 'Copiar imagem' }}
        </button>
      </div>

      <div class="share-hint card">
        <p>
          <strong>Como usar:</strong> baixe a imagem e mande no grupo do WhatsApp, Instagram Stories ou onde o pessoal estiver.
          A imagem tem resolução 1080 × 1350 px (ideal para Instagram).
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.share-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.share-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.share-title {
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}

.share-sub {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.share-loading {
  color: var(--text-muted);
  padding: 2rem 0;
}

.canvas-preview-wrap {
  display: flex;
  justify-content: center;
}

.canvas-preview {
  position: relative;
  width: 324px;
  height: 405px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--border), 0 20px 60px rgba(0,0,0,0.4);
}

.canvas-preview canvas {
  width: 324px;
  height: 405px;
  display: block;
}

.canvas-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15,20,25,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.share-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
}

.share-hint {
  padding: 1rem 1.25rem;
  font-size: 0.87rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.share-hint strong {
  color: var(--text);
}
</style>
