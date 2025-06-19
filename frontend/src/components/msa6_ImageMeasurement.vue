<template>
  <div class="image-measurement-container">
    <!-- 결과 저장 버튼 영역 추가 -->
    <div v-if="measurements.length > 0" class="save-result-area">
      <button class="save-btn" @click="showTableSelector">
        <i class="fas fa-save"></i> 측정 결과 저장
      </button>
    </div>
    
    <!-- 테이블 이름 선택 팝업 -->
    <TableNameSelector
      :show="showTableSelectorPopup"
      @close="showTableSelectorPopup = false"
      @select="saveWithTableName"
    />
    
    <!-- 알림 메시지 -->
    <div v-if="notification.show" 
         :class="['notification', notification.type]">
      {{ notification.message }}
    </div>
  </div>
</template>

<script>
import TableNameSelector from './TableNameSelector.vue';

export default {
  components: {
    TableNameSelector
  },
  data() {
    return {
      showTableSelectorPopup: false,
      notification: {
        show: false,
        message: '',
        type: 'info',
        timeout: null
      }
    };
  },
  computed: {
    // 부모 컴포넌트의 filteredMeasurements 데이터 사용 (results-table에 표시되는 수정된 최종 데이터)
    measurements() {
      // 부모 컴포넌트의 측정 팝업에서 filteredMeasurements 가져오기
      const measurementPopup = this.$parent.$refs.measurementPopup;
      if (measurementPopup && measurementPopup.filteredMeasurements) {
        console.log('filteredMeasurements 사용:', measurementPopup.filteredMeasurements.length, '개');
        console.log('filteredMeasurements 샘플:', measurementPopup.filteredMeasurements.slice(0, 3));
        return measurementPopup.filteredMeasurements;
      }
      
      // 폴백: 기존 measurements 사용
      const fallbackMeasurements = this.$parent.measurements || [];
      console.log('폴백 measurements 사용:', fallbackMeasurements.length, '개');
      return fallbackMeasurements;
    },
    // 현재 파일 정보
    currentFile() {
      return this.$parent.currentFile || null;
    }
  },
  methods: {
    /**
     * 테이블 이름 선택 팝업 표시
     */
    showTableSelector() {
      console.log('🚀🚀🚀 showTableSelector 함수 호출됨! 🚀🚀🚀');
      console.log('팝업 표시 전 상태:', this.showTableSelectorPopup);
      this.showTableSelectorPopup = true;
      console.log('팝업 표시 후 상태:', this.showTableSelectorPopup);
    },
    
    /**
     * 선택한 테이블 이름으로 측정 결과 저장
     */
    async saveWithTableName(selectedTable) {
      console.log('🔥🔥🔥 saveWithTableName 함수 호출됨! 🔥🔥🔥');
      console.log('전달받은 selectedTable:', selectedTable);
      
      try {
        console.log('=== 저장 시작 ===');
        console.log('선택한 테이블:', selectedTable);
        
        // segmentedMeasurements 전체 데이터를 직접 사용
        const measurementPopup = this.$parent.$refs.measurementPopup;
        console.log('부모 컴포넌트 $parent:', this.$parent);
        console.log('measurementPopup 참조:', measurementPopup);
        
        let resultsTableData = [];
        
        if (measurementPopup) {
          const segmentedMeasurements = measurementPopup.segmentedMeasurements || [];
          
          console.log('=== segmentedMeasurements 전체 데이터 분석 ===');
          console.log('measurementPopup 객체 키들:', Object.keys(measurementPopup));
          console.log('segmentedMeasurements 존재 여부:', !!measurementPopup.segmentedMeasurements);
          console.log('전체 segmentedMeasurements 길이:', segmentedMeasurements.length);
          console.log('segmentedMeasurements 타입:', typeof segmentedMeasurements);
          console.log('segmentedMeasurements 배열 여부:', Array.isArray(segmentedMeasurements));
          
          // 전체 데이터 구조 확인
          segmentedMeasurements.forEach((segment, index) => {
            if (index < 10) { // 처음 10개만 로깅
              console.log(`세그먼트 #${index}:`, {
                itemId: segment.itemId,
                subItemId: segment.subItemId,
                value: segment.value,
                isBright: segment.isBright,
                isTotal: segment.isTotal,
                전체키: Object.keys(segment),
                전체객체: segment
              });
            }
          });
          
          // 일단 segmentedMeasurements 전체를 사용 (필터링 없이)
          resultsTableData = segmentedMeasurements;
          
          console.log('필터링 없이 전체 데이터 사용, 길이:', resultsTableData.length);
          console.log('resultsTableData 첫 3개:', resultsTableData.slice(0, 3));
        } else {
          console.error('measurementPopup을 찾을 수 없습니다!');
          console.log('$parent.$refs:', this.$parent.$refs);
        }
        
        console.log('=== 최종 저장할 데이터 ===');
        console.log('measurementPopup 존재:', !!measurementPopup);
        console.log('최종 resultsTableData 길이:', resultsTableData.length);
        console.log('최종 resultsTableData 타입:', typeof resultsTableData);
        console.log('최종 resultsTableData 배열 여부:', Array.isArray(resultsTableData));
        
        if (!resultsTableData || resultsTableData.length === 0) {
          console.error('저장할 데이터가 없습니다!');
          this.showNotification('저장할 측정 결과가 없습니다.', 'error');
          return;
        }
        
        // 로컬 스토리지에서 사용자 정보 가져오기
        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        const userName = userInfo.username || '';
        
        if (!userName) {
          this.showNotification('사용자 정보를 찾을 수 없습니다.', 'error');
          return;
        }
        
        const lot_wafer = this.currentFile ? this.currentFile.name.split('.')[0] : '';
        
        // results-table 데이터를 그대로 사용
        const processedMeasurements = resultsTableData.map((segment, index) => {
          console.log(`results-table 데이터 #${index + 1}:`, segment);
          
          // segment 객체의 속성을 그대로 사용
          const itemId = segment.itemId || "";
          const subItemId = segment.subItemId || "";
          const value = parseFloat(segment.value) || 0;
          
          const processedData = {
            itemId: itemId,
            subItemId: subItemId,
            value: value
          };
          
          console.log(`최종 저장 데이터 #${index + 1}:`, processedData);
          return processedData;
        });
        
        // 이미지 데이터 캡처
        let beforeImageData = null;
        let afterImageData = null;
        
        try {
          console.log('=== 이미지 캡처 시작 ===');
          // 부모 컴포넌트에서 이미지 데이터 가져오기
          const imageData = await this.captureImageData();
          beforeImageData = imageData.beforeImage;
          afterImageData = imageData.afterImage;
          
          console.log('이미지 데이터 캡처 완료:', {
            beforeImage: beforeImageData ? `있음 (길이: ${beforeImageData.length})` : '없음',
            afterImage: afterImageData ? `있음 (길이: ${afterImageData.length})` : '없음'
          });
        } catch (imageError) {
          console.warn('이미지 캡처 실패:', imageError);
          this.showNotification('이미지 캡처에 실패했지만 측정 데이터는 저장됩니다.', 'warning');
        }
        
        // 측정 결과 저장 API 호출 (백엔드에서 권한 확인 포함)
        const requestData = {
          table_name: selectedTable.table_name,
          username: userName,
          lot_wafer: lot_wafer,
          measurements: processedMeasurements
        };
        
        // 이미지 데이터가 있으면 추가
        if (beforeImageData) {
          requestData.before_image_data = beforeImageData;
        }
        if (afterImageData) {
          requestData.after_image_data = afterImageData;
        }
        
        console.log('=== API 요청 데이터 ===');
        console.log('요청 URL:', 'http://localhost:8000/api/msa6/save-with-table-name');
        console.log('요청 데이터 (이미지 제외):', {
          table_name: requestData.table_name,
          username: requestData.username,
          lot_wafer: requestData.lot_wafer,
          measurements: requestData.measurements,
          before_image_data: requestData.before_image_data ? '있음' : '없음',
          after_image_data: requestData.after_image_data ? '있음' : '없음'
        });
        
        const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        console.log('=== API 응답 ===');
        console.log('응답 상태:', response.status);
        console.log('응답 데이터:', result);
        
        if (result.status !== 'success') {
          // 권한 오류인 경우 특별 처리
          if (response.status === 403) {
            this.showNotification(result.message || '해당 테이블에 대한 저장 권한이 없습니다.', 'error');
            return;
          }
          throw new Error(result.message || '저장 실패');
        }
        
        // 성공 메시지에 저장된 이미지 정보 포함
        let successMessage = `측정 결과가 '${selectedTable.table_name}' 테이블에 저장되었습니다.`;
        if (result.saved_images) {
          const imageInfo = [];
          if (result.saved_images.before) {
            imageInfo.push(`처리 전 이미지: ${result.saved_images.before}`);
          }
          if (result.saved_images.after) {
            imageInfo.push(`처리 후 이미지: ${result.saved_images.after}`);
          }
          if (imageInfo.length > 0) {
            successMessage += ` ${imageInfo.join(', ')}도 저장되었습니다.`;
          }
        }
        
        this.showNotification(successMessage, 'success');
        
      } catch (error) {
        console.error('측정 결과 저장 중 오류:', error);
        this.showNotification('측정 결과 저장 중 오류가 발생했습니다.', 'error');
      }
    },
    
    /**
     * 측정 결과가 표시된 이미지 데이터 캡처
     */
    async captureImageData() {
      return new Promise((resolve, reject) => {
        try {
          console.log('=== 이미지 캡처 상세 로그 ===');
          
          // 부모 컴포넌트의 측정 팝업에서 이미지 데이터 가져오기
          const measurementPopup = this.$parent.$refs.measurementPopup;
          console.log('측정 팝업 참조:', measurementPopup ? '있음' : '없음');
          
          if (!measurementPopup) {
            console.warn('측정 팝업 참조를 찾을 수 없습니다.');
            resolve({ beforeImage: null, afterImage: null });
            return;
          }
          
          // 캔버스 참조 가져오기
          const canvas = measurementPopup.$refs.canvas;
          console.log('캔버스 참조:', canvas ? '있음' : '없음');
          console.log('캔버스 크기:', canvas ? `${canvas.width}x${canvas.height}` : 'N/A');
          
          if (!canvas) {
            console.warn('캔버스 참조를 찾을 수 없습니다.');
            resolve({ beforeImage: null, afterImage: null });
            return;
          }
          
          // 현재 이미지 상태 확인
          console.log('현재 이미지 상태:', {
            isShowingInputImage: measurementPopup.isShowingInputImage,
            inputImageUrl: measurementPopup.inputImageUrl ? '있음' : '없음',
            outputImageUrl: measurementPopup.outputImageUrl ? '있음' : '없음',
            internalInputImageUrl: measurementPopup.internalInputImageUrl ? '있음' : '없음'
          });
          
          // 현재 캔버스 상태를 이미지로 캡처 (측정 결과 포함)
          let currentImageData;
          try {
            currentImageData = canvas.toDataURL('image/png', 0.9);
            console.log('현재 캔버스 캡처 성공, 데이터 길이:', currentImageData.length);
          } catch (captureError) {
            console.error('캔버스 캡처 실패:', captureError);
            reject(captureError);
            return;
          }
          
          // Before/After 이미지 구분
          const isShowingInputImage = measurementPopup.isShowingInputImage;
          
          let beforeImage = null;
          let afterImage = null;
          
          if (isShowingInputImage) {
            // 현재 입력 이미지를 보고 있는 경우
            beforeImage = currentImageData;
            console.log('Before 이미지 설정 완료 (현재 입력 이미지)');
            
            // 출력 이미지로 전환하여 캡처
            if (measurementPopup.outputImageUrl) {
              console.log('출력 이미지로 전환 시도...');
              try {
                // 임시로 출력 이미지로 전환
                measurementPopup.isShowingInputImage = false;
                
                // DOM 업데이트 대기
                this.$nextTick(() => {
                  // 잠시 대기 후 캡처 (이미지 로딩 시간 고려)
                  setTimeout(() => {
                    try {
                      afterImage = canvas.toDataURL('image/png', 0.9);
                      console.log('After 이미지 캡처 성공, 데이터 길이:', afterImage.length);
                      
                      // 원래 상태로 복원
                      measurementPopup.isShowingInputImage = true;
                      console.log('원래 상태로 복원 완료');
                      
                      resolve({ beforeImage, afterImage });
                    } catch (error) {
                      console.warn('After 이미지 캡처 실패:', error);
                      measurementPopup.isShowingInputImage = true;
                      resolve({ beforeImage, afterImage: null });
                    }
                  }, 1000); // 1초 대기로 증가
                });
              } catch (error) {
                console.warn('이미지 전환 실패:', error);
                resolve({ beforeImage, afterImage: null });
              }
            } else {
              console.log('출력 이미지 URL이 없음');
              resolve({ beforeImage, afterImage: null });
            }
          } else {
            // 현재 출력 이미지를 보고 있는 경우
            afterImage = currentImageData;
            console.log('After 이미지 설정 완료 (현재 출력 이미지)');
            
            // 입력 이미지로 전환하여 캡처
            if (measurementPopup.internalInputImageUrl || measurementPopup.inputImageUrl) {
              console.log('입력 이미지로 전환 시도...');
              try {
                // 임시로 입력 이미지로 전환
                measurementPopup.isShowingInputImage = true;
                
                // DOM 업데이트 대기
                this.$nextTick(() => {
                  // 잠시 대기 후 캡처 (이미지 로딩 시간 고려)
                  setTimeout(() => {
                    try {
                      beforeImage = canvas.toDataURL('image/png', 0.9);
                      console.log('Before 이미지 캡처 성공, 데이터 길이:', beforeImage.length);
                      
                      // 원래 상태로 복원
                      measurementPopup.isShowingInputImage = false;
                      console.log('원래 상태로 복원 완료');
                      
                      resolve({ beforeImage, afterImage });
                    } catch (error) {
                      console.warn('Before 이미지 캡처 실패:', error);
                      measurementPopup.isShowingInputImage = false;
                      resolve({ beforeImage: null, afterImage });
                    }
                  }, 1000); // 1초 대기로 증가
                });
              } catch (error) {
                console.warn('이미지 전환 실패:', error);
                resolve({ beforeImage: null, afterImage });
              }
            } else {
              console.log('입력 이미지 URL이 없음');
              resolve({ beforeImage: null, afterImage });
            }
          }
          
        } catch (error) {
          console.error('이미지 캡처 중 오류:', error);
          reject(error);
        }
      });
    },
    
    /**
     * 알림 메시지 표시
     */
    showNotification(message, type = 'info') {
      // 이전 타이머가 있으면 제거
      if (this.notification.timeout) {
        clearTimeout(this.notification.timeout);
      }
      
      // 알림 설정
      this.notification.show = true;
      this.notification.message = message;
      this.notification.type = type;
      
      // 3초 후 자동으로 닫기
      this.notification.timeout = setTimeout(() => {
        this.notification.show = false;
      }, 3000);
    }
  }
};
</script>

<style scoped>
.save-result-area {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.save-btn {
  padding: 10px 16px;
  background-color: #4c6ef5;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-btn:hover {
  background-color: #3b5bdb;
}

.notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 9999;
  animation: fadeIn 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.notification.info {
  background-color: #4c6ef5;
}

.notification.success {
  background-color: #40c057;
}

.notification.error {
  background-color: #fa5252;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style> 