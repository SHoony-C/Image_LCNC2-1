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
  methods: {
    /**
     * 테이블 이름 선택 팝업 표시
     */
    showTableSelector() {
      this.showTableSelectorPopup = true;
    },
    
    /**
     * 선택한 테이블 이름으로 측정 결과 저장
     */
    async saveWithTableName(selectedTable) {
      try {
        console.log('선택한 테이블:', selectedTable);
        
        if (!this.measurements || this.measurements.length === 0) {
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
        
        // 측정 결과 저장 API 호출 (백엔드에서 권한 확인 포함)
        for (const measurement of this.measurements) {
          const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              table_name: selectedTable.table_name,
              username: userName,
              lot_wafer: lot_wafer,
              measurement: {
                itemId: measurement.label || 'measurement',
                subItemId: measurement.type || 'distance',
                value: parseFloat(measurement.value) || 0
              }
            })
          });
          
          const result = await response.json();
          
          if (result.status !== 'success') {
            // 권한 오류인 경우 특별 처리
            if (response.status === 403) {
              this.showNotification(result.message || '해당 테이블에 대한 저장 권한이 없습니다.', 'error');
              return;
            }
            throw new Error(result.message || '저장 실패');
          }
        }
        
        this.showNotification(`측정 결과가 '${selectedTable.table_name}' 테이블에 저장되었습니다.`, 'success');
        
      } catch (error) {
        console.error('측정 결과 저장 중 오류:', error);
        this.showNotification('측정 결과 저장 중 오류가 발생했습니다.', 'error');
      }
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