<template>
  <div>
    <AppOrchestrator />
    <NotificationToast />
    <ServerDisconnectedBanner />
    <WebSocketDebugPanel v-if="wsDebugEnabled" />
  </div>
</template>

<script setup lang="ts">
import AppOrchestrator from './components/AppOrchestrator.vue'
import NotificationToast from './components/NotificationToast.vue'
import ServerDisconnectedBanner from './components/ServerDisconnectedBanner.vue'
import WebSocketDebugPanel from './components/WebSocketDebugPanel.vue'

const wsDebugEnabled = import.meta.env.VITE_WS_DEBUG === 'true'
</script>
