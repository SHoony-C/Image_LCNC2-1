<template>
  <div class="msa-component" :class="{ active: isActive }">
    <h3>MSA4</h3>
    <div class="content">
      <div class="title">벡터 변환</div>
      <div class="description">관련 이미지 벡터 변환된 것 3차원 plot</div>
      <div class="status-indicator" :class="status">
        {{ statusText }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MSA4VectorTransform',
  data() {
    return {
      isActive: false,
      status: 'pending',
      statusText: '대기중'
    }
  }
}
</script>

<style scoped>
.msa-component {
  border: 2px solid #e6e1f9;
  border-radius: 12px;
  padding: 1rem;
  background: white;
  min-width: 200px;
  transition: all 0.3s ease;
}

.msa-component.active {
  border-color: #9f8fff;
  box-shadow: 0 0 15px rgba(159, 143, 255, 0.2);
}

.content {
  text-align: center;
}

.title {
  font-weight: bold;
  color: #6c5ce7;
  margin-bottom: 0.5rem;
}

.description {
  font-size: 0.9rem;
  color: #666;
}

.status-indicator {
  margin-top: 1rem;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.8rem;
  display: inline-block;
}

.status-indicator.pending {
  background: #e6e1f9;
  color: #6c5ce7;
}

.status-indicator.processing {
  background: #c8f7c5;
  color: #27ae60;
}

.status-indicator.success {
  background: #c8f7c5;
  color: #27ae60;
}

.status-indicator.warning {
  background: #ffeaa7;
  color: #d35400;
}
</style> 