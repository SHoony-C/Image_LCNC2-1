import { ref, reactive, computed } from 'vue'

import { useNodeProcessor } from './msa5_useNodeProcessor'
import { useWorkflowHistory } from './msa5_useWorkflowHistory'
import { useWorkflowValidation } from './msa5_useWorkflowValidation'
import { useWorkflowPersistence } from './msa5_useWorkflowPersistence'
import { useWorkflowExecution } from './msa5_useWorkflowExecution'
import { useDragDrop } from './msa5_useDragDrop'
import { useVueFlow } from './msa5_useVueFlow'
import { useImageManagement } from './msa5_useImageManagement'
import { useUIState } from './msa5_useUIState'
import { useCrossComponent } from './msa5_useCrossComponent'
import { useLifecycle } from './msa5_useLifecycle'

/**
 * Orchestrator composable for MSA5 Image LCNC component.
 * Wires all composables together.
 */
export function useSetup(props) {
  // Core shared state
  const hasInput = ref(false)
  const hasOutput = ref(false)
  const elements = ref([])
  const selectedNode = ref(null)
  const selectedEdge = ref(null)
  const inputImage = ref('')
  const processedImages = reactive({})
  const processingStatus = ref('idle')
  const previewImageUrl = ref(null)
  const availableNodes = ref([])
  const isNodesLoading = ref(true)
  const defaultOptions = ref({})
  const workflowArea = ref(null)
  const canSaveWorkflow = ref(false)

  const filteredNodes = computed(() => {
    return availableNodes.value ? availableNodes.value.filter(n => n && n.id !== 'merge') : []
  })
  const mergeNode = computed(() => {
    return availableNodes.value ? availableNodes.value.find(n => n && n.id === 'merge') : null
  })

  const updateConnections = () => {
    const connections = elements.value.filter(el => el.type === 'smoothstep')
    hasInput.value = connections.some(conn => conn.source === 'start')
    hasOutput.value = connections.some(conn => conn.target === 'end')
  }
  const initializeElements = () => {
    elements.value = [
      { id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: '시작' } },
      { id: 'end', type: 'end', position: { x: 500, y: 300 }, data: { label: '종료' } }
    ]
  }

  // 1. Workflow History
  const { undoStack, redoStack, saveToHistory, undo, redo } = useWorkflowHistory(elements, updateConnections)

  // 2. UI State
  const {
    isMaximized, showStatusMessage, statusMessage, statusType,
    showWorkflowErrorDialog, workflowErrorTitle, workflowErrorMessage, workflowErrorDetails,
    containerRef, toggleMaximize, openImagePreview, closeImagePreview,
    closeWorkflowErrorDialog, setStatusMessage,
    deleteSelectedNode, deleteSelectedEdge, handleKeyDown,
    getNodeSummary, getWorkflowDisplayItems, getNodeCount, getConnectionCount,
    workflowSummaryItems, processedWorkflowItems
  } = useUIState(
    elements, selectedNode, selectedEdge, previewImageUrl,
    saveToHistory, updateConnections, undo, redo,
    canSaveWorkflow, processingStatus
  )

  // 3. Node Processor
  const errorDialogState = {
    showWorkflowErrorDialog, workflowErrorTitle,
    workflowErrorMessage, workflowErrorDetails
  }
  const {
    getDefaultParams, resolveNodeType, processNode, processMergeNode,
    setProcessedImage, revokeAllProcessedImages,
    cleanupDeletedNodeImages, detectImageFormat
  } = useNodeProcessor(elements, processedImages, defaultOptions, errorDialogState)

  // 4. Workflow Validation
  const { validateWorkflow, findProcessingPath } = useWorkflowValidation(elements, inputImage)

  // 5. Workflow Persistence
  const uiStateForPersistence = { showStatusMessage, statusMessage, statusType }
  const {
    savedWorkflows, showSaveWorkflowDialog, workflowName, workflowDescription,
    workflowNameInput, showDuplicateNameDialog, newWorkflowName, newWorkflowNameInput,
    showDuplicateNameError, currentImageTitle,
    calculateImageHash, checkSavedWorkflow, prepareElementsForSave, prepareElementsForLoad,
    openWorkflowSaveDialog, cancelSaveWorkflow, confirmSaveWorkflow,
    saveWorkflowToServer, saveWorkflow, loadWorkflow, loadDefaultWorkflow,
    loadSavedWorkflows, showDuplicateNameWarning, closeDuplicateNameDialog, applyNewName
  } = useWorkflowPersistence(
    elements, inputImage, processedImages, processingStatus,
    uiStateForPersistence, errorDialogState,
    getNodeSummary, initializeElements, getDefaultParams, defaultOptions,
    canSaveWorkflow
  )

  // 6. Image Management
  const persistenceStateForImage = {
    canSaveWorkflow, currentImageTitle, calculateImageHash,
    checkSavedWorkflow, workflowName, workflowDescription
  }
  const {
    setImage, sendImageToMSA6, exportImagesToExternal,
    findSimilarForEndImage, handleMSA6Transfer
  } = useImageManagement(
    elements, inputImage, processedImages,
    uiStateForPersistence, persistenceStateForImage
  )

  // 7. Workflow Execution
  const {
    processingQueue, processStart, processWorkflow
  } = useWorkflowExecution(
    elements, inputImage, processedImages, processingStatus,
    uiStateForPersistence, errorDialogState,
    validateWorkflow, processNode, processMergeNode, sendImageToMSA6,
    canSaveWorkflow, hasOutput
  )

  // 8. VueFlow instance management
  const {
    flowInstance, onInit, onPaneReady, onNodeDragStop,
    onConnect, onNodeClick, onEdgeClick, handleCanvasClick
  } = useVueFlow(
    elements, selectedNode, selectedEdge,
    getDefaultParams, defaultOptions,
    saveToHistory, updateConnections,
    canSaveWorkflow, processingStatus
  )

  // 9. Drag & Drop
  const { onDragStart, onDragOver, onDrop } = useDragDrop(
    elements, selectedNode, flowInstance, workflowArea,
    getDefaultParams, defaultOptions,
    saveToHistory, canSaveWorkflow, processingStatus
  )

  // 10. Cross-Component Communication
  const persistenceStateForCross = { workflowName, prepareElementsForLoad }
  const {
    handleImageUpdate, handleWorkflowFromMSA4, handleWorkflowFromMSA3
  } = useCrossComponent(
    elements, inputImage, processedImages,
    uiStateForPersistence, persistenceStateForCross, setImage
  )

  // 11. Lifecycle (backend loading, mount/unmount)
  useLifecycle({
    availableNodes, isNodesLoading, defaultOptions,
    initializeElements, handleKeyDown,
    handleImageUpdate, handleWorkflowFromMSA4, handleWorkflowFromMSA3,
    loadDefaultWorkflow, loadSavedWorkflows,
  })

  // Return all template bindings
  return {
    isMaximized, toggleMaximize,
    hasInput, hasOutput, elements, selectedNode, selectedEdge,
    inputImage, processedImages, processingStatus,
    previewImageUrl, openImagePreview, closeImagePreview,
    processStart,
    onDragStart, onDragOver, onDrop,
    onInit, onConnect, onNodeClick, onEdgeClick, onNodeDragStop, onPaneReady,
    availableNodes, isNodesLoading, filteredNodes, mergeNode,
    containerRef, workflowArea,
    undo, redo, deleteSelectedNode, deleteSelectedEdge,
    handleKeyDown, handleCanvasClick,
    saveWorkflow, canSaveWorkflow, savedWorkflows, loadWorkflow, openWorkflowSaveDialog,
    showSaveWorkflowDialog, workflowName, workflowDescription,
    workflowNameInput, cancelSaveWorkflow, confirmSaveWorkflow, saveWorkflowToServer,
    getNodeSummary, getNodeCount, getConnectionCount,
    getWorkflowDisplayItems, workflowSummaryItems, processedWorkflowItems,
    exportImagesToExternal, findSimilarForEndImage,
    handleMSA6Transfer, sendImageToMSA6,
    showDuplicateNameDialog, closeDuplicateNameDialog,
    newWorkflowName, newWorkflowNameInput,
    applyNewName, showDuplicateNameWarning, showDuplicateNameError,
    validateWorkflow,
    showWorkflowErrorDialog, workflowErrorTitle,
    workflowErrorMessage, workflowErrorDetails,
    closeWorkflowErrorDialog, statusMessage, statusType, setStatusMessage,
    showStatusMessage,
  }
}
