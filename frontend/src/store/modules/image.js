import axios from 'axios'

const state = {
  images: [],
  currentImage: null,
  uploadProgress: 0
}

const mutations = {
  SET_IMAGES(state, images) {
    state.images = images
  },
  SET_CURRENT_IMAGE(state, image) {
    state.currentImage = image
  },
  SET_UPLOAD_PROGRESS(state, progress) {
    state.uploadProgress = progress
  },
  ADD_IMAGE(state, image) {
    state.images.push(image)
  },
  REMOVE_IMAGE(state, imageId) {
    state.images = state.images.filter(img => img.id !== imageId)
  }
}

const actions = {
  async fetchImages({ commit }) {
    try {
      const response = await axios.get('/api/images')
      commit('SET_IMAGES', response.data)
    } catch (error) {
      console.error('Failed to fetch images:', error)
      throw error
    }
  },

  async uploadImages({ commit, rootState }, files) {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await axios.post('/api/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${rootState.auth.token}`
        },
        onUploadProgress: progressEvent => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          commit('SET_UPLOAD_PROGRESS', progress)
        }
      })

      response.data.forEach(image => {
        commit('ADD_IMAGE', image)
      })

      return response.data
    } catch (error) {
      console.error('Failed to upload images:', error)
      throw error
    }
  },

  async deleteImage({ commit, rootState }, imageId) {
    try {
      await axios.delete(`/api/images/${imageId}`, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('REMOVE_IMAGE', imageId)
    } catch (error) {
      console.error('Failed to delete image:', error)
      throw error
    }
  },

  async processImage({ commit, rootState }, { imageId, operations }) {
    try {
      const response = await axios.post(`/api/images/${imageId}/process`, operations, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('SET_CURRENT_IMAGE', response.data)
      return response.data
    } catch (error) {
      console.error('Failed to process image:', error)
      throw error
    }
  }
}

const getters = {
  allImages: state => state.images,
  currentImage: state => state.currentImage,
  uploadProgress: state => state.uploadProgress
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
} 