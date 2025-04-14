import { createStore } from 'vuex'
import auth from './modules/auth'
import imageProcessing from './modules/imageProcessing'
import workflow from './modules/workflow'

export default createStore({
  state: {
  },
  mutations: {
  },
  actions: {
  },
  modules: {
    auth,
    imageProcessing,
    workflow
  }
}) 