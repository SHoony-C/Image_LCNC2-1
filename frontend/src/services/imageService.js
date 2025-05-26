import apiClient from './api';

const imageService = {
  /**
   * 이미지 업로드
   * @param {File} imageFile 업로드할 이미지 파일
   * @returns {Promise} 업로드 결과
   */
  uploadImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    return apiClient.post('/msa1_imageinput/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  /**
   * 이미지 전처리 요청
   * @param {string} imageId 이미지 ID
   * @param {Object} options 전처리 옵션
   * @returns {Promise} 전처리 작업 결과
   */
  preprocessImage(imageId, options) {
    return apiClient.post('/msa1_imageinput/preprocess', {
      imageId,
      options
    });
  },

  /**
   * 업로드된 이미지 리스트 조회
   * @returns {Promise} 이미지 리스트
   */
  getImages() {
    return apiClient.get('/msa1_imageinput/images');
  },

  /**
   * 이미지 처리 상태 확인
   * @param {string} jobId 작업 ID
   * @returns {Promise} 작업 상태
   */
  getImageStatus(jobId) {
    return apiClient.get(`/msa1_imageinput/status/${jobId}`);
  }
};

export default imageService; 