import axios from 'axios'

const state = {
  analysisResults: {},
  currentAnalysis: null,
  isAnalyzing: false
}

const mutations = {
  SET_ANALYSIS_RESULT(state, { imageId, result }) {
    state.analysisResults[imageId] = result
  },
  SET_CURRENT_ANALYSIS(state, analysis) {
    state.currentAnalysis = analysis
  },
  SET_ANALYZING(state, status) {
    state.isAnalyzing = status
  },
  CLEAR_ANALYSIS(state, imageId) {
    delete state.analysisResults[imageId]
  }
}

const actions = {
  async analyzeImage({ commit, rootState }, imageId) {
    commit('SET_ANALYZING', true)
    try {
      const response = await axios.post(`/api/llm/analyze/${imageId}`, null, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      
      commit('SET_ANALYSIS_RESULT', {
        imageId,
        result: response.data
      })
      commit('SET_CURRENT_ANALYSIS', response.data)
      
      return response.data
    } catch (error) {
      console.error('Failed to analyze image:', error)
      throw error
    } finally {
      commit('SET_ANALYZING', false)
    }
  },

  async generateDescription({ commit, rootState }, { imageId, prompt }) {
    try {
      const response = await axios.post(`/api/llm/describe/${imageId}`, { prompt }, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      
      commit('SET_ANALYSIS_RESULT', {
        imageId,
        result: {
          ...state.analysisResults[imageId],
          description: response.data.description
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to generate description:', error)
      throw error
    }
  },

  async getImageTags({ commit, rootState }, imageId) {
    try {
      const response = await axios.get(`/api/llm/tags/${imageId}`, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      
      commit('SET_ANALYSIS_RESULT', {
        imageId,
        result: {
          ...state.analysisResults[imageId],
          tags: response.data.tags
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to get image tags:', error)
      throw error
    }
  },

  async getImageVector({ commit, rootState }, imageId) {
    try {
      const response = await axios.get(`/api/llm/vector/${imageId}`, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      
      commit('SET_ANALYSIS_RESULT', {
        imageId,
        result: {
          ...state.analysisResults[imageId],
          vector: response.data.vector
        }
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to get image vector:', error)
      throw error
    }
  }
}

const getters = {
  getAnalysisResult: state => imageId => state.analysisResults[imageId],
  currentAnalysis: state => state.currentAnalysis,
  isAnalyzing: state => state.isAnalyzing
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
} 