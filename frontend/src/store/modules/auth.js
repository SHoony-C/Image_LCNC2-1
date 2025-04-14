import axios from 'axios'

const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null
}

const mutations = {
  SET_TOKEN(state, token) {
    state.token = token
    localStorage.setItem('token', token)
  },
  SET_USER(state, user) {
    state.user = user
    localStorage.setItem('user', JSON.stringify(user))
  },
  CLEAR_AUTH(state) {
    state.token = null
    state.user = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

const actions = {
  async login({ commit }, credentials) {
    try {
      const response = await axios.post('/api/auth/login', credentials)
      commit('SET_TOKEN', response.data.token)
      commit('SET_USER', response.data.user)
      return response.data
    } catch (error) {
      throw error.response.data
    }
  },
  async logout({ commit }) {
    commit('CLEAR_AUTH')
  },
  async checkAuth({ commit, state }) {
    if (!state.token) return false
    
    try {
      const response = await axios.get('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      })
      commit('SET_USER', response.data)
      return true
    } catch (error) {
      commit('CLEAR_AUTH')
      return false
    }
  }
}

const getters = {
  isAuthenticated: state => !!state.token,
  currentUser: state => state.user
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
} 