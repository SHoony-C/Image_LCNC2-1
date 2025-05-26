import apiClient from './api';

const preprocessingService = {
  /**
   * LLM과 FastMCP를 이용한 이미지 전처리
   * @param {string} imageId 이미지 ID
   * @param {Object} options 전처리 옵션
   * @returns {Promise} 전처리 작업 결과
   */
  processWithLLM(imageId, options) {
    return apiClient.post('/msa6_preprocessing/process-llm', {
      imageId,
      options
    });
  },

  /**
   * FastMCP를 이용한 이미지 전처리
   * @param {string} imageId 이미지 ID
   * @param {Object} options 전처리 옵션
   * @returns {Promise} 전처리 작업 결과
   */
  processWithFastMCP(imageId, options) {
    return apiClient.post('/msa6_preprocessing/process-fastmcp', {
      imageId,
      options
    });
  },

  /**
   * 이미지 자동 박스 처리
   * @param {string} imageId 이미지 ID
   * @param {Object} options 박스 처리 옵션
   * @returns {Promise} 박스 처리 결과
   */
  autoBoxDetection(imageId, options) {
    return apiClient.post('/msa6_preprocessing/autobox', {
      imageId,
      options
    });
  },

  /**
   * 전처리 상태 조회
   * @param {string} jobId 작업 ID
   * @returns {Promise} 작업 상태
   */
  getPreprocessingStatus(jobId) {
    return apiClient.get(`/msa6_preprocessing/status/${jobId}`);
  },

  /**
   * 전처리된 이미지 조회
   * @param {string} imageId 원본 이미지 ID
   * @returns {Promise} 전처리된 이미지 정보
   */
  getProcessedImages(imageId) {
    return apiClient.get(`/msa6_preprocessing/processed/${imageId}`);
  }
};

export default preprocessingService; 