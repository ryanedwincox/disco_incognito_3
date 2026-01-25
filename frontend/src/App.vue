<template>
  <div>
    <AppOrchestrator />
    <NotificationToast />
    <ServerDisconnectedBanner />
  </div>
</template>

<script setup lang="ts">
import AppOrchestrator from './components/AppOrchestrator.vue'
import NotificationToast from './components/NotificationToast.vue'
import ServerDisconnectedBanner from './components/ServerDisconnectedBanner.vue'
</script>
