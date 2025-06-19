<template>
  <div v-if="show" class="popup-overlay" @click="close">
    <div class="popup-container" @click.stop>
      <div class="popup-header">
        <h3>I-app Image Details</h3>
        <div class="header-actions">
          <button v-if="image && image.workflow" class="load-workflow-btn" @click="loadWorkflowToMSA5">
            <i class="fas fa-file-import"></i> 워크플로우 불러오기
          </button>
        <button class="close-button" @click="close">
          <i class="fas fa-times"></i>
        </button>
        </div>
      </div>
      <div class="popup-content">
        <div class="image-section">
          <!-- 이미지 비교 섹션 -->
          <div class="image-comparison">
            <div class="before-image">
              <h4>Before</h4>
          <img :src="imageUrl" :alt="imageName" class="main-image" />
            </div>
            <div class="after-image" v-if="hasAfterImage">
              <h4>After</h4>
              <img :src="afterImageUrl" :alt="afterImageName" class="main-image" />
            </div>
          </div>
        </div>
        <div class="workflow-section">
          <div class="iapp-workflow-info" v-if="image && image.workflow">
            <!-- 워크플로우 정보 -->
            <h3>{{ workflowName }}</h3>
            <p v-if="workflowDescription">{{ workflowDescription }}</p>
            <p v-if="workflowTimestamp"><small>생성일: {{ workflowTimestamp }}</small></p>
            
            <!-- 워크플로우 노드 시각화 - 세로 방향 -->
            <div v-if="hasNodes" class="workflow-diagram">
              <h4>워크플로우</h4>
              <div class="workflow-nodes-container">
                <!-- 시작 노드 -->
                <div class="workflow-node start-node">
                  <i class="fas fa-play"></i>
                  <span>시작</span>
                </div>
                
                <!-- 중간 노드들 - 세로 배치 -->
                <div v-for="(node, index) in processedNodes" :key="node.id || index" class="workflow-node-wrapper">
                  <div class="connector-line"></div>
                  <div class="workflow-node process-node">
                    <div class="node-badge">{{ index + 1 }}</div>
                    <div class="node-content">
                      <div class="node-header">
                        <i v-if="node.data && node.data.icon" :class="node.data.icon"></i>
                        <i v-else :class="getNodeIcon(node.name || node.type || 'process')"></i>
                        <span>{{ node.data && node.data.label ? node.data.label : (node.name || '처리') }}</span>
                    </div>
                      <div class="node-option">
                        <div v-if="node.data && node.data.params">
                          <div v-for="(param, key) in getFilteredParams(node.data.params)" :key="key" class="param-item">
                            <span class="param-name">{{ formatParamName(key) }}</span>:
                            <span class="param-value">{{ typeof param === 'object' ? param.value : param }}</span>
                          </div>
                        </div>
                        <div v-else-if="node.type === 'clahe'" class="param-item">
                          <span class="param-name">Clip limit</span>: <span class="param-value">2.0</span><br>
                          <span class="param-name">Tile grid size</span>: <span class="param-value">8</span>
                        </div>
                        <div v-else-if="node.type === 'median_filter' || node.type === 'median'" class="param-item">
                          <span class="param-name">Kernel size</span>: <span class="param-value">3</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 연결선 -->
                <div class="connector-line"></div>
                
                <!-- 종료 노드 -->
                <div class="workflow-node end-node">
                  <i class="fas fa-stop"></i>
                  <span>종료</span>
                </div>
              </div>
            </div>
            
            <!-- 워크플로우 메타데이터 -->
            <div class="workflow-metadata">
              <div class="metadata-row" v-if="image.workflow.workflow_id">
                <span class="metadata-label">워크플로우 ID:</span>
                <span class="metadata-value">{{ image.workflow.workflow_id }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.workflow_name">
                <span class="metadata-label">워크플로우 이름:</span>
                <span class="metadata-value">{{ image.workflow.workflow_name }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.input_image_filename">
                <span class="metadata-label">입력 이미지:</span>
                <span class="metadata-value">{{ getShortFilename(image.workflow.input_image_filename) }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.output_image_filename">
                <span class="metadata-label">출력 이미지:</span>
                <span class="metadata-value">{{ getShortFilename(image.workflow.output_image_filename) }}</span>
              </div>
            </div>
          </div>
          
          <div class="iapp-workflow-info workflow-not-found" v-else-if="image && image.workflowStatus === 'not_found'">
            <h3>워크플로우 정보 없음</h3>
            <p>이 이미지에 대한 워크플로우 데이터를 찾을 수 없습니다.</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
          
          <div class="iapp-workflow-info workflow-error" v-else-if="image && image.workflowStatus === 'error'">
            <h3>워크플로우 정보 오류</h3>
            <p>워크플로우 데이터를 불러오는 중 오류가 발생했습니다.</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
          
          <div class="iapp-workflow-info workflow-loading" v-else-if="image && image.isLoading">
            <h3>워크플로우 정보 로딩 중...</h3>
            <div class="loading-spinner">
              <div class="spinner"></div>
            </div>
          </div>
          
          <div class="iapp-workflow-info workflow-unknown" v-else-if="image">
            <h3>워크플로우 상태 불명</h3>
            <p>워크플로우 상태: {{ image.workflowStatus || '알 수 없음' }}</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ImageIAppPopup',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    imageUrl: {
      type: String,
      required: true
    },
    imageName: {
      type: String,
      required: true
    },
    image: Object
  },
  methods: {
    close() {
      this.$emit('close');
    },
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp);
      return date.toLocaleString();
    },
    getNodeIcon(nodeType) {
      const iconMap = {
        'start': 'mdi mdi-play',
        'end': 'mdi mdi-stop',
        'input': 'mdi mdi-file-import',
        'output': 'mdi mdi-file-export',
        'process': 'mdi mdi-cog',
        'filter': 'mdi mdi-filter',
        'transform': 'mdi mdi-auto-fix',
        'custom': 'mdi mdi-cube',
        'median': 'fas fa-brush',
        'gamma': 'fas fa-sliders-h',
        'clahe': 'fas fa-chart-line'
      };
      return iconMap[nodeType.toLowerCase()] || 'mdi mdi-cube';
    },
    getShortFilename(filename) {
      if (!filename) return '';
      // 너무 긴 파일명은 앞뒤 10자만 표시하고 중간은 ...으로 줄임
      if (filename.length > 25) {
        return filename.substring(0, 10) + '...' + filename.substring(filename.length - 10);
      }
      return filename;
    },
    getWorkflowName(workflow) {
      //console.log('IApp Popup: Getting workflow name from:', workflow);
      
      // Check different property names that might contain the name
      const possibleNameProps = ['workflow_name', 'name', 'title', 'id'];
      for (const prop of possibleNameProps) {
        if (workflow[prop]) {
          //console.log(`IApp Popup: Found workflow name in property "${prop}": ${workflow[prop]}`);
          return workflow[prop];
        }
      }
      
      //console.log('IApp Popup: No workflow name found');
      return 'No workflow data available';
    },
    getWorkflowDescription(workflow) {
      //console.log('IApp Popup: Getting workflow description');
      
      // Check different property names that might contain the description
      const possibleDescProps = ['description', 'desc', 'summary', 'details'];
      for (const prop of possibleDescProps) {
        if (workflow[prop]) {
          //console.log(`IApp Popup: Found description in property "${prop}": ${workflow[prop]}`);
          return workflow[prop];
        }
      }
      
      //console.log('IApp Popup: No description found');
      return 'No description data available';
    },
    getWorkflowTimestamp(workflow) {
      //console.log('IApp Popup: Getting workflow timestamp');
      
      // Check different property names that might contain the timestamp
      const possibleTimeProps = ['created_at', 'timestamp', 'date', 'created', 'time'];
      for (const prop of possibleTimeProps) {
        if (workflow[prop]) {
          //console.log(`IApp Popup: Found timestamp in property "${prop}": ${workflow[prop]}`);
          return workflow[prop];
        }
      }
      
      //console.log('IApp Popup: No timestamp found');
      // Return null to indicate no timestamp instead of current date
      return null;
    },
    hasWorkflowNodes(workflow) {
      //console.log('IApp Popup: Checking for workflow nodes');
      
      // Check if the workflow has any nodes
      const hasNodes = workflow.nodes && Array.isArray(workflow.nodes) && workflow.nodes.length > 0;
      //console.log(`IApp Popup: Workflow has nodes? ${hasNodes}`);
      
      return hasNodes;
    },
    getWorkflowNodes(workflow) {
      // Implement the logic to get the workflow nodes
      return workflow.nodes || [];
    },
    getNodeType(node) {
      // Implement the logic to get the node type
      return node.type || 'custom';
    },
    getNodeLabel(node) {
      // Implement the logic to get the node label
      return node.label || node.name || node.id || node.type || 'Node';
    },
    processNodes() {
      if (!this.image || !this.image.workflow) {
        //console.log('No workflow data available');
        return [];
      }
      
      // 워크플로우 데이터 디버깅
      //console.log('Full workflow data:', JSON.stringify(this.image.workflow));
      
      // API 호환성을 위한 노드 타입 매핑
      const apiCompatibilityMap = {
        'median': 'median_filter',
        'blur': 'gaussian_blur', 
        'gamma': 'gamma',
        'gamma_correction': 'gamma',
        'anisotropic': 'anisotropic_diffusion',
        'anisotropic_diffusion_filter': 'anisotropic_diffusion',
        'anisotropic_filter': 'anisotropic_diffusion',
        '비등방성 확산': 'anisotropic_diffusion',
        '비등방성': 'anisotropic_diffusion',
        '확산 필터': 'anisotropic_diffusion',
        '비등방성 확산 필터': 'anisotropic_diffusion',
        'clahe': 'clahe',
        'threshold': 'threshold',
        'edge': 'edge',
        'edge_detection': 'edge',
        'brightness': 'brightness',
        'contrast': 'contrast',
        'histogram_eq': 'histogram_equalization',
        'hist_eq': 'histogram_equalization',
        'histogram': 'histogram_equalization',
        'histogram_equalization': 'histogram_equalization',
        'object_detection': 'object_detection',
        'object-detection': 'object_detection',
        'object': 'object_detection'
      };
      
      // 노드 매핑 헬퍼 함수
      const mapNodeType = (node) => {
        // 원본 타입 저장
        const originalType = node.type || (node.data && node.data.type) || '';
        
        // 타입 매핑 적용
        if (apiCompatibilityMap[originalType]) {
          if (node.type) {
            node.type = apiCompatibilityMap[originalType];
          }
          if (node.data && node.data.type) {
            node.data.type = apiCompatibilityMap[originalType];
          }
          
          // 노드 이름도 일관성 있게 변경
          if (node.name) {
            node.name = apiCompatibilityMap[originalType];
          }
          //console.log(`Node type mapped: ${originalType} -> ${apiCompatibilityMap[originalType]}`);
        }
        
        return node;
      };
      
      // elements 배열이 있으면 사용
      if (this.image.workflow.elements && Array.isArray(this.image.workflow.elements)) {
        // start와 end를 제외한 요소들만 반환
        const customNodes = [];
        
        // 각 요소 확인하며 로깅
        this.image.workflow.elements.forEach((element, index) => {
          //console.log(`Element ${index}:`, element);
          
          if (element.type !== 'start' && element.type !== 'end') {
            // 노드 타입 매핑 적용
            element = mapNodeType(element);
            
            //console.log(`Adding custom node:`, element);
            customNodes.push(element);
          } else {
            //console.log(`Skipping node (start/end):`, element);
          }
        });
        
        //console.log('Final custom nodes:', customNodes);
        return customNodes;
      }
      
      // 다른 형태의 노드 구조 처리 (기존 코드와 동일)
      if (this.image.workflow.nodes && Array.isArray(this.image.workflow.nodes)) {
        const customNodes = this.image.workflow.nodes
          .filter(node => node.type !== 'start' && node.type !== 'end')
          .map(node => mapNodeType(node));
        //console.log('Using nodes array:', customNodes);
        return customNodes;
      }
      
      // nodes_summary 배열이 있으면 사용
      if (this.image.workflow.nodes_summary && Array.isArray(this.image.workflow.nodes_summary)) {
        const customNodes = this.image.workflow.nodes_summary
          .filter(node => node.type !== 'start' && node.type !== 'end')
          .map(node => mapNodeType(node));
        //console.log('Using nodes_summary array:', customNodes);
        return customNodes;
      }
      
      //console.log('No workflow nodes found');
      return [];
    },
    formatParamName(key) {
      // 언더스코어를 공백으로 변환하고 첫 글자를 대문자로
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    formatParamValue(value) {
      if (typeof value === 'number') {
        // 숫자인 경우 소수점 2자리까지만 표시
        return Number.isInteger(value) ? value : value.toFixed(2);
      } else if (typeof value === 'boolean') {
        // 불리언 값 표시
        return value ? '활성화' : '비활성화';
      } else if (Array.isArray(value)) {
        // 배열 값 표시
        return value.join(', ');
      } else if (value === null || value === undefined) {
        return '없음';
      }
      return value;
    },
    // 워크플로우 구조 분석 함수
    inspectWorkflowStructure(workflow, prefix = '') {
      if (!workflow) {
        //console.log(prefix + '워크플로우 데이터가 없습니다.');
        return;
      }
      
      //console.log(prefix + '워크플로우 구조 분석:');
      
      // 최상위 키 확인
      const keys = Object.keys(workflow);
      //console.log(prefix + '최상위 키:', keys);
      
      // 노드 관련 키 찾기
      const possibleNodeKeys = ['nodes', 'node', 'elements', 'steps', 'operations'];
      let foundNodesKey = null;
      
      // 직접적인 노드 배열 검색
      for (const key of possibleNodeKeys) {
        if (workflow[key] && Array.isArray(workflow[key])) {
          foundNodesKey = key;
          //console.log(prefix + `노드 배열 발견: "${key}", 길이:`, workflow[key].length);
          break;
        }
      }
      
      // 중첩된 위치에서 노드 배열 검색
      if (!foundNodesKey) {
        for (const key of Object.keys(workflow)) {
          if (typeof workflow[key] === 'object' && workflow[key] !== null) {
            for (const innerKey of possibleNodeKeys) {
              if (workflow[key][innerKey] && Array.isArray(workflow[key][innerKey])) {
                foundNodesKey = `${key}.${innerKey}`;
                //console.log(prefix + `중첩된 노드 배열 발견: "${foundNodesKey}", 길이:`, workflow[key][innerKey].length);
                break;
              }
            }
            if (foundNodesKey) break;
          }
        }
      }
      
      // 노드 맵 구조 검색 (객체 내 여러 노드 객체가 있는 경우)
      if (!foundNodesKey) {
        let nodeCount = 0;
        for (const key of Object.keys(workflow)) {
          if (
            typeof workflow[key] === 'object' && 
            workflow[key] !== null && 
            (workflow[key].type || workflow[key].data)
          ) {
            nodeCount++;
          }
        }
        
        if (nodeCount > 0) {
          //console.log(prefix + `노드 맵 구조 발견. 노드 수:`, nodeCount);
        }
      }
      
      // 워크플로우 속성 상세 분석
      //console.log(prefix + '워크플로우 속성 분석:');
      for (const key of Object.keys(workflow)) {
        const value = workflow[key];
        
        if (Array.isArray(value)) {
          //console.log(prefix + `${key}: 배열(${value.length})`);
          
          // 배열의 첫 번째 항목 구조 분석
          if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            //console.log(prefix + `  ${key}[0] 속성:`, Object.keys(value[0]));
          }
        } else if (typeof value === 'object' && value !== null) {
          //console.log(prefix + `${key}: 객체`);
          //console.log(prefix + `  ${key} 속성:`, Object.keys(value));
        } else {
          //console.log(prefix + `${key}: ${typeof value}`);
        }
      }
      
      return foundNodesKey;
    },
    // 워크플로우 구조 출력 함수
    debugWorkflow(workflow) {
      // 디버깅용 간략 정보 출력
      try {
        //console.log('---------- 워크플로우 디버깅 정보 ----------');
        
        // 전체 워크플로우 구조 확인
        //console.log('워크플로우 최상위 키:', Object.keys(workflow));
        
        // 노드 정보 (있는 경우)
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
          //console.log(`워크플로우 노드 수: ${workflow.nodes.length}`);
          //console.log('첫 번째 노드 구조:', workflow.nodes[0]);
        } else {
          //console.log('워크플로우에 nodes 배열이 없습니다.');
        }
        
        // data 필드 확인 (있는 경우)
        if (workflow.data) {
          //console.log('워크플로우 data 필드 키:', Object.keys(workflow.data));
          
          // data 필드 내 노드 정보 확인
          if (workflow.data.nodes && Array.isArray(workflow.data.nodes)) {
            //console.log(`워크플로우 data.nodes 수: ${workflow.data.nodes.length}`);
            //console.log('첫 번째 data.node 구조:', workflow.data.nodes[0]);
          }
        }
        
        // 특정 노드 타입 확인
        const nodeTypes = new Set();
        const findNodes = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          
          // 노드 타입 검사
          if (obj.type && typeof obj.type === 'string') {
            nodeTypes.add(obj.type);
          }
          
          // 배열인 경우 각 항목 재귀 검사
          if (Array.isArray(obj)) {
            obj.forEach(item => findNodes(item));
            return;
          }
          
          // 객체인 경우 각 속성 재귀 검사
          Object.values(obj).forEach(val => {
            if (val && typeof val === 'object') {
              findNodes(val);
            }
          });
        };
        
        findNodes(workflow);
        //console.log('발견된 노드 타입:', Array.from(nodeTypes));
        
        //console.log('---------- 워크플로우 디버깅 정보 종료 ----------');
      } catch (error) {
        console.error('워크플로우 디버깅 중 오류:', error);
      }
    },
    loadWorkflowToMSA5() {
      //console.log('원본 워크플로우 데이터:', this.image.workflow);
      
      // 워크플로우 디버깅 정보 출력
      this.debugWorkflow(this.image.workflow);
      
      // 워크플로우 구조 분석
      this.inspectWorkflowStructure(this.image.workflow);
      
      // 워크플로우 데이터 검증 및 구조화
      if (!this.image || !this.image.workflow) {
        console.error('워크플로우 데이터가 없습니다.');
        alert('워크플로우 데이터가 없습니다.');
        return;
      }
      
      // MongoDB 워크플로우 데이터 구조 분석
      const rawWorkflow = this.image.workflow;
      
      // 가능한 노드 키 목록
      const possibleNodeKeys = ['nodes', 'node', 'elements', 'steps', 'operations'];
      
      // 노드 데이터 추출 (다양한 구조 지원)
      let nodes = [];
      
      // 1. 직접적인 노드 배열 검색
      let foundNodesDirectly = false;
      for (const key of possibleNodeKeys) {
        if (rawWorkflow[key] && Array.isArray(rawWorkflow[key])) {
          nodes = rawWorkflow[key];
          //console.log(`직접적인 노드 배열 발견: "${key}", 길이:`, nodes.length);
          foundNodesDirectly = true;
          break;
        }
      }
      
      // 2. 중첩된 위치에서 노드 배열 검색
      if (!foundNodesDirectly) {
        for (const key of Object.keys(rawWorkflow)) {
          if (typeof rawWorkflow[key] === 'object' && rawWorkflow[key] !== null) {
            for (const innerKey of possibleNodeKeys) {
              if (rawWorkflow[key][innerKey] && Array.isArray(rawWorkflow[key][innerKey])) {
                nodes = rawWorkflow[key][innerKey];
                //console.log(`중첩된 노드 배열 발견: "${key}.${innerKey}", 길이:`, nodes.length);
                foundNodesDirectly = true;
                break;
              }
            }
            if (foundNodesDirectly) break;
          }
        }
      }
      
      // 3. 노드 맵 구조 추출 (객체 내 여러 노드 객체가 있는 경우)
      if (!foundNodesDirectly && typeof rawWorkflow === 'object') {
        // 가능한 노드 객체들 수집
        const candidateNodes = [];
        
        // 최상위 속성 탐색
        for (const key of Object.keys(rawWorkflow)) {
          const value = rawWorkflow[key];
          
          // 노드로 보이는 객체 식별
          if (typeof value === 'object' && value !== null) {
            // 노드 여부 판별 조건
            const hasNodeType = value.type || (value.data && value.data.type);
            const hasNodeId = value.id || (value.data && value.data.id);
            const isValidNode = hasNodeType || hasNodeId;
            
            if (isValidNode) {
              candidateNodes.push(value);
            }
            
            // 중첩 객체 내 노드 탐색
            if (typeof value === 'object' && !Array.isArray(value)) {
              for (const innerKey of Object.keys(value)) {
                const innerValue = value[innerKey];
                
                if (typeof innerValue === 'object' && innerValue !== null) {
                  const hasInnerNodeType = innerValue.type || (innerValue.data && innerValue.data.type);
                  const hasInnerNodeId = innerValue.id || (innerValue.data && innerValue.data.id);
                  const isInnerValidNode = hasInnerNodeType || hasInnerNodeId;
                  
                  if (isInnerValidNode && !Array.isArray(innerValue)) {
                    candidateNodes.push(innerValue);
                  }
                }
              }
            }
          }
        }
        
        if (candidateNodes.length > 0) {
          nodes = candidateNodes;
          //console.log(`노드 맵 구조에서 ${nodes.length}개의 노드를 추출했습니다.`);
        }
      }
      
      // 4. 워크플로우가 단일 노드인 경우
      if (nodes.length === 0 && rawWorkflow.type) {
        nodes = [rawWorkflow];
        //console.log('워크플로우 자체가 단일 노드입니다.');
      }
      
      // 5. 대체 구조 - 워크플로우 내 특정 필드를 직접 추출
      if (nodes.length === 0 && rawWorkflow.workflow) {
        // workflow 필드가 있는 경우
        this.inspectWorkflowStructure(rawWorkflow.workflow, '중첩된 workflow 필드: ');
        
        // 재귀적으로 내부 워크플로우에서 노드 추출 시도
        if (typeof rawWorkflow.workflow === 'object') {
          for (const key of possibleNodeKeys) {
            if (rawWorkflow.workflow[key] && Array.isArray(rawWorkflow.workflow[key])) {
              nodes = rawWorkflow.workflow[key];
              //console.log(`중첩된 workflow에서 노드 배열 발견: "workflow.${key}", 길이:`, nodes.length);
              break;
            }
          }
        }
      }
      
      // 최종 노드 필터링 - 유효한 객체만 유지
      nodes = nodes.filter(node => node && typeof node === 'object');
      
      //console.log('추출된 노드 목록:', nodes);
      
      if (nodes.length === 0) {
        console.error('워크플로우에 유효한 노드가 없습니다.');
        alert('워크플로우에 노드가 없습니다.');
        return;
      }
      
      // 워크플로우 이름 추출
      const workflowName = rawWorkflow.name || rawWorkflow.title || 
                            (this.image.title ? `${this.image.title}_workflow` : null);
      
      // 전달할 데이터 준비
      const workflowData = {
        name: workflowName,
        nodes: nodes.map(node => {
          // 노드 타입 처리 (여러 구조 지원)
          let nodeType = '';
          let nodeData = {};
          
          if (node.type) {
            nodeType = node.type;
          } else if (node.data && node.data.type) {
            nodeType = node.data.type;
          } else if (node.nodeName) {
            nodeType = node.nodeName;
          } else if (node.name) {
            nodeType = node.name;
          } else {
            // 타입이 없으면 ID에서 추출 시도
            if (node.id && typeof node.id === 'string') {
              const idParts = node.id.split('_');
              if (idParts.length > 0) {
                nodeType = idParts[0]; // ID의 첫 부분을 타입으로 사용
              }
            }
            
            // 여전히 타입이 없으면 기본값 사용
            if (!nodeType) {
              nodeType = 'custom';
             }
          }
          
          // 노드 데이터 처리
          if (node.data) {
            nodeData = { ...node.data };
          } else if (node.parameters || node.params || node.options) {
            // 파라미터/옵션이 별도 필드에 있는 경우
            nodeData = { 
              ...(node.parameters || {}),
              ...(node.params || {}),
              ...(node.options || {})
            };
          } else {
            // 데이터 필드가 없으면 type과 id를 제외한 모든 속성을 데이터로 간주
            nodeData = { ...node };
            delete nodeData.type;
            delete nodeData.id;
            
            // 일반적인 메타데이터 필드 제외
            delete nodeData.position;
            delete nodeData.positionAbsolute;
            delete nodeData.selected;
            delete nodeData.dragging;
          }
          
          // 노드 타입을 완전한 API 엔드포인트 형식으로 변환
          // API 엔드포인트와 호환되는 정확한 타입명 사용
          const apiCompatibilityMap = {
            'median': 'median_filter',
            'blur': 'gaussian_blur', 
            'gamma': 'gamma',
            'gamma_correction': 'gamma',
            'anisotropic': 'anisotropic_diffusion',
            'anisotropic_diffusion_filter': 'anisotropic_diffusion',
            'anisotropic_filter': 'anisotropic_diffusion',
            '비등방성 확산': 'anisotropic_diffusion',
            '비등방성': 'anisotropic_diffusion',
            '확산 필터': 'anisotropic_diffusion',
            '비등방성 확산 필터': 'anisotropic_diffusion',
            'clahe': 'clahe',
            'threshold': 'threshold',
            'edge': 'edge',
            'edge_detection': 'edge',
            'brightness': 'brightness',
            'contrast': 'contrast',
            'histogram_eq': 'histogram_equalization',
            'hist_eq': 'histogram_equalization',
            'histogram': 'histogram_equalization',
            'histogram_equalization': 'histogram_equalization',
            'object_detection': 'object_detection',
            'object-detection': 'object_detection',
            'object': 'object_detection'
          };
          
          // 노드 타입 매핑 적용 (API 호환성)
          if (apiCompatibilityMap[nodeType]) {
            //console.log(`노드 타입 매핑 적용: ${nodeType} -> ${apiCompatibilityMap[nodeType]}`);
            nodeType = apiCompatibilityMap[nodeType];
          }
          
          // 한글 노드 라벨 매핑
          const koreanToApiTypeMap = {
            '미디언 필터': 'median_filter',
            '미디안 필터': 'median_filter',
            '감마 보정': 'gamma',
            '히스토그램 평활화': 'histogram_equalization',
            '히스토그램': 'histogram_equalization',
            '가우시안 블러': 'gaussian_blur',
            '블러': 'gaussian_blur',
            '비등방성 확산': 'anisotropic_diffusion',
            '비등방성 필터': 'anisotropic_diffusion',
            '비등방성 확산 필터': 'anisotropic_diffusion',
            '비등방성': 'anisotropic_diffusion',
            '엣지 검출': 'edge',
            '엣지': 'edge',
            '이진화': 'threshold',
            '밝기 조정': 'brightness',
            '밝기': 'brightness',
            '대비 조정': 'contrast',
            '대비': 'contrast',
            '객체 검출': 'object_detection',
            '객체 감지': 'object_detection'
          };
          
          // 라벨이 한글인 경우 API 타입으로 변환
          if (node.label && koreanToApiTypeMap[node.label]) {
            //console.log(`한글 라벨 매핑 적용: ${node.label} -> ${koreanToApiTypeMap[node.label]}`);
            nodeType = koreanToApiTypeMap[node.label];
          } else if (nodeData.label && koreanToApiTypeMap[nodeData.label]) {
            //console.log(`데이터 한글 라벨 매핑 적용: ${nodeData.label} -> ${koreanToApiTypeMap[nodeData.label]}`);
            nodeType = koreanToApiTypeMap[nodeData.label];
          }
          
          //console.log(`최종 변환된 노드 타입:`, nodeType);
          
          // 라벨 처리
          let label = '';
          if (nodeData.label) {
            label = nodeData.label;
          } else if (node.label) {
            label = node.label;
          } else if (node.name) {
            label = node.name;
          } else {
            // 라벨이 없으면 타입에서 생성
            label = nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace(/_/g, ' ');
          }
          
          return {
            id: node.id || `node_${Math.random().toString(36).substring(2, 9)}`,
            type: nodeType,
            label: label,
            data: nodeData
          };
        }),
        edges: rawWorkflow.edges || [],
        originalWorkflow: rawWorkflow
      };
      
      //console.log('MSA5로 전송할 워크플로우 데이터:', workflowData);
      
      // 이벤트 버스를 통해 MSA5에 워크플로우 데이터 전송
      if (window.MSAEventBus) {
        window.MSAEventBus.emit('load-workflow-to-msa5', workflowData);
        //console.log('MSAEventBus를 통해 load-workflow-to-msa5 이벤트 발생');
      }
      
      // 직접 DOM 이벤트로도 전송 (추가 안전장치)
      const event = new CustomEvent('load-workflow-to-msa5', {
        detail: workflowData,
        bubbles: true
      });
      document.dispatchEvent(event);
      //console.log('DOM 이벤트를 통해 load-workflow-to-msa5 이벤트 발생');
      
      // 팝업 닫기
      this.close();
      
      // 성공 메시지 표시
      alert('워크플로우가 MSA5로 로드되었습니다.');
    },
    getFilteredParams(params) {
      if (!params) return {};
      const result = {};
      
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'enabled' && key !== '0') {
          result[key] = value;
        }
      });
      
      return result;
    }
  },
  computed: {
    workflowName() {
      //console.log('IApp Popup: Getting workflow name from:', this.image ? this.image.workflow : 'null');
      if (this.image && this.image.workflow) {
        const name = this.image.workflow.workflow_name;
        if (name) {
          //console.log('IApp Popup: Workflow name found:', name);
          return name;
        }
      }
      //console.log('IApp Popup: No workflow name found');
      return '워크플로우 정보 없음';
    },
    workflowDescription() {
      //console.log('IApp Popup: Getting workflow description');
      if (this.image && this.image.workflow) {
        // 여러 필드명 시도
        const possibleFields = ['description', 'workflow_description'];
        for (const field of possibleFields) {
          if (this.image.workflow[field]) {
            //console.log(`IApp Popup: Workflow description found in ${field}:`, this.image.workflow[field]);
            return this.image.workflow[field];
          }
        }
      }
      //console.log('IApp Popup: No description found');
      return null;
    },
    workflowTimestamp() {
      //console.log('IApp Popup: Getting workflow timestamp');
      if (this.image && this.image.workflow) {
        // 여러 타임스탬프 필드 시도
        const possibleFields = ['created_at', 'timestamp'];
        for (const field of possibleFields) {
          if (this.image.workflow[field]) {
            //console.log(`IApp Popup: Workflow timestamp found in ${field}:`, this.image.workflow[field]);
            try {
              // ISO 날짜 형식 포맷팅
              return new Date(this.image.workflow[field]).toLocaleString();
            } catch (e) {
              return this.image.workflow[field];
            }
          }
        }
      }
      //console.log('IApp Popup: No timestamp found');
      return null;
    },
    hasNodes() {
      //console.log('IApp Popup: Checking for workflow nodes');
      
      if (!this.image || !this.image.workflow) {
        //console.log('IApp Popup: No workflow object');
        return false;
      }
      
      // 워크플로우 직접 로깅
      try {
        //console.log('IApp Popup: Workflow elements:', JSON.stringify(this.image.workflow.elements));
      } catch (e) {
        //console.log('IApp Popup: Error stringifying workflow elements');
      }
      
      // elements 배열 확인
      if (this.image.workflow.elements && Array.isArray(this.image.workflow.elements)) {
        const hasProcessNodes = this.image.workflow.elements.some(el => el.type !== 'start' && el.type !== 'end');
        //console.log('IApp Popup: Has process nodes in elements?', hasProcessNodes);
        return hasProcessNodes;
      }
      
      //console.log('IApp Popup: No workflow nodes found');
      return false;
    },
    processedNodes() {
      if (!this.image || !this.image.workflow) {
        //console.log('No workflow data available in computed');
        return [];
      }
      
      // Use the same mapping function from processNodes method
      return this.processNodes();
    },
    nodeCount() {
      return this.image && 
             this.image.workflow && 
             this.image.workflow.nodes ? 
             this.image.workflow.nodes.length : 0;
    },
    hasAfterImage() {
      return !!this.imageName && this.imageName.includes('_before');
    },
    afterImageName() {
      if (!this.imageName) return '';
      return this.imageName.replace('_before', '_after');
    },
    afterImageUrl() {
      if (!this.hasAfterImage) return '';
      
      // 원본 파일명에서 _before를 _after로 변경
      const afterName = this.afterImageName;
      
      // 8091 포트 사용하여 후처리 이미지 URL 생성
      // noname_before이미지면 localhost:8091/image_set_url/workflow_images/name_after.png
      if (afterName.includes('/')) {
        // 경로가 포함된 경우 전체 경로 변경
        const path = afterName.substring(0, afterName.lastIndexOf('/') + 1);
        const filename = afterName.substring(afterName.lastIndexOf('/') + 1);
        return `http://localhost:8091/workflow_images/${filename}`;
      } else {
        // 경로 없이 파일명만 있는 경우
        return `http://localhost:8091/workflow_images/${afterName}`;
      }
    }
  },
  mounted() {
    // 전역 이벤트 버스 초기화 (없으면 생성)
    if (!window.MSAEventBus) {
      window.MSAEventBus = {
        listeners: {},
        emit(event, data) {
          if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
          }
          // 이벤트 발생 로그
          //console.log(`MSAEventBus: Event "${event}" emitted with data:`, data);
        },
        on(event, callback) {
          if (!this.listeners[event]) {
            this.listeners[event] = [];
          }
          this.listeners[event].push(callback);
          // 이벤트 리스너 등록 로그
          //console.log(`MSAEventBus: Listener added for event "${event}"`);
        },
        off(event, callback) {
          if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(
              cb => cb !== callback
            );
          }
        }
      };
      //console.log('MSAEventBus 초기화됨');
    }
  }
};
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.popup-container {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
}

.popup-header h3 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.load-workflow-btn {
  background-color: #4a76fd;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.load-workflow-btn:hover {
  background-color: #3a65e9;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.load-workflow-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.load-workflow-btn i {
  font-size: 14px;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
}

.popup-content {
  display: flex;
  padding: 24px;
}

.image-section {
  flex: 1;
  margin-right: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.main-image {
  max-width: 100%;
  max-height: 500px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.workflow-section {
  flex: 1;
  padding-left: 24px;
  border-left: 1px solid #eee;
}

.workflow-details {
  margin-top: 16px;
}

.detail-row {
  margin-bottom: 12px;
}

.workflow-nodes {
  margin-top: 24px;
}

.workflow-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 16px;
}

.flow-nodes {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin-bottom: 32px;
}

.node-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #6c5ce7;
}

.node-text {
  margin-top: 8px;
  font-size: 14px;
}

.node-arrow {
  position: absolute;
  bottom: -24px;
  width: 2px;
  height: 24px;
  background-color: #ddd;
}

.node-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  background-color: #6c5ce7;
  color: white;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
}

.start-node .node-icon, .end-node .node-icon {
  background-color: #6c5ce7;
  color: white;
}

.process-node .node-icon {
  background-color: #e6e1f9;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.loading-indicator i {
  font-size: 32px;
  color: #6c5ce7;
  margin-bottom: 16px;
}

.loading-indicator p {
  font-size: 16px;
  color: #333;
}

.retry-hint {
  color: #666;
  font-size: 14px;
  text-align: center;
  font-style: italic;
}

.no-workflow-data {
  padding: 24px;
  background-color: #f8f9fa;
  border-radius: 8px;
  text-align: center;
  margin-top: 16px;
}

.workflow-not-found, .workflow-error {
  background-color: #ffecec;
  border-left: 4px solid #f44336;
  padding: 10px 15px;
  margin: 10px 0;
  border-radius: 4px;
}

.workflow-loading {
  background-color: #e8f4fd;
  border-left: 4px solid #2196F3;
  padding: 10px 15px;
  margin: 10px 0;
  border-radius: 4px;
}

.workflow-unknown {
  background-color: #fff9e6;
  border-left: 4px solid #ffc107;
  padding: 10px 15px;
  margin: 10px 0;
  border-radius: 4px;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #339af0;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .popup-content {
    flex-direction: column;
  }
  
  .image-section {
    margin-right: 0;
    margin-bottom: 24px;
  }
  
  .workflow-section {
    padding-left: 0;
    border-left: none;
    border-top: 1px solid #eee;
    padding-top: 24px;
  }
}

.workflow-diagram {
  margin: 20px 0;
  padding: 15px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #eee;
}

.workflow-diagram h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-weight: 600;
  font-size: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.workflow-nodes-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  position: relative;
}

.workflow-node-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.connector-line {
  width: 2px;
  height: 20px;
  background-color: #ddd;
  margin: 0;
}

.workflow-node {
  position: relative;
  padding: 12px 15px;
  border-radius: 8px;
  margin: 5px 0;
  min-width: 200px;
  box-sizing: border-box;
}

.workflow-node.start-node,
.workflow-node.end-node {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 120px;
  padding: 10px;
}

.start-node {
  background-color: #2196F3;
  color: white;
}

.end-node {
  background-color: #F44336;
  color: white;
}

.process-node {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  width: 280px;
}

.node-badge {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 22px;
  height: 22px;
  background-color: #4CAF50;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.node-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-header i {
  font-size: 18px;
  color: #666;
}

.node-header span {
  font-weight: 500;
  font-size: 14px;
}

.node-option {
  margin-top: 5px;
  border-top: 1px dotted #e5e7eb;
  padding-top: 5px;
}

/* 이미지 비교 섹션 스타일 */
.image-comparison {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.before-image, .after-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.before-image h4, .after-image h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.main-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  border: 1px solid #eee;
}

@media (max-width: 768px) {
  .process-node {
    width: 100%;
  }
}

/* 파라미터 스타일링 */
.workflow-parameters {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.parameter-card {
  flex: 1;
  min-width: 200px;
  background-color: #f9f9f9;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eeeeee;
}

.parameter-header {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f1f1f1;
  position: relative;
}

.parameter-badge {
  width: 20px;
  height: 20px;
  background-color: #4CAF50;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-right: 10px;
}

.parameter-title {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.parameter-content {
  padding: 10px;
}

.parameter-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.param-item {
  margin-top: 5px;
  font-size: 12px;
  color: #555;
}

.param-name {
  font-weight: 500;
  color: #6b7280;
}

.param-value {
  font-weight: normal;
  color: #111827;
}

.workflow-metadata {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #eee;
}

.metadata-row {
  display: flex;
  margin-bottom: 8px;
}

.metadata-label {
  flex: 0 0 130px;
  font-weight: 500;
  color: #495057;
}

.metadata-value {
  flex: 1;
  color: #212529;
  word-break: break-all;
}

.node-details-section {
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.node-details-section h5 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.node-detail-card {
  margin-bottom: 15px;
  padding: 12px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #eee;
}

.node-detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.node-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #4a76fd;
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 12px;
  margin-right: 10px;
}

.node-title {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.node-params {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.param-row {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.param-label {
  font-weight: 500;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.param-value {
  font-size: 14px;
  color: #333;
}

.node-empty-params {
  text-align: center;
  padding: 10px;
  font-size: 14px;
  color: #888;
  font-style: italic;
  background-color: #f8f9fa;
  border-radius: 4px;
}
</style> 