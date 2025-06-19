<template>
  <div class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="sidebar-header">
      <div class="logo-container">
        <img src="@/assets/logo.png" alt="Logo" class="logo" />
        <span v-if="!isCollapsed">Soft UI Dashboard PRO</span>
      </div>
      <button class="toggle-btn" @click="toggleSidebar">
        <i class="fas fa-bars"></i>
      </button>
    </div>
    
    <div class="sidebar-content">
      <div class="section-title">I-APP</div>
      <nav class="nav-menu">
        <router-link to="/main" class="nav-item" active-class="active">
          <i class="fas fa-image"></i>
          <span v-if="!isCollapsed">Main</span>
        </router-link>
        <router-link to="/analysis" class="nav-item" active-class="active">
          <i class="fas fa-chart-line"></i>
          <span v-if="!isCollapsed">Analysis</span>
        </router-link>
      </nav>

      <div v-if="isAdmin" class="section-title">ADMIN</div>
      <nav v-if="isAdmin" class="nav-menu">
        <router-link to="/admin/dashboard" class="nav-item" active-class="active">
          <i class="fas fa-tachometer-alt"></i>
          <span v-if="!isCollapsed">Dashboard</span>
        </router-link>
        <router-link to="/admin/users" class="nav-item" active-class="active">
          <i class="fas fa-users"></i>
          <span v-if="!isCollapsed">User Management</span>
        </router-link>
        <router-link to="/admin/settings" class="nav-item" active-class="active">
          <i class="fas fa-cog"></i>
          <span v-if="!isCollapsed">Settings</span>
        </router-link>
        <router-link to="/admin/user-count" class="nav-item" active-class="active">
          <i class="fas fa-user-check"></i>
          <span v-if="!isCollapsed">User Count</span>
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'AppSidebar',
  setup() {
    const store = useStore();
    
    // 현재 사용자가 관리자인지 확인
    const isAdmin = computed(() => {
      const user = store.state.auth.user;
      // permission이 'admin'인 경우에만 true를 반환
      return user && user.permission === 'admin';
    });
    
    return {
      isAdmin
    };
  },
  data() {
    return {
      isCollapsed: false
    }
  },
  methods: {
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
      // Emit event to parent to adjust main content margin
      this.$emit('sidebar-toggle', this.isCollapsed);
    }
  }
}
</script>

<style scoped>
.sidebar {
  width: 250px;
  height: 100vh;
  background: white;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  transition: all 0.3s ease;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar.collapsed {
  width: 70px;
}

.sidebar-header {
  height: 70px;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--gray-200);
  position: relative;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  width: 35px;
  height: 35px;
  object-fit: contain;
}

.toggle-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--primary-50);
  color: var(--primary-600);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.toggle-btn i {
  font-size: 1.2rem;
}

.toggle-btn:hover {
  background: var(--primary-100);
  color: var(--primary-700);
}

.sidebar.collapsed .logo-container span {
  display: none;
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}

.sidebar.collapsed .logo-container {
  display: none;
}

.sidebar.collapsed .toggle-btn {
  margin: 0;
  width: 50px;
  height: 50px;
  border-radius: 8px;
}

.sidebar-content {
  padding: 1.5rem 1rem;
  overflow-y: auto;
  height: calc(100vh - 70px);
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-400);
  margin: 0.5rem 0;
  padding: 0 0.5rem;
}

.nav-menu {
  margin-bottom: 2rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  color: var(--gray-600);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
  margin-bottom: 0.25rem;
}

.nav-item:hover {
  background: var(--primary-50);
  color: var(--primary-700);
}

.nav-item.active {
  background: var(--primary-600);
  color: white;
}

.nav-item i {
  width: 20px;
  text-align: center;
}

@media (max-width: 1200px) {
  .sidebar {
    transform: translateX(-100%);
    box-shadow: none;
  }

  .sidebar.collapsed {
    transform: translateX(0);
    width: 250px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  }
  
  .sidebar.collapsed .logo-container {
    display: flex;
  }
  
  .sidebar.collapsed .sidebar-header {
    justify-content: space-between;
    padding: 0 1rem;
  }
}
</style> 