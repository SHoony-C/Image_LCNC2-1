<template>
  <div class="table-selector-overlay" v-if="show">
    <div class="table-selector-container">
      <div class="selector-header">
        <h3>테이블 선택</h3>
        <button class="close-btn" @click="close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="selector-body">
        <div class="search-container">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="테이블 이름 검색..."
            class="search-input"
            @input="searchTables"
          />
        </div>
        
        <div class="tables-container">
          <div class="tables-list">
            <div 
              v-for="table in filteredTables" 
              :key="table.idx"
              class="table-item"
              :class="{ 'selected': selectedTable && selectedTable.idx === table.idx }"
              @click="selectTable(table)"
            >
              <div class="table-name">{{ table.table_name }}</div>
              <div class="table-dept" v-if="table.department">{{ table.department }}</div>
            </div>
            
            <div v-if="filteredTables.length === 0 && !isLoading" class="no-results">
              검색 결과가 없습니다
            </div>
            
            <div v-if="isLoading" class="loading">
              <span>테이블 목록을 불러오는 중...</span>
            </div>
          </div>
        </div>
        
        <div class="lot-id-container">
          <label for="lot-id">Lot Wafer</label>
          <input 
            type="text" 
            id="lot-id" 
            v-model="lot_wafer" 
            placeholder="Lot Wafer 입력 (필수)"
            class="lot-id-input"
            @blur="checkLotWaferDuplicate"
            @input="resetLotWaferError"
          />
          <div v-if="lotWaferMessage" class="lot-id-message" :class="{'error': lotWaferError}">
            {{ lotWaferMessage }}
          </div>
        </div>
      </div>
      
      <div class="selector-footer">
        <button 
          class="cancel-btn"
          @click="close"
        >
          취소
        </button>
        <button 
          class="select-btn" 
          :disabled="!selectedTable || !lot_wafer || lotWaferError"
          @click="confirmSelection"
        >
          선택 완료
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TableNameSelector',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      tables: [],
      filteredTables: [],
      selectedTable: null,
      searchQuery: '',
      isLoading: false,
      lot_wafer: '',
      lotWaferError: false,
      lotWaferMessage: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.loadTables();
      }
    },
    selectedTable() {
      // 테이블 변경 시 lot_wafer 중복 체크 초기화
      this.lotWaferError = false;
      this.lotWaferMessage = '';
      
      // 만약 lot_wafer가 입력되어 있다면 다시 체크
      if (this.lot_wafer && this.selectedTable) {
        this.checkLotWaferDuplicate();
      }
    }
  },
  methods: {
    async loadTables() {
      try {
        this.isLoading = true;
        const response = await fetch('http://localhost:8000/api/msa6/table-names');
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
          this.tables = result.data;
          this.filteredTables = [...this.tables];
        } else {
          console.error('테이블 목록 로드 실패:', result);
        }
      } catch (error) {
        console.error('테이블 목록 로드 중 오류:', error);
      } finally {
        this.isLoading = false;
      }
    },
    
    searchTables() {
      if (!this.searchQuery) {
        this.filteredTables = [...this.tables];
        return;
      }
      
      const query = this.searchQuery.toLowerCase();
      this.filteredTables = this.tables.filter(table => 
        table.table_name.toLowerCase().includes(query) ||
        (table.department && table.department.toLowerCase().includes(query))
      );
    },
    
    selectTable(table) {
      this.selectedTable = table;
    },
    
    async checkLotWaferDuplicate() {
      // lot_wafer와 테이블이 모두 선택된 경우에만 체크
      if (!this.lot_wafer || !this.selectedTable) {
        this.lotWaferError = false;
        this.lotWaferMessage = '';
        return;
      }
      
      try {
        // 중복 체크 API 호출
        const response = await fetch('http://localhost:8000/api/external_storage/check-lot-wafer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            lot_wafer: this.lot_wafer,
            table_name: this.selectedTable.table_name
          })
        });
        
        const result = await response.json();
        
        if (result.status === 'duplicate') {
          // 중복된 lot_wafer 경고
          this.lotWaferError = true;
          this.lotWaferMessage = result.message || '이미 존재하는 Lot Wafer입니다.';
        } else if (result.status === 'available') {
          // 사용 가능한 lot_wafer
          this.lotWaferError = false;
          this.lotWaferMessage = '';
        } else {
          // 오류 발생
          this.lotWaferError = false;
          this.lotWaferMessage = '';
          console.error('Lot Wafer 중복 체크 오류:', result);
        }
      } catch (error) {
        console.error('Lot Wafer 중복 체크 중 오류 발생:', error);
        this.lotWaferError = false;
        this.lotWaferMessage = '';
      }
    },
    
    // Lot Wafer 입력값 변경 시 에러 상태 초기화
    resetLotWaferError() {
      if (this.lotWaferError) {
        this.lotWaferError = false;
        this.lotWaferMessage = '';
      }
    },
    
    confirmSelection() {
      if (!this.selectedTable) {
        alert('테이블을 선택해주세요.');
        return;
      }
      
      if (!this.lot_wafer) {
        alert('Lot Wafer를 입력해주세요.');
        return;
      }
      
      if (this.lotWaferError) {
        alert('이미 존재하는 Lot Wafer입니다. 다른 ID를 입력해주세요.');
        return;
      }
      
      this.$emit('select', {
        ...this.selectedTable,
        lot_wafer: this.lot_wafer,
        is_result: true  // MSA6 결과 이미지임을 명시
      });
      
      this.selectedTable = null;
      this.searchQuery = '';
      this.lot_wafer = '';
      this.lotWaferError = false;
      this.lotWaferMessage = '';
    },
    
    close() {
      this.selectedTable = null;
      this.searchQuery = '';
      this.lot_wafer = '';
      this.lotWaferError = false;
      this.lotWaferMessage = '';
      this.$emit('close');
    }
  }
}
</script>

<style scoped>
.table-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.table-selector-container {
  background: #fff;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.selector-header {
  padding: 1rem 1.5rem;
  background: #7950f2;
  border-bottom: 1px solid #6741d9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selector-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn i {
  font-size: 1.2rem;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.selector-body {
  flex: 1;
  min-height: 0;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-container {
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #7950f2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(121, 80, 242, 0.1);
}

.tables-container {
  flex: 1;
  min-height: 0;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
}

.tables-list {
  height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
}

.table-item {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.table-item:hover {
  background: #f8f0ff;
}

.table-item.selected {
  background: #f3f0ff;
  border: 1px solid #b197fc;
}

.table-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: #495057;
}

.table-dept {
  font-size: 0.8rem;
  color: #868e96;
}

.no-results, .loading {
  padding: 2rem;
  text-align: center;
  color: #868e96;
  font-size: 0.95rem;
}

.lot-id-container {
  width: 100%;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f0ff;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.lot-id-container label {
  display: block;
  margin-bottom: 0.5rem;
  color: #495057;
  font-size: 0.9rem;
  font-weight: 600;
}

.lot-id-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.2s;
  background: #fff;
}

.lot-id-input:focus {
  border-color: #7950f2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(121, 80, 242, 0.1);
}

.lot-id-message {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #2b8a3e;
}

.lot-id-message.error {
  color: #e03131;
}

.selector-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  background: #f1f3f5;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  color: #495057;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e9ecef;
}

.select-btn {
  padding: 0.75rem 1.5rem;
  background: #7950f2;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover:not(:disabled) {
  background: #6741d9;
}

.select-btn:disabled {
  background: #b197fc;
  cursor: not-allowed;
}
</style> 