<template>
  <div class="msa-component">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-network-wired"></i>
        <span>유사 이미지 검색</span>
      </div>
    </div>

    <div class="status-message" v-if="message.show">
      <i :class="message.icon"></i>
      <span>{{ message.text }}</span>
    </div>

    <div class="content-container">
      <div class="plot-container">
        <div id="plotly-visualization"></div>
        <div v-if="!isDataLoaded && !loadingComplete" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-message">데이터 로딩 중...</div>
        </div>
      </div>
      
      <div class="image-section">
        <div v-if="isProcessing" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-message">{{ loadingMessage }}</div>
        </div>
        
        <div class="scrollable-content">
          <!-- 선택된 이미지 섹션 -->
          <div class="selected-image-section" v-if="selectedFilename">
            <h3>선택된 이미지</h3>
            <div class="selected-image-wrapper">
              <img 
                :src="selectedImage && selectedImage.url ? selectedImage.url : getImageUrl(selectedFilename)" 
                :alt="selectedFilename"
                @error="handleImageError"
                @click="showImageDetailsPopup(selectedFilename)"
                class="main-image clickable"
              />
            </div>
          </div>
          
          <!-- 유사 이미지 섹션 -->
          <div v-if="similarImages.length > 0" class="similar-images-section">
            <h3>유사 이미지</h3>
            <div class="similar-images-grid">
              <div 
                v-for="(image, idx) in similarImages.slice(0, 4)" 
                :key="idx" 
                class="similar-image-item"
                @click="showImageDetailsPopup(image.filename)"
              >
                <img 
                :src="image.url || getImageUrl(image.filename)"
                :alt="image.filename"
                  @error="handleImageError"
                  class="similar-image"
                />
                <div class="similarity-score">
                  {{ formatSimilarity(image.similarity) }}% 유사
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 이미지 상세 팝업 -->
    <Teleport to="body">
      <div v-if="showImagePopup" class="image-detail-popup-overlay" @click="closeImagePopup">
        <div class="image-detail-popup" @click.stop>
          <div class="popup-header">
            <h3 v-if="selectedImage?.workflow">워크플로우 이름: {{ selectedImage.workflow.workflow_name }}</h3>
            <h3 v-else>{{ getCleanFilename(selectedImage?.filename || '') }}</h3>
            <button class="close-popup-btn" @click="closeImagePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="popup-content">
            <!-- 이미지 영역: 처리 전/후 -->
            <div class="popup-image-container">
              <!-- 처리 전 이미지 -->
              <div class="image-before-section">
                <h5 class="image-label">처리 전</h5>
                <img 
                  :src="selectedImage?.workflow?.input_image_url || getImageUrl(selectedImage?.workflow?.input_image || selectedImage?.filename)"
                  alt="처리 전 이미지" 
                  class="popup-image"
                  @error="handleImageError"
                >
              </div>
              
              <!-- 처리 후 이미지 -->
              <div class="image-after-section">
                <h5 class="image-label">처리 후</h5>
                <img 
                  :src="selectedImage?.workflow?.output_image_url || getImageUrl(selectedImage?.workflow?.output_image || (selectedImage?.filename ? getAfterImageName(selectedImage.filename) : ''))"
                  alt="처리 후 이미지" 
                  class="popup-image"
                  @error="handleImageError"
                >
              </div>
            </div>
            
            <div class="popup-details">
              <!-- 워크플로우 정보 표시 -->
              <div class="workflow-details" v-if="selectedImage?.workflow">
                <div class="detail-row" v-if="selectedImage.workflow.description">
                  <strong>설명:</strong> {{ selectedImage.workflow.description }}
                </div>
                
                <div class="detail-row">
                  <strong>생성일:</strong> {{ formatDate(selectedImage.workflow.created_at) || formatDate(selectedImage.workflow.timestamp) || 'N/A' }}
                </div>
                
                <!-- 노드 정보 표시 -->
                <div class="workflow-nodes" v-if="selectedImage.workflow.nodes && selectedImage.workflow.nodes.length > 0">
                  <div class="workflow-header-flex">
                    <h5>워크플로우 다이어그램</h5>
                    
                    <!-- 워크플로우 불러오기 버튼 - 오른쪽에 배치 -->
                    <button class="load-workflow-btn" @click="loadWorkflowToMSA5(selectedImage.workflow)">
                      <i class="fas fa-file-import"></i>
                      MSA5에서 워크플로우 사용하기
                    </button>
                  </div>
                  
                  <!-- 워크플로우 다이어그램 -->
                  <div class="workflow-container">
                    <div class="workflow-visual">
                      <!-- 시작 노드 -->
                      <div class="flow-node start-node">
                        <div class="node-icon">
                          <i class="fas fa-play"></i>
                        </div>
                        <div class="node-text">시작</div>
                        <div class="node-arrow"></div>
                      </div>
                      
                      <!-- 프로세스 노드들 -->
                      <div class="flow-nodes">
                        <div v-for="(node, idx) in selectedImage.workflow.nodes" :key="idx" class="flow-node process-node">
                          <div class="node-badge">{{idx + 1}}</div>
                          <div class="node-icon">
                            <i :class="getNodeIcon(node.type || 'custom')"></i>
                          </div>
                          <div class="node-text">
                            {{ node.label || node.name || node.id || node.type || '노드' }}
                          </div>
                          <div class="node-arrow" v-if="idx < selectedImage.workflow.nodes.length - 1"></div>
                          
                          <!-- 노드 상세 정보 (호버 시 표시) -->
                          <div class="node-tooltip">
                            <div class="tooltip-header">
                              <span class="node-type-badge">{{ node.type || 'custom' }}</span>
                              <span class="node-id-badge" v-if="node.id">ID: {{ (node.id || '').substring(0, 8) }}</span>
                            </div>
                            <div class="tooltip-body">
                              <div class="property-list">
                                <div class="property-item" v-if="node.id">
                                  <div class="property-name">id:</div>
                                  <div class="property-value">{{ node.id }}</div>
                                </div>
                                <div class="property-item">
                                  <div class="property-name">icon:</div>
                                  <div class="property-value">{{ getNodeIcon(node.type || 'custom') }}</div>
                                </div>
                                <template v-if="node.data && typeof node.data === 'object'">
                                  <div class="property-item" v-for="entry in getFilteredNodeData(node.data)" :key="entry.key">
                                    <div class="property-name">{{ entry.key }}:</div>
                                    <div class="property-value">{{ entry.value }}</div>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 종료 노드 -->
                      <div class="flow-node end-node">
                        <div class="node-icon">
                          <i class="fas fa-stop"></i>
                        </div>
                        <div class="node-text">종료</div>
                      </div>
                    </div>
                    
                    <!-- 워크플로우 통계 -->
                    <div class="workflow-stats">
                      <div class="stat-item">
                        <i class="fas fa-project-diagram"></i>
                        <span>총 노드:</span>
                        <strong>{{ selectedImage.workflow.nodes.length }}</strong>
                      </div>
                      <div class="stat-item">
                        <i class="fas fa-share-alt"></i>
                        <span>총 엣지:</span>
                        <strong>{{ selectedImage.workflow.nodes.length + 1 }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 사용된 이미지 표시 -->
                <div class="detail-row" v-if="selectedImage.workflow.images && selectedImage.workflow.images.length > 0">
                  <strong>사용된 이미지:</strong> {{ selectedImage.workflow.images?.length || 0 }}개
                </div>
                
                <!-- 기타 메타 정보 -->
                <div class="detail-row" v-if="selectedImage.workflow.created_by">
                  <strong>생성자:</strong> {{ selectedImage.workflow.created_by }}
                </div>
                
                <div class="detail-row" v-if="selectedImage.workflow.last_modified">
                  <strong>마지막 수정일:</strong> {{ formatDate(selectedImage.workflow.last_modified) }}
                </div>
                
                <!-- 추가 속성이 있는 경우 표시 -->
                <div v-if="selectedImage.workflow.parameters" class="parameters-section">
                  <h5>파라미터</h5>
                  <div class="param-list">
                    <div v-for="(value, key) in selectedImage.workflow.parameters" :key="key" class="param-item">
                      <strong>{{ key }}:</strong> {{ value }}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 워크플로우 정보 로딩 중 또는 없음 표시 -->
              <div class="workflow-loading" v-else-if="selectedImage && !selectedImage.workflow">
                <div v-if="selectedImage.isLoading">
                  <p>워크플로우 정보 확인 중...</p>
                  <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                  </div>
                </div>
                <div v-else-if="selectedImage.workflowStatus === 'not_found'">
                  <p>이 이미지에 연결된 워크플로우가 없습니다.</p>
                  <i class="fas fa-info-circle"></i>
                </div>
                <div v-else-if="selectedImage.workflowStatus === 'error'">
                  <p>워크플로우 정보를 불러오는 중 오류가 발생했습니다.</p>
                  <i class="fas fa-exclamation-triangle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>

/* 통합된 워크플로우 다이어그램 스타일 */
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

.flow-node:hover .node-tooltip {
  display: block;
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

/* 노드 툴팁 스타일 */
.node-tooltip {
  display: none;
  position: absolute;
  left: 120px;
  top: 50%;
  transform: translateY(-50%);
  width: 240px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
  z-index: 10;
  overflow: hidden;
}

.tooltip-header {
  padding: 10px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-type-badge {
  background-color: #74c0fc;
  color: #1864ab;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.node-id-badge {
  color: #868e96;
  font-size: 12px;
}

.tooltip-body {
  padding: 10px;
  max-height: 200px;
  overflow-y: auto;
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

/* 노드 카드 섹션 */
.node-cards-section {
  padding: 0 15px 15px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  padding: 15px 0;
  margin: 0;
  color: #343a40;
}

.node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.node-card {
  flex: 1 1 300px;
  min-width: 250px;
  background-color: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  border-left: 4px solid #339af0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.node-card:hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.node-card-header {
  padding: 12px 15px;
  background-color: #f1f3f5;
  display: flex;
  align-items: center;
}

.node-number {
  background-color: #339af0;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  margin-right: 12px;
}

.node-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.node-card-body {
  padding: 15px;
}

.property-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-item {
  display: flex;
  font-size: 13px;
}

.property-name {
  font-weight: 500;
  color: #495057;
  width: 80px;
  flex-shrink: 0;
}

.property-value {
  color: #6c757d;
  word-break: break-word;
}



/* MSA5 스타일 워크플로우 다이어그램 */
.msa5-workflow-diagram {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  background-color: white;
}

.diagram-title, .details-title {
  padding: 15px;
  margin: 0;
  background-color: #f5f5f5;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e0e0e0;
}

.diagram-container {
  display: flex;
  flex-direction: column;
}

.diagram-header {
  padding: 10px 15px;
  background-color: #f9f9f9;
}

.workflow-name {
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.flow-container {
  display: flex;
  align-items: center;
  padding: 20px 15px;
  overflow-x: auto;
  min-height: 80px;
  background-color: white;
}

/* 노드 스타일 */
.msa5-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  height: 80px;
  padding: 5px 10px;
  border-radius: 6px;
  position: relative;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.msa5-node:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.msa5-node i {
  font-size: 22px;
  margin-bottom: 6px;
}

.msa5-node span {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msa5-start-node {
  background-color: #1c7ed6;
  color: white;
}

.msa5-process-node {
  background-color: white;
  border: 1px solid #ced4da;
  color: #495057;
}

.msa5-end-node {
  background-color: #fa5252;
  color: white;
}

.node-index {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 20px;
  height: 20px;
  background-color: #339af0;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.msa5-node-group {
  display: flex;
  align-items: center;
}

.msa5-connector {
  display: flex;
  align-items: center;
  height: 20px;
}

/* 다이어그램 푸터 */
.diagram-footer {
  padding: 12px 15px;
  background-color: #f9f9f9;
  border-top: 1px solid #e0e0e0;
}

.workflow-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #555;
}

.stat-item i {
  margin-right: 6px;
  color: #1c7ed6;
}

/* 노드 상세 정보 스타일 */
.msa5-node-details {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  background-color: white;
  margin-bottom: 20px;
}

.node-cards {
  padding: 15px;
}

.node-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 15px;
}

.node-card-header {
  padding: 10px 15px;
  background-color: #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-type {
  font-weight: 500;
  color: #495057;
  padding: 2px 6px;
  background-color: #e9ecef;
  border-radius: 4px;
  font-size: 12px;
}

.node-id {
  color: #868e96;
  font-size: 12px;
}

.node-card-body {
  padding: 15px;
}

.property-item {
  display: flex;
  margin-bottom: 8px;
  font-size: 13px;
}

.property-label {
  font-weight: 500;
  color: #495057;
  width: 80px;
  flex-shrink: 0;
}

.property-value {
  color: #6c757d;
  word-break: break-word;
}



/* 강제 고정 크기 및 스크롤 스타일 */
.msa-component {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  overflow: hidden !important;
  max-height: 100vh !important;
}

.component-header {
  height: 48px !important;
  min-height: 48px !important;
  max-height: 48px !important;
  background-color: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 15px !important;
  flex: 0 0 48px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left i {
  color: #555;
}

.content-container {
  display: flex !important;
  flex-direction: column !important;
  height: calc(100% - 48px) !important;
  width: 100% !important;
  overflow: hidden !important;
  position: relative !important;
  flex: 1 1 auto !important; 
}

.plot-container {
  height: 300px !important;
  min-height: 300px !important;
  max-height: 300px !important;
  width: 100% !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  flex: 0 0 300px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
}

#plotly-visualization {
  width: 100% !important;
  height: 300px !important;
  min-height: 300px !important;
  max-height: 300px !important;
  flex: 1 !important;
}

.image-section {
  position: relative !important;
  height: calc(100% - 300px) !important;
  max-height: calc(100% - 300px) !important;
  width: 100% !important;
  background-color: #f8f9fa;
  flex: 1 1 auto !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

/* 스크롤 가능한 내부 컨테이너 */
.scrollable-content {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: 100% !important;
  width: 100% !important;
  overflow-y: scroll !important; /* 항상 스크롤바 표시 */
  overflow-x: hidden !important;
  padding: 20px !important;
  box-sizing: border-box !important;
}

/* 선택된 이미지 섹션 */
.selected-image-section {
  margin-bottom: 20px !important;
  width: 100% !important;
}

.selected-image-section h3 {
  font-size: 18px !important;
  margin-bottom: 15px !important;
  color: #333 !important;
}

.selected-image-wrapper {
  display: flex !important;
  justify-content: center !important;
  margin-bottom: 20px !important;
}

/* 클릭 가능한 이미지 스타일 */
.clickable {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
}

.popup-image-container {
  flex: 0 0 auto;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

@media (min-width: 768px) {
  .popup-image-container {
    width: 45%;
    margin-right: 20px;
    margin-bottom: 0;
  }
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

.load-workflow-btn i {
  font-size: 16px;
}

.popup-details {
  flex: 1 1 auto;
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

.workflow-details {
  margin-top: 20px;
  border-top: 1px solid #e9ecef;
  padding-top: 15px;
}

.workflow-details h4 {
  font-size: 16px;
  margin-bottom: 15px;
  color: #343a40;
}

.workflow-details h5 {
  font-size: 14px;
  margin: 15px 0 10px;
  color: #495057;
}

/* 이미지 비교 스타일 */
.workflow-images {
  margin: 15px 0;
}

.image-comparison {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 10px;
}

.image-before, .image-after {
  flex: 1 1 calc(50% - 15px);
  min-width: 150px;
}

.image-before p, .image-after p {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #495057;
}

.workflow-thumbnail {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

/* 노드 리스트 스타일 */
.workflow-nodes {
  margin: 15px 0;
}

.node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.node-item {
  background-color: #e9ecef;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
}

.node-name {
  font-weight: 500;
}

.node-type {
  margin-left: 6px;
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

.node-id {
  margin-left: 6px;
  font-size: 12px;
  color: #6c757d;
}

.node-details {
  margin-left: 10px;
}

.node-parameter {
  font-size: 13px;
  color: #495057;
}

.data-tag {
  font-size: 13px;
  color: #6c757d;
}

/* 파라미터 스타일 */
.parameters-section {
  margin-top: 15px;
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.param-item {
  font-size: 13px;
  padding: 6px 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #dee2e6;
}

/* 워크플로우 불러오기 버튼 */
.load-workflow-btn {
  margin-top: 20px;
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
}

.load-workflow-btn:hover {
  background-color: #0069d9;
}

.load-workflow-btn i {
  font-size: 16px;
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

/* 로딩 및 에러 메시지 스타일 */
.loading-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(255, 255, 255, 0.9) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 10 !important;
}

.loading-spinner {
  border: 3px solid #f3f3f3 !important;
  border-top: 3px solid #3498db !important;
  border-radius: 50% !important;
  width: 30px !important;
  height: 30px !important;
  animation: spin 1s linear infinite !important;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: #dc3545 !important;
  text-align: center !important;
  padding: 10px !important;
  margin-top: 10px !important;
}

.status-message {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  background: rgba(0, 0, 0, 0.8) !important;
  color: white !important;
  padding: 10px 20px !important;
  border-radius: 4px !important;
  z-index: 1000 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}


</style>

<script>
import Plotly from 'plotly.js-dist';

// Plotly를 전역 객체로 설정 (window.Plotly 참조용)
window.Plotly = Plotly;

// 디버깅 로거 설정
const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) {
    console.log('[MSA4]', ...args);
  }
}

export default {
  name: 'MSA4VectorTransform',
  emits: ['update-msa5-image'], // MSA5로 이미지 전달 이벤트 정의
  data() {
    return {
      vectors: [],               // 원본 벡터 데이터
      projectedVectors: [],      // 3D로 투영된 벡터 데이터
      labels: [],                // 이미지 레이블 (파일명)
      imageLabels: [],           // 이미지 레이블의 별도 복사본
      markerColors: [],          // 마커 색상 배열
      markerSizes: [],           // 마커 크기 배열
      similarImages: [],         // 유사 이미지 배열
      selectedImage: null,       // 현재 선택된 이미지 정보 (filename, url, index, coordinates)
      isProcessing: false,       // 처리 중 상태
      isDataLoaded: false,       // 데이터 로드 완료 상태
      loadingComplete: false,    // 로딩 완료 상태
      loadingMessage: '',        // 로딩 메시지
      errorMessage: '',          // 오류 메시지
      plot: null,                // Plotly 플롯 참조
      resizeObserver: null,      // ResizeObserver 인스턴스
      lastSimilarImagesRequestId: null, // 마지막 유사 이미지 요청 ID
      selectedFilename: null,
      selectedImageIndex: -1,
      selectedIndex: -1,
      showCoordinates: true,     // 좌표 표시 여부
      message: {
        show: false,
        text: '',
        icon: 'fas fa-info-circle',
        type: 'info'
      },
      resizeHandler: null,
      containerObserver: null,
      containerWidth: 0,
      containerHeight: 0,
      lastImageData: null, // 마지막 이미지 데이터 저장
      msa1Element: null,
      msa5Element: null,
      componentFindInterval: null,
      apiEndpoints: [
        '/api/process-image',
        '/api/msa4/process-image',
        '/api/vectors/extract'
      ],
      lastImageTimestamp: 0,
      currentImageData: null,
      selectedImageName: null,
      msa1FindAttempts: 0,
      maxFindAttempts: 5,
      msa5MessageActive: false, // MSA5 메시지 전송 표시
      showDebugControls: false, // 디버그 컨트롤 표시
      currentImage: null,
      showStatusMessage: false,
      plotSizeObserver: null,
      isSelectingImageFlag: false, // 이미지 선택 중 플래그 (재귀 방지)
      isLoading: false,
      lastHighlightIndex: -1,    // 마지막으로 하이라이트된 포인트 인덱스
      plotData: [],
      selectedPoint: null,
      plotLayout: {
        scene: {
          xaxis: { title: 'X' },
          yaxis: { title: 'Y' },
          zaxis: { title: 'Z' }
        },
        showlegend: false,
        margin: { l: 0, r: 0, t: 0, b: 0 },
        hovermode: 'closest'
      },
      plotConfig: {
        responsive: true,
        displayModeBar: true,
        scrollZoom: true
      },
      showImagePopup: false,
      popupImageUrl: '',
      popupImageFilename: '',
      popupWorkflowData: null
    }
  },
  computed: {
    plotlyData() {
      if (!this.vectors || this.vectors.length === 0) return [];
      
      return [{
        type: 'scatter3d',
        mode: 'markers',
        x: this.vectors.map(v => v[0]),
        y: this.vectors.map(v => v[1]),
        z: this.vectors.map(v => v[2]),
        marker: {
          size: this.markerSizes,
          color: this.markerColors,
          line: {
            color: 'rgba(0,0,0,0.2)',
            width: 0.5
          }
        },
        hoverinfo: 'none'
      }];
    }
  },
  watch: {
    vectors: {
      handler(newVectors) {
        if (newVectors) {
          this.markerSizes = Array(newVectors.length).fill(6);
          this.markerColors = Array(newVectors.length).fill('#1f77b4');
          this.initializePlot();
        }
      },
      immediate: true
    }
  },
  mounted() {
    logDebug('MSA4 Vector Transform Component mounted');
    this.checkVectorsData();
    
    // 전역 이벤트 리스너 설정
    logDebug('Setting up document-level event listeners');
    window.addEventListener('keydown', this.handleKeyDown);
    
    // MSA1에서 이미지 업데이트 이벤트 리스너 등록
    document.addEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    
    // MSA5에서 유사 이미지 결과 수신하는 이벤트 리스너 등록
    document.addEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // 컴포넌트 크기 변경 감지를 위한 ResizeObserver 설정
    this.setupResizeObserver();
    
    // 기본 3D 그래프 시각화 생성
    this.createVisualization();
    
    // MSA 컴포넌트 간 통신 상태 콘솔에 로깅
    console.log('%c[MSA4] Component ready for inter-component communication', 
      'background: #28a745; color: white; padding: 2px 6px; border-radius: 2px');
    
    logDebug('MSA4 component initialization complete');
  },
  beforeUnmount() {
    logDebug('MSA4 component unmounting');
    
    // 이벤트 리스너 정리
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.removeEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // ResizeObserver 정리
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    logDebug('MSA4 event listeners and observers cleaned up');
  },
  methods: {
    // MSA1 요소 찾기 및 모니터링
    findAndMonitorMSA1() {
      // 다양한 선택자 시도
      const selectors = [
        '#msa1-component',
        '.msa1-component',
        '[data-component="msa1"]',
        '.msa1',
        // DOM 계층 구조 기반 선택자
        '.top-row .msa1',
        '.main-container .msa1',
        // 상위 컴포넌트에서 찾기
        '.upper-section .msa1',
        // 문서 전체에서 찾기
        'div[id*="msa1"]',
        'div[class*="msa1"]'
      ];

      // 각 선택자 시도
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          logDebug(`MSA1 element found with selector: ${selector}`);
          this.msa1Element = element;
          this.setupMSA1Listeners(element);
          return;
        }
      }

      // MSA5 요소도 찾기
      const msa5Selectors = [
        '#msa5-component',
        '.msa5-component',
        '[data-component="msa5"]',
        '.msa5',
        '.bottom-row .msa5',
        'div[id*="msa5"]',
        'div[class*="msa5"]'
      ];

      for (const selector of msa5Selectors) {
        const element = document.querySelector(selector);
        if (element) {
          logDebug(`MSA5 element found with selector: ${selector}`);
          this.msa5Element = element;
        }
      }

      // 요소를 찾지 못한 경우 재시도
      if (!this.msa1Element && this.msa1FindAttempts < this.maxFindAttempts) {
        this.msa1FindAttempts++;
        logDebug(`MSA1 element not found, retrying (${this.msa1FindAttempts}/${this.maxFindAttempts})`);
        setTimeout(() => this.findAndMonitorMSA1(), 1000);
      } else if (!this.msa1Element) {
        logDebug('Failed to find MSA1 element after maximum attempts');
      }
    },

    // MSA1 리스너 설정
    setupMSA1Listeners(element) {
      // 파일 입력 요소 찾기
      const fileInputs = element.querySelectorAll('input[type="file"]');
      if (fileInputs.length > 0) {
        fileInputs.forEach(input => {
          input.addEventListener('change', this.handleMSA1FileInputChange);
          logDebug('Added file input change listener to MSA1');
        });
      }
      
      // 이미지 요소 찾기
      const images = element.querySelectorAll('img');
      if (images.length > 0) {
        images.forEach(img => {
          img.addEventListener('load', this.handleMSA1ImageLoad);
          logDebug('Added image load listener to MSA1');
        });
      }
    },

    // MSA1 파일 입력 변경 처리
    handleMSA1FileInputChange(event) {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        logDebug(`MSA1 file input change detected: ${file.name}`);
        
        // 파일을 이미지 URL로 변환
        const imageUrl = URL.createObjectURL(file);
        this.processNewImage({
          imageUrl: imageUrl,
          imageName: file.name,
          source: 'msa1-file-input'
        });
      }
    },

    // MSA1 이미지 로드 처리
    handleMSA1ImageLoad(event) {
      const img = event.target;
      if (img.src && img.complete && img.naturalWidth > 0) {
        logDebug(`MSA1 image loaded: ${img.src}`);
        // 이미지가 변경되었는지 확인 (타임스탬프 또는 URL 비교)
        const currentTime = Date.now();
        if (currentTime - this.lastImageTimestamp > 1000) { // 1초 이내 중복 방지
          this.lastImageTimestamp = currentTime;
          this.processNewImage({
            imageUrl: img.src,
            imageName: this.getImageNameFromUrl(img.src),
            source: 'msa1-image-load'
          });
        }
      }
    },

    // URL에서 이미지 이름 추출
    getImageNameFromUrl(url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        return decodeURIComponent(filename);
      } catch (error) {
        return 'unknown_image.jpg';
      }
    },
    
    // 전역 객체를 통한 이미지 데이터 폴링 (기존 유지)
    // setupImagePolling() {}
    
    // 외부에서 직접 호출하는 이미지 처리 핸들러
    handleDirectImageData(imageData) {
      logDebug('Received direct image data:', imageData);
      if (!imageData || (!imageData.imageUrl && !imageData.url)) {
        logDebug('Invalid image data received in handleDirectImageData');
        return;
      }
      
      // 다양한 포맷 지원
      const processData = {
        imageUrl: imageData.imageUrl || imageData.url,
        imageName: imageData.imageName || imageData.name || this.getImageNameFromUrl(imageData.imageUrl || imageData.url),
        source: imageData.source || 'external-direct'
      };
      
      // 이미지 처리 호출
      this.processNewImage(processData);
    },
    
    // 기존 메서드들...
    async checkVectorsData() {
      logDebug('Checking vector data availability');
      
      if (this.vectors && this.vectors.length > 0) {
        logDebug(`Vector data already loaded, ${this.vectors.length} vectors available`);
        return;
      }
      
      this.loadingMessage = '벡터 데이터 로딩 중...';
      this.isLoading = true;
      
      try {
        // API 엔드포인트에 오류가 발생하므로 직접 스토리지 파일 접근만 시도
        try {
          logDebug('Trying direct storage access...');
          const response = await fetch('http://localhost:8000/storage/vector/vectors.json', {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            // 직접 스토리지에서 벡터 로드 성공, 메타데이터도 함께 로드
            const vectors = await response.json();
            
            try {
              // 메타데이터 별도 로드
              const metadataResponse = await fetch('http://localhost:8000/storage/vector/metadata.json', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json'
                }
              });
              
              if (metadataResponse.ok) {
                const metadata = await metadataResponse.json();
                
                // 중복 제거 및 처리
                const uniqueVectors = new Map();
                metadata.forEach((label, index) => {
                  const cleanLabel = this.removeTimestamp(label);
                  if (!uniqueVectors.has(cleanLabel) && vectors[index]) {
                    uniqueVectors.set(cleanLabel, vectors[index]);
                  }
                });
                
                // 맵에서 배열로 변환
                const processedVectors = Array.from(uniqueVectors.values());
                const processedLabels = Array.from(uniqueVectors.keys());
                
                logDebug(`Processed ${processedVectors.length} unique vectors from direct storage`);
                this.processVectorData(processedVectors, processedLabels);
                
                this.isDataLoaded = true;
                this.loadingComplete = true;
                this.loadingMessage = '';
                return;
              }
            } catch (metadataError) {
              logDebug('Error loading metadata:', metadataError.message);
              // 메타데이터 없이도 벡터만 활용 가능
              const dummyLabels = Array(vectors.length).fill().map((_, i) => `이미지${i+1}`);
              this.processVectorData(vectors, dummyLabels);
              
              this.isDataLoaded = true;
              this.loadingComplete = true;
              this.loadingMessage = '';
              return;
            }
          }
        } catch (storageError) {
          logDebug('Error with direct storage:', storageError.message);
        }
        
        // 모든 시도 실패 시 바로 더미 데이터 생성
        logDebug('All methods failed, creating dummy vector data');
        this.createDummyVectorData();
        this.isDataLoaded = true;
        this.loadingComplete = true;
        this.isLoading = false;
        
      } catch (error) {
        console.error('Error loading vector data:', error);
        logDebug('Creating dummy data as last resort');
        this.createDummyVectorData();
        this.loadingComplete = true;
        this.isLoading = false;
      }
    },
    
    // 일반 벡터 데이터 API 호출 (백업용) - 이제 사용하지 않음
    async fallbackToRegularVectors() {
      logDebug('Creating dummy vector data instead of using fallback API');
      this.createDummyVectorData();
      this.loadingComplete = true;
      this.isLoading = false;
    },
    
    // 타임스탬프 제거 함수
    removeTimestamp(filename) {
      if (!filename) return filename;
      return filename.replace(/^\d{8}_\d{6}_/, '');
    },
    
    // 이미지명 정규화 함수 (타임스탬프 제거)
    normalizeImageName(filename) {
      return this.removeTimestamp(filename);
    },
    
    // 더미 벡터 데이터 생성 (테스트용)
    createDummyVectorData() {
      logDebug('Creating dummy vector data for testing');
      
      const dummyCount = 30;
      const dummyVectors = [];
      const dummyLabels = [];
      
      for (let i = 0; i < dummyCount; i++) {
        // 128차원 랜덤 벡터 생성
        const vector = Array(128).fill().map(() => Math.random() - 0.5);
        dummyVectors.push(vector);
        dummyLabels.push(`테스트이미지${i+1}`);
      }
      
      this.processVectorData(dummyVectors, dummyLabels);
      this.showMessage('테스트용 더미 데이터가 생성되었습니다', 'warning');
    },

    async extractVectors() {
      this.isProcessing = true;
      this.loadingMessage = '이미지 벡터 추출 중...';
      
      try {
        const response = await fetch('/api/msa4/extract-vectors', {
          method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
          this.showMessage(`${data.count}개 이미지 벡터 추출 완료`, 'success');
          await this.checkVectorsData();
        } else {
          this.showMessage(data.message || '벡터 추출 실패', 'warning');
        }
      } catch (error) {
        console.error('Error extracting vectors:', error);
        this.showMessage('벡터 추출 중 오류가 발생했습니다', 'error');
      }
    },
    
    showMessage(text, type = 'info') {
      this.message = {
        show: true,
        text: text,
        type: type,
        icon: type === 'success' ? 'fas fa-check-circle' : 
             type === 'warning' ? 'fas fa-exclamation-triangle' : 
             type === 'error' ? 'fas fa-times-circle' : 'fas fa-info-circle'
      };
      
      // 3초 후 메시지 자동 숨김
      setTimeout(() => {
        this.message.show = false;
      }, 3000);
    },
    
    initializeMarkerStyles() {
      // 이 메서드는 더 이상 사용하지 않음 - 비반응형 접근법으로 대체됨
      logDebug('initializeMarkerStyles is now deprecated');
      // 기존 반응형 로직 대신 createPlot 및 highlightSelectedPoint에서 
      // 비반응형 배열을 직접 생성하여 사용함
    },
    
    projectVectorsWith3DPCA(vectors) {
      logDebug('Projecting vectors to 3D space...');
      if (!vectors || vectors.length === 0) {
        console.error('No vectors to project');
        return [];
      }
      
      try {
        // 벡터 차원 확인
        const vectorDim = vectors[0].length;
        if (vectorDim < 3) {
          throw new Error(`Vector dimension (${vectorDim}) is too small for 3D projection`);
        }

        // 벡터를 3개의 그룹으로 나누어 평균 계산
        const projectedVectors = vectors.map(vec => {
          const groupSize = Math.floor(vec.length / 3);
          const groups = [
            vec.slice(0, groupSize),
            vec.slice(groupSize, 2 * groupSize),
            vec.slice(2 * groupSize)
          ];
          
          return groups.map(group => 
            group.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) / group.length
          );
        });

        // 정규화
        const dimensions = [0, 1, 2].map(dim => ({
          min: Math.min(...projectedVectors.map(v => v[dim])),
          max: Math.max(...projectedVectors.map(v => v[dim]))
        }));

        return projectedVectors.map(vec => 
          vec.map((val, i) => {
            const min = dimensions[i].min;
            const max = dimensions[i].max;
            return max > min ? (val - min) / (max - min) : 0.5;
          })
        );

      } catch (error) {
        console.error('Error in vector projection:', error);
        return vectors.map(() => [0.5, 0.5, 0.5]); // 에러 시 기본값 반환
      }
    },
    
    calculate3DDistance(point1, point2) {
      return Math.sqrt(
        Math.pow(point1[0] - point2[0], 2) +
        Math.pow(point1[1] - point2[1], 2) +
        Math.pow(point1[2] - point2[2], 2)
      );
    },
    
    // 유사 이미지 검색 함수 수정
    findSimilarImages(filename) {
      if (!filename) {
        logDebug('No filename provided for finding similar images');
        return;
      }
      
      logDebug(`Finding similar images for: ${filename}`);
      this.isProcessing = true;
      this.loadingMessage = '유사 이미지 검색 중...';
      
      // API 엔드포인트 경로 수정 (/api/msa4/ -> /api/)
      const apiUrl = `http://localhost:8000/api/similar-images/${encodeURIComponent(filename)}`;
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        logDebug(`Received similar images data: ${data.similar_images?.length || 0} images`);
        
        if (data.status === 'success' && data.similar_images && data.similar_images.length > 0) {
          // 상위 4개만 선택
          const topSimilarImages = data.similar_images.slice(0, 4).map(item => ({
            filename: item.filename,
            similarity: item.similarity,
            url: this.getImageUrl(item.filename)
          }));
          
          // 유사도(similarity)를 기준으로 내림차순 정렬
          topSimilarImages.sort((a, b) => b.similarity - a.similarity);
          
          this.similarImages = topSimilarImages;
          logDebug(`Processed ${topSimilarImages.length} similar images`);
        } else {
          this.similarImages = [];
          if (data.status === 'error') {
            this.displayErrorMessage(data.message || '유사 이미지를 찾을 수 없습니다');
          }
        }
      })
      .catch(error => {
        console.error('Error finding similar images:', error);
        this.displayErrorMessage('유사 이미지 검색 중 오류가 발생했습니다');
        this.similarImages = [];
      })
      .finally(() => {
        this.isProcessing = false;
      });
    },

    // 유사 이미지 클릭 처리
    handleSimilarImageClick(filename) {
      logDebug(`Similar image clicked: ${filename}`);
      
      // 재귀 방지 (이미 이미지 선택 처리 중이면 무시)
      if (this.isSelectingImageFlag) {
        logDebug('Already in image selection process, ignoring similar image click');
        return;
      }
      
      // setTimeout으로 콜 스택 초기화
      setTimeout(() => {
        this.selectImage(filename);
      }, 0);
    },

    // 유사도 값 포맷팅 (필터 대신 메소드 사용)
    formatSimilarity(similarity) {
      // Prevent double multiplication of percentage values
      if (similarity > 1) {
        return Math.round(parseFloat(similarity)); // Already a percentage
      }
      return Math.round(parseFloat(similarity) * 100);
    },

    // 에러 메시지 표시 함수 추가
    displayErrorMessage(message) {
      console.error('[MSA4 Error]', message);
      this.errorMessage = message;
      this.showMessage(message, 'error');
      
      // 3초 후 에러 메시지 숨기기
      setTimeout(() => {
        this.errorMessage = '';
      }, 3000);
    },

    // ResizeObserver 설정 함수 추가
    setupResizeObserver() {
      logDebug('Setting up ResizeObserver');
      
      // 기존 ResizeObserver 정리
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      
      // 컨테이너 요소 찾기
      const container = this.$el.querySelector('.content-container');
      if (!container) {
        logDebug('Content container not found');
        return;
      }
      
      // 새로운 ResizeObserver 생성
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          logDebug(`Container size changed: ${width}x${height}`);
          
          // Plotly 플롯이 존재하고 DOM에 표시되어 있는 경우에만 리사이즈
          const plotDiv = document.getElementById('plotly-visualization');
          if (plotDiv && plotDiv.innerHTML !== '' && plotDiv.clientWidth > 0) {
            try {
              window.Plotly.relayout(plotDiv, {
                width: plotDiv.clientWidth,
                height: plotDiv.clientHeight
              });
              logDebug('Plot resized successfully');
            } catch (error) {
              console.error('Error resizing plot:', error);
            }
          } else {
            logDebug('Plot not ready for resize');
          }
        }
      });
      
      // 컨테이너 관찰 시작
      this.resizeObserver.observe(container);
      logDebug('ResizeObserver setup complete');
    },

    // 3D 시각화 생성 함수 추가
    createVisualization() {
      logDebug('Creating 3D visualization');
      
      // 시각화 컨테이너 요소 선택
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        logDebug('Visualization container not found');
        return;
      }
      
      // 컨테이너 크기 확인
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        logDebug('Container has zero dimensions, delaying visualization creation');
        // 컨테이너 크기가 설정될 때까지 지연
        setTimeout(() => this.createVisualization(), 100);
        return;
      }
      
      // 초기 데이터 (실제 데이터가 로드되기 전에 표시할 빈 그래프)
      const emptyData = [{
        type: 'scatter3d',
        mode: 'markers',
        x: [],
        y: [],
        z: [],
        text: [],
        marker: {
          size: 5,
          color: '#cccccc',
          opacity: 0.7
        }
      }];
      
      // 그래프 레이아웃 설정
      const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
          xaxis: { title: '' },
          yaxis: { title: '' },
          zaxis: { title: '' },
          aspectratio: { x: 1, y: 1, z: 1 }
        },
        showlegend: false,
        hovermode: 'closest',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        width: container.clientWidth,
        height: container.clientHeight
      };
      
      // Plotly 옵션 설정
      const config = {
        responsive: true,
        displayModeBar: false
      };
      
      // 그래프 초기화
      try {
        // 이미 생성된 플롯이 있으면 제거
        if (container.innerHTML !== '') {
          window.Plotly.purge(container);
        }
        
        // 새 플롯 생성
        window.Plotly.newPlot(container, emptyData, layout, config)
          .then(() => {
            logDebug('Initial empty visualization created successfully');
            // 빈 플롯 참조 저장
            this.plot = container;
          })
          .catch(error => {
            console.error('Error creating initial visualization:', error);
          });
      } catch (error) {
        console.error('Error creating Plotly visualization:', error);
      }
    },
    
    // API 엔드포인트 설정 함수 수정
    getApiEndpoint(path) {
      // API는 8000 포트 사용
      const baseUrl = 'http://localhost:8000';
      return `${baseUrl}${path}`;
    },

    // 이미지 URL 생성 함수 수정
    getImageUrl(filename) {
      if (!filename) return '';
      
      // 파일명에 _before 접미사 추가 (없는 경우에만)
      let imageFilename = filename;
      if (!imageFilename.includes('_before.') && !imageFilename.includes('_after.')) {
        // 확장자 분리 후 _before 추가
        const parts = imageFilename.split('.');
        if (parts.length > 1) {
          const ext = parts.pop();
          imageFilename = parts.join('.') + '_before.' + ext;
        }
      }
      
      // 8091 포트의 이미지 서버 직접 접근
      return `http://localhost:8091/images/${encodeURIComponent(imageFilename)}`;
    },

    // 벡터 데이터 처리 함수
    processVectorData(vectors, labels) {
      logDebug(`Processing vector data: ${vectors.length} vectors, ${labels?.length || 0} labels`);
      
      // 유효성 검사
      if (!vectors || vectors.length === 0) {
        this.displayErrorMessage('유효한 벡터 데이터가 없습니다.');
        return;
      }
      
      // 벡터와 레이블 저장 (원본 이미지 파일명 보존)
      this.vectors = vectors;
      
      // 라벨 확인 - 콘솔에 출력해서 실제 이미지 파일명 확인
      console.log('Original labels received:', labels);
      
      if (labels && Array.isArray(labels) && labels.length > 0) {
        this.labels = labels;
        logDebug(`Using ${labels.length} original image labels`);
      } else {
        // 라벨이 없는 경우에만 생성
        this.labels = Array(vectors.length).fill().map((_, i) => `fallback_${i+1}`);
        logDebug('No labels provided, using fallback labels');
      }
      
      this.imageLabels = [...this.labels]; // 레이블 복사본 생성
      
      // 3D 투영을 위한 마커 스타일 초기화
      this.initializeMarkerStyles();
      
      try {
        // 3D PCA를 사용하여 벡터 투영
        this.projectedVectors = this.projectVectorsWith3DPCA(vectors);
        
        if (!this.projectedVectors || this.projectedVectors.length === 0) {
          logDebug('Failed to project vectors, cannot visualize');
          this.displayErrorMessage('벡터 데이터를 시각화할 수 없습니다.');
          return;
        }
        
        // Plotly 데이터 준비
        this.createPlot();
        
        // 데이터 로드 상태 업데이트
        this.isDataLoaded = true;
        this.loadingComplete = true;
        this.loadingMessage = '';
      } catch (error) {
        console.error('Error processing vector data:', error);
        this.displayErrorMessage('벡터 데이터 처리 중 오류가 발생했습니다');
        this.loadingComplete = true;
        this.loadingMessage = '';
      }
    },
    
    // 인덱스로 이미지 선택하는 함수 (Plotly 이벤트용)
    selectImageByIndex(index) {
      // 절대로 다른 이벤트를 유발하지 않게 단순화
      if (index < 0 || index >= this.labels.length || this.isSelectingImageFlag) {
        return;
      }
      
      this.isSelectingImageFlag = true;
      
      try {
        // 데이터만 업데이트
        this.selectedIndex = index;
        this.selectedFilename = this.labels[index];
        
        // 유사 이미지 찾기는 별도 함수에서 실행
        this.processSelectedImage();
      } catch (error) {
        console.error('Error selecting image:', error);
      } finally {
        // 플래그는 processSelectedImage에서 해제
      }
    },
    
    // 선택된 이미지 처리 - 완전 분리된 함수로 구현
    processSelectedImage() {
      if (!this.selectedFilename) {
        this.isSelectingImageFlag = false;
        return;
      }
      
      // 재진입 방지를 위해 로컬 변수로 저장
      const filename = this.selectedFilename;
      const index = this.selectedIndex;
      
      // UI 업데이트
      this.updatePlotMarkers(index);
      
      // 실제 API 호출은 타이머로 분리해서 실행
      setTimeout(() => {
        // 유사 이미지 검색
        this.findSimilarImagesForIndex(index, filename);
      }, 100);
    },
    
    // 별도 함수로 유사 이미지 검색을 분리
    findSimilarImagesForIndex(index, filename) {
      if (!filename) return;
      
      logDebug(`Finding similar images for index ${index}: ${filename}`);
      this.isProcessing = true;
      this.loadingMessage = '유사 이미지 검색 중...';
      
      // API 엔드포인트로 요청
      const apiUrl = `http://localhost:8000/api/similar-images/${encodeURIComponent(filename)}`;
      
      // 로컬 변수로 현재 요청 추적
      const requestId = Date.now();
      this.lastSimilarImagesRequestId = requestId;
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        // 지연된 응답 무시
        if (this.lastSimilarImagesRequestId !== requestId) {
          return null;
        }
        
        if (!response.ok) {
          // API 오류시 기본 유사도 함수 사용
          logDebug(`API returned error ${response.status}, using fallback similar images`);
          return this.getFallbackSimilarImages(index, filename);
        }
        return response.json();
      })
      .then(data => {
        // 지연된 응답 또는 취소된 요청 무시
        if (!data || this.lastSimilarImagesRequestId !== requestId) {
          return;
        }
        
        if (data.status === 'success' && data.similar_images && data.similar_images.length > 0) {
          const processedSimilarImages = data.similar_images.slice(0, 4).map(img => ({
            filename: img.filename,
            similarity: img.similarity > 1 ? img.similarity : img.similarity * 100, // Only multiply if not already percentage
            url: img.image_url || img.url || this.getImageUrl(img.filename),
            workflow_name: null // Will be populated from MongoDB
          }));
          
          // 유사도(similarity)를 기준으로 내림차순 정렬
          processedSimilarImages.sort((a, b) => b.similarity - a.similarity);
          
          this.similarImages = processedSimilarImages;
        } else if (data.fallbackSimilarImages) {
          // 폴백 데이터 사용
          this.similarImages = data.fallbackSimilarImages;
        } else {
          // API에서 데이터를 받지 못한 경우 폴백 사용
          return this.getFallbackSimilarImages(index, filename);
        }
      })
      .catch(error => {
        console.error('Error finding similar images:', error);
        // 폴백 방식으로 유사 이미지 찾기
        return this.getFallbackSimilarImages(index, filename);
      })
      .finally(() => {
        this.isProcessing = false;
        // 이제 플래그 해제
        this.isSelectingImageFlag = false;
      });
    },
    
    // API 오류 시 대체 유사 이미지 제공 (로컬 계산)
    getFallbackSimilarImages(index, filename) {
      logDebug(`Using fallback method to find similar images for ${filename}`);
      
      // 벡터 데이터가 없으면 빈 배열 반환
      if (!this.projectedVectors || !this.projectedVectors[index]) {
        return { fallbackSimilarImages: [] };
      }
      
      // 현재 선택된 이미지의 벡터
      const selectedVector = this.projectedVectors[index];
      
      // 모든 이미지와의 거리 계산
      const distances = this.projectedVectors.map((vector, idx) => {
        return {
          index: idx,
          filename: this.labels[idx],
          distance: this.calculate3DDistance(selectedVector, vector),
          // 선택된 이미지 자신은 제외 (거리가 0)
          isSelf: idx === index
        };
      });
      
      // 거리 기준으로 정렬 (가까운 순)
      distances.sort((a, b) => a.distance - b.distance);
      
      // 가장 가까운 이미지 5개 선택 (자신 제외)
      const nearestImages = distances
        .filter(item => !item.isSelf)
        .slice(0, 4)
        .map(item => {
          // 거리를 유사도로 변환 (1 - 정규화된 거리)
          const maxDistance = 1.732; // 3D 공간에서 최대 거리 (대략적 값)
          const normalizedDistance = Math.min(item.distance / maxDistance, 1);
          const similarity = Math.round((1 - normalizedDistance) * 100);
          
          return {
            filename: item.filename,
            similarity: similarity,
            url: this.getImageUrl(item.filename)
          };
        });
        
      logDebug(`Found ${nearestImages.length} fallback similar images`);
      this.similarImages = nearestImages;
      
      return { fallbackSimilarImages: nearestImages };
    },
    
    // 플롯 마커만 업데이트 - Plotly 의존성 최소화
    updatePlotMarkers(selectedIndex) {
      try {
        const container = document.getElementById('plotly-visualization');
        if (!container) return;
        
        // 새 색상과 크기 배열 생성
        const colors = Array(this.projectedVectors.length).fill('rgba(169, 169, 169, 0.7)');
        const sizes = Array(this.projectedVectors.length).fill(6);
        
        // 선택된 점만 강조
        if (selectedIndex >= 0 && selectedIndex < colors.length) {
          colors[selectedIndex] = 'rgba(255, 0, 0, 0.8)';
          sizes[selectedIndex] = 12;
        }
        
        // 단일 업데이트
        Plotly.restyle(container, {
          'marker.color': [colors],
          'marker.size': [sizes]
        }, [0]);
      } catch (error) {
        console.error('Error updating markers:', error);
      }
    },

    // 이미지 업데이트 핸들러 (다른 컴포넌트에서 이미지 데이터 수신)
    handleImageUpdate(event) {
      logDebug('Received image update event from another component');
      
      try {
        // 이벤트에서 이미지 데이터 추출
        const imageData = event.detail || event;
        logDebug('Image data received:', imageData);
        
        // 이미지 데이터가 없으면 반환
        if (!imageData || (!imageData.url && !imageData.imageUrl)) {
          logDebug('Invalid image data received');
          return;
        }
        
        // 처리 중 표시 업데이트
        this.isProcessing = true;
        this.loadingMessage = '이미지 처리 중...';
        
        // 새 이미지 레퍼런스 저장
        this.lastImageData = {
          url: imageData.url || imageData.imageUrl,
          name: imageData.name || imageData.imageName || this.getImageNameFromUrl(imageData.url || imageData.imageUrl),
          timestamp: new Date().getTime(),
          source: imageData.source || 'external'
        };
        
        // 0.5초 지연 후 이미지 처리 (연속적인 이벤트 방지)
        setTimeout(() => {
          this.processNewImage(this.lastImageData);
        }, 500);
      } catch (error) {
        console.error('Error handling image update:', error);
        this.showMessage('이미지 업데이트 처리 중 오류가 발생했습니다', 'error');
        this.isProcessing = false;
      }
    },

    // 새 이미지 처리 함수
    processNewImage(imageData) {
      logDebug('Processing new image:', imageData);
      
      if (!imageData || (!imageData.url && !imageData.imageUrl)) {
        logDebug('Invalid image data received');
        this.isProcessing = false;
        return;
      }
      
      // URL 정보 추출
      const imageUrl = imageData.url || imageData.imageUrl;
      const imageName = imageData.name || imageData.imageName || this.getImageNameFromUrl(imageUrl);
      
      logDebug(`Processing image: ${imageName} (${imageUrl})`);
      this.loadingMessage = '이미지 처리 중...';
      this.isProcessing = true;
      
      // 벡터 데이터 확인
      this.checkVectorsData()
        .then(() => {
          // 이미지에 해당하는 인덱스 찾기
          const imageIndex = this.labels.findIndex(label => label === imageName);
          
          if (imageIndex !== -1) {
            logDebug(`Found image in dataset at index ${imageIndex}: ${imageName}`);
            // 해당 이미지 선택
            this.selectImage(imageName);
          } else {
            logDebug(`Image not found in dataset: ${imageName}`);
            // 오류 메시지 표시하지 않음 (사용자 요청에 따라 제거)
            this.isProcessing = false;
          }
        })
        .catch(error => {
          console.error('Error during image processing:', error);
          this.isProcessing = false;
        });
    },

    // 이미지 오류 처리 함수
    handleImageError(event) {
      const img = event.target;
      logDebug(`Image loading error for: ${img.alt || 'unknown image'}`);
      
      // 이미지 소스 URL에서 파일명 추출
      const filename = img.alt || this.getImageNameFromUrl(img.src);
      
      // 현재 URL 확인
      const currentSrc = img.src;
      
      // 이미 대체 시도를 했는지 확인 (data 속성 사용)
      const retryCount = parseInt(img.dataset.retryCount || '0');
      
      if (retryCount < 2) {
        // 재시도 카운트 증가
        img.dataset.retryCount = (retryCount + 1).toString();
        
        // 대체 URL 시도
        let newSrc = '';
        
        if (currentSrc.includes('_before') && !currentSrc.includes('_after')) {
          // _before에서 _after로 시도
          newSrc = currentSrc.replace('_before', '_after');
        } else if (currentSrc.includes('_after')) {
          // _after에서 접미사 없는 기본 파일명으로 시도
          newSrc = currentSrc.replace('_after', '');
        } else {
          // 접미사 없는 URL에서 원본 파일명 추출 후 다시 시도
          const parts = filename.split('.');
          if (parts.length > 1) {
            const ext = parts.pop();
            const baseName = parts.join('.');
            
            if (retryCount === 0) {
              newSrc = `http://localhost:8091/images/${encodeURIComponent(baseName + '_after.' + ext)}`;
            } else {
              newSrc = `http://localhost:8091/images/${encodeURIComponent(baseName + '.' + ext)}`;
            }
          }
        }
        
        if (newSrc && newSrc !== currentSrc) {
          logDebug(`Trying alternative image URL: ${newSrc}`);
          img.src = newSrc;
          return;
        }
      }
      
      // 모든 대체 시도 실패 시 오류 표시
      logDebug(`All image loading attempts failed for: ${filename}`);
      
      // 이미지에 오류 스타일 적용
      img.classList.add('image-error');
      
      // 이미지 깨짐 표시를 위한 기본 이미지로 대체
      img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZjAwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWFsZXJ0LXRyaWFuZ2xlIj48cGF0aCBkPSJNMTAuMjkgMy44NkwxLjgyIDE4YTIgMiAwIDAgMCAxLjcxIDNoMTYuOTRhMiAyIDAgMCAwIDEuNzEtM0wxMy43MSAzLjg2YTIgMiAwIDAgMC0zLjQyIDB6Ij48L3BhdGg+PGxpbmUgeDE9IjEyIiB5MT0iOSIgeDI9IjEyIiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iMTIiIHkxPSIxNyIgeDI9IjEyLjAxIiB5Mj0iMTciPjwvbGluZT48L3N2Zz4=';
    },

    // 선택된 이미지의 3D 좌표 반환
    getSelectedImageCoordinates() {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.projectedVectors.length) {
        return this.projectedVectors[this.selectedIndex].map(val => val.toFixed(4));
      }
      return ['0.0000', '0.0000', '0.0000'];
    },

    // Plotly 스타일 업데이트
    updatePlotStyles() {
      logDebug('Updating plot styles');
      
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        logDebug('Plot container not found');
        return;
      }

      try {
        // 스타일 업데이트를 위한 데이터 준비
        const update = {
          'marker.size': [this.markerSizes],
          'marker.color': [this.markerColors]
        };

        // 단일 Plotly.restyle 호출로 모든 스타일 업데이트
        Plotly.restyle(container, update, [0]).catch(error => {
          console.error('Error in Plotly.restyle:', error);
        });
      } catch (error) {
        console.error('Error updating plot styles:', error);
      }
    },

    async initializePlot() {
      logDebug('Initializing plot');
      const container = document.getElementById('plotly-visualization');
      if (!container || !this.vectors || this.vectors.length === 0) return;

      try {
        await Plotly.newPlot(container, this.plotlyData, this.plotLayout, this.plotConfig);
        
        // 이벤트 리스너 등록
        container.on('plotly_click', this.handlePlotClick);
      } catch (error) {
        console.error('Error initializing plot:', error);
      }
    },

    async loadSimilarImages(index) {
      if (index >= 0 && index < this.labels.length) {
        const filename = this.labels[index];
        await this.findSimilarImages(filename);
      }
    },

    // 이미지 파일명으로 선택하는 함수 (외부 호출용)
    selectImage(filename) {
      logDebug(`Selecting image by filename: ${filename}`);
      
      if (!filename) {
        logDebug('No filename provided');
        return;
      }
      
      // 중복 선택 방지 플래그 설정
      if (this.isSelectingImageFlag) {
        logDebug('Already in image selection process, ignoring');
        return;
      }
      
      this.isSelectingImageFlag = true;
      
      try {
        // 입력된 파일명에서 타임스탬프 제거
        const normalizedFilename = this.normalizeImageName(filename);
        
        logDebug(`Normalized filename: ${normalizedFilename}`);
        
        // 파일명으로 인덱스 찾기 (정규화된 이름 기준)
        let index = -1;
        
        for (let i = 0; i < this.labels.length; i++) {
          if (this.normalizeImageName(this.labels[i]) === normalizedFilename) {
            index = i;
            break;
          }
        }
        
        if (index === -1) {
          logDebug(`No image found with filename: ${normalizedFilename}`);
          this.displayErrorMessage(`이미지를 찾을 수 없습니다: ${normalizedFilename}`);
          return;
        }
        
        // 인덱스 기반 선택 함수 호출
        this.selectImageByIndex(index);
      } catch (error) {
        console.error('Error in selectImage:', error);
        this.isSelectingImageFlag = false;
      }
    },

    createPlot() {
      logDebug('Creating plot with projected vector data');
      
      const container = document.getElementById('plotly-visualization');
      if (!container || !this.projectedVectors || this.projectedVectors.length === 0) {
        logDebug('Cannot create plot: container or data missing');
        return;
      }
      
      try {
        // 기존 플롯 제거
        Plotly.purge(container);
        
        // 컨테이너 크기 고정 (300px)
        const containerHeight = 300;
        logDebug(`Plot container height set to: ${containerHeight}px`);
        
        // 3D 포인트 데이터 준비 - 깊은 복사
        const x = [...this.projectedVectors.map(v => v[0])];
        const y = [...this.projectedVectors.map(v => v[1])];
        const z = [...this.projectedVectors.map(v => v[2])];
        
        // 비반응형 데이터로 플롯 생성
        const plotData = [{
          type: 'scatter3d',
          mode: 'markers',
          x: x,
          y: y,
          z: z,
          text: [...this.labels],
          hoverinfo: 'text',
          marker: {
            size: 6,
            color: 'rgba(169, 169, 169, 0.7)',
            opacity: 0.8,
            line: {
              color: 'rgba(0,0,0,0.2)',
              width: 0.5
            }
          }
        }];
        
        const layout = {
          margin: { l: 0, r: 0, b: 0, t: 0 },
          scene: {
            xaxis: { title: '', showgrid: true, zeroline: true },
            yaxis: { title: '', showgrid: true, zeroline: true },
            zaxis: { title: '', showgrid: true, zeroline: true },
            camera: {
              eye: { x: 1.5, y: 1.5, z: 1.5 }
            }
          },
          showlegend: false,
          hovermode: 'closest',
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          autosize: false, // 자동 크기 조정 사용하지 않음
          width: container.clientWidth,
          height: containerHeight // 고정 높이 300px
        };
        
        const config = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
          // 아이콘 크기 조정 옵션
          modeBarButtonsToAdd: [{
            name: 'Reset',
            click: function(gd) {
              Plotly.relayout(gd, {
                'scene.camera': layout.scene.camera
              });
            }
          }]
        };

        // this 컨텍스트 저장 (먼저 선언)
        const self = this;

        // 새 플롯 생성
        Plotly.newPlot(container, plotData, layout, config).then(() => {
          logDebug('Plot created successfully');
          
          // 모드바 스타일 수정
          this.fixModeBarStyle();
          
          // 클릭 이벤트 핸들러는 하나만 등록 - Plotly 방식으로
          container.on('plotly_click', function(eventData) {
            // 이미 처리 중이면 중복 실행 방지
            if (self.isSelectingImageFlag) {
              logDebug('Already processing, skipping click');
              return;
            }
            
            if (eventData && eventData.points && eventData.points.length > 0) {
              const point = eventData.points[0];
              const index = point.pointNumber;
              
              if (index >= 0 && index < self.labels.length) {
                // 이벤트 루프 분리해서 처리
                setTimeout(() => {
                  self.selectImageByIndex(index);
                }, 0);
              }
            }
          });
          
          // 초기 선택 포인트가 있으면 강조
          if (this.selectedIndex >= 0) {
            this.updatePlotMarkers(this.selectedIndex);
          }
        });

      } catch (error) {
        console.error('Error in createPlot:', error);
        this.displayErrorMessage('그래프 생성 중 오류가 발생했습니다');
      }
    },
    
    // 모드바 스타일 수정 함수
    fixModeBarStyle() {
      setTimeout(() => {
        const modeBar = document.querySelector('.modebar');
        if (modeBar) {
          // 모드바 스타일 축소
          modeBar.style.cssText = 'transform: scale(0.6); transform-origin: top right;';
          
          // 모드바 버튼 스타일 축소
          const buttons = modeBar.querySelectorAll('.modebar-btn');
          buttons.forEach(btn => {
            btn.style.cssText = 'width: 24px; height: 24px;';
            
            // SVG 아이콘 크기 조정
            const svg = btn.querySelector('svg');
            if (svg) {
              svg.style.cssText = 'width: 16px; height: 16px;';
            }
          });
        }
      }, 100); // 플롯 렌더링 후 실행
    },

    async showImageDetailsPopup(filename) {
      // 이미지 URL 직접 설정 (8091 포트)
      this.popupImageUrl = this.getImageUrl(filename);
      this.popupImageFilename = filename;
      this.showImagePopup = true;
      
      const cleanFilename = this.getCleanFilename(filename);
      logDebug(`Opening popup for image: ${filename}, clean name: ${cleanFilename}`);
      
      // 선택된 이미지 정보 설정
      this.selectedImage = {
        filename: filename,
        cleanName: cleanFilename,
        url: this.popupImageUrl,
        isLoading: true,
        workflowStatus: 'loading'
      };
      
      try {
        // 파일명에서 _before나 _after가 있는 경우 제거하여 원본 이름으로 검색
        const searchFilename = filename.replace(/_before\.|_after\./g, '.');
        
        // MongoDB에서 워크플로우 정보 조회
        logDebug('Fetching workflow info for:', searchFilename);
        const response = await fetch(`http://localhost:8000/api/workflow/get-by-image?filename=${encodeURIComponent(searchFilename)}`);
        
        const data = await response.json();
        logDebug('Workflow API response:', data);
        
        if (response.ok && data.status === 'success' && data.workflow) {
          // 상세 노드 정보 로깅
          console.log('Workflow nodes data from MongoDB:', data.workflow.nodes);
          
          if (data.workflow.nodes && Array.isArray(data.workflow.nodes)) {
            console.log(`Number of nodes: ${data.workflow.nodes.length}`);
            // 각 노드의 구조 상세 로깅
            data.workflow.nodes.forEach((node, index) => {
              console.log(`Node ${index + 1} details:`, node);
              console.log(`  - Node type: ${node.type || 'undefined'}`);
              console.log(`  - Node name: ${node.name || 'undefined'}`);
              console.log(`  - Node keys:`, Object.keys(node));
            });
          } else {
            console.log('Nodes data is not an array or is missing:', data.workflow.nodes);
          }
          
          // 워크플로우 정보 설정
          this.selectedImage.workflow = data.workflow;
          this.selectedImage.workflowStatus = 'found';
          logDebug(`워크플로우 정보 찾음: ${data.workflow.workflow_name}`);
          
          // 워크플로우 이미지 URL 수정 (8091 포트 직접 접근)
          if (this.selectedImage.workflow.input_image) {
            this.selectedImage.workflow.input_image_url = this.getImageUrl(this.selectedImage.workflow.input_image);
          }
          if (this.selectedImage.workflow.output_image) {
            this.selectedImage.workflow.output_image_url = this.getImageUrl(this.selectedImage.workflow.output_image);
          }
        } else {
          // No workflow found, try with the original filename
          const retryResponse = await fetch(`http://localhost:8000/api/workflow/get-by-image?filename=${encodeURIComponent(filename)}`);
          const retryData = await retryResponse.json();
          
          if (retryResponse.ok && retryData.status === 'success' && retryData.workflow) {
            // 상세 노드 정보 로깅 (재시도)
            console.log('Workflow nodes data from MongoDB (retry):', retryData.workflow.nodes);
            
            if (retryData.workflow.nodes && Array.isArray(retryData.workflow.nodes)) {
              console.log(`Number of nodes (retry): ${retryData.workflow.nodes.length}`);
              // 각 노드의 구조 상세 로깅
              retryData.workflow.nodes.forEach((node, index) => {
                console.log(`Node ${index + 1} details (retry):`, node);
                console.log(`  - Node type: ${node.type || 'undefined'}`);
                console.log(`  - Node name: ${node.name || 'undefined'}`);
                console.log(`  - Node keys:`, Object.keys(node));
              });
            } else {
              console.log('Nodes data is not an array or is missing (retry):', retryData.workflow.nodes);
            }
            
            this.selectedImage.workflow = retryData.workflow;
            this.selectedImage.workflowStatus = 'found';
            logDebug(`워크플로우 정보 찾음 (재시도): ${retryData.workflow.workflow_name}`);
            
            // 워크플로우 이미지 URL 수정 (8091 포트 직접 접근)
            if (this.selectedImage.workflow.input_image) {
              this.selectedImage.workflow.input_image_url = this.getImageUrl(this.selectedImage.workflow.input_image);
            }
            if (this.selectedImage.workflow.output_image) {
              this.selectedImage.workflow.output_image_url = this.getImageUrl(this.selectedImage.workflow.output_image);
            }
          } else {
            // No workflow found
            this.selectedImage.workflowStatus = 'not_found';
            logDebug(`워크플로우 정보를 찾을 수 없음: ${data.message || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('워크플로우 정보 조회 오류:', error);
        this.selectedImage.workflowStatus = 'error';
      } finally {
        // 로딩 상태 해제
        this.selectedImage.isLoading = false;
      }
    },
    
    closeImagePopup() {
      this.showImagePopup = false;
      this.selectedImage = null;
    },

    // 이미지 해시 계산 (대략적인 구현)
    async calculateImageHash(imageUrl) {
      try {
        // 이미지 바이너리 데이터 가져오기
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // ArrayBuffer로 변환
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        
        // 16진수 문자열로 변환
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
      } catch (error) {
        console.error('이미지 해시 계산 오류:', error);
        // 오류 발생 시 간단한 해시 대체
        return `hash_${this.popupImageFilename.replace(/\W+/g, '_')}`;
      }
    },

    sendImageToLCNC() {
      if (!this.popupImageUrl || !this.popupImageFilename) {
        this.showMessage('전송할 이미지 정보가 없습니다.', 'error');
        return;
      }
      
      // 커스텀 이벤트 생성하여 MSA5에 이미지 데이터 전송
      const imageData = {
        imageUrl: this.popupImageUrl,
        imageTitle: this.popupImageFilename
      };
      
      // 이벤트 생성 및 발송
      const event = new CustomEvent('msa4-to-msa5-image', {
        detail: imageData,
        bubbles: true
      });
      document.dispatchEvent(event);
      
      // 메시지 표시
      this.showMessage('이미지가 MSA5로 전송되었습니다.', 'success');
      
      // 팝업 닫기
      this.closeImagePopup();
    },

    loadWorkflowToLCNC() {
      if (!this.popupWorkflowData) {
        this.showMessage('워크플로우 데이터가 없습니다.', 'error');
        return;
      }
      
      // 이미지 전송과 함께 워크플로우 데이터도 전송
      const imageData = {
        imageUrl: this.popupImageUrl,
        imageTitle: this.popupImageFilename,
        workflowData: this.popupWorkflowData
      };
      
      // 이벤트 생성 및 발송
      const event = new CustomEvent('msa4-to-msa5-workflow', {
        detail: imageData,
        bubbles: true
      });
      document.dispatchEvent(event);
      
      // 메시지 표시
      this.showMessage('워크플로우가 MSA5로 전송되었습니다.', 'success');
      
      // 팝업 닫기
      this.closeImagePopup();
    },

    // MSA5에서 유사 이미지 결과 처리
    handleSimilarImagesFromMSA5(event) {
      logDebug('Received similar images from MSA5:', event.detail);
      
      const data = event.detail;
      if (!data || !data.originalImage || !data.similarImages || data.similarImages.length === 0) {
        logDebug('Invalid similar images data received from MSA5');
        return;
      }
      
      // 유사 이미지 처리
      const processedSimilarImages = data.similarImages.map(img => ({
        filename: img.filename,
        similarity: img.similarity > 1 ? img.similarity : img.similarity * 100, // Only multiply if not already percentage
        url: img.image_url || img.url || this.getImageUrl(img.filename),
        workflow_name: null // Will be populated from MongoDB
      }));
      
      // 유사도(similarity)를 기준으로 내림차순 정렬
      processedSimilarImages.sort((a, b) => b.similarity - a.similarity);
      
      // 유사 이미지 업데이트
      this.similarImages = processedSimilarImages;
      
      // 가장 유사한 첫 번째 이미지를 선택된 이미지로 설정
      if (processedSimilarImages.length > 0) {
        const mostSimilarImage = processedSimilarImages[0];
        this.selectedFilename = mostSimilarImage.filename;
        this.selectedImage = {
          filename: mostSimilarImage.filename,
          url: mostSimilarImage.url
        };
      }
    },

    // Add function to fetch workflow information from MongoDB
    async fetchWorkflowInfo(filename) {
      try {
        const endpoint = this.getApiEndpoint(`/api/workflow/get-by-image?filename=${encodeURIComponent(filename)}`);
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (data.status === 'success' && data.workflow) {
          return data.workflow;
        }
        return null;
      } catch (error) {
        console.error('Error fetching workflow info:', error);
        return null;
      }
    },

    // Add function to load workflow to MSA5
    loadWorkflowToMSA5(workflow) {
      if (!workflow) {
        this.showMessage('전송할 워크플로우가 없습니다', 'error');
        return;
      }
      
      try {
        // 워크플로우 데이터 구조화 (MSA5에서 사용할 수 있는 형태로)
        const processedWorkflow = { 
          ...workflow,
          // nodes 배열 변환 및 기본 position 추가
          nodes: workflow.nodes.map((node, index) => {
            // 각 노드에 position 속성 추가 (없는 경우)
            if (!node.position) {
              node.position = { x: 150 + (index * 100), y: 100 };
            }
            
            // 노드 ID 확인
            if (!node.id) {
              node.id = `node_${index}_${Date.now()}`;
            }
            
            // 타입 확인
            if (!node.type) {
              node.type = 'custom';
            }
            
            return {
              id: node.id,
              type: node.type,
              position: node.position,
              data: {
                label: node.label || node.name || node.type || '노드',
                icon: this.getNodeIcon(node.type || 'custom'),
                params: { ...node.data } // 노드 데이터 복사
              },
              // 기타 필요한 속성 추가
              label: node.label || node.name || node.type || '노드',
              icon: this.getNodeIcon(node.type || 'custom')
            };
          }),
          
          // edges 생성 (없는 경우)
          edges: workflow.edges || this.generateEdges(workflow.nodes),
          
          // elements 배열 추가 (Vue Flow에서 사용)
          elements: [
            // 시작 노드
            { id: 'start', type: 'start', position: { x: 50, y: 100 } },
            
            // 프로세스 노드들 (위에서 생성한 nodes 배열 활용)
            ...workflow.nodes.map((node, index) => ({
              id: node.id || `node_${index}_${Date.now()}`,
              type: node.type || 'custom',
              position: node.position || { x: 150 + (index * 100), y: 100 },
              data: {
                label: node.label || node.name || node.type || '노드',
                icon: this.getNodeIcon(node.type || 'custom'),
                params: { ...node.data } // 노드 데이터 복사
              }
            })),
            
            // 종료 노드
            { id: 'end', type: 'end', position: { x: 50 + ((workflow.nodes.length + 1) * 100), y: 100 } },
            
            // 엣지들 (연결선)
            ...(workflow.edges || this.generateEdges(workflow.nodes))
          ]
        };
        
        // 입력 및 출력 이미지 정보 추가
        if (workflow.input_image) {
          processedWorkflow.input_image = workflow.input_image;
          processedWorkflow.input_image_url = workflow.input_image_url || this.getImageUrl(workflow.input_image);
        }
        
        if (workflow.output_image) {
          processedWorkflow.output_image = workflow.output_image;
          processedWorkflow.output_image_url = workflow.output_image_url || this.getImageUrl(workflow.output_image);
        }
        
        // 워크플로우 데이터 이벤트 생성
        const event = new CustomEvent('msa4-to-msa5-workflow', {
          detail: {
            workflow_name: workflow.workflow_name,
            workflow_data: processedWorkflow,
            nodes: processedWorkflow.nodes,
            edges: processedWorkflow.edges,
            elements: processedWorkflow.elements
          }
        });
        
        // 이벤트 발송
        document.dispatchEvent(event);
        
        // 성공 메시지 표시
        this.showMessage(`워크플로우 '${workflow.workflow_name}'을(를) MSA5로 전송했습니다`, 'success');
        
        // 팝업 닫기
        this.closeImagePopup();
      } catch (error) {
        console.error('워크플로우 전송 중 오류 발생:', error);
        this.showMessage(`워크플로우 전송 실패: ${error.message}`, 'error');
      }
    },
    
    // 노드들 간의 엣지(연결선) 자동 생성
    generateEdges(nodes) {
      if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return [];
      }
      
      const edges = [];
      
      // 시작 노드와 첫 번째 노드 연결
      edges.push({
        id: `edge-start-${nodes[0].id || 'node_0'}`,
        source: 'start',
        target: nodes[0].id || 'node_0',
        type: 'smoothstep'
      });
      
      // 노드들 간의 연결
      for (let i = 0; i < nodes.length - 1; i++) {
        const sourceId = nodes[i].id || `node_${i}`;
        const targetId = nodes[i + 1].id || `node_${i + 1}`;
        
        edges.push({
          id: `edge-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep'
        });
      }
      
      // 마지막 노드와 종료 노드 연결
      edges.push({
        id: `edge-${nodes[nodes.length - 1].id || `node_${nodes.length - 1}`}-end`,
        source: nodes[nodes.length - 1].id || `node_${nodes.length - 1}`,
        target: 'end',
        type: 'smoothstep'
      });
      
      return edges;
    },

    // Update the handleImageClick function to fetch workflow info
    async handleImageClick(image) {
      this.selectedImage = image;
      this.popupImageUrl = image.url;
      
      // Fetch workflow info for this image
      const workflow = await this.fetchWorkflowInfo(image.filename);
      if (workflow) {
        this.selectedImage.workflow = workflow;
      }
      
      this.showImagePopup();
    },

    // Add this new method to remove file extension and suffixes
    getCleanFilename(filename) {
      if (!filename) return '';
      
      // 확장자 제거
      let cleanName = filename.replace(/\.[^/.]+$/, '');
      
      // _before 또는 _after 접미사 제거
      return cleanName.replace(/_before$|_after$/g, '');
    },

    // Date formatting method
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      
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
        return dateString;
      }
    },

    // 노드 데이터에서 중요 정보만 필터링
    getFilteredNodeData(data) {
      if (!data || typeof data !== 'object') return [];
      
      return Object.entries(data)
        .filter(([key, val]) => 
          key !== 'label' && 
          key !== 'name' && 
          val !== undefined && 
          val !== null
        )
        .map(([key, val]) => ({
          key,
          value: typeof val === 'object' ? '{...}' : val
        }));
    },

    // 노드 타입에 따른 아이콘 반환
    getNodeIcon(nodeType) {
      const iconMap = {
        'image': 'fas fa-image',
        'filter': 'fas fa-filter',
        'crop': 'fas fa-crop',
        'resize': 'fas fa-expand',
        'rotate': 'fas fa-redo',
        'blur': 'fas fa-brush',
        'transform': 'fas fa-object-group',
        'color': 'fas fa-palette',
        'custom': 'fas fa-cog',
        'input': 'fas fa-file-import',
        'output': 'fas fa-file-export',
        'process': 'fas fa-cogs',
        'ai': 'fas fa-brain',
        'ml': 'fas fa-robot',
        'detection': 'fas fa-search',
        'recognition': 'fas fa-eye',
        'segmentation': 'fas fa-object-ungroup'
      };
      
      return iconMap[nodeType.toLowerCase()] || 'fas fa-cog';
    },

    // 이미지명을 _after 버전으로 변환
    getAfterImageName(filename) {
      if (!filename) return '';
      
      // 이미 _after가 있으면 그대로 반환
      if (filename.includes('_after.')) {
        return filename;
      }
      
      // _before가 있으면 _after로 변환
      if (filename.includes('_before.')) {
        return filename.replace('_before.', '_after.');
      }
      
      // 확장자 분리
      const lastDotIndex = filename.lastIndexOf('.');
      if (lastDotIndex === -1) {
        // 확장자가 없는 경우
        return `${filename}_after`;
      }
      
      // 확장자 있는 경우 확장자 앞에 _after 추가
      const name = filename.substring(0, lastDotIndex);
      const ext = filename.substring(lastDotIndex);
      return `${name}_after${ext}`;
    },
  }
}
</script>

 

/* 워크플로우 다이어그램 스타일 - 개선된 버전 */
.workflow-diagram-container {
  margin: 20px 0;
  background-color: #f8f9fa;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.workflow-diagram-container h5 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #343a40;
  padding-bottom: 10px;
  border-bottom: 1px solid #dee2e6;
}

.workflow-diagram {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 20px 10px;
  position: relative;
  min-height: 130px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

/* 연결선 스타일 */
.workflow-diagram::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50px;
  right: 50px;
  height: 2px;
  background-color: #007bff;
  transform: translateY(-50%);
  z-index: 1;
}

.workflow-node {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  margin: 0 10px;
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.workflow-node:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.15);
}

.node-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.node-label {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  word-break: keep-all;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.start-node {
  background-color: #007bff;
  color: white;
}

.process-node {
  background-color: white;
  color: #495057;
  border: 2px solid #6c757d;
}

.end-node {
  background-color: #dc3545;
  color: white;
}

.nodes-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  z-index: 2;
}

/* 노드 사이 화살표 */
.workflow-node::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -20px;
  width: 20px;
  height: 10px;
  background: transparent;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 10px solid #007bff;
  transform: translateY(-50%);
  z-index: 2;
}

.end-node::after {
  display: none;
}

.workflow-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 15px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #495057;
}

.stat-item i {
  color: #007bff;
  font-size: 16px;
}

/* 노드 상세 정보 스타일 개선 */
.workflow-details-container {
  margin-top: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.workflow-details-container h5 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #343a40;
  padding-bottom: 10px;
  border-bottom: 1px solid #dee2e6;
}

.node-details {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  border-left: 4px solid #007bff;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.node-type-id {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 500;
}

.node-type {
  background-color: #e9ecef;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: #495057;
}

.node-id {
  color: #6c757d;
  font-size: 13px;
}

.node-properties {
  background-color: #f8f9fa;
  border-radius: 6px;
  padding: 10px;
}

.property-row {
  display: flex;
  margin-bottom: 6px;
}

.property-key {
  font-weight: 500;
  color: #495057;
  width: 80px;
  flex-shrink: 0;
}

.property-value {
  color: #6c757d;
}

/* 새로운 워크플로우 다이어그램 스타일 */
.workflow-container {
  margin-bottom: 25px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.workflow-title {
  padding: 15px 20px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
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

.flow-node:hover .node-tooltip {
  display: block;
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

/* 노드 정보 컨테이너 */
.node-info-container {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 20px;
}

.section-title {
  padding: 15px 20px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.node-list {
  padding: 20px;
}

.node-card {
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 15px;
  overflow: hidden;
  border-left: 4px solid #339af0;
}

.node-card-header {
  padding: 12px 15px;
  background-color: #f1f3f5;
  display: flex;
  align-items: center;
}

.node-number {
  background-color: #339af0;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  margin-right: 12px;
}

.node-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.node-type-badge {
  background-color: #74c0fc;
  color: #1864ab;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.node-id-badge {
  color: #868e96;
  font-size: 12px;
}

.node-card-body {
  padding: 15px;
}

.property-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-item {
  display: flex;
  font-size: 13px;
}

.property-name {
  font-weight: 500;
  color: #495057;
  width: 80px;
  flex-shrink: 0;
}

.property-value {
  color: #6c757d;
  word-break: break-word;
}
<!-- Removed duplicate style tag -->
