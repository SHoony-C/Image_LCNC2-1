<template>
  <div class="msa-component" :class="{ maximized: isMaximized }">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>이미지 전처리 LCNC</span>
      </div>
      <div class="header-right">
        <button @click="processStart" class="process-btn" :disabled="!inputImage">
          <i class="fas fa-play-circle"></i>
          Process Start
        </button>
        <button @click="toggleMaximize" class="maximize-btn">
          <i :class="isMaximized ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
      </div>
    </div>

    <!-- 상태 메시지 알림 -->
    <div class="status-message" v-if="showStatusMessage">
      <i class="fas fa-info-circle"></i>
      <span>{{ statusMessage }}</span>
    </div>

    <div class="workflow-container">
      <div class="node-palette">
        <div class="palette-header">
          <i class="fas fa-th-large"></i>
          <span>전처리 옵션</span>
        </div>
        
        <!-- 전처리 노드 팔레트 (스크롤 가능) -->
        <div class="preprocessing-nodes-wrapper">
          <div class="preprocessing-nodes-container">
            <div v-for="node in availableNodes.filter(n => n.id !== 'merge')" :key="node.id" class="palette-node" draggable="true"
              @dragstart="onDragStart($event, node)">
              <i :class="node.icon"></i>
              <span>{{ node.label }}</span>
            </div>
          </div>
        </div>
        
        <!-- 병합 노드를 하단에 고정 배치 -->
        <div class="merge-palette-section">
          <div class="merge-node-container" draggable="true" @dragstart="onDragStart($event, availableNodes.find(n => n.id === 'merge'))">
            <div class="merge-node-preview">
              <div class="diamond-preview">
                <i class="fas fa-object-group"></i>
              </div>
              <span>이미지 병합</span>
            </div>
            <div class="merge-node-desc">
              여러 이미지를 하나로 병합합니다 (최대 3개 입력)
            </div>
          </div>
        </div>
      </div>

      <div class="workflow-area" @dragover="onDragOver" @drop="onDrop">
        <VueFlow v-model="elements" :default-viewport="{ x: 0, y: 0, zoom: 0.7 }"
          @connect="onConnect" @node-drag-stop="onNodeDragStop" @node-click="onNodeClick"
          :min-zoom="0.2" :max-zoom="2" :snap-to-grid="true" :snap-grid="[15, 15]"
          fit-view-on-init
          @pane-ready="onPaneReady"
          @init="onInit">
          <Background pattern-color="#aaa" gap="8" />
          <Controls />
          <MiniMap 
            ref="minimap"
            node-color="#8b5cf6" 
            mask-color="rgba(139, 92, 246, 0.1)"
            class="custom-minimap"
            :pannable="true"
          />
          
          <template #node-start>
            <div class="start-node" :class="{ 'has-connection': hasInput }">
              <Handle type="source" position="right" />
              <div class="node-header">
                <i class="fas fa-play"></i>
                <span>시작</span>
              </div>
              <div class="node-image" v-if="inputImage" @click.stop="openImagePreview(inputImage)">
                <img :src="inputImage" alt="Input image" />
              </div>
            </div>
          </template>

          <template #node-end>
            <div class="end-node" :class="{ 'has-connection': hasOutput }">
              <Handle type="target" position="left" />
              <div class="node-header">
                <i class="fas fa-stop"></i>
                <span>종료</span>
              </div>
              <div class="node-image" v-if="processedImages['end']" @click.stop="openImagePreview(processedImages['end'])">
                <img :src="processedImages['end']" alt="Output image" />
              </div>
            </div>
          </template>

          <template #node-custom="nodeProps">
            <div class="workflow-node">
              <Handle type="target" position="left" />
              <Handle type="source" position="right" />
              <div class="node-header">
                <i :class="nodeProps.data.icon"></i>
                <span>{{ nodeProps.data.label }}</span>
              </div>
              <div class="node-image" v-if="processedImages[nodeProps.id]" @click.stop="openImagePreview(processedImages[nodeProps.id])">
                <img :src="processedImages[nodeProps.id]" alt="Processed image" />
              </div>
            </div>
          </template>

          <template #node-merge="nodeProps">
            <div class="merge-node">
              <Handle type="target" position="left-top" id="input-lefttop" />
              <Handle type="target" position="left-bottom" id="input-leftbottom" />
              <Handle type="target" position="right-top" id="input-righttop" />
              <Handle type="source" position="right-bottom" id="output-rightbottom" />
              
              <div class="node-header">
                <i :class="nodeProps.data.icon"></i>
                <span>{{ nodeProps.data.label }}</span>
              </div>
              <div class="node-image" v-if="processedImages[nodeProps.id]" @click.stop="openImagePreview(processedImages[nodeProps.id])">
                <img :src="processedImages[nodeProps.id]" alt="Merged image" />
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <div class="options-panel" v-if="selectedNode">
        <div class="panel-header">
          <h3>{{ selectedNode.data.label }} 설정</h3>
          <button class="close-btn" @click="selectedNode = null">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="panel-content">
          <div v-for="(param, key) in selectedNode.data.params" :key="key" class="param-item">
            <label>{{ param.label }}</label>
            <template v-if="param.options">
              <select v-model="param.value" class="param-input">
                <option v-for="option in param.options" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </template>
            <template v-else>
              <input type="number" v-model="param.value" class="param-input"
                :min="param.min" :max="param.max" :step="param.step">
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 이미지 프리뷰 팝업 -->
    <Teleport to="body">
      <div class="image-preview-overlay" v-if="previewImageUrl" @click="closeImagePreview">
        <div class="image-preview-container" @click.stop>
          <div class="preview-header">
            <h3>이미지 상세보기</h3>
            <button class="close-preview-btn" @click="closeImagePreview">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="preview-content">
            <img :src="previewImageUrl" alt="Preview" class="preview-image">
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'

export default {
  name: 'MSA5ImageLCNC',
  components: {
    VueFlow,
    MiniMap,
    Handle,
    Background,
    Controls
  },
  setup() {
    const isMaximized = ref(false)
    const hasInput = ref(false)
    const hasOutput = ref(false)
    const elements = ref([])
    const selectedNode = ref(null)
    const inputImage = ref(null)
    const processedImages = reactive({})
    const processingStatus = ref('idle')
    const previewImageUrl = ref(null)
    const statusMessage = ref('')
    const showStatusMessage = ref(false)
    const availableNodes = ref([])
    const isNodesLoading = ref(true)
    const flowInstance = ref(null)
    const defaultOptions = ref({})
    const processingQueue = ref([])

    // 전처리 옵션 로드 함수
    const loadAvailableNodes = async () => {
      isNodesLoading.value = true
      try {
        // 백엔드 API 엔드포인트 호출
        const response = await fetch('http://localhost:8000/api/msa5/nodes')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        
        console.log('전처리 옵션 응답 데이터:', data)
        
        // 백엔드에서 받은 노드 옵션 설정
        availableNodes.value = data.options || []
        defaultOptions.value = data.defaultOptions || {}

        console.log('로드된 전처리 노드:', availableNodes.value)
        console.log('로드된 기본 옵션:', defaultOptions.value)

        // 로드된 노드 기반으로 초기 elements 설정
        elements.value = [
          { id: 'start', type: 'start', position: { x: 50, y: 50 }, data: { label: '시작' } },
          { id: 'end', type: 'end', position: { x: 650, y: 400 }, data: { label: '종료' } }
        ]

      } catch (error) {
        console.error('전처리 옵션을 불러오는 중 오류 발생:', error)
        statusMessage.value = '전처리 옵션을 불러올 수 없습니다. 백엔드 서버에 연결하세요.'
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
        
        // 백엔드 연결 실패 시 빈 상태로 유지
        availableNodes.value = []
        defaultOptions.value = {}
        
        // 초기 elements 설정
        elements.value = [
          { id: 'start', type: 'start', position: { x: 50, y: 50 }, data: { label: '시작' } },
          { id: 'end', type: 'end', position: { x: 650, y: 400 }, data: { label: '종료' } }
        ]
      } finally {
        isNodesLoading.value = false
      }
    }

    const handleImageUpdate = (event) => {
      console.log('[MSA5 handleImageUpdate] 이벤트 수신 타입:', event.type);
      
      // 이벤트에서 이미지 URL 추출 시도
      let imageUrl = null;
      
      if (event.detail) {
        console.log('[MSA5] 이벤트 detail 키:', Object.keys(event.detail));
        // 일반적인 imageUrl 찾기
        if (event.detail.imageUrl) {
          imageUrl = event.detail.imageUrl;
        }
        // 다른 가능한 속성 이름들 확인
        else if (event.detail.image) {
          imageUrl = event.detail.image;
        }
        else if (event.detail.url) {
          imageUrl = event.detail.url;
        }
        else if (event.detail.src) {
          imageUrl = event.detail.src;
        }
      }
      
      // 이벤트 자체에 이미지 속성이 있는지 확인
      if (!imageUrl && event.image) {
        imageUrl = event.image;
      }
      
      if (!imageUrl && event.imageUrl) {
        imageUrl = event.imageUrl;
      }
      
      // 이미지 URL을 찾았으면 직접 처리 함수 호출
      if (imageUrl) {
        console.log('[MSA5] 이벤트에서 이미지 URL 추출 성공');
        handleDirectImageUpdate(imageUrl);
      } else {
        console.warn('[MSA5] 이벤트에서 이미지 URL을 찾을 수 없음:', event);
      }
    }

    const clearProcessedImages = () => {
      Object.keys(processedImages).forEach(key => delete processedImages[key])
      processingStatus.value = 'idle'
      hasOutput.value = false
    }

    const processStart = async () => {
      if (!inputImage.value) return

      showStatusMessage.value = true
      statusMessage.value = '워크플로우 처리 시작...'
      processingStatus.value = 'processing'

      // processedImages 초기화
      Object.keys(processedImages).forEach(key => delete processedImages[key])
      processedImages['start'] = inputImage.value

      const workflow = findProcessingPath()
      if (!workflow || workflow.length === 0) {
        console.error('No valid workflow path found')
        processingStatus.value = 'error'
        showStatusMessage.value = true
        statusMessage.value = '유효한 워크플로우 경로가 없습니다. 시작부터 종료까지 연결된 경로를 만들어주세요.'
        setTimeout(() => { showStatusMessage.value = false }, 5000)
        return
      }

      console.log('Processing workflow path:', workflow)

      await processWorkflow()
    }

    const findProcessingPath = () => {
      const connections = elements.value.filter(el => el.type === 'smoothstep')
      const nodes = elements.value.filter(el => el.type !== 'smoothstep')
      
      const graph = {}
      for (const node of nodes) {
        graph[node.id] = []
      }
      
      for (const conn of connections) {
        const source = conn.source
        const target = conn.target
        
        if (!graph[source]) graph[source] = []
        graph[source].push(target)
      }
      
      const path = []
      const visited = new Set()
      const visiting = new Set()
      
      const mergeNodes = nodes.filter(node => 
        node.type === 'merge' || 
        (node.data && node.data.id === 'merge')
      ).map(node => node.id)
      
      const incomingEdges = {}
      for (const node of nodes) {
        incomingEdges[node.id] = 0
      }
      
      for (const conn of connections) {
        const target = conn.target
        incomingEdges[target] = (incomingEdges[target] || 0) + 1
      }
      
      const findPathDFS = (nodeId) => {
        if (visiting.has(nodeId)) {
          console.error('순환 참조 발견:', nodeId)
          return false
        }
        
        if (visited.has(nodeId)) return true
        
        visiting.add(nodeId)
        
        const children = graph[nodeId] || []
        for (const child of children) {
          if (!findPathDFS(child)) return false
        }
        
        visiting.delete(nodeId)
        visited.add(nodeId)
        
        path.unshift(nodeId)
        
        return true
      }
      
      if (!findPathDFS('start')) {
        console.error('순환 참조가 있어 유효한 경로를 찾을 수 없습니다.')
        return null
      }
      
      if (!visited.has('end')) {
        console.error('시작부터 종료까지의 경로가 없습니다.')
        return null
      }
      
      let finalPath = []
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i]
        
        if (mergeNodes.includes(nodeId)) {
          const inputNodeIds = connections
            .filter(conn => 
              conn.target === nodeId && 
              ['input-lefttop', 'input-leftbottom', 'input-righttop'].includes(conn.targetHandle)
            )
            .map(conn => conn.source)
          
          const allInputsProcessed = inputNodeIds.every(inputId => 
            finalPath.includes(inputId) || inputId === 'start'
          )
          
          if (allInputsProcessed) {
            finalPath.push(nodeId)
          } else {
            path.push(nodeId)
          }
        } else {
          finalPath.push(nodeId)
        }
      }
      
      return finalPath
    }

    const processWorkflow = async () => {
      try {
        console.log('워크플로우 처리 시작')

        processingQueue.value = []

        const startNode = elements.value.find(node => node.type === 'start')
        console.log('시작 노드:', startNode)

        if (!startNode) {
          throw new Error('시작 노드를 찾을 수 없습니다')
        }

        const startEdges = elements.value.filter(edge => edge.type === 'smoothstep' && edge.source === startNode.id)
        console.log('시작 노드의 출력 엣지:', startEdges)

        const startImage = processedImages[startNode.id]
        console.log('시작 노드의 입력 이미지:', startImage)

        if (!startImage) {
          throw new Error('입력 이미지가 없습니다')
        }

        console.log('시작 노드 처리 완료')

        processingQueue.value.push(...startEdges)
        console.log('처리 큐 초기화:', processingQueue.value)

        while (processingQueue.value.length > 0) {
          const edge = processingQueue.value.shift()
          console.log('현재 처리 중인 엣지:', edge)

          const sourceNode = elements.value.find(node => node.id === edge.source)
          const targetNode = elements.value.find(node => node.id === edge.target)

          console.log('소스 노드:', sourceNode)
          console.log('타겟 노드:', targetNode)

          if (!sourceNode || !targetNode) {
            console.warn('엣지의 소스 또는 타겟 노드를 찾을 수 없습니다:', edge)
            continue
          }

          if (processedImages[targetNode.id]) {
             console.log(`타겟 노드 ${targetNode.id}는 이미 처리되었습니다. 건너니다.`);
             continue;
          }

          const sourceImage = processedImages[sourceNode.id]
          console.log('소스 노드의 출력 이미지:', sourceImage)

          if (!sourceImage) {
            console.warn('소스 노드의 출력 이미지가 없습니다:', sourceNode.id)
            if (targetNode.type !== 'merge') {
               console.error(`소스 노드 ${sourceNode.id}의 이미지가 없어 ${targetNode.id} 처리를 진행할 수 없습니다.`);
            } else {
               console.log(`병합 노드 ${targetNode.id}는 소스 ${sourceNode.id}의 이미지를 기다립니다.`);
           }
           continue
          }

          console.log('타겟 노드 처리 시작:', targetNode.data.id)
          let processedImage
          if (targetNode.data.id === 'merge') {
            processedImage = await processMergeNode(targetNode);
            if (!processedImage) {
               console.log(`병합 노드 ${targetNode.id} 처리가 아직 준비되지 않았습니다.`);
               continue;
            }
          } else if (targetNode.type === 'end') {
             processedImage = sourceImage;
             console.log('종료 노드 도달');
          } else {
            processedImage = await processImage(targetNode, sourceImage)
          }
          console.log('타겟 노드 처리 완료:', targetNode.data.id)

          processedImages[targetNode.id] = processedImage
          console.log('처리된 이미지 저장:', targetNode.id)

          if (targetNode.type !== 'end') {
            const targetEdges = elements.value.filter(e => e.type === 'smoothstep' && e.source === targetNode.id);
            targetEdges.forEach(tEdge => {
                if (!processingQueue.value.some(qEdge => qEdge.id === tEdge.id)) {
                    processingQueue.value.push(tEdge);
                }
            });
            console.log('새로운 엣지 큐에 추가:', targetEdges);
          }
        }

        console.log('워크플로우 처리 완료')
        console.log('최종 처리된 이미지들:', processedImages)

        const finalImage = processedImages['end']
        console.log('최종 이미지:', finalImage)

        if (finalImage) {
          console.log('MSA6로 이미지 전달:', finalImage.substring(0, 50) + '...');
          
          // MSA6로 이미지 전달 이벤트
          const imageProcessedEvent = new CustomEvent('msa5-image-processed', {
            detail: { 
              imageUrl: finalImage,
              timestamp: new Date().toISOString()
            }
          });
          
          window.dispatchEvent(imageProcessedEvent);
          console.log('MSA6로 이미지 이벤트 발송 완료');
          
          hasOutput.value = true;
        } else {
          console.warn('최종 이미지가 없습니다')
          hasOutput.value = false;
        }

        processingStatus.value = 'completed'
        showStatusMessage.value = true
        statusMessage.value = '워크플로우 처리가 완료되었습니다!'

        setTimeout(() => { showStatusMessage.value = false }, 3000)
      } catch (error) {
        console.error('워크플로우 처리 중 오류 발생:', error)
        processingStatus.value = 'error'
        showStatusMessage.value = true
        statusMessage.value = `워크플로우 처리 중 오류 발생: ${error.message || '알 수 없는 오류'}`
      }
    }

    const processImage = async (node, inputImg) => {
      const nodeType = node.data.id
      console.log(`이미지 처리 시작 - 노드 타입: ${nodeType}`)

      try {
        // 파라미터 전처리
        const processedParams = {};
        if (node.data.params) {
          Object.entries(node.data.params).forEach(([key, paramObj]) => {
            // Object.prototype.hasOwnProperty 대신 Object.hasOwn 사용
            processedParams[key] = Object.hasOwn(paramObj, 'value') ? paramObj.value : paramObj;
          });
        }

        console.log('이미지 처리 시작:', { 
          nodeType, 
          originalParams: node.data.params,
          processedParams: processedParams 
        });
        
        // FormData 생성
        const formData = new FormData();
        
        // 이미지가 File 객체인 경우 직접 사용, URL인 경우 fetch로 가져옴
        if (inputImg instanceof File) {
          formData.append('image', inputImg);
        } else if (inputImg instanceof Blob) {
          formData.append('image', inputImg, 'image.png');
        } else if (typeof inputImg === 'string') {
          if (inputImg.startsWith('blob:') || inputImg.startsWith('data:')) {
            const response = await fetch(inputImg);
            const blob = await response.blob();
            formData.append('image', blob, 'image.png');
          } else {
            throw new Error('지원하지 않는 이미지 형식입니다.');
          }
        } else {
          throw new Error('유효하지 않은 이미지 형식입니다.');
        }

        // 노드 타입과 처리된 파라미터 추가
        formData.append('nodeType', nodeType);
        formData.append('params', JSON.stringify(processedParams));

        console.log('API 요청 데이터:', {
          nodeType,
          params: processedParams
        });

        // API 호출
        const response = await fetch('http://localhost:8000/api/msa5/process', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API 오류 응답:', errorText);
          throw new Error(`API 오류 (${response.status}): ${errorText}`);
        }

        // 응답이 이미지인 경우
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('image/')) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }

        // JSON 응답인 경우
        const result = await response.json();
        if (result.status === 'success' && result.image) {
          return result.image;
        }

        throw new Error(result.message || '이미지 처리 실패');
      } catch (error) {
        console.error('이미지 처리 실패:', error);
        throw error;
      }
    }

    const processMergeNode = async (node) => {
        try {
          const connections = elements.value.filter(el =>
            el.type === 'smoothstep' && el.target === node.id &&
            ['input-lefttop', 'input-leftbottom', 'input-righttop'].includes(el.targetHandle)
          );

          console.log(`병합 노드 ${node.id} 입력 연결:`, connections);

          const inputImages = [];
          let allInputsReady = true;
          for (const conn of connections) {
            const sourceNodeId = conn.source;
            const sourceImage = processedImages[sourceNodeId];

            if (!sourceImage) {
              console.log(`병합 노드 ${node.id}: 소스 ${sourceNodeId}의 이미지가 아직 준비되지 않았습니다.`);
              allInputsReady = false;
              break;
            }
            inputImages.push(sourceImage);
          }

          if (!allInputsReady) {
            return null;
          }

          console.log(`병합 노드 ${node.id} 입력 이미지 개수: ${inputImages.length}`);

          if (inputImages.length === 0) {
            showStatusMessage.value = true;
            statusMessage.value = '병합할 이미지가 없습니다.';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
            return null;
          }

          // 병합 파라미터 처리
          const processedParams = {};
          if (node.data.params) {
            Object.entries(node.data.params).forEach(([key, paramObj]) => {
              // Object.prototype.hasOwnProperty 대신 Object.hasOwn 사용
              processedParams[key] = Object.hasOwn(paramObj, 'value') ? paramObj.value : paramObj;
            });
          }
          
          // FormData 생성
          const formData = new FormData();
          
          // 이미지 추가
          for (let i = 0; i < inputImages.length; i++) {
            const image = inputImages[i];
            if (image.startsWith('blob:') || image.startsWith('data:')) {
              const response = await fetch(image);
              const blob = await response.blob();
              formData.append('images', blob, `image_${i}.png`);
            }
          }
          
          // 파라미터 JSON 추가
          formData.append('params', JSON.stringify(processedParams));
          
          console.log(`병합 노드 ${node.id} 파라미터:`, processedParams);

          // API 호출
          const response = await fetch(`http://localhost:8000/api/msa5/process/merge`, {
              method: 'POST',
              body: formData
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('API 오류 응답:', errorText);
            throw new Error(`API 오류 (${response.status}): ${errorText}`);
          }

          const contentType = response.headers.get('Content-Type');
          if (contentType && contentType.includes('image/')) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
          }

          const result = await response.json();
          if (result.status === 'success' && result.image) {
            return result.image;
          }

          throw new Error(result.message || '이미지 병합 실패');
        } catch (error) {
          console.error('이미지 병합 오류:', error);
          throw error;
        }
    }

    const onDragStart = (event, node) => {
      event.dataTransfer.setData('application/vueflow', JSON.stringify(node))
      event.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (event) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }

    const onDrop = (event) => {
      event.preventDefault()

      const bounds = event.currentTarget.getBoundingClientRect()
      const position = flowInstance.value.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      })

      const nodeData = JSON.parse(event.dataTransfer.getData('application/vueflow'))

      // 사용되지 않는 nodeParams 제거
      // const nodeParams = availableNodes.value.find(n => n.id === nodeData.id)?.params || {}

      const newNode = {
        id: `${nodeData.id}-${Date.now()}`,
        type: nodeData.id === 'merge' ? 'merge' : 'custom',
        position,
        data: {
          id: nodeData.id,
          label: nodeData.label,
          icon: nodeData.icon,
          params: getDefaultParams(nodeData.id, defaultOptions.value)
        }
      }
      console.log("Dropped new node:", newNode)

      elements.value.push(newNode)
    }

    const onConnect = (params) => {
      const { source, target } = params
      if (isValidConnection(source, target)) {
        elements.value.push({
          id: `e${source}-${target}`,
          source,
          target,
          type: 'smoothstep'
        })
        if (source === 'start') hasInput.value = true
        if (target === 'end') hasOutput.value = true
      }
    }

    const onNodeDragStop = (event) => {
      console.log('Node dragged:', event.node.id)
    }

    const onNodeClick = (event) => {
      const { node } = event
      if (node && node.type && node.type !== 'smoothstep' && node.data && node.id !== 'start' && node.id !== 'end') {
         if (!node.data.params) {
           console.warn(`Node ${node.id} data is missing params object. Initializing.`)
           node.data.params = getDefaultParams(node.data.id, defaultOptions.value)
         }
         selectedNode.value = node
         console.log('Node selected:', selectedNode.value)
      } else {
         selectedNode.value = null
         console.log('Node deselected or invalid node clicked.')
      }
    }

    const isValidConnection = (source, target) => {
      if (source === target) return false
      if (source === 'end') return false
      if (target === 'start') return false
      
      const existingConnection = elements.value.find(
        el => el.type === 'smoothstep' && 
        ((el.source === source && el.target === target) || 
         (el.source === target && el.target === source))
      )
      
      return !existingConnection
    }

    const toggleMaximize = () => {
      isMaximized.value = !isMaximized.value
    }

    const onInit = (instance) => {
      flowInstance.value = instance
      console.log('VueFlow initialized')
    }

    const onPaneReady = (instance) => {
      console.log('VueFlow pane ready')
      if (instance) {
        instance.fitView({ padding: 0.4, duration: 200 })
        setTimeout(() => {
          instance.zoomTo(0.9)
        }, 300)
      }
    }

    const openImagePreview = (imageUrl) => {
      previewImageUrl.value = imageUrl
      document.addEventListener('keydown', handleEscKey)
    }

    const closeImagePreview = () => {
      previewImageUrl.value = null
      document.removeEventListener('keydown', handleEscKey)
    }

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        closeImagePreview()
      }
    }

    const getNodeIcon = (nodeId) => {
      const icons = {
        resize: 'fas fa-expand',
        crop: 'fas fa-crop',
        rotate: 'fas fa-sync',
        flip: 'fas fa-exchange-alt',
        brightness: 'fas fa-sun',
        contrast: 'fas fa-adjust',
        blur: 'fas fa-blur',
        sharpen: 'fas fa-cut',
        grayscale: 'fas fa-image',
        threshold: 'fas fa-tachometer-alt',
        edge: 'fas fa-border-style',
        hue: 'fas fa-palette',
        merge: 'fas fa-object-group'
      }
      return icons[nodeId] || 'fas fa-image'
    }

    const getDefaultParams = (nodeId, defaults) => {
      // 백엔드에서 받은 기본 옵션만 사용
      const nodeDefaults = defaults[nodeId] || {}
      const params = {}

      console.log(`${nodeId} 노드의 기본값:`, nodeDefaults);

      // 백엔드에서 받은 기본값을 UI 파라미터 구조로 변환
      switch (nodeId) {
        case 'resize':
          params.width = { label: '너비', value: nodeDefaults.width, min: 1, max: 5000, step: 1 }
          params.height = { label: '높이', value: nodeDefaults.height, min: 1, max: 5000, step: 1 }
          break
        case 'crop':
          params.x = { label: 'X 좌표', value: nodeDefaults.x, min: 0, max: 5000, step: 1 }
          params.y = { label: 'Y 좌표', value: nodeDefaults.y, min: 0, max: 5000, step: 1 }
          params.width = { label: '너비', value: nodeDefaults.width, min: 1, max: 5000, step: 1 }
          params.height = { label: '높이', value: nodeDefaults.height, min: 1, max: 5000, step: 1 }
          break
        case 'rotate':
          params.angle = { label: '각도', value: nodeDefaults.angle, min: -360, max: 360, step: 1 }
          break
        case 'flip':
          params.direction = {
            label: '방향',
            value: nodeDefaults.direction,
            options: ['horizontal', 'vertical', 'both']
          }
          break
        case 'brightness':
          params.factor = { label: '밝기', value: nodeDefaults.factor, min: 0, max: 3, step: 0.1 }
          break
        case 'contrast':
          params.factor = { label: '대비', value: nodeDefaults.factor, min: 0, max: 3, step: 0.1 }
          break
        case 'blur':
          params.radius = { label: '반경', value: nodeDefaults.radius, min: 0, max: 20, step: 1 }
          break
        case 'sharpen':
          params.radius = { label: '반경', value: nodeDefaults.radius, min: 0, max: 20, step: 1 }
          params.percent = { label: '강도(%)', value: nodeDefaults.percent, min: 0, max: 500, step: 10 }
          break
        case 'threshold':
          params.threshold = { label: '임계값', value: nodeDefaults.threshold, min: 0, max: 255, step: 1 }
          break
        case 'edge':
          params.method = {
            label: '방법',
            value: nodeDefaults.method,
            options: ['canny', 'sobel', 'prewitt', 'laplacian']
          }
          params.low_threshold = { label: '낮은 임계값', value: nodeDefaults.low_threshold, min: 0, max: 255, step: 1 }
          params.high_threshold = { label: '높은 임계값', value: nodeDefaults.high_threshold, min: 0, max: 255, step: 1 }
          break
        case 'hue':
          params.hue_factor = { label: '색조 변화량', value: nodeDefaults.hue_factor, min: -180, max: 180, step: 1 }
          break
        case 'grayscale':
          params.enabled = { label: '활성화', value: nodeDefaults.enabled, type: 'boolean' }
          break
        case 'invert':
          params.enabled = { label: '활성화', value: nodeDefaults.enabled, type: 'boolean' }
          break
        case 'merge':
          params.merge_type = { 
            label: '병합 방식', 
            value: nodeDefaults.merge_type,
            options: ['horizontal', 'vertical', 'grid', 'overlay']
          }
          params.spacing = { label: '간격', value: nodeDefaults.spacing, min: 0, max: 100, step: 1 }
          break
        default:
          console.warn(`Node type "${nodeId}" has no default parameters defined.`)
      }

      return params
    }

    const requestMSA1Image = () => {
      console.log('[MSA5] MSA1에 직접 이미지 요청 시도...');
      
      // 이미지가 이미 있으면 요청하지 않음
      if (inputImage.value) {
        console.log('[MSA5] 이미 이미지가 있어 요청 취소');
        return;
      }
      
      // 글로벌 이벤트 발송
      window.dispatchEvent(new CustomEvent('request-msa1-image', {
        detail: { requestor: 'MSA5', timestamp: new Date().toISOString() }
      }));
      
      // DOM에서 MSA1 이미지 직접 찾기 시도
      try {
        const msa1ImageElement = document.querySelector('.msa1-image img, .msa1 .image-container img, #msa1-image');
        if (msa1ImageElement && msa1ImageElement.src) {
          console.log('[MSA5] DOM에서 MSA1 이미지 직접 발견:', msa1ImageElement.src.substring(0, 30) + '...');
          handleDirectImageUpdate(msa1ImageElement.src);
          return;
        }
      } catch (err) {
        console.warn('[MSA5] DOM에서 MSA1 이미지 검색 실패:', err);
      }
      
      // window 객체에서 이미지 찾기
      if (window.msa1ImageUrl) {
        console.log('[MSA5] 전역 변수에서 MSA1 이미지 발견');
        handleDirectImageUpdate(window.msa1ImageUrl);
      }
    }
    
    // 새로운 함수: 이미지를 직접 업데이트 
    const handleDirectImageUpdate = (imageUrl) => {
      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image')) {
        console.warn('[MSA5] 유효하지 않은 이미지 URL:', typeof imageUrl);
        return;
      }
      
      console.log('[MSA5] 직접 이미지 업데이트:', imageUrl.substring(0, 30) + '...');
      
      // processedImages 초기화
      Object.keys(processedImages).forEach(key => delete processedImages[key]);
      
      // 이미지 설정
      inputImage.value = imageUrl;
      processedImages['start'] = imageUrl;
      hasInput.value = true;
      
      console.log('[MSA5] 직접 이미지 업데이트 완료, 상태 업데이트됨');
      
      // DOM에서 시작 노드 이미지 강제 갱신을 위한 트릭
      setTimeout(() => {
        const startNodeImage = document.querySelector('.start-node .node-image img');
        if (startNodeImage) {
          startNodeImage.src = imageUrl;
          console.log('[MSA5] 시작 노드 이미지 DOM 직접 업데이트 완료');
        }
      }, 100);
    }

    onMounted(() => {
      console.log('=========== MSA5 COMPONENT MOUNTED ==========');
      loadAvailableNodes();
      
      // 즉시 MSA1에 현재 이미지 요청
      requestMSA1Image();
      
      // 모든 가능한 이벤트 리스닝
      const possibleEvents = [
        'msa1-image-selected', 
        'msa1-image-update', 
        'image-selected', 
        'msa1-clipboard-image',
        'paste-image',
        'image-pasted',
        'imageSelected',
        'image-update'
      ];
      
      possibleEvents.forEach(eventName => {
        window.addEventListener(eventName, (event) => {
          console.log(`[MSA5] ${eventName} 이벤트 감지됨:`, event);
          handleImageUpdate(event);
        });
        console.log(`[MSA5] ${eventName} 이벤트 리스너 등록 완료`);
      });
      
      // MSA4 이벤트 리스너도 추가
      window.addEventListener('msa4-image-selected', handleImageUpdate);
      
      // 직접 window.msa1Image 폴링 (전역변수로 저장된 경우)
      const checkGlobalImage = setInterval(() => {
        if (window.msa1Image && !inputImage.value) {
          console.log('[MSA5] 전역 MSA1 이미지 발견:', typeof window.msa1Image);
          handleDirectImageUpdate(window.msa1Image);
          clearInterval(checkGlobalImage);
        }
      }, 500);
      
      // 고전적인 이벤트 버스 접근법 - 전역 이벤트 발송
      window.dispatchEvent(new CustomEvent('request-current-image', {
        detail: { component: 'MSA5', timestamp: new Date().toISOString() }
      }));
      
      // 이미지 폴링 - 다른 컴포넌트에서 수동으로 확인
      setTimeout(requestMSA1Image, 1000);
      setTimeout(requestMSA1Image, 3000);
      
      // 페이지 paste 이벤트 리스닝
      document.addEventListener('paste', (e) => {
        console.log('[MSA5] 페이지 paste 이벤트 감지');
        if (e.clipboardData && e.clipboardData.items) {
          const items = e.clipboardData.items;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const blob = items[i].getAsFile();
              const reader = new FileReader();
              reader.onload = (event) => {
                console.log('[MSA5] 클립보드에서 이미지 로드 완료');
                handleDirectImageUpdate(event.target.result);
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      });
    })

    onUnmounted(() => {
      // 이벤트 리스너 해제
      window.removeEventListener('msa4-image-selected', handleImageUpdate);
      window.removeEventListener('msa1-image-selected', handleImageUpdate);
    })

    return {
      isMaximized,
      hasInput,
      hasOutput,
      elements,
      selectedNode,
      inputImage,
      processedImages,
      processingStatus,
      previewImageUrl,
      statusMessage,
      showStatusMessage,
      availableNodes,
      isNodesLoading,
      flowInstance,
      handleImageUpdate,
      clearProcessedImages,
      processStart,
      onDragStart,
      onDragOver,
      onDrop,
      onConnect,
      onNodeDragStop,
      onNodeClick,
      isValidConnection,
      toggleMaximize,
      onInit,
      onPaneReady,
      openImagePreview,
      closeImagePreview,
      getNodeIcon,
      getDefaultParams
    }
  }
}
</script>

<style scoped>
.msa-component {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #1e293b;
}

.header-right {
  display: flex;
  gap: 0.5rem;
}

.process-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
}

.process-btn:hover {
  background: #7c3aed;
}

.process-btn:disabled {
  background: #c4b5fd;
  cursor: not-allowed;
}

.maximize-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.maximize-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.workflow-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100% - 4rem); /* Account for header */
}

.node-palette {
  width: 200px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.palette-header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #1e293b;
  flex-shrink: 0;
}

.palette-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.palette-node {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: move;
  transition: all 0.2s ease;
}

.palette-node:hover {
  border-color: #8b5cf6;
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.1);
}

.workflow-area {
  flex: 1;
  position: relative;
  background: #f8fafc;
  overflow: hidden;
  height: 100%;
  cursor: default;
}

.workflow-area.dragging {
  cursor: move;
}

.workflow-node,
.start-node,
.end-node {
  background: white;
  border-radius: 4px;
  padding: 1rem;
  min-width: 200px;
  border: 1px solid rgba(124, 58, 237, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.handle {
  width: 24px;
  height: 24px;
  background: #8b5cf6;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border: 3px solid white;
  box-shadow: 0 0 0 3px #8b5cf6;
  cursor: crosshair;
  z-index: 10;
  transition: all 0.2s ease;
}

.handle.source {
  right: -12px;
}

.handle.target {
  left: -12px;
}

.handle:hover {
  background: #7c3aed;
  box-shadow: 0 0 0 4px #7c3aed;
  transform: translateY(-50%) scale(1.1);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.node-params {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.param-item label {
  font-size: 0.8rem;
  color: #64748b;
}

.param-item input {
  padding: 0.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.9rem;
}

.start-node {
  background: #10B981;
  color: white;
  border-color: #059669;
}

.end-node {
  background: #EF4444;
  color: white;
  border-color: #DC2626;
}

.msa-component.maximized {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  z-index: 9999;
}

.msa-component.maximized .workflow-container {
  height: calc(100vh - 4rem);
}

.options-panel {
  width: 250px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.options-panel.hidden {
  transform: translateX(100%);
}

.options-panel.visible {
  transform: translateX(0);
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.panel-content {
  padding: 1rem;
  overflow-y: auto;
}

.param-item {
  margin-bottom: 1rem;
}

.param-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #1e293b;
}

.param-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.9rem;
}

.param-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}

select.param-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 2rem;
}

:deep(.vue-flow__handle) {
  width: 11px !important;
  height: 11px !important;
  border-radius: 50% !important;
  background: #8b5cf6 !important;
  border: 2px solid white !important;
  box-shadow: 0 0 0 2px #8b5cf6 !important;
}

:deep(.vue-flow__handle.connectable) {
  cursor: crosshair !important;
}

:deep(.vue-flow__handle:hover) {
  background: #7c3aed !important;
  box-shadow: 0 0 0 3px #7c3aed !important;
}

:deep(.vue-flow__minimap) {
  position: absolute;
  right: 20px;
  bottom: 20px;
  background-color: white;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  width: 200px !important;
  height: 150px !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 5;
}

:deep(.vue-flow__minimap svg) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.vue-flow__minimap-mask) {
  fill: rgba(139, 92, 246, 0.1);
  stroke: #8b5cf6;
  stroke-width: 2;
  pointer-events: all;
  cursor: move;
}

:deep(.vue-flow__minimap-node) {
  fill: #8b5cf6;
  stroke: white;
  stroke-width: 1;
}

:deep(.vue-flow__minimap-edge) {
  stroke: #8b5cf6;
  stroke-width: 1;
}

.custom-minimap {
  position: absolute !important;
  right: 20px !important;
  bottom: 20px !important;
  width: 200px !important;
  height: 150px !important;
  z-index: 100 !important;
  user-select: none !important;
}

.node-image {
  margin-top: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-image:hover {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  transform: scale(1.02);
}

.node-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* 이미지 프리뷰 팝업 스타일 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(5px);
  transform: translateZ(0); /* 새 레이어로 렌더링하여 성능 향상 */
}

.image-preview-container {
  position: relative;
  width: 90vw;
  max-width: 1400px;
  max-height: 95vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 35px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.preview-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
}

.preview-content {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  max-height: calc(95vh - 70px);
}

.preview-image {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  min-width: 500px; /* 최소 너비 설정 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.close-preview-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.2rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-preview-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
  transform: scale(1.05);
}

/* 상태 메시지 스타일 */
.status-message {
  position: absolute;
  top: 4rem;
  left: 50%;
  transform: translateX(-50%);
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  animation: fade-in-out 3s forwards;
  max-width: 90%;
}

.status-message i {
  font-size: 1.25rem;
}

@keyframes fade-in-out {
  0% { opacity: 0; transform: translate(-50%, -10px); }
  10% { opacity: 1; transform: translate(-50%, 0); }
  80% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -10px); }
}

/* 병합 노드 스타일 */
.merge-node {
  width: 180px;
  height: auto;
  background: white;
  border-radius: 4px;
  position: relative;
  border: 1px solid rgba(124, 58, 237, 0.2);
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.merge-node .node-header {
  transform: none;
  width: 100%;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.5rem;
}

.merge-node .node-image {
  transform: none;
  width: 100%;
  height: 120px;
  margin: 0;
}

/* 병합 노드 핸들 위치 조정 - 꼭지점에 배치 */
.merge-node :deep(.vue-flow__handle) {
  width: 11px !important;
  height: 11px !important;
}

/* 좌상단 */
.merge-node :deep(.vue-flow__handle.target#input-lefttop) {
  left: -5px;
  top: 10px;
}

/* 좌하단 */
.merge-node :deep(.vue-flow__handle.target#input-leftbottom) {
  left: -5px;
  top: unset;
  bottom: 10px;
}

/* 우상단 */
.merge-node :deep(.vue-flow__handle.target#input-righttop) {
  right: -5px;
  left: unset;
  top: 10px;
}

/* 우하단 */
.merge-node :deep(.vue-flow__handle.source#output-rightbottom) {
  right: -5px;
  left: unset;
  top: unset;
  bottom: 10px;
}

/* 다이아몬드 프리뷰 스타일 복원 */
.diamond-preview {
  width: 30px;
  height: 30px;
  background: white;
  transform: none;
  border: 2px solid #8b5cf6;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 4px;
}

.diamond-preview i {
  transform: none;
  color: #8b5cf6;
  font-size: 0.9rem;
}

/* 전처리 노드 래퍼 컨테이너 추가 */
.preprocessing-nodes-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* 전처리 노드 컨테이너 스크롤 개선 */
.preprocessing-nodes-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1rem;
  overflow-y: scroll;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 스크롤바 스타일링 */
.preprocessing-nodes-container::-webkit-scrollbar {
  width: 6px;
}

.preprocessing-nodes-container::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.preprocessing-nodes-container::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}

/* 병합 노드 섹션 개선 */
.merge-palette-section {
  padding: 1rem;
  background: rgba(139, 92, 246, 0.05);
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

/* 병합 노드 컨테이너 스타일 복원 */
.merge-node-container {
  background: white;
  border-radius: 6px;
  border: 1px solid rgba(124, 58, 237, 0.3);
  padding: 1rem;
  cursor: move;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 2px 4px rgba(124, 58, 237, 0.1);
}

.merge-node-container:hover {
  border-color: #8b5cf6;
  box-shadow: 0 4px 8px rgba(139, 92, 246, 0.2);
  transform: translateY(-2px);
}

/* 병합 노드 헤더 스타일 복원 */
.merge-node-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  color: #7c3aed;
}

.merge-node-desc {
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
}
</style> 