<template>
  <div class="analysis-view">
    <!-- 분석 뷰 컨텐츠 -->
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      measurementData: [],
      images: []
    };
  },
  methods: {
    async fetchData() {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/side2/data');
        if (response.data.status === 'success') {
          this.measurementData = response.data.data;
          this.images = response.data.images.map(img => ({
            ...img,
            path: `http://127.0.0.1:8000/images/${img.filename}`
          }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }
  },
  mounted() {
    this.fetchData();
  }
};
</script>

<style scoped>
.analysis-view {
  padding: 20px;
}
</style> 