<template>
  <div>
    <router-view />
    <NotificationToast />
    <ServerDisconnectedBanner />
  </div>
</template>

<script setup lang="ts">
import NotificationToast from './components/NotificationToast.vue'
import ServerDisconnectedBanner from './components/ServerDisconnectedBanner.vue'
</script>
