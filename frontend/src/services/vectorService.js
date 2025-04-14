import apiClient from './api';

const vectorService = {
  /**
   * 이미지 벡터 변환 요청
   * @param {string} imageId 이미지 ID
   * @param {Object} options 벡터화 옵션
   * @returns {Promise} 벡터화 작업 결과
   */
  vectorizeImage(imageId, options) {
    return apiClient.post('/msa4_vector/vectorize', {
      imageId,
      options
    });
  },

  /**
   * 벡터 변환 상태 조회
   * @param {string} jobId 작업 ID
   * @returns {Promise} 작업 상태
   */
  getVectorStatus(jobId) {
    return apiClient.get(`/msa4_vector/status/${jobId}`);
  },

  /**
   * 3D 플롯 데이터 조회
   * @param {string} imageId 이미지 ID
   * @returns {Promise} 3D 플롯 데이터
   */
  get3DPlotData(imageId) {
    return apiClient.get(`/msa4_vector/plot3d/${imageId}`);
  },

  /**
   * 유사 이미지 검색
   * @param {string} imageId 기준 이미지 ID
   * @param {number} limit 결과 제한 수
   * @returns {Promise} 유사 이미지 리스트
   */
  getSimilarImages(imageId, limit = 10) {
    return apiClient.get(`/msa4_vector/similar/${imageId}?limit=${limit}`);
  },
  
  /**
   * 벡터 공간에서의 이미지 군집화(클러스터링) 요청
   * @param {Object} options 클러스터링 옵션
   * @returns {Promise} 클러스터링 결과
   */
  clusterImages(options) {
    return apiClient.post('/msa4_vector/cluster', options);
  }
};

export default vectorService; 