<template>
  <div>
    <router-view v-if="isRouterRoute" />
    <AppOrchestrator v-else />
    <NotificationToast />
    <ServerDisconnectedBanner />
    <NoSpotifyDeviceBanner />
    <WebSocketDebugPanel v-if="wsDebugEnabled" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppOrchestrator from './components/AppOrchestrator.vue'
import NotificationToast from './components/NotificationToast.vue'
import ServerDisconnectedBanner from './components/ServerDisconnectedBanner.vue'
import NoSpotifyDeviceBanner from './components/NoSpotifyDeviceBanner.vue'
import WebSocketDebugPanel from './components/WebSocketDebugPanel.vue'

const route = useRoute()
const isRouterRoute = computed(() => route.path.startsWith('/test'))
const wsDebugEnabled = import.meta.env.VITE_WS_DEBUG === 'true'
</script>
