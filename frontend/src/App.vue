<template>
  <div>
    <AppOrchestrator />
    <NotificationToast />
    <ServerDisconnectedBanner />
    <WebSocketDebugPanel v-if="authStore.isTestMode" />
  </div>
</template>

<script setup lang="ts">
import AppOrchestrator from './components/AppOrchestrator.vue'
import NotificationToast from './components/NotificationToast.vue'
import ServerDisconnectedBanner from './components/ServerDisconnectedBanner.vue'
import WebSocketDebugPanel from './components/WebSocketDebugPanel.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
</script>
