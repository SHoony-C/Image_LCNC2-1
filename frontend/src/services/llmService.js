import apiClient from './api';

const llmService = {
  /**
   * MSA2 - 첫 번째 LLM 서비스 결과 요청
   * @param {string} imageId 이미지 ID
   * @param {Object} options LLM 옵션
   * @returns {Promise} LLM 결과
   */
  getLLMResults(imageId, options) {
    return apiClient.post('/msa2_llm/analyze', {
      imageId,
      options
    });
  },

  /**
   * MSA2 - LLM 분석 결과 조회
   * @param {string} jobId 작업 ID
   * @returns {Promise} 작업 상태 및 결과
   */
  getLLMStatus(jobId) {
    return apiClient.get(`/msa2_llm/status/${jobId}`);
  },

  /**
   * MSA3 - 두 번째 LLM 서비스 결과 요청
   * @param {string} imageId 이미지 ID
   * @param {Object} options LLM 옵션
   * @returns {Promise} LLM 결과
   */
  getLLM2Results(imageId, options) {
    return apiClient.post('/msa3_llm2/analyze', {
      imageId,
      options
    });
  },

  /**
   * MSA3 - 두 번째 LLM 분석 결과 조회
   * @param {string} jobId 작업 ID
   * @returns {Promise} 작업 상태 및 결과
   */
  getLLM2Status(jobId) {
    return apiClient.get(`/msa3_llm2/status/${jobId}`);
  },

  /**
   * 이미지에 대한 모든 LLM 분석 결과 조회
   * @param {string} imageId 이미지 ID
   * @returns {Promise} 모든 LLM 분석 결과
   */
  getAllLLMResults(imageId) {
    return apiClient.get(`/msa2_llm/results/${imageId}`);
  }
};

export default llmService; 