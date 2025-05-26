import apiClient from './api';

const lcncService = {
  /**
   * 워크플로우 생성
   * @param {string} name 워크플로우 이름
   * @param {Array} steps 워크플로우 단계
   * @returns {Promise} 생성된 워크플로우
   */
  createWorkflow(name, steps) {
    return apiClient.post('/msa5_lcnc/workflow', {
      name,
      steps
    });
  },

  /**
   * 워크플로우 실행
   * @param {string} workflowId 워크플로우 ID
   * @param {Object} params 워크플로우 실행 파라미터
   * @returns {Promise} 실행 결과
   */
  executeWorkflow(workflowId, params) {
    return apiClient.post(`/msa5_lcnc/workflow/${workflowId}/execute`, params);
  },

  /**
   * 워크플로우 상태 조회
   * @param {string} workflowId 워크플로우 ID
   * @returns {Promise} 워크플로우 상태
   */
  getWorkflowStatus(workflowId) {
    return apiClient.get(`/msa5_lcnc/workflow/${workflowId}`);
  },

  /**
   * 모든 워크플로우 조회
   * @returns {Promise} 워크플로우 리스트
   */
  getWorkflows() {
    return apiClient.get('/msa5_lcnc/workflows');
  },

  /**
   * 워크플로우 취소
   * @param {string} workflowId 워크플로우 ID
   * @returns {Promise} 취소 결과
   */
  cancelWorkflow(workflowId) {
    return apiClient.post(`/msa5_lcnc/workflow/${workflowId}/cancel`);
  },

  /**
   * 워크플로우 템플릿 조회
   * @returns {Promise} 워크플로우 템플릿 리스트
   */
  getWorkflowTemplates() {
    return apiClient.get('/msa5_lcnc/templates');
  },

  /**
   * 워크플로우 저장
   * @param {string} workflowId 워크플로우 ID
   * @param {Object} workflowData 워크플로우 데이터
   * @returns {Promise} 저장 결과
   */
  saveWorkflow(workflowId, workflowData) {
    return apiClient.put(`/msa5_lcnc/workflow/${workflowId}`, workflowData);
  }
};

export default lcncService; 