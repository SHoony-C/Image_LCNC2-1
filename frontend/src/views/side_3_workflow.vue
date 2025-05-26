<template>
  <div class="workflow-view">
    <div class="page-title">
      <h1>Workflow</h1>
      <div class="title-underline"></div>
    </div>
    <div class="content">
      <!-- Workflow content here -->
    </div>
    <MainFooter />
  </div>
</template>

<script>
import MainFooter from '@/views/m0_footer.vue'

export default {
  name: 'WorkflowView',
  components: {
    MainFooter
  }
}
</script>

<style scoped>
.workflow-view {
  padding: 2rem;
  background: var(--primary-50);
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  position: relative;
}

.page-title {
  width: 100%;
  text-align: center;
  margin-bottom: 2rem;
  position: relative;
}

.page-title h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-800);
  margin: 0;
  letter-spacing: -0.5px;
  position: relative;
  display: inline-block;
}

.title-underline {
  width: 60px;
  height: 4px;
  background: var(--primary-600);
  margin: 1rem auto 0;
  border-radius: 2px;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 3rem;
  height: calc(100vh - 12rem);
}
</style> 