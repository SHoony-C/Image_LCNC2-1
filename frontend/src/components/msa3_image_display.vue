<template>
  <div class="msa3-container">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>이미지 상세 정보</span>
      </div>
    </div>
    
    <div class="content-area">
      <div v-if="!mainImage" class="empty-state">
        <div class="welcome-content">
          <div class="welcome-icon-container">
            <i class="fas fa-image main-icon"></i>
          </div>
          <h3>이미지 뷰어</h3>
          <p class="instruction">그래프에서 이미지 포인트를 선택하거나<br>이미지를 업로드하세요.</p>
          
          
        </div>
      </div>
      
      <div v-else class="image-display">
        <div class="selected-image">
          <h4>선택된 이미지: {{ getCleanFilename(mainImage.filename) }}</h4>
          <div class="image-tag" :class="{ 'tag-iapp': isIAppTag(mainImage.filename), 'tag-analysis': !isIAppTag(mainImage.filename) }">
            <i :class="isIAppTag(mainImage.filename) ? 'fas fa-cogs' : 'fas fa-chart-bar'"></i>
            <span>{{ isIAppTag(mainImage.filename) ? 'I-app' : 'Analysis' }}</span>
          </div>
          <div class="image-wrapper" @click="showImageDetailsPopup(mainImage.filename)">
            <img v-if="mainImage" :src="mainImage.url" :alt="mainImage.filename" @error="handleImageError" />
          </div>
        </div>
        
        <div class="similar-images">
          <div class="similar-section-headers">
            <h4 class="similar-section-title iapp-title">I-app 유사 이미지</h4>
            <h4 class="similar-section-title analysis-title">Analysis 유사 이미지</h4>
          </div>
          
          <div class="dual-column-grid">
            <!-- I-app 태그 유사 이미지 -->
            <div class="column iapp-column">
              <div 
                v-for="image in iAppSimilarImages" 
                :key="image.filename" 
                class="similar-image-item"
                @click="selectSimilarImage(image)"
              >
                <img :src="image.url" :alt="image.filename" @error="handleImageError" />
                <div class="similarity-score">{{ formatSimilarity(image.similarity) }}% 유사</div>
              </div>
            </div>
            
            <!-- Analysis 태그 유사 이미지 -->
            <div class="column analysis-column">
              <div 
                v-for="image in analysisSimilarImages" 
                :key="image.filename" 
                class="similar-image-item"
                @click="selectSimilarImage(image)"
              >
                <img :src="image.url" :alt="image.filename" @error="handleImageError" />
                <div class="similarity-score">{{ formatSimilarity(image.similarity) }}% 유사</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 이미지 상세 팝업 -->
    <Teleport to="body">
      <!-- I-App 태그 팝업 -->
      <ImageIAppPopup 
        v-if="showImagePopup && isIAppTag(selectedImage?.filename)"
        :show="showImagePopup"
        :imageUrl="getImageUrl(selectedImage?.filename)"
        :imageName="selectedImage?.filename"
        :image="selectedImage"
        @close="closeImagePopup"
      />
      
      <!-- Analysis 태그 팝업 -->
      <ImageAnalysisPopup 
        v-if="showImagePopup && !isIAppTag(selectedImage?.filename)"
        :show="showImagePopup"
        :imageUrl="getImageUrl(selectedImage?.filename)"
        :imageName="selectedImage?.filename"
        @close="closeImagePopup"
        @analyze="handleAnalyzeRequest"
      />
    </Teleport>
  </div>
</template>

<script>
import ImageIAppPopup from './msa3_image_iapp_popup.vue';
import ImageAnalysisPopup from './msa3_image_analysis_popup.vue';

export default {
  name: 'MSA3ImageDisplay',
  components: {
    ImageIAppPopup,
    ImageAnalysisPopup
  },
  data() {
    return {
      mainImage: null,
      similarImages: [],
      showImagePopup: false,
      selectedImage: null,
      errorMessage: '',
      dataPollingInterval: null,
      debugMode: false, // 디버깅 모드 비활성화
      layoutInitialized: false, // 레이아웃 초기화 상태 추적
      resizeHandler: null
    }
  },
  computed: {
    // I-app 태그 유사 이미지 (최대 3개)
    iAppSimilarImages() {
      return this.similarImages
        .filter(image => this.isIAppTag(image.filename))
        .slice(0, 3);
    },
    
    // Analysis 태그 유사 이미지 (최대 3개)
    analysisSimilarImages() {
      return this.similarImages
        .filter(image => !this.isIAppTag(image.filename))
        .slice(0, 3);
    }
  },
  created() {
    //console.log('MSA3 컴포넌트 초기화 시작...');
    
    try {
      // 커스텀 이벤트 리스너 추가
      document.addEventListener('msa2-to-msa3-image-selected', this.handleMSA2Event);
      document.addEventListener('msa2-to-msa3-similar-images', this.handleMSA2SimilarImages);
      //console.log('MSA3: DOM 커스텀 이벤트 리스너 등록 완료');
      
      // 전역 이벤트 버스 리스너 추가
      if (window.MSAEventBus) {
        window.MSAEventBus.on('msa2-image-selected', this.handleImageSelected);
        window.MSAEventBus.on('msa2-similar-images', this.handleSimilarImagesFound);
        //console.log('MSA3: 전역 이벤트 버스 리스너 등록 완료');
      } else {
        console.warn('MSA3: 전역 이벤트 버스가 존재하지 않습니다');
      }
      
      // MSA3가 준비되었음을 MSA2에 알림
      setTimeout(() => {
        try {
          // 커스텀 DOM 이벤트를 통해 알림
          const event = new CustomEvent('msa3-ready', { detail: true });
          document.dispatchEvent(event);
          
          // 전역 이벤트 버스를 통해 알림
          if (window.MSAEventBus) {
            window.MSAEventBus.emit('msa3-ready', true);
          }
          
          //console.log('MSA3: 준비 완료 신호를 MSA2에 전송했습니다');
        } catch (error) {
          console.error('MSA3: 준비 완료 신호 전송 중 오류:', error);
        }
      }, 500);
      
      // 시작할 때 전역 데이터 확인 (한 번만 실행)
      this.checkGlobalSharedData();
      
      // 리사이즈 이벤트 리스너 추가
      this.resizeHandler = this.debounce(() => {
        this.initializeLayout();
      }, 250);
      
      window.addEventListener('resize', this.resizeHandler);
    } catch (error) {
      console.error('MSA3: created 라이프사이클 오류:', error);
    }
  },
  beforeDestroy() {
    try {
      // 커스텀 이벤트 리스너 정리
      document.removeEventListener('msa2-to-msa3-image-selected', this.handleMSA2Event);
      document.removeEventListener('msa2-to-msa3-similar-images', this.handleMSA2SimilarImages);
      
      // 전역 이벤트 버스 리스너 정리
      if (window.MSAEventBus) {
        window.MSAEventBus.off('msa2-image-selected', this.handleImageSelected);
        window.MSAEventBus.off('msa2-similar-images', this.handleSimilarImagesFound);
      }
      
      // 리사이즈 이벤트 리스너 제거
      window.removeEventListener('resize', this.resizeHandler);
      
      // 데이터 폴링 인터벌 정리 (혹시 있을 경우)
      if (this.dataPollingInterval) {
        clearInterval(this.dataPollingInterval);
      }
    } catch (error) {
      console.error('MSA3: beforeDestroy 라이프사이클 오류:', error);
    }
  },
  mounted() {
    //console.log('MSA3 컴포넌트가 마운트되었습니다.');
    
    // 레이아웃 초기화 지연 실행 (DOM이 완전히 렌더링된 후)
    this.$nextTick(() => {
      // 첫 번째 시도
      this.initializeLayout();
      
      // 백업으로 약간 지연 후 다시 시도
      setTimeout(() => {
        if (!this.layoutInitialized) {
          this.initializeLayout();
        }
      }, 500);
      
      // 즉시 데이터 확인 시도
      this.checkGlobalSharedData();
      
      // 추가 확인 시도
      setTimeout(() => {
        this.checkGlobalSharedData();
      }, 1000);
    });
  },
  methods: {
    // 디바운스 함수 - 리사이즈 최적화
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },
    
    // I-app 태그 여부 확인
    isIAppTag(filename) {
      if (!filename) return false;
      return filename.includes('_before');
    },
    
    // 전역 공유 데이터 확인
    checkGlobalSharedData() {
      try {
        if (typeof window !== 'undefined' && window.MSASharedData) {
          // 현재 이미지 데이터 확인
          if (window.MSASharedData.currentImage && 
              (!this.mainImage || 
               this.mainImage.filename !== window.MSASharedData.currentImage.filename)) {
            this.handleImageSelected(window.MSASharedData.currentImage);
          }
          
          // 유사 이미지 데이터 확인
          if (window.MSASharedData.similarImages && 
              window.MSASharedData.similarImages.length > 0) {
            this.handleSimilarImagesFound(window.MSASharedData.similarImages);
          }
        } else {
          // 전역 객체가 없으면 생성
          if (typeof window !== 'undefined' && !window.MSASharedData) {
            window.MSASharedData = {
              currentImage: null,
              similarImages: []
            };
          }
        }
      } catch (error) {
        console.error('MSA3: 전역 데이터 확인 중 오류:', error);
      }
    },
    
    // MSA2에서 보내는 커스텀 이벤트 핸들러
    handleMSA2Event(event) {
      if (event.detail) {
        this.handleImageSelected(event.detail);
      }
    },
    
    // MSA2에서 보내는 유사 이미지 커스텀 이벤트 핸들러
    handleMSA2SimilarImages(event) {
      if (event.detail && Array.isArray(event.detail)) {
        this.handleSimilarImagesFound(event.detail);
      }
    },
    
    // 선택된 이미지 처리
    handleImageSelected(image) {
      if (!image) {
        return;
      }
      
      // 유효하지 않은 이미지 필터링
      if (image.filename === 'main' || 
          (image.filename && (image.filename.includes('localhost') || 
                           image.filename.includes('undefined') || 
                           image.filename.includes('null')))) {
        console.warn(`MSA3: 유효하지 않은 이미지 파일명 무시: ${image.filename}`);
        return;
      }
      
      // 이미지 URL이 없거나 유효하지 않은 경우 생성
      if (!image.url && image.filename) {
        image.url = this.getImageUrl(image.filename);
      } else if (image.url && (image.url.includes('localhost:8080/main') || 
                              image.url.includes('undefined') || 
                              image.url.includes('null'))) {
        console.warn(`MSA3: 유효하지 않은 이미지 URL 수정: ${image.url}`);
        image.url = this.getImageUrl(image.filename || 'default');
      }
      
      this.mainImage = {...image};
      
      // 워크플로우 정보 요청 - 유효한 파일명인 경우에만
      if (image && image.filename && 
          !image.filename.includes('localhost') && 
          image.filename !== 'main' && 
          !image.filename.includes('undefined') && 
          !image.filename.includes('null')) {
        this.fetchWorkflowInfo(image.filename);
      }
    },
    
    // 유사 이미지 처리
    handleSimilarImagesFound(images) {
      if (!images || !Array.isArray(images)) {
        return;
      }
      
      //console.log(`MSA3: 유사 이미지 데이터 수신 - 총 ${images.length}개`);
      
      // 이미지 전처리 - URL 및 유사도 값 보정
      const processedImages = images.map(img => {
        // 이미 URL이 있는 경우 그대로 사용, 없으면 생성
        const imageUrl = img.url || this.getImageUrl(img.filename);
        
        // 유사도 값이 이미 있으면 그대로 사용, 없으면 거리를 기반으로 계산
        let similarity = img.similarity;
        if (similarity === undefined || similarity === null) {
          if (img.distance !== undefined && img.distance !== null) {
            similarity = (1 - img.distance) * 100;
          } else {
            similarity = 50; // 기본값
          }
        }
        
        // 태그 타입 확인 (파일명으로 추론, 백엔드 태그 값 우선)
        let tagType = img.tag_type;
        if (!tagType) {
          tagType = this.isIAppTag(img.filename) ? 'I-app' : 'Analysis';
        }
        
        return {
          ...img,
          url: imageUrl,
          similarity: similarity,
          tag_type: tagType
        };
      });
      
      // 태그별로 이미지 분류 (명시적으로 태그 타입으로 필터링)
      const iappImages = processedImages.filter(img => 
        img.tag_type === 'I-app' || this.isIAppTag(img.filename)
      );
      const analysisImages = processedImages.filter(img => 
        img.tag_type === 'Analysis' || (!this.isIAppTag(img.filename) && img.tag_type !== 'I-app')
      );
      
      //console.log(`MSA3: 태그별 분류 - I-app: ${iappImages.length}개, Analysis: ${analysisImages.length}개`);
      
      // 유사도 순으로 정렬
      iappImages.sort((a, b) => b.similarity - a.similarity);
      analysisImages.sort((a, b) => b.similarity - a.similarity);
      
      // 각 태그별로 최대 3개씩 선택
      const selectedIappImages = iappImages.slice(0, 3);
      const selectedAnalysisImages = analysisImages.slice(0, 3);
      
      // 태그별 이미지 결합
      this.similarImages = [...selectedIappImages, ...selectedAnalysisImages];
      
      //console.log(`MSA3: 유사 이미지 처리 완료 - I-app: ${selectedIappImages.length}개, Analysis: ${selectedAnalysisImages.length}개, 총 ${this.similarImages.length}개`);
    },
    
    // 이미지 상세 팝업 표시
    showImageDetailsPopup(filename) {
      //console.log('MSA3: Showing image details popup for:', filename);
      
      // 현재 메인 이미지 정보를 기반으로 선택된 이미지 설정
      this.selectedImage = { 
        ...this.mainImage,
        filename: filename,
        url: this.getImageUrl(filename)
      };
      
      // 워크플로우 정보 요청 - 팝업 표시 전에 처리
      this.fetchWorkflowInfo(filename);
      
      // 팝업 표시
      this.showImagePopup = true;
    },
    
    // 유사 이미지 클릭 시 해당 이미지를 주 이미지로 변경
    selectSimilarImage(image) {
      //console.log('MSA3: Similar image selected:', image.filename);
      
      // 선택한 이미지를 주 이미지로 설정
      this.mainImage = image;
      
      // MSA2에 이미지 선택 이벤트 발생
      this.$root.$emit('select-image-by-filename', image.filename);
      
      // 이미지 상세 팝업 표시
      this.showImageDetailsPopup(image.filename);
    },
    
    // 이미지 로드 오류 처리
    handleImageError(event) {
      const img = event.target;
      
      // 이미지 로드 실패 시 기본 이미지로 대체
      img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+';
      img.alt = '이미지 로드 실패';
    },
    
    // 이미지 URL 생성
    getImageUrl(filename) {
      if (!filename) return '';
      
      // 유효하지 않은 이미지 파일명 필터링
      if (filename === 'main' || filename.includes('localhost') || 
          filename.includes('undefined') || filename.includes('null')) {
        console.warn(`MSA3: 유효하지 않은 이미지 파일명: ${filename}, 기본 이미지 URL 반환`);
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+';
      }
      
      // 파일명 정규화 - 특수문자 및 공백 처리
      let imageFilename = encodeURIComponent(filename);
      
      // 이미 완전한 URL인 경우 그대로 반환
      if (filename.startsWith('http://') || filename.startsWith('https://')) {
        //console.log(`MSA3: 이미 완전한 URL이므로 그대로 사용: ${filename}`);
        return filename;
      }
      
      // 디버깅용 로그
      //console.log(`MSA3: Getting image URL for: ${filename} (encoded: ${imageFilename})`);
      
      // API 서버를 통해 이미지 요청 (MSA2와 동일한 경로 사용)
      return `http://localhost:8000/api/imageanalysis/images/${imageFilename}`;
    },
    
    // 후처리 이미지 이름 생성
    getAfterImageName(filename) {
      if (!filename) return '';
      const ext = filename.split('.').pop();
      const baseName = filename.substring(0, filename.lastIndexOf('.'));
      return `${baseName}_after.${ext}`;
    },
    
    // 파일명 정리
    getCleanFilename(filename) {
      if (!filename) return '';
      // 경로 제거
      const nameOnly = filename.split('/').pop();
      // 확장자 제거는 필요에 따라 주석 해제
      // return nameOnly.substring(0, nameOnly.lastIndexOf('.'));
      return nameOnly;
    },
    
    // 유사도 포맷팅
    formatSimilarity(value) {
      if (typeof value === 'number') {
        return Math.round(value);
      }
      return 0;
    },
    
    // 날짜 포맷팅
    formatDate(dateString) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        console.error('Date formatting error:', e);
        return dateString;
      }
    },
    
    // 노드 타입에 따른 아이콘 클래스
    getNodeIcon(type) {
      const iconMap = {
        'resize': 'fas fa-expand',
        'crop': 'fas fa-crop',
        'rotate': 'fas fa-sync',
        'filter': 'fas fa-filter',
        'blur': 'fas fa-eye-slash',
        'sharpen': 'fas fa-sliders-h',
        'contrast': 'fas fa-adjust',
        'brightness': 'fas fa-sun',
        'color': 'fas fa-palette',
        'custom': 'fas fa-cogs'
      };
      
      return iconMap[type.toLowerCase()] || 'fas fa-cogs';
    },
    
    // 팝업 닫기
    closeImagePopup() {
      this.showImagePopup = false;
    },
    
    // 워크플로우 정보 가져오기
    fetchWorkflowInfo(filename) {
      if (!filename) {
        console.error('MSA3: fetchWorkflowInfo called with empty filename');
        return;
      }
      
      //console.log('MSA3: ========== WORKFLOW INFO FETCH START ==========');
      //console.log(`MSA3: fetchWorkflowInfo called with filename: ${filename}`);
      
      // 이미지에 워크플로우 정보 로딩 상태 설정
      if (this.selectedImage) {
        //console.log('MSA3: Setting selectedImage to loading state');
        this.selectedImage = {
          ...this.selectedImage,
          isLoading: true,
          workflowStatus: 'loading'
        };
      } else {
        console.warn('MSA3: selectedImage is null when fetching workflow');
      }
      
      // I-app 태그 이미지인지 확인
      const isIAppImage = this.isIAppTag(filename);
      //console.log(`MSA3: Is this an I-app image? ${isIAppImage}`);
      
      if (!isIAppImage) {
        // Analysis 이미지는 워크플로우 정보가 필요 없음
        //console.log('MSA3: Not an I-app image, skipping workflow fetch');
        if (this.selectedImage) {
          this.selectedImage = {
            ...this.selectedImage,
            isLoading: false,
            workflowStatus: 'not_applicable'
          };
        }
        return;
      }
      
      //console.log(`MSA3: Fetching workflow info for I-app image: ${filename}`);
      
      // 워크플로우 검색용 파일명 - _before 및 확장자(.png, .jpg 등) 제거
      const searchFilename = filename
        .replace("_before", "")  // _before 제거
        .replace(/\.(png|jpg|jpeg|gif)$/i, "");  // 파일 확장자 제거
      
      // URL 인코딩 처리 - 한글 및 특수문자 처리
      const encodedSearchFilename = encodeURIComponent(searchFilename);
      
      // 직접 워크플로우 이름만 사용하는 방식으로 변경 (MongoDB workflow_name 필드와 일치)
      const apiUrl = `http://localhost:8000/api/workflow/by-image/${encodedSearchFilename}`;
      
      //console.log(`MSA3: Workflow API URL: ${apiUrl}`);
      //console.log(`MSA3: Workflow search filename (cleaned): ${searchFilename}`);
      //console.log(`MSA3: Encoded search filename: ${encodedSearchFilename}`);
      //console.log(`MSA3: Filename bytes: ${this.getStringBytes(searchFilename)}`);
      
      // API 요청 - I-app 이미지 워크플로우 정보
      //console.log('MSA3: Sending fetch request to API');
      fetch(apiUrl)
        .then(response => {
          //console.log(`MSA3: Workflow API response status: ${response.status}, statusText: ${response.statusText}`);
          
          // 응답 헤더 로깅
          const responseHeaders = {};
          response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
          });
          //console.log(`MSA3: Response headers:`, responseHeaders);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.error(`MSA3: Workflow not found for ${filename}, clean name: ${searchFilename}`);
              
              // 404 오류 처리 - 워크플로우를 찾을 수 없음
              if (this.selectedImage) {
                this.selectedImage = {
                  ...this.selectedImage,
                  isLoading: false,
                  workflowStatus: 'not_found',
                  workflow: null  // 명시적으로 null 설정
                };
                //console.log('MSA3: Setting workflow status to not_found due to 404 error');
              }
              
              // 대체 방법으로 직접 이름만 사용해서 다시 시도
              const simpleNameUrl = `http://localhost:8000/api/workflow/by-image/${searchFilename}`;
              //console.log(`MSA3: Trying alternative URL: ${simpleNameUrl}`);
              return fetch(simpleNameUrl)
                .then(altResponse => {
                  //console.log(`MSA3: Alternative API response status: ${altResponse.status}, statusText: ${altResponse.statusText}`);
                  return altResponse;
                });
            }
            throw new Error(`HTTP 오류 ${response.status}: ${response.statusText}`);
          }
          //console.log('MSA3: Response OK, parsing JSON');
          return response.json()
            .then(data => {
              //console.log('MSA3: JSON parse successful', data);
              return data;
            })
            .catch(parseError => {
              console.error('MSA3: JSON parse error', parseError);
              throw new Error(`JSON 파싱 오류: ${parseError.message}`);
            });
        })
        .then(data => {
          //console.log('MSA3: Workflow data received:', data);
          
          // API에서 명시적으로 is_demo_data 필드가 있는지 확인
          const isDemoData = data && data.is_demo_data === true;
          
          if (isDemoData) {
            console.warn('MSA3: Server returned demo data, not using it');
            if (this.selectedImage) {
              this.selectedImage = {
                ...this.selectedImage,
                workflowStatus: 'not_found',
                workflow: null
              };
            }
            return;
          }
          
          // 응답이 HTTP 오류 객체인 경우
          if (data && data.status && data.status >= 400) {
            console.error(`MSA3: API returned error response: ${data.status}`);
            if (this.selectedImage) {
              this.selectedImage = {
                ...this.selectedImage,
                isLoading: false,
                workflowStatus: 'error',
                workflow: null
              };
            }
            return;
          }
          
          // 워크플로우 정보 업데이트
          if (this.selectedImage && data && (data.workflow || data)) {
            //console.log('MSA3: Updating selectedImage with workflow data');
            const workflowData = data.workflow || data;
            //console.log('MSA3: Workflow data structure:', Object.keys(workflowData));
            
            this.selectedImage = {
              ...this.selectedImage,
              workflow: workflowData,
              isLoading: false,
              workflowStatus: 'found'
            };
            //console.log('MSA3: Workflow data updated in selectedImage', this.selectedImage.workflow);
          } else {
            console.error('MSA3: Invalid workflow data received or selectedImage is null');
            if (data) console.error('MSA3: Data structure:', Object.keys(data));
            if (this.selectedImage) {
              this.selectedImage = {
                ...this.selectedImage,
                isLoading: false,
                workflowStatus: 'error'
              };
            }
          }
        })
        .catch(error => {
          // 두 번째 시도까지 실패한 경우
          console.error('MSA3: Error fetching workflow info:', error);
          
          // 이미 404 처리가 되지 않은 경우만 상태 업데이트
          if (this.selectedImage && this.selectedImage.workflowStatus !== 'not_found') {
            console.error('MSA3: Setting error state for workflow fetch');
            this.selectedImage = {
              ...this.selectedImage,
              isLoading: false,
              workflowStatus: 'error',
              workflow: null  // 명시적으로 null 설정
            };
          }
        })
        .finally(() => {
          //console.log('MSA3: ========== WORKFLOW INFO FETCH END ==========');
        });
    },
    
    // 바이트 배열을 문자열로 변환
    getStringBytes(str) {
      try {
        // 문자열을 UTF-8 인코딩된 바이트 배열로 변환
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        
        // 바이트 배열을 16진수로 표시
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      } catch (e) {
        return `인코딩 오류: ${e.message}`;
      }
    },
    
    // MSA5에 워크플로우 로드
    loadWorkflowToMSA5(workflow) {
      if (!workflow) return;
      
      //console.log('MSA3: Loading workflow to MSA5:', workflow);
      this.$root.$emit('load-workflow-to-msa5', workflow);
      this.closeImagePopup();
    },
    
    // 레이아웃 초기화 함수
    initializeLayout() {
      try {
        // 컨테이너 엘리먼트 확인
        const container = this.$el;
        if (!container) {
          console.warn('MSA3: 컨테이너 엘리먼트를 찾을 수 없습니다');
          this.layoutInitialized = true; // 오류가 발생해도 초기화된 것으로 처리
          return false;
        }
        
        // 타입 확인 및 안전하게 처리
        if (typeof container.querySelector !== 'function') {
          console.warn('MSA3: 컨테이너의 querySelector가 함수가 아닙니다:', typeof container.querySelector);
          this.layoutInitialized = true; // 오류가 발생해도 초기화된 것으로 처리
          return false;
        }
        
        // 안전하게 클래스 추가
        try {
          if (container.classList) {
            container.classList.add('initialized');
          } else if (container.className !== undefined) {
            // 대체 방법으로 className 속성 사용
            container.className = (container.className + ' initialized').trim();
          }
        } catch (classError) {
          console.error('MSA3: 클래스 추가 중 오류:', classError);
        }
        
        // content-area 엘리먼트 확인 - try/catch로 안전하게 처리
        try {
          const contentArea = container.querySelector('.content-area');
          if (contentArea) {
            if (contentArea.classList) {
              contentArea.classList.add('initialized');
            } else if (contentArea.className !== undefined) {
              contentArea.className = (contentArea.className + ' initialized').trim();
            }
          }
        } catch (contentError) {
          console.error('MSA3: content-area 처리 중 오류:', contentError);
        }
        
        this.layoutInitialized = true;
        //console.log('MSA3: 레이아웃 초기화 완료');
        return true;
      } catch (error) {
        console.error('MSA3: 레이아웃 초기화 중 오류 발생', error);
        this.layoutInitialized = true; // 오류가 발생해도 초기화된 것으로 처리
        return false;
      }
    },
    handleAnalyzeRequest(data) {
      // Emit event to parent to forward data to MSA4
      this.$emit('analyze-image', {
        imageName: data.imageName,
        textContent: data.textContent,
        imageUrl: this.getImageUrl(data.imageName)
      });
    }
  }
}
</script>

<style scoped>
.msa3-container {
  display: block;
  height: 100%;
  width: 100%;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  /* 레이아웃 계산 안정화를 위한 추가 속성 */
  position: relative;
  box-sizing: border-box;
  min-height: 300px; /* 최소 높이 설정 */
}

.msa3-container.initialized {
  /* 클래스 기반 스타일 - JavaScript 의존성 감소 */
  display: flex;
  flex-direction: column;
}

.card-header {
  background-color: #4a76fd;
  color: white;
  padding: 8px 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 레이아웃 계산 안정화 */
  position: relative;
  height: 40px; /* 명시적 높이 설정 */
  box-sizing: border-box;
  flex-shrink: 0; /* 크기 고정 */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.debug-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}

.debug-btn:hover {
  background-color: #5a6268;
}

.debug-info {
  margin-top: 20px;
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  text-align: left;
  color: #6c757d;
}

.debug-info h4 {
  margin-top: 0;
  color: #6c757d;
  font-size: 14px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 5px;
  margin-bottom: 10px;
}

.debug-image-info {
  margin-top: 8px;
  padding: 8px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 12px;
  color: #6c757d;
}

.debug-image-info p {
  margin: 2px 0;
}

.debug-similar-info {
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  font-size: 10px;
  border-bottom-right-radius: 4px;
}

.debug-similar-list {
  margin-top: 10px;
  padding: 8px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 12px;
}

.debug-similar-list h5 {
  margin: 0 0 5px 0;
  font-size: 12px;
  color: #6c757d;
}

.debug-similar-list ul {
  margin: 0;
  padding-left: 20px;
}

.debug-similar-list li {
  margin-bottom: 2px;
}

.content-area {
  position: relative;
  padding: 12px;
  overflow-y: auto;
  display: block;
  height: calc(100% - 40px); /* 헤더 높이 제외 */
  box-sizing: border-box;
  min-height: 260px; /* 최소 높이 설정 */
}

.content-area.initialized {
  /* 클래스 기반 스타일 - JavaScript 의존성 감소 */
  flex: 1;
  overflow: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #666;
  text-align: center;
  padding: 40px 20px;
  box-sizing: border-box;
  /* 플렉스 컨테이너에 맞춤 */
  flex: 1;
  background-color: #f8f9fa;
}

.welcome-content {
  max-width: 90%;
  padding: 25px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  animation: fade-in 0.5s ease-out;
}

.welcome-icon-container {
  width: 90px;
  height: 90px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(74, 118, 253, 0.1);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(74, 118, 253, 0.4);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(74, 118, 253, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(74, 118, 253, 0);
  }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.main-icon {
  font-size: 3.5rem;
  color: #4a76fd;
}

.empty-state h3 {
  font-size: 1.5rem;
  margin: 0 0 15px 0;
  color: #333;
  font-weight: 600;
}

.instruction {
  font-size: 1rem;
  margin-bottom: 25px;
  color: #555;
  line-height: 1.5;
}

.steps {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 25px;
}

.step {
  display: flex;
  align-items: center;
  background-color: #f0f4ff;
  padding: 10px 15px;
  border-radius: 8px;
  border-left: 3px solid #4a76fd;
}

.step-number {
  background-color: #4a76fd;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-right: 10px;
  font-size: 0.9rem;
}

.step-text {
  font-size: 0.9rem;
  color: #333;
}

.step-arrow {
  color: #4a76fd;
  font-size: 1.2rem;
}

.waiting-animation {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.dot {
  width: 10px;
  height: 10px;
  background-color: #4a76fd;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% { 
    transform: scale(0);
  }
  40% { 
    transform: scale(1.0);
  }
}

.image-display {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.selected-image {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.similar-images {
  flex: 1;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #333;
  font-weight: 600;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
}

.image-wrapper {
  width: 100%;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
  border: 1px solid #eee;
}

.image-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.image-wrapper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-grid {
  display: none; /* 이전 그리드 스타일 제거 */
}

.similar-image-item {
  position: relative;
  height: 150px;
  background-color: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #eee;
}

.similar-image-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #4a76fd;
}

.similar-image-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.similarity-score {
  position: absolute;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  font-size: 0.8rem;
  border-top-left-radius: 8px;
  font-weight: 500;
}

/* 이미지 상세 팝업 스타일 */
.image-detail-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.image-detail-popup {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: min(90vw, 1000px); /* Responsive sizing */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

@keyframes popup-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.popup-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #343a40;
}

.close-popup-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #6c757d;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-popup-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #343a40;
}

.popup-content {
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
  max-height: calc(90vh - 60px);
}

@media (min-width: 768px) {
  .popup-content {
    flex-direction: row;
  }
  
  .popup-image-container {
    width: 35%;
    margin-right: 20px;
    margin-bottom: 0;
  }
  
  .popup-details {
    width: 65%;
  }
}

.popup-image-container {
  flex: 0 0 auto;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

.image-before-section,
.image-after-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-label {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 14px;
}

.image-before-section {
  margin-bottom: 15px;
}

.popup-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #eee;
}

.workflow-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.workflow-header-flex h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #343a40;
}

/* 워크플로우 불러오기 버튼 */
.load-workflow-btn {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.load-workflow-btn:hover {
  background-color: #0069d9;
}

/* 워크플로우 다이어그램 스타일 */
.workflow-container {
  margin-bottom: 25px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.workflow-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 25px 15px;
  overflow-y: auto;
  position: relative;
  min-height: 300px;
  background: linear-gradient(to bottom, #f9f9f9, #ffffff);
}

/* 흐름선 스타일 - 세로 방향 */
.workflow-visual::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 60px;
  bottom: 60px;
  width: 3px;
  background: linear-gradient(to bottom, #4dabf7, #339af0, #228be6);
  transform: translateX(-50%);
  z-index: 1;
}

.flow-nodes {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
  margin: 15px 0;
}

.flow-node {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 110px;
  height: 110px;
  margin: 15px 0;
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  transition: all 0.25s ease;
  background-color: white;
  cursor: pointer;
}

.flow-node:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.start-node {
  background-color: #1c7ed6;
  color: white;
  box-shadow: 0 4px 12px rgba(28, 126, 214, 0.25);
}

.end-node {
  background-color: #e03131;
  color: white;
  box-shadow: 0 4px 12px rgba(224, 49, 49, 0.25);
}

.process-node {
  border: 2px solid #dee2e6;
  position: relative;
}

.node-badge {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 24px;
  height: 24px;
  background-color: #339af0;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.node-icon {
  font-size: 24px;
  margin-bottom: 10px;
}

.node-text {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  word-break: keep-all;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 세로 방향 화살표 */
.node-arrow {
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 12px solid #228be6;
  z-index: 3;
}

.start-node .node-arrow {
  border-top-color: white;
}

/* 워크플로우 통계 */
.workflow-stats {
  display: flex;
  padding: 15px 20px;
  background-color: #f8f9fa;
  border-top: 1px solid #eee;
}

.stat-item {
  display: flex;
  align-items: center;
  margin-right: 25px;
  font-size: 14px;
  color: #495057;
}

.stat-item i {
  margin-right: 10px;
  color: #228be6;
  font-size: 16px;
}

.stat-item span {
  margin-right: 6px;
}

/* 워크플로우 정보 관련 스타일 */
.workflow-details {
  margin-top: 20px;
}

.detail-row {
  margin-bottom: 12px;
  line-height: 1.4;
}

.detail-row strong {
  font-weight: 600;
  color: #495057;
  margin-right: 5px;
}

/* 워크플로우 로딩 상태 */
.workflow-loading {
  margin-top: 20px;
  padding: 20px;
  text-align: center;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.workflow-loading p {
  margin-bottom: 10px;
  color: #495057;
}

.workflow-loading .loading-spinner {
  font-size: 24px;
  color: #007bff;
  margin-top: 10px;
}

.workflow-loading i.fa-info-circle {
  font-size: 24px;
  color: #17a2b8;
  margin-top: 10px;
}

.workflow-loading i.fa-exclamation-triangle {
  font-size: 24px;
  color: #dc3545;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .image-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 이미지 태그 스타일 */
.image-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  margin: 0 0 10px 0;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  gap: 6px;
}

.tag-iapp {
  background-color: rgba(46, 204, 113, 0.15);
  color: #27ae60;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.tag-analysis {
  background-color: rgba(255, 165, 0, 0.15);
  color: #e67e22;
  border: 1px solid rgba(255, 165, 0, 0.3);
}

/* 유사 이미지 섹션 스타일 */
.similar-section-headers {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.similar-section-title {
  flex: 1;
  margin: 0;
  font-size: 0.9rem;
  padding-bottom: 6px;
  border-bottom: 1px solid #eee;
}

.iapp-title {
  color: #27ae60;
  border-bottom: 2px solid #27ae60;
  margin-right: 8px;
}

.analysis-title {
  color: #e67e22;
  border-bottom: 2px solid #e67e22;
  margin-left: 8px;
}

/* 2열 그리드 레이아웃 */
.dual-column-grid {
  display: flex;
  gap: 12px;
  height: calc(100% - 40px);
  overflow-y: auto;
}

.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.iapp-column .similar-image-item {
  border-left: 3px solid #27ae60;
}

.iapp-column .similar-image-item:hover {
  box-shadow: 0 4px 12px rgba(46, 204, 113, 0.2);
  border-color: #27ae60;
}

.analysis-column .similar-image-item {
  border-left: 3px solid #e67e22;
}

.analysis-column .similar-image-item:hover {
  box-shadow: 0 4px 12px rgba(255, 165, 0, 0.2);
  border-color: #e67e22;
}
</style> 