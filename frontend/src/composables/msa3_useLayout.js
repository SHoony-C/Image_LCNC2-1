/**
 * Composable for MSA3 layout initialization and utility functions.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.layoutInitialized - Layout initialized flag ref
 * @param {Function} deps.getEl - Function to get the component root element ($el)
 * @returns Layout functions
 */
export function useLayout(deps) {
  const { layoutInitialized, getEl } = deps

  // 디바운스 함수 - 리사이즈 최적화
  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // 레이아웃 초기화 함수
  function initializeLayout() {
    try {
      // 컨테이너 엘리먼트 확인
      const container = getEl()
      if (!container) {
        layoutInitialized.value = true // 오류가 발생해도 초기화된 것으로 처리
        return false
      }

      // 타입 확인 및 안전하게 처리
      if (typeof container.querySelector !== 'function') {
        layoutInitialized.value = true // 오류가 발생해도 초기화된 것으로 처리
        return false
      }

      // 안전하게 클래스 추가
      try {
        if (container.classList) {
          container.classList.add('initialized')
        } else if (container.className !== undefined) {
          // 대체 방법으로 className 속성 사용
          container.className = (container.className + ' initialized').trim()
        }
      } catch (classError) {
        // console.error('MSA3: 클래스 추가 중 오류:', classError)
      }

      // content-area 엘리먼트 확인 - try/catch로 안전하게 처리
      try {
        const contentArea = container.querySelector('.content-area')
        if (contentArea) {
          if (contentArea.classList) {
            contentArea.classList.add('initialized')
          } else if (contentArea.className !== undefined) {
            contentArea.className = (contentArea.className + ' initialized').trim()
          }
        }
      } catch (contentError) {
        // console.error('MSA3: content-area 처리 중 오류:', contentError)
      }

      layoutInitialized.value = true
      return true
    } catch (error) {
      layoutInitialized.value = true // 오류가 발생해도 초기화된 것으로 처리
      return false
    }
  }

  return {
    debounce,
    initializeLayout
  }
}
