<template>
  <div class="app-header">
    <div class="page-title">
      <h1>{{ pageTitle }}</h1>
      <div class="title-underline"></div>
    </div>
    
    <!-- User icon in top right -->
    <div class="user-auth-section">
      <div v-if="isAuthenticated" class="user-icon-container">
        <div class="user-avatar-circle" @click="toggleUserMenu">
          <i class="fas fa-user"></i>
        </div>
        
        <!-- User dropdown menu -->
        <div class="user-dropdown" v-show="showUserMenu">
          <div class="dropdown-header">
            <div class="user-avatar-large">
              <i class="fas fa-user"></i>
            </div>
            <div class="user-details">
              <div class="user-email">{{ currentUser.email || currentUser.username }}</div>
              <div class="user-id">{{ currentUser.id }}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-menu-items">
            <a href="#" class="dropdown-item">
              <i class="fas fa-key"></i> Set OpenAI API Key
            </a>
            <a href="#" class="dropdown-item">
              <i class="fas fa-robot"></i> Set Custom Llama API
            </a>
            <a href="#" class="dropdown-item">
              <i class="fas fa-user-cog"></i> Profile Settings
            </a>
            <a href="#" class="dropdown-item">
              <i class="fas fa-link"></i> Add Links
            </a>
            <a href="#" class="dropdown-item">
              <i class="fas fa-shield-alt"></i> Security
            </a>
            <a href="#" class="dropdown-item" v-if="hasRole('admin')" @click.prevent="goToManagement">
              <i class="fas fa-cog"></i> Administration
            </a>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-menu-items">
            <a href="#" class="dropdown-item logout-item" @click.prevent="handleLogout">
              <i class="fas fa-sign-out-alt"></i> Logout
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

export default {
  name: 'AppHeader',
  props: {
    pageTitle: {
      type: String,
      required: true
    }
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const showUserMenu = ref(false);
    
    const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);
    const currentUser = computed(() => store.getters['auth/currentUser'] || {});
    
    const toggleUserMenu = (event) => {
      event.stopPropagation();
      showUserMenu.value = !showUserMenu.value;
    };
    
    const closeUserMenu = () => {
      showUserMenu.value = false;
    };
    
    const handleLogout = async () => {
      await store.dispatch('auth/logout');
      router.push('/login');
    };
    
    const goToManagement = () => {
      router.push('/admin/dashboard');
    };
    
    const hasRole = (role) => {
      if (!currentUser.value) return false;
      return currentUser.value.permission === role || 
        (currentUser.value.roles && currentUser.value.roles.includes(role));
    };
    
    // Add click outside handler
    const closeOnOutsideClick = (event) => {
      if (showUserMenu.value) {
        const userMenu = document.querySelector('.user-dropdown');
        const userIcon = document.querySelector('.user-avatar-circle');
        if (userMenu && !userMenu.contains(event.target) && 
            userIcon && !userIcon.contains(event.target)) {
          closeUserMenu();
        }
      }
    };
    
    onMounted(() => {
      document.addEventListener('click', closeOnOutsideClick);
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', closeOnOutsideClick);
    });
    
    return {
      isAuthenticated,
      currentUser,
      showUserMenu,
      toggleUserMenu,
      closeUserMenu,
      handleLogout,
      goToManagement,
      hasRole
    };
  }
}
</script>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  position: relative;
  width: 100%;
}

.page-title {
  display: flex;
  flex-direction: column;
}

.page-title h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--primary-700);
  margin-bottom: 0.5rem;
}

.title-underline {
  width: 80px;
  height: 4px;
  background: var(--primary-500);
  border-radius: 2px;
}

.user-auth-section {
  position: absolute;
  top: 0;
  right: 0;
}

.user-icon-container {
  position: relative;
}

.user-avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-600);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.user-avatar-circle:hover {
  background: var(--primary-700);
}

.user-dropdown {
  position: absolute;
  top: 50px;
  right: 0;
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--primary-50);
}

.user-avatar-large {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary-600);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-email {
  font-weight: 600;
  font-size: 0.9rem;
}

.user-id {
  font-size: 0.8rem;
  color: var(--gray-500);
}

.dropdown-divider {
  height: 1px;
  background: var(--gray-200);
  margin: 0;
}

.dropdown-menu-items {
  padding: 0.5rem 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.25rem;
  color: var(--gray-700);
  text-decoration: none;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.dropdown-item:hover {
  background: var(--primary-50);
}

.dropdown-item i {
  margin-right: 0.75rem;
  width: 20px;
  text-align: center;
  font-size: 1rem;
  color: var(--primary-600);
}

.logout-item {
  color: #ef4444;
}

.logout-item i {
  color: #ef4444;
}
</style> 