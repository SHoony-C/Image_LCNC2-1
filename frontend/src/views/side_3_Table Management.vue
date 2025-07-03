<template>
  <div class="table-manage-view">
    <AppHeader pageTitle="Table Management" />
    
    <div class="table-manage-content">
      <div class="control-section">
        <!-- 분석 타입 선택 -->
        <div class="control-group">
          <label for="analysis-type-select">분석 타입:</label>
          <select 
            id="analysis-type-select"
            v-model="analysisType" 
            class="analysis-type-select"
            :disabled="isLoading"
          >
            <option value="measurement">CD 분석</option>
            <option value="defect">불량 분석</option>
          </select>
        </div>
        
        <!-- 테이블 선택 -->
        <div class="control-group">
          <label for="table-select">테이블 선택:</label>
          <select 
            id="table-select"
            v-model="selectedTable" 
            class="table-select"
            :disabled="isLoading"
            @change="onTableChange"
          >
            <option value="">테이블을 선택하세요</option>
            <option v-for="table in authorizedTables" 
                    :key="table.table_name" 
                    :value="table.table_name">
              {{ table.table_name }}
            </option>
          </select>
        </div>
        
        <!-- 날짜 범위 -->
        <div class="control-group">
          <label>날짜 범위:</label>
          <div class="date-range">
            <input 
              type="date" 
              v-model="dateFrom" 
              class="date-input"
              :disabled="isLoading"
            />
            <span class="date-separator">~</span>
            <input 
              type="date" 
              v-model="dateTo" 
              class="date-input"
              :disabled="isLoading"
            />
          </div>
        </div>
        
        <!-- Data Load 버튼 -->
        <button 
          class="load-btn" 
          @click="loadData" 
          :disabled="!canLoadData || isLoading"
        >
          {{ isLoading ? '로딩 중...' : 'Data Load' }}
        </button>
      </div>

      <!-- 테이블 설명 수정 영역 -->
      <div v-if="selectedTable && dataLoaded" class="table-desc-section">
        <div class="desc-header">
          <h4>테이블 설명 수정</h4>
        </div>
        <div class="desc-content">
          <div class="desc-group">
            <label>테이블명: {{ loadedTableName }}</label>
            <textarea 
              v-model="tableDescription"
              class="desc-textarea"
              :placeholder="isDescriptionLoading ? '설명을 불러오는 중...' : '테이블 설명을 입력하세요...'"
              :disabled="isLoading || isDescriptionLoading"
            ></textarea>
          </div>
          <button 
            class="desc-save-btn" 
            @click="saveTableDescription"
            :disabled="isLoading || isDescriptionLoading || !tableDescription.trim() || !loadedTableName">
            <i class="fas fa-save"></i> 
            {{ isDescriptionLoading ? '로딩 중...' : '설명 저장' }}
          </button>
        </div>
      </div>

      <!-- 테이블 데이터 표시 영역 -->
      <div class="data-section" v-if="tableData && tableData.length > 0">
        <div class="data-header">
          <h3>{{ loadedTableName }} 테이블 데이터 ( 총 {{ tableData.length }}건 )</h3>
          <div class="data-actions">
            <!-- Lot Wafer 검색 -->
            <div class="search-group">
              <input 
                type="text" 
                v-model="lotWaferTableSearch" 
                class="table-search-input"
                placeholder="Lot Wafer 검색..."
                :disabled="isLoading"
              />
              <i class="fas fa-search search-icon"></i>
            </div>
            <!-- 변경사항 저장 버튼 -->
            <button 
              class="action-btn save-btn" 
              @click="saveChanges" 
              :disabled="isLoading || !hasChanges"
            >
              <i class="fas fa-save"></i> 변경 내용 저장
            </button>
            <!-- 다운로드 버튼 -->
            <button class="action-btn download-btn" @click="downloadData" :disabled="isLoading">
              <i class="fas fa-download"></i> 다운로드
            </button>
          </div>
        </div>
        
        <!-- CD 분석 테이블 -->
        <div v-if="loadedAnalysisType === 'measurement'" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>테이블명</th>
                <th>사용자</th>
                <th>Lot Wafer</th>
                <th>Item ID</th>
                <th>Subitem ID</th>
                <th>값</th>
                <th>생성일시</th>
                <th>임시 삭제</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredTableData" :key="row.pk_id">
                <td>{{ row.table_name }}</td>
                <td>{{ row.username }}</td>
                <td>{{ row.lot_wafer }}</td>
                <td>
                  <input 
                    type="text" 
                    v-model="row.item_id" 
                    class="editable-input"
                    @input="markAsChanged(row)"
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    v-model="row.subitem_id" 
                    class="editable-input"
                    @input="markAsChanged(row)"
                  />
                </td>
                <td>{{ row.value ? Number(row.value).toFixed(2) : '-' }}</td>
                <td>{{ formatDateTime(row.create_time) }}</td>
                <td>
                  <input 
                    type="checkbox" 
                    v-model="row.is_deleted" 
                    class="delete-checkbox"
                    @change="markAsChanged(row)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- 불량 분석 테이블 -->
        <div v-else-if="loadedAnalysisType === 'defect'" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>테이블명</th>
                <th>사용자</th>
                <th>Lot Wafer</th>
                <th>Item ID</th>
                <th>Subitem ID</th>
                <th>Major Axis</th>
                <th>Minor Axis</th>
                <th>Area</th>
                <th>Striation Ratio</th>
                <th>Distortion Ratio</th>
                <th>생성일시</th>
                <th>임시 삭제</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredTableData" :key="row.pk_id || row.id">
                <td>{{ row.table_name }}</td>
                <td>{{ row.username }}</td>
                <td>{{ row.lot_wafer }}</td>
                <td>
                  <input 
                    type="text" 
                    v-model="row.item_id" 
                    class="editable-input"
                    @input="markAsChanged(row)"
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    v-model="row.subitem_id" 
                    class="editable-input"
                    @input="markAsChanged(row)"
                  />
                </td>
                <td>{{ row.major_axis ? Number(row.major_axis).toFixed(2) : '-' }}</td>
                <td>{{ row.minor_axis ? Number(row.minor_axis).toFixed(2) : '-' }}</td>
                <td>{{ row.area ? Number(row.area).toFixed(2) : '-' }}</td>
                <td>{{ row.striated_ratio ? Number(row.striated_ratio).toFixed(3) : '-' }}</td>
                <td>{{ row.distorted_ratio ? Number(row.distorted_ratio).toFixed(3) : '-' }}</td>
                <td>{{ formatDateTime(row.created_at) }}</td>
                <td>
                  <input 
                    type="checkbox" 
                    v-model="row.is_deleted" 
                    class="delete-checkbox"
                    @change="markAsChanged(row)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 데이터가 없을 때 -->
      <div v-else-if="!isLoading && loadAttempted && !dataLoaded" class="no-data">
        <i class="fas fa-table"></i>
        <p>선택한 조건에 해당하는 데이터가 없습니다.</p>
      </div>
      
      <!-- 초기 상태 -->
      <div v-else-if="!isLoading && !loadAttempted" class="initial-state">
        <i class="fas fa-database"></i>
        <p>테이블을 선택하고 Data Load 버튼을 클릭하세요.</p>
      </div>
    </div>

    <!-- 확인 모달 -->
    <div v-if="showConfirmModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>변경사항 저장 확인</h3>
        </div>
        <div class="modal-body">
          <p>{{ changedRowsCount }}개의 레코드가 변경되었습니다.</p>
          <p>변경사항을 저장하시겠습니까?</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeModal">취소</button>
          <button class="btn-confirm" @click="confirmSave">확인</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import axios from 'axios';

export default {
  name: 'TableManageView',
  components: {
    AppHeader
  },
  setup() {
    // 상태 변수들
    const analysisType = ref('measurement');
    const loadedAnalysisType = ref(''); // 실제로 로드된 분석 타입
    const selectedTable = ref('');
    const loadedTableName = ref(''); // Data Load 후에만 업데이트되는 테이블명
    const authorizedTables = ref([]);
    const tableData = ref([]);
    const originalData = ref([]);
    const changedRows = ref(new Set());
    const isLoading = ref(false);
    const lotWaferTableSearch = ref('');
    const showConfirmModal = ref(false);
    const tableDescription = ref('');
    const loadAttempted = ref(false);
    const dataLoaded = ref(false); // 데이터 로드 성공 여부
    const isDescriptionLoading = ref(false); // 테이블 설명 로딩 상태 추가
    
    // 한국시간 기준으로 날짜 설정 (오늘부터 30일 전까지)
    const getKoreanDate = (daysOffset = 0) => {
      const now = new Date();
      const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const targetDate = new Date(koreanTime.getTime() + (daysOffset * 24 * 60 * 60 * 1000));
      return targetDate.toISOString().split('T')[0];
    };
    
    const dateFrom = ref(getKoreanDate(-30)); // 30일 전
    const dateTo = ref(getKoreanDate(0)); // 오늘

    // 현재 사용자 정보 가져오기
    const getCurrentUser = () => {
      const userInfo = localStorage.getItem('user');
      if (userInfo) {
        return JSON.parse(userInfo);
      }
      return { username: 'default_user' };
    };

    // 권한 있는 테이블 목록 조회
    const fetchAuthorizedTables = async () => {
      try {
        const user = getCurrentUser();
        const response = await axios.get(`http://localhost:8000/api/side3/authorized-tables?username=${user.username}`);
        
        if (response.data.status === 'success') {
          authorizedTables.value = response.data.data;
        } else {
          console.error('권한 테이블 조회 실패:', response.data.message);
          authorizedTables.value = [];
        }
      } catch (error) {
        console.error('권한 테이블 조회 오류:', error);
        authorizedTables.value = [];
      }
    };

    // 테이블 설명 조회
    const fetchTableDescription = async (tableName) => {
      if (!tableName) {
        tableDescription.value = '';
        return;
      }
      
      isDescriptionLoading.value = true; // 로딩 시작
      
      try {
        const response = await axios.get(`http://localhost:8000/api/side3/table-description?table_name=${tableName}`);
        
        if (response.data.status === 'success') {
          tableDescription.value = response.data.table_desc || '';
        } else {
          // 오류 발생 시에도 기존 값 유지하지 않고 빈 문자열로 설정
          tableDescription.value = '';
        }
      } catch (error) {
        console.error('테이블 설명 조회 오류:', error);
        // 오류 발생 시에도 기존 값 유지하지 않고 빈 문자열로 설정
        tableDescription.value = '';
      } finally {
        isDescriptionLoading.value = false; // 로딩 완료
      }
    };

    // 테이블 설명 저장
    const saveTableDescription = async () => {
      // 실제로 데이터가 로드된 테이블의 설명을 저장
      if (!loadedTableName.value) {
        alert('먼저 Data Load를 실행해주세요.');
        return;
      }
      
      isLoading.value = true;
      
      try {
        const response = await axios.put('http://localhost:8000/api/side3/table-description', {
          table_name: loadedTableName.value, // selectedTable 대신 loadedTableName 사용
          table_desc: tableDescription.value
        });
        
        if (response.data.status === 'success') {
          alert('테이블 설명이 저장되었습니다.');
        } else {
          alert('테이블 설명 저장 실패: ' + response.data.message);
        }
      } catch (error) {
        console.error('테이블 설명 저장 오류:', error);
        alert('테이블 설명 저장 중 오류가 발생했습니다.');
      } finally {
        isLoading.value = false;
      }
    };

    // 테이블 변경 시 처리
    const onTableChange = () => {
      // 테이블 선택이 변경되어도 기존 데이터와 설명은 유지
      // Data Load 버튼을 눌렀을 때만 데이터와 설명이 변경됨
      
      // 드롭다운 변경 시에는 아무것도 초기화하지 않음
      // 기존에 로드된 데이터와 설명을 그대로 유지
    };

    // 필터링된 테이블 데이터
    const filteredTableData = computed(() => {
      if (!tableData.value || !Array.isArray(tableData.value)) {
        return [];
      }
      
      if (!lotWaferTableSearch.value.trim()) {
        return tableData.value;
      }
      
      const searchTerm = lotWaferTableSearch.value.toLowerCase();
      return tableData.value.filter(row => {
        return row.lot_wafer && row.lot_wafer.toLowerCase().includes(searchTerm);
      });
    });

    // 데이터 로드 가능 여부 확인
    const canLoadData = computed(() => {
      return selectedTable.value && dateFrom.value && dateTo.value;
    });

    // 변경사항 여부 확인
    const hasChanges = computed(() => {
      return changedRows.value.size > 0;
    });

    // 변경된 행 수
    const changedRowsCount = computed(() => {
      return changedRows.value.size;
    });

    // 날짜시간 포맷팅 함수
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '-';
      const date = new Date(dateTime);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    // 행 변경 표시 - 개선된 버전
    const markAsChanged = (row) => {
      let uniqueId = null;
      
      // 분석 타입에 따른 ID 필드 결정
      if (loadedAnalysisType.value === 'measurement') {
        uniqueId = row.pk_id;
      } else {
        // 불량 분석의 경우 pk_id와 id 모두 확인
        uniqueId = row.pk_id || row.id;
      }
      
      if (uniqueId) {
        // 원본 데이터와 비교하여 실제 변경 여부 확인
        const originalRow = originalData.value.find(orig => {
          let origId = null;
          if (loadedAnalysisType.value === 'measurement') {
            origId = orig.pk_id;
          } else {
            // 불량 분석의 경우 pk_id와 id 모두 확인
            origId = orig.pk_id || orig.id;
          }
          return origId === uniqueId;
        });
        
        if (originalRow) {
          // 변경 가능한 필드들만 비교
          const editableFields = ['item_id', 'subitem_id', 'is_deleted'];
          let hasChanged = false;
          
          for (const field of editableFields) {
            if (row[field] !== originalRow[field]) {
              hasChanged = true;
              break;
            }
          }
          
          if (hasChanged) {
            changedRows.value.add(uniqueId);
          } else {
            changedRows.value.delete(uniqueId);
          }
        }
      }
    };

    // 데이터 로드 함수
    const loadData = async () => {
      if (!canLoadData.value) return;
      
      isLoading.value = true;
      loadAttempted.value = true;
      dataLoaded.value = false;
      changedRows.value.clear();
      
      try {
        const params = new URLSearchParams();
        params.append('table_name', selectedTable.value);
        params.append('analysis_type', analysisType.value);
        
        if (dateFrom.value) {
          params.append('date_from', dateFrom.value);
        }
        if (dateTo.value) {
          params.append('date_to', dateTo.value);
        }
        
        const queryString = params.toString();
        const apiUrl = `http://localhost:8000/api/side3/table-data?${queryString}`;
        
        // console.log('Loading data with URL:', apiUrl);
        const response = await axios.get(apiUrl);
        
        // console.log('API Response:', response.data);
        
        if (response.data.status === 'success') {
          tableData.value = response.data.data;
          // 원본 데이터를 깊은 복사로 저장
          originalData.value = JSON.parse(JSON.stringify(response.data.data));
          dataLoaded.value = true;
          loadedTableName.value = selectedTable.value;
          loadedAnalysisType.value = analysisType.value; // 로드 시점의 분석 타입 저장
          
          // 데이터 로드 성공 시 테이블 설명 가져오기
          await fetchTableDescription(selectedTable.value);
        } else {
          console.error('데이터 로드 실패:', response.data.message);
          alert('데이터 로드 실패: ' + response.data.message);
          tableData.value = [];
          originalData.value = [];
          dataLoaded.value = false;
        }
      } catch (error) {
        console.error('Error loading table data:', error);
        alert('데이터 로드 중 오류가 발생했습니다: ' + error.message);
        tableData.value = [];
        originalData.value = [];
        dataLoaded.value = false;
      } finally {
        isLoading.value = false;
      }
    };

    // 변경사항 저장
    const saveChanges = () => {
      if (!hasChanges.value) return;
      showConfirmModal.value = true;
    };

    // 모달 닫기
    const closeModal = () => {
      showConfirmModal.value = false;
    };

    // 저장 확인
    const confirmSave = async () => {
      showConfirmModal.value = false;
      isLoading.value = true;

      try {
        const user = getCurrentUser();
        const updates = [];
        
        // 변경된 행들을 찾아서 업데이트 데이터 준비
        changedRows.value.forEach(uniqueId => {
          const row = tableData.value.find(r => {
            let rowId = null;
            if (loadedAnalysisType.value === 'measurement') {
              rowId = r.pk_id;
            } else {
              // 불량 분석의 경우 pk_id와 id 모두 확인
              rowId = r.pk_id || r.id;
            }
            return rowId === uniqueId;
          });
          
          if (row) {
            // 필요한 데이터만 전송
            const updateData = {
              item_id: row.item_id,
              subitem_id: row.subitem_id,
              is_deleted: row.is_deleted ? 1 : 0
            };
            
            // ID 필드 추가 - 실제 존재하는 필드 사용
            if (loadedAnalysisType.value === 'measurement') {
              updateData.pk_id = row.pk_id;
            } else {
              // 불량 분석의 경우 실제 존재하는 ID 필드 사용
              if (row.pk_id) {
                updateData.pk_id = row.pk_id;
              } else if (row.id) {
                updateData.id = row.id;
              }
            }
            
            // console.log('Row data to update:', updateData);
            updates.push(updateData);
          }
        });

        // 분석 타입에 따라 정확한 테이블명 결정
        const actualTableName = loadedAnalysisType.value === 'measurement' ? 'msa6_result_cd' : 'msa6_result_defect';

        const response = await axios.put(
          `http://localhost:8000/api/side3/table-data/${actualTableName}?username=${user.username}`,
          updates
        );

        if (response.data.status === 'success') {
          alert(`${response.data.updated_count}개의 레코드가 성공적으로 업데이트되었습니다.`);
          changedRows.value.clear();
          // 데이터 다시 로드
          await loadData();
        } else {
          alert('업데이트 실패: ' + response.data.message);
        }
      } catch (error) {
        console.error('Error updating data:', error);
        alert('업데이트 중 오류가 발생했습니다: ' + error.message);
      } finally {
        isLoading.value = false;
      }
    };

    // 데이터 다운로드 함수
    const downloadData = async () => {
      if (!tableData.value || tableData.value.length === 0) return;
      
      try {
        // CSV 형식으로 데이터 다운로드
        const csvContent = generateCSV(filteredTableData.value);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedTable.value}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } catch (error) {
        console.error('Error downloading data:', error);
      }
    };

    // CSV 생성 함수
    const generateCSV = (data) => {
      if (!data || data.length === 0) return '';
      
      const headers = Object.keys(data[0]).filter(key => key !== 'pk_id' && key !== 'id');
      const csvHeaders = headers.join(',');
      const csvRows = data.map(row => 
        headers.map(header => {
          const value = row[header];
          return value !== null && value !== undefined ? `"${value}"` : '';
        }).join(',')
      );
      
      return [csvHeaders, ...csvRows].join('\n');
    };

    // 컴포넌트 마운트 시 초기화
    onMounted(() => {
      fetchAuthorizedTables();
    });

    return {
      analysisType,
      loadedAnalysisType,
      selectedTable,
      loadedTableName,
      authorizedTables,
      tableData,
      filteredTableData,
      isLoading,
      dateFrom,
      dateTo,
      lotWaferTableSearch,
      canLoadData,
      hasChanges,
      changedRowsCount,
      showConfirmModal,
      tableDescription,
      loadAttempted,
      dataLoaded,
      isDescriptionLoading,
      loadData,
      saveChanges,
      downloadData,
      formatDateTime,
      markAsChanged,
      closeModal,
      confirmSave,
      onTableChange,
      saveTableDescription
    };
  }
};
</script>

<style scoped>
.table-manage-view {
  background: var(--primary-50);
  min-height: calc(100vh - 70px);
  height: 100%;
  width: calc(100% - 250px);
  margin-left: 250px;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
}

.table-manage-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.control-section {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
  align-items: center;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
}

.control-group label {
  font-weight: 600;
  color: var(--gray-700);
  font-size: 0.875rem;
}

.analysis-type-select,
.table-select,
.search-input {
  padding: 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  transition: border-color 0.3s ease;
}

.analysis-type-select:focus,
.table-select:focus,
.search-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  padding: 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  width: 150px;
}

.date-separator {
  color: var(--gray-500);
  font-weight: 500;
}

.load-btn {
  background: var(--primary-600);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  height: fit-content;
}

.load-btn:hover:not(:disabled) {
  background: var(--primary-700);
  transform: translateY(-1px);
}

.load-btn:disabled {
  background: var(--gray-400);
  cursor: not-allowed;
}

.data-section {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh; /* 전체 높이의 70%로 제한 */
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
  flex-shrink: 0; /* 헤더는 축소되지 않도록 */
  color: var(--primary-700);
}

.data-header h3 {
  color: var(--gray-800);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.data-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* 검색 그룹 스타일 */
.search-group {
  position: relative;
  display: flex;
  align-items: center;
}

.table-search-input {
  padding: 0.5rem 0.75rem;
  padding-right: 2.5rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  width: 200px;
  transition: border-color 0.3s ease;
}

.table-search-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  color: var(--gray-400);
  pointer-events: none;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.375rem;
  background: white;
  color: var(--gray-700);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--primary-500);
  color: var(--primary-600);
}

.save-btn {
  background: var(--green-600);
  color: white;
  border-color: var(--green-600);
}

.save-btn:hover:not(:disabled) {
  background: var(--green-700);
  border-color: var(--green-700);
}

.save-btn:disabled {
  background: var(--gray-500) !important;
  border-color: var(--gray-500) !important;
  color: white !important;
  cursor: not-allowed;
  opacity: 0.8 !important;
  visibility: visible !important;
}

.download-btn:hover:not(:disabled) {
  border-color: var(--blue-500);
  color: var(--blue-600);
}

/* 테이블 컨테이너 스타일 - 스크롤 가능하도록 */
.table-container {
  overflow-y: auto;
  flex: 1; /* 남은 공간을 모두 차지 */
  max-height: calc(70vh - 120px); /* 헤더 높이를 제외한 나머지 */
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--gray-200);
  vertical-align: middle;
}

.data-table th {
  background: var(--gray-50);
  font-weight: 600;
  color: var(--primary-700);
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table tbody tr:hover {
  background: var(--gray-50);
}

.editable-input {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.editable-input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.delete-checkbox {
  transform: scale(1.2);
  cursor: pointer;
}

.no-data,
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--gray-500);
  text-align: center;
}

.no-data i,
.initial-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--gray-400);
}

.no-data p,
.initial-state p {
  font-size: 1.125rem;
  margin: 0;
}

/* 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  min-width: 400px;
  max-width: 500px;
}

.modal-header {
  padding: 1.5rem 2rem 1rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h3 {
  margin: 0;
  color: var(--gray-800);
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem 2rem;
}

.modal-body p {
  margin: 0 0 1rem;
  color: var(--gray-600);
  line-height: 1.5;
}

.modal-body p:last-child {
  margin-bottom: 0;
}

.modal-footer {
  padding: 1rem 2rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel,
.btn-confirm {
  padding: 0.5rem 1.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: white;
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

.btn-cancel:hover {
  background: var(--gray-50);
}

.btn-confirm {
  background: var(--primary-600);
  color: white;
  border: 1px solid var(--primary-600);
}

.btn-confirm:hover {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

@media (max-width: 1200px) {
  .table-manage-view {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .control-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .control-group {
    min-width: auto;
  }
  
  .date-range {
    flex-direction: column;
    align-items: stretch;
  }
  
  .date-input {
    width: 100%;
  }
}

/* 테이블 설명 수정 영역 스타일 */
.table-desc-section {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.desc-header {
  padding: 1rem 2rem;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  color: var(--primary-700);
}

.desc-header h4 {
  margin: 0;
  color: var(--gray-800);
  font-size: 1.125rem;
  font-weight: 600;
}

.desc-content {
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.desc-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.desc-group label {
  font-weight: 600;
  color: var(--gray-700);
  font-size: 0.875rem;
}

.desc-textarea {
  min-height: 80px;
  padding: 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.3s ease;
}

.desc-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}

.desc-save-btn {
  background: #2563eb !important; /* blue-600 */
  color: white !important;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  min-height: 40px;
  opacity: 1 !important;
  visibility: visible !important;
  font-size: 0.875rem;
}

.desc-save-btn:hover:not(:disabled) {
  background: #1d4ed8 !important; /* blue-700 */
  transform: translateY(-1px);
}

.desc-save-btn:disabled {
  background: #9ca3af !important; /* gray-400 */
  color: #6b7280 !important; /* gray-500 */
  cursor: not-allowed;
  opacity: 0.8 !important;
  visibility: visible !important;
}

/* action-btn과 save-btn이 함께 적용될 때 disabled 상태 */
.action-btn.save-btn:disabled {
  background: var(--gray-400) !important; /* 비활성화 시 회색 */
  border-color: var(--gray-400) !important;
  color: #ffffff !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
}

/* Vue scoped CSS 대응 - 활성화된 저장 버튼 */
.table-manage-view .action-btn.save-btn:not(:disabled),
.table-manage-view .save-btn:not(:disabled) {
  background: #059669 !important; /* 초록색 배경으로 확실히 구분 */
  border-color: #059669 !important;
  color: #ffffff !important;
  cursor: pointer !important;
  opacity: 1 !important;
  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3) !important;
  font-weight: 600 !important;
}

/* 활성화된 저장 버튼 hover 효과 */
.table-manage-view .action-btn.save-btn:not(:disabled):hover,
.table-manage-view .save-btn:not(:disabled):hover {
  background: #047857 !important; /* 더 진한 초록색 */
  border-color: #047857 !important;
  box-shadow: 0 4px 8px rgba(5, 150, 105, 0.4) !important;
  transform: translateY(-1px) !important;
}

/* 모든 가능한 선택자 조합으로 활성화 상태 확실히 적용 */
button.save-btn:not(:disabled),
.save-btn:not(:disabled),
[class*="save-btn"]:not(:disabled),
button[class*="save-btn"]:not(:disabled) {
  background: #059669 !important;
  background-color: #059669 !important;
  border-color: #059669 !important;
  color: #ffffff !important;
  cursor: pointer !important;
  opacity: 1 !important;
  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3) !important;
  font-weight: 600 !important;
}

/* 비활성화된 저장 버튼 */
button.save-btn:disabled,
.save-btn:disabled,
[class*="save-btn"]:disabled,
button[class*="save-btn"]:disabled {
  background: var(--gray-400) !important;
  background-color: var(--gray-400) !important;
  border-color: var(--gray-400) !important;
  color: #ffffff !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
}

/* 인라인 스타일보다도 높은 우선순위 - 활성화 */
button.save-btn:not([disabled]) {
  background: #059669 !important;
  background-color: #059669 !important;
  border-color: #059669 !important;
  color: #ffffff !important;
  cursor: pointer !important;
  opacity: 1 !important;
  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3) !important;
  font-weight: 600 !important;
}

/* 인라인 스타일보다도 높은 우선순위 - 비활성화 */
button.save-btn[disabled] {
  background: var(--gray-400) !important;
  background-color: var(--gray-400) !important;
  border-color: var(--gray-400) !important;
  color: #ffffff !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
}
</style> 