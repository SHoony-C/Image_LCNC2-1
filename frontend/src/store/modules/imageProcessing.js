import axios from 'axios'
import io from 'socket.io-client'
import LogService from '../../utils/logService'

let socket = null

const state = {
  uploadedImage: null,
  uploadStatus: null,
  processingStatus: {
    msa1: { status: 'idle', progress: 0 },
    msa2: { status: 'idle', progress: 0 },
    msa3: { status: 'idle', progress: 0 },
    msa4: { status: 'idle', progress: 0 }
  },
  processingResults: {
    preprocessedImages: [],
    vectorData: null,
    plotData: null,
    llmResults: null
  },
  activeWorkflow: null,
  workflowHistory: []
}

const getters = {
  isUploading: state => state.uploadStatus === 'uploading',
  isProcessing: state => Object.values(state.processingStatus).some(s => s.status === 'processing'),
  processingProgress: state => {
    const statuses = Object.values(state.processingStatus)
    const total = statuses.reduce((sum, s) => sum + s.progress, 0)
    return Math.round(total / statuses.length)
  },
  workflowSteps: state => state.activeWorkflow ? state.activeWorkflow.steps : []
}

const actions = {
  // Connect to the WebSocket for real-time updates
  connectSocket({ commit, dispatch }) {
    const socketUrl = process.env.VUE_APP_SOCKET_URL || 'http://localhost:8085'
    socket = io(socketUrl)
    
    socket.on('connect', () => {
      console.log('Socket connected')
    })
    
    socket.on('processing_update', data => {
      commit('UPDATE_PROCESSING_STATUS', data)
    })
    
    socket.on('processing_result', data => {
      commit('ADD_PROCESSING_RESULT', data)
    })
    
    socket.on('workflow_update', data => {
      commit('UPDATE_WORKFLOW', data)
    })
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      // Attempt to reconnect after delay
      setTimeout(() => dispatch('connectSocket'), 5000)
    })
  },
  
  // Disconnect from WebSocket
  disconnectSocket() {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },
  
  // Upload image to MSA1
  async uploadImage({ commit }, imageFile) {
    try {
      commit('SET_UPLOAD_STATUS', 'uploading')
      
      // 로그 저장 - 이미지 업로드 시작
      LogService.logAction('start_image_upload', {
        filename: imageFile.name,
        filesize: imageFile.size,
        filetype: imageFile.type
      })
      
      const formData = new FormData()
      formData.append('image', imageFile)
      
      const response = await axios.post('http://localhost:8000/api/msa1/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: progressEvent => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          commit('UPDATE_PROCESSING_STATUS', {
            service: 'msa1',
            status: 'processing',
            progress: percentCompleted
          })
        }
      })
      
      commit('SET_UPLOADED_IMAGE', response.data.imageUrl)
      commit('SET_UPLOAD_STATUS', 'completed')
      
      // 로그 저장 - 이미지 업로드 완료
      LogService.logAction('complete_image_upload', {
        filename: imageFile.name,
        imageUrl: response.data.imageUrl
      })
      
      return response.data
    } catch (error) {
      // 로그 저장 - 이미지 업로드 실패
      LogService.logAction('failed_image_upload', {
        filename: imageFile ? imageFile.name : 'unknown',
        error: error.message
      })
      
      commit('SET_UPLOAD_STATUS', 'error')
      console.error('Upload error:', error)
      throw error
    }
  },
  
  // Request preprocessing from MSA1
  async requestPreprocessing({ commit }, { imageId, options }) {
    try {
      // 로그 저장 - 전처리 시작
      LogService.logAction('start_preprocessing', {
        imageId,
        options
      })
      
      commit('UPDATE_PROCESSING_STATUS', {
        service: 'msa1',
        status: 'processing',
        progress: 0
      })
      
      const response = await axios.post('http://localhost:8000/api/msa1/preprocess', {
        imageId,
        options
      })
      
      // 로그 저장 - 전처리 요청 완료
      LogService.logAction('preprocessing_requested', {
        imageId
      })
      
      // The actual progress updates will come through the socket connection
      return response.data
    } catch (error) {
      // 로그 저장 - 전처리 실패
      LogService.logAction('failed_preprocessing', {
        imageId,
        error: error.message
      })
      
      commit('UPDATE_PROCESSING_STATUS', {
        service: 'msa1',
        status: 'error',
        progress: 0
      })
      console.error('Preprocessing error:', error)
      throw error
    }
  },
  
  // Start a workflow in MSA5
  async startWorkflow({ commit }, { name, steps }) {
    try {
      // 로그 저장 - 워크플로우 시작
      LogService.logAction('start_workflow', {
        name,
        stepsCount: steps.length
      })
      
      const response = await axios.post('http://localhost:8000/api/msa5/workflow', {
        name,
        steps
      })
      
      commit('SET_ACTIVE_WORKFLOW', response.data)
      
      // 로그 저장 - 워크플로우 생성됨
      LogService.logAction('workflow_created', {
        name,
        workflowId: response.data.id
      })
      
      return response.data
    } catch (error) {
      // 로그 저장 - 워크플로우 시작 실패
      LogService.logAction('failed_workflow_start', {
        name,
        error: error.message
      })
      
      console.error('Workflow start error:', error)
      throw error
    }
  },
  
  // Poll for processing status for services that don't support WebSockets
  async pollProcessingStatus({ commit }, { serviceId, jobId }) {
    try {
      const response = await axios.get(`http://localhost:8000/api/${serviceId}/status/${jobId}`)
      
      commit('UPDATE_PROCESSING_STATUS', {
        service: serviceId,
        ...response.data
      })
      
      return response.data
    } catch (error) {
      console.error('Status polling error:', error)
      throw error
    }
  }
}

const mutations = {
  SET_UPLOADED_IMAGE(state, imageUrl) {
    state.uploadedImage = imageUrl
  },
  
  SET_UPLOAD_STATUS(state, status) {
    state.uploadStatus = status
  },
  
  UPDATE_PROCESSING_STATUS(state, { service, status, progress }) {
    if (state.processingStatus[service]) {
      state.processingStatus[service].status = status
      state.processingStatus[service].progress = progress || 0
    }
  },
  
  ADD_PROCESSING_RESULT(state, { type, data }) {
    switch (type) {
      case 'preprocessed':
        state.processingResults.preprocessedImages.push(data)
        break
      case 'vector':
        state.processingResults.vectorData = data
        break
      case 'plot':
        state.processingResults.plotData = data
        break
      case 'llm':
        state.processingResults.llmResults = data
        break
    }
  },
  
  SET_ACTIVE_WORKFLOW(state, workflow) {
    state.activeWorkflow = workflow
  },
  
  UPDATE_WORKFLOW(state, workflowData) {
    if (state.activeWorkflow && state.activeWorkflow.id === workflowData.id) {
      state.activeWorkflow = { ...state.activeWorkflow, ...workflowData }
    }
    
    // Update in history if exists
    const index = state.workflowHistory.findIndex(w => w.id === workflowData.id)
    if (index >= 0) {
      state.workflowHistory.splice(index, 1, { 
        ...state.workflowHistory[index], 
        ...workflowData 
      })
    } else if (workflowData.status === 'completed' || workflowData.status === 'failed') {
      state.workflowHistory.push(workflowData)
    }
  },
  
  RESET_PROCESSING(state) {
    state.uploadedImage = null
    state.uploadStatus = null
    Object.keys(state.processingStatus).forEach(key => {
      state.processingStatus[key] = { status: 'idle', progress: 0 }
    })
    state.processingResults = {
      preprocessedImages: [],
      vectorData: null,
      plotData: null,
      llmResults: null
    }
  }
}

export default {
  state,
  getters,
  actions,
  mutations
} 