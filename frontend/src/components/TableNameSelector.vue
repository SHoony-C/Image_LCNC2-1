<template>
  <div class="table-selector-overlay" v-if="show" @click.self="close">
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
          <label for="lot-id">Lot ID</label>
          <input 
            type="text" 
            id="lot-id" 
            v-model="lotId" 
            placeholder="Lot ID 입력 (필수)"
            class="lot-id-input"
          />
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
          :disabled="!selectedTable || !lotId"
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
      lotId: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.loadTables();
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
    
    confirmSelection() {
      if (!this.selectedTable) {
        alert('테이블을 선택해주세요.');
        return;
      }
      
      if (!this.lotId) {
        alert('Lot ID를 입력해주세요.');
        return;
      }
      
      this.$emit('select', {
        ...this.selectedTable,
        lot_id: this.lotId
      });
      
      this.selectedTable = null;
      this.searchQuery = '';
      this.lotId = '';
    },
    
    close() {
      this.selectedTable = null;
      this.searchQuery = '';
      this.lotId = '';
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