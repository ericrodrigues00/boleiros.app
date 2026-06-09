import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Member } from '../types'
import { useApi } from '../composables/useApi'

const TOKEN_KEY = 'boleiros_token'
const POOL_TOKEN_KEY = 'boleiros_pool_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const poolToken = ref<string | null>(localStorage.getItem(POOL_TOKEN_KEY))
  const member = ref<Member | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!member.value)
  const isAdmin = computed(() => member.value?.role === 'admin')

  function setSession(newToken: string, newMember: Member, inviteToken: string) {
    token.value = newToken
    member.value = newMember
    poolToken.value = inviteToken
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(POOL_TOKEN_KEY, inviteToken)
  }

  function logout() {
    token.value = null
    member.value = null
    poolToken.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(POOL_TOKEN_KEY)
  }

  async function bootstrap(inviteToken?: string) {
    if (!token.value) return false
    if (inviteToken && poolToken.value && inviteToken !== poolToken.value) {
      logout()
      return false
    }
    loading.value = true
    try {
      const api = useApi()
      const { member: m } = await api.auth.me(token.value)
      member.value = m
      return true
    } catch {
      logout()
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    token,
    poolToken,
    member,
    loading,
    isAuthenticated,
    isAdmin,
    setSession,
    logout,
    bootstrap,
  }
})
