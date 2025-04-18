<template>
  <div class="main-view">
    <div class="mobile-header">
      <button class="hamburger-btn" @click="toggleSidebar">
        <i class="fas fa-bars"></i>
      </button>
    </div>
    <div class="page-title">
      <h1>I-App Main</h1>
      <div class="title-underline"></div>
    </div>
    <div class="content">
      <div class="sidebar" :class="{ 'sidebar-open': isSidebarOpen }">
        <div class="sidebar-header">
          <h3>메뉴</h3>
          <button class="close-btn" @click="toggleSidebar">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <nav class="sidebar-nav">
          <a href="#" class="nav-item">메뉴 1</a>
          <a href="#" class="nav-item">메뉴 2</a>
          <a href="#" class="nav-item">메뉴 3</a>
        </nav>
      </div>
      <div class="msa-grid">
        <div class="top-row">
          <MSA1ImageInput class="msa-card msa1" />
          <MSA2LLMAnalysis class="msa-card msa2" />
          <MSA3LLMAnalysis2 class="msa-card msa3" />
        </div>
        <div class="bottom-row">
          <MSA4VectorTransform class="msa-card msa4" />
          <div class="msa5-6-container">
            <MSA5ImageLCNC class="msa-card msa5" />
            <MSA6FinalResult class="msa-card msa6" />
          </div>
        </div>
      </div>
    </div>
    <MainFooter />
    <div class="sidebar-overlay" v-if="isSidebarOpen" @click="toggleSidebar"></div>
  </div>
</template>

<script>
import MSA1ImageInput from '@/components/msa1_image_input.vue'
import MSA2LLMAnalysis from '@/components/msa2_llm_analysis.vue'
import MSA3LLMAnalysis2 from '@/components/msa3_llm_analysis2.vue'
import MSA4VectorTransform from '@/components/msa4_vector_transform.vue'
import MSA5ImageLCNC from '@/components/msa5_image_lcnc.vue'
import MSA6FinalResult from '@/components/msa6_final_result.vue'
import MainFooter from '@/views/m0_footer.vue'

export default {
  name: 'MSADashboard',
  components: {
    MSA1ImageInput,
    MSA2LLMAnalysis,
    MSA3LLMAnalysis2,
    MSA4VectorTransform,
    MSA5ImageLCNC,
    MSA6FinalResult,
    MainFooter
  },
  data() {
    return {
      isSidebarOpen: false
    }
  },
  methods: {
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    }
  }
}
</script>

<style scoped>
.main-view {
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
}

.page-title h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-800);
  margin: 0;
  letter-spacing: -0.5px;
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
  height: calc(100vh - 13rem);
  min-height: 800px;
}

.msa-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem;
  width: 100%;
  height: 100%;
}

.top-row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 2fr;
  gap: 2rem;
  width: 100%;
  height: 40%;
  min-height: 300px;
}

.bottom-row {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  width: 100%;
  height: 60%;
  min-height: 400px;
}

.msa5-6-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  height: 100%;
}

.msa-card {
  background: white;
  border-radius: 15px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msa1 {
  height: 100%;
}

.msa2, .msa3 {
  height: 100%;
}

.msa4 {
  height: 100%;
  width: 300px;
}

.msa5 {
  height: 100%;
}

.msa6 {
  height: 100%;
  width: 100%;
}

.msa-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

@media (max-width: 1600px) {
  .top-row {
    grid-template-columns: 1fr 1.5fr 1.5fr;
  }
}

@media (max-width: 1400px) {
  .top-row {
    grid-template-columns: 1fr 1fr 1fr;
    height: 45%;
  }

  .bottom-row {
    height: 55%;
  }
}

@media (max-width: 1200px) {
  .content {
    height: auto;
  }

  .top-row {
    grid-template-columns: 1fr;
    height: auto;
    gap: 1rem;
  }

  .bottom-row {
    grid-template-columns: 1fr;
    height: auto;
    gap: 1rem;
  }

  .msa5-6-container {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .msa1, .msa2, .msa3 {
    min-height: 250px;
    height: auto;
  }

  .msa4 {
    width: 100%;
    height: 300px;
  }

  .msa5 {
    min-height: 400px;
    width: 100%;
  }

  .msa6 {
    width: 100%;
    height: 400px;
  }

  .msa-card {
    margin-bottom: 1rem;
  }

  .mobile-header {
    display: block;
  }

  .main-view {
    padding-top: 0;
  }
}

@media (max-width: 768px) {
  .msa1, .msa2, .msa3, .msa4 {
    min-height: 200px;
  }

  .msa5, .msa6 {
    height: 300px;
  }

  .msa-grid {
    gap: 1rem;
    padding: 0.5rem;
  }
}

.dashboard-footer {
  background: rgba(255, 255, 255, 0.8);
  padding: 0.75rem 0;
  border-top: 1px solid var(--gray-200);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  color: var(--gray-500);
}

.footer-info p {
  margin: 0;
  font-size: 0.85rem;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.footer-link {
  color: var(--primary-600);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: var(--primary-700);
}

.mobile-header {
  display: none;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.hamburger-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--primary-600);
  cursor: pointer;
  padding: 0.5rem;
}

.sidebar {
  position: fixed;
  top: 0;
  left: -300px;
  width: 300px;
  height: 100vh;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 1000;
}

.sidebar-open {
  left: 0;
}

.sidebar-header {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--gray-200);
}

.sidebar-header h3 {
  margin: 0;
  color: var(--primary-800);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--gray-600);
  cursor: pointer;
}

.sidebar-nav {
  padding: 1rem;
}

.nav-item {
  display: block;
  padding: 1rem;
  color: var(--gray-800);
  text-decoration: none;
  transition: background 0.2s;
  border-radius: 8px;
}

.nav-item:hover {
  background: var(--primary-50);
  color: var(--primary-600);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}
</style> 