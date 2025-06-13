import axios from 'axios'

const state = {
  workflows: [],
  currentWorkflow: null,
  isRunning: false
}

const mutations = {
  SET_WORKFLOWS(state, workflows) {
    state.workflows = workflows
  },
  SET_CURRENT_WORKFLOW(state, workflow) {
    state.currentWorkflow = workflow
  },
  ADD_WORKFLOW(state, workflow) {
    state.workflows.push(workflow)
  },
  UPDATE_WORKFLOW(state, updatedWorkflow) {
    const index = state.workflows.findIndex(w => w.id === updatedWorkflow.id)
    if (index !== -1) {
      state.workflows.splice(index, 1, updatedWorkflow)
    }
  },
  REMOVE_WORKFLOW(state, workflowId) {
    state.workflows = state.workflows.filter(w => w.id !== workflowId)
  },
  SET_RUNNING(state, status) {
    state.isRunning = status
  }
}

const actions = {
  async fetchWorkflows({ commit, rootState }) {
    try {
      const response = await axios.get('http://localhost:8000/api/workflows', {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('SET_WORKFLOWS', response.data)
      return response.data
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
      throw error
    }
  },

  async createWorkflow({ commit, rootState }, workflowData) {
    try {
      const response = await axios.post('http://localhost:8000/api/workflows', workflowData, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('ADD_WORKFLOW', response.data)
      return response.data
    } catch (error) {
      console.error('Failed to create workflow:', error)
      throw error
    }
  },

  async updateWorkflow({ commit, rootState }, { id, workflowData }) {
    try {
      const response = await axios.put(`http://localhost:8000/api/workflows/${id}`, workflowData, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('UPDATE_WORKFLOW', response.data)
      return response.data
    } catch (error) {
      console.error('Failed to update workflow:', error)
      throw error
    }
  },

  async deleteWorkflow({ commit, rootState }, workflowId) {
    try {
      await axios.delete(`http://localhost:8000/api/workflows/${workflowId}`, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      commit('REMOVE_WORKFLOW', workflowId)
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      throw error
    }
  },

  async runWorkflow({ commit, rootState }, workflowId) {
    commit('SET_RUNNING', true)
    try {
      const response = await axios.post(`http://localhost:8000/api/workflows/${workflowId}/run`, null, {
        headers: {
          Authorization: `Bearer ${rootState.auth.token}`
        }
      })
      return response.data
    } catch (error) {
      console.error('Failed to run workflow:', error)
      throw error
    } finally {
      commit('SET_RUNNING', false)
    }
  }
}

const getters = {
  allWorkflows: state => state.workflows,
  currentWorkflow: state => state.currentWorkflow,
  isRunning: state => state.isRunning,
  getWorkflowById: state => id => state.workflows.find(w => w.id === id)
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
} 