<template>
  <div class="error-toast" role="alert" aria-live="assertive">
    <div class="error-toast__icon">⚠</div>
    <div class="error-toast__body">
      <span class="error-toast__op">
        "{{ operation }}" failed — change reverted
      </span>
      <span class="error-toast__msg">{{ message }}</span>
    </div>
    <button
      class="error-toast__close"
      @click="$emit('dismiss')"
      aria-label="Dismiss error"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  operation: string;
}>();

defineEmits<{
  dismiss: [];
}>();
</script>
