import axios from 'axios';

/**
 * 사용자 액션 로깅 서비스
 * 
 * 애플리케이션 내 다양한 액션을 로깅하는 기능 제공
 * - 페이지 방문
 * - 버튼 클릭
 * - 기능 사용
 * - 등등
 */
class LogService {
  // 최근 로깅된 액션을 추적하기 위한 캐시
  static recentLogs = new Map();
  
  // 동일 액션 로깅 방지를 위한 쿨다운 시간 (밀리초)
  static COOLDOWN_MS = 2000;
  
  // 에러 발생 시 로깅 기능 자동 비활성화를 위한 변수
  static errorCount = 0;
  static maxErrorCount = 3; // 3번 이상 실패하면 로깅 중단
  static loggingDisabled = false;

  /**
   * 사용자 액션을 로깅합니다
   * @param {string} action - 수행한 액션 (예: "page_visit", "button_click", "process_start")
   * @param {object} details - 액션에 대한 추가 정보 (선택 사항)
   */
  static async logAction(action, details = {}) {
    // 로깅이 비활성화된 경우 아무 작업도 하지 않음
    if (this.loggingDisabled) {
      return false;
    }
    
    try {
      // 중복 로깅 방지 로직
      const actionKey = this.getActionKey(action, details);
      const now = Date.now();
      
      // 동일한 액션이 쿨다운 기간 내에 호출되었는지 확인
      if (this.recentLogs.has(actionKey)) {
        const lastLogTime = this.recentLogs.get(actionKey);
        if (now - lastLogTime < this.COOLDOWN_MS) {
          return false; // 중복 요청 무시
        }
      }
      
      // 액션과 시간 기록
      this.recentLogs.set(actionKey, now);
      
      // 맵 크기 관리 (최대 50개 항목 유지)
      if (this.recentLogs.size > 50) {
        const oldestKey = this.recentLogs.keys().next().value;
        this.recentLogs.delete(oldestKey);
      }
      
      // 로컬 스토리지에서 사용자 정보 가져오기
      const userStr = localStorage.getItem('user');
      let username = 'anonymous';
      let department = null;
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          username = user.username || 'anonymous';
          department = user.department || null;
        } catch (e) {
          console.error('[LogService] 사용자 정보 파싱 오류:', e);
        }
      }
      
      // 액션 문자열 형식화
      let actionStr = action;
      if (details && Object.keys(details).length > 0) {
        actionStr += `: ${JSON.stringify(details)}`;
      }
      
      // API 요청 데이터 준비
      const requestData = {
        username,
        department,
        useraction: actionStr
      };
      
      // 로그 저장 API 호출 (인증 필요 없는 엔드포인트 사용)
      const response = await axios.post('http://localhost:8000/api/users/log-action-noauth', requestData, {
        // 타임아웃 설정으로 응답 지연 시 요청 취소
        timeout: 3000
      });
      
      // 에러 카운트 초기화 (성공 시)
      this.errorCount = 0;
      
      // 개발 환경에서는 콘솔에도 로깅
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[LOG] ${username} - ${actionStr}`);
      }
      
      return true;
    } catch (error) {
      // 로깅 실패해도 앱 동작에 영향 주지 않도록 조용히 에러 핸들링
      console.error('[LogService] 액션 로깅 실패:', error);
      
      // 에러 카운트 증가
      this.errorCount++;
      
      // 최대 에러 카운트 초과 시 로깅 비활성화
      if (this.errorCount >= this.maxErrorCount) {
        console.warn(`[LogService] ${this.maxErrorCount}회 이상 로깅 실패로 로깅 기능 비활성화됨`);
        this.loggingDisabled = true;
      }
      
      return false;
    }
  }
  
  /**
   * 액션과 세부 정보를 기반으로 고유한 키 생성
   * @private
   */
  static getActionKey(action, details) {
    // 단순한 액션인 경우 액션 자체를 키로 사용
    if (!details || Object.keys(details).length === 0) {
      return action;
    }
    
    // 세부 정보가 있는 경우 주요 식별자 추출
    let identifiers = [];
    
    // 일반적으로 사용되는 식별 필드 추출
    if (details.id) identifiers.push(details.id);
    if (details.page) identifiers.push(details.page);
    if (details.component) identifiers.push(details.component);
    if (details.process) identifiers.push(details.process);
    
    // 식별자가 없는 경우 전체 세부 정보 사용
    if (identifiers.length === 0) {
      identifiers.push(JSON.stringify(details));
    }
    
    return `${action}:${identifiers.join(':')}`;
  }
  
  /**
   * 페이지 방문 로깅
   * @param {string} pageName - 방문한 페이지 이름
   */
  static async logPageVisit(pageName) {
    return this.logAction('page_visit', { page: pageName });
  }
  
  /**
   * 버튼 클릭 로깅
   * @param {string} buttonName - 클릭한 버튼 이름
   * @param {string} pageName - 버튼이 있는 페이지 (선택 사항)
   */
  static async logButtonClick(buttonName, pageName = null) {
    const details = { button: buttonName };
    if (pageName) details.page = pageName;
    return this.logAction('button_click', details);
  }
  
  /**
   * 이미지 선택 로깅
   * @param {string} imageId - 선택한 이미지 ID
   * @param {string} pageName - 이미지가 있는 페이지
   */
  static async logImageSelect(imageId, pageName) {
    return this.logAction('image_select', { image: imageId, page: pageName });
  }
  
  /**
   * 프로세스 시작 로깅
   * @param {string} processName - 시작한 프로세스 이름
   * @param {object} params - 프로세스 파라미터 (선택 사항)
   */
  static async logProcessStart(processName, params = null) {
    const details = { process: processName };
    if (params) details.params = params;
    return this.logAction('process_start', details);
  }
  
  /**
   * 데이터 저장 로깅
   * @param {string} dataType - 저장한 데이터 유형
   * @param {string} dataId - 데이터 식별자 (선택 사항)
   */
  static async logDataSave(dataType, dataId = null) {
    const details = { type: dataType };
    if (dataId) details.id = dataId;
    return this.logAction('data_save', details);
  }
  
  /**
   * 로깅 기능 수동 활성화/비활성화
   * @param {boolean} enabled - 로깅 활성화 여부
   */
  static setLoggingEnabled(enabled) {
    this.loggingDisabled = !enabled;
    this.errorCount = 0; // 에러 카운트 초기화
    console.log(`[LogService] 로깅 기능 ${enabled ? '활성화' : '비활성화'} 됨`);
  }
}

export default LogService; 