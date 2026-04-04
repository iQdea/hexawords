<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)

onMounted(() => {
  auth.init()
})

async function handleSignOut() {
  await auth.signOut()
  menuOpen.value = false
  router.push('/')
}

function navigate(path: string) {
  menuOpen.value = false
  router.push(path)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="logo">
        <span class="logo-hex">&#x2B22;</span> Hexawords
      </RouterLink>
      <div class="menu-wrap">
        <button class="menu-toggle" @click="menuOpen = !menuOpen">&#9776;</button>
        <transition name="dropdown">
          <div v-if="menuOpen" class="dropdown" @click.self="menuOpen = false">
            <button class="dd-item" @click="navigate('/rules')">Правила</button>
            <button class="dd-item" @click="navigate('/leaderboard')">Лидерборд</button>
            <button class="dd-item" @click="navigate('/profile')">Профиль</button>
            <div class="dd-divider"></div>
            <button v-if="auth.isAuthenticated" class="dd-item" @click="handleSignOut">Выйти</button>
            <button v-else class="dd-item" @click="navigate('/login')">Войти</button>
          </div>
        </transition>
      </div>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
  background: url('/img/sky.png') top center / cover no-repeat fixed;
  background-color: #87ceeb;
}

#app {
  height: 100%;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0.4rem 1rem;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  z-index: 100;
  flex-shrink: 0;
  height: 44px;
}

.logo {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: #1565c0;
}

.logo-hex {
  font-size: 1.4rem;
  color: #43a047;
}

.menu-wrap {
  margin-left: auto;
  position: relative;
}

.menu-toggle {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  color: #555;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
}
.menu-toggle:hover { background: rgba(0,0,0,0.05); }

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.3rem;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  min-width: 150px;
  padding: 0.3rem;
  z-index: 200;
}

.dd-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.8rem;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #333;
  font-family: inherit;
}
.dd-item:hover { background: rgba(25,118,210,0.08); color: #1565c0; }

.dd-divider {
  height: 1px;
  background: rgba(0,0,0,0.08);
  margin: 0.2rem 0.4rem;
}

.dropdown-enter-active { transition: opacity 0.15s, transform 0.15s; }
.dropdown-leave-active { transition: opacity 0.1s, transform 0.1s; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
