<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function joinWithLink() {
  const link = prompt('Cole o link de convite do bolão:')
  if (!link) return
  try {
    const url = new URL(link)
    const parts = url.pathname.split('/')
    const token = parts[parts.indexOf('b') + 1]
    if (token) router.push(`/b/${token}`)
  } catch {
    if (link.length > 10) router.push(`/b/${link}`)
  }
}
</script>

<template>
  <section class="hero">
    <h1 class="hero__logo">boleiros<span>.app</span></h1>
    <p class="hero__tagline">
      Bolão da Copa entre amigos. Aposte nos grupos, palpite o mata-mata e dispute o ranking.
    </p>
    <div class="hero__actions">
      <button class="btn btn-primary" @click="router.push('/criar')">Criar bolão</button>
      <button class="btn btn-ghost" @click="joinWithLink">Entrar com link</button>
    </div>
  </section>
</template>
