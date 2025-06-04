# MSA6 Image Popup 컴포넌트 작동 방식 및 스케일바 처리 문서

## 1. 개요

`msa6_image_popup1.vue` 컴포넌트는 이미지 측정 및 스케일바 기능을 제공하는 팝업 컴포넌트입니다. 이 컴포넌트는 MSA5 처리 결과 이미지를 표시하고, 사용자가 측정과 스케일바 설정을 할 수 있게 합니다. 특히 스케일바 처리는 복잡한 로직을 가지고 있어 이 문서에서 자세히 설명합니다.

⚠️ **주의**: 이 문서는 스케일바 관련 로직 수정 시 반드시 참고해야 합니다. 무분별한 수정은 여러 버그를 발생시킬 수 있습니다.

## 2. 핵심 컴포넌트 및 파일

- **msa6_image_popup1.vue**: 메인 팝업 컴포넌트
- **popupOverride.js**: DOM 직접 조작을 통한 팝업 오버라이드 시스템
- **MSA5 컴포넌트**: MSA6 팝업을 호출하는 부모 컴포넌트

## 3. 데이터 흐름 및 상태 관리

### 3.1 주요 상태 변수

- `isVisible`: 팝업 표시 여부 (MSA6 팝업이 열려 있는지)
- `manualScaleBarSet`: 수동 스케일바가 설정되었는지 여부 (중요: 이 값이 true일 때만 수동 설정으로 간주)
- `scaleBarDetected`: 스케일바가 자동 감지되었는지 여부
- `scaleMethod`: 현재 측정 방식 ('scaleBar', 'magnification' 등)
- `showScaleChoicePopup`: 스케일바 선택 팝업 표시 여부
- `measurements`: 측정 결과 배열 (선 측정, 영역 측정 등)
- `segmentedMeasurements`: 세그먼트된 측정 결과 배열 (밝기 기반 경계 감지 결과)
- `defectMeasurements`: 불량 감지 측정 결과 배열
- `referenceLines`: 기준선 배열

### 3.2 로컬/세션 스토리지 사용

- **localStorage**:
  - `msa6_scalebar_[imageKey]`: 이미지별 스케일바 설정 저장
  - `msa6_scalebar_global`: 전역 스케일바 설정 (마지막 사용 설정)
  - `msa6_last_image_key`: 마지막으로 사용한 이미지 키

- **sessionStorage**:
  - `msa6_no_scale_popup`: 스케일바 자동 감지 팝업 방지 플래그
  - `msa6_no_auto_popup`: 자동 팝업 열림 방지 플래그
  - `msa5_end_image_format`: MSA5 처리 결과 이미지 형식

## 4. 스케일바 처리 주요 로직

### 4.1 스케일바 설정 저장/복원

```javascript
// 설정 저장
saveScaleBarSettings() {
  // 현재 설정을 localStorage에 저장
  // 1. 이미지별 설정
  // 2. 마지막 이미지 키
  // 3. 전역 설정
}

// 설정 복원
restoreScaleBarSettings() {
  // localStorage에서 설정 복원 시도
  // 1. 현재 이미지 설정
  // 2. 마지막 이미지 설정
  // 3. 전역 설정
}
```

### 4.2 스케일바 자동 감지 및 팝업 표시

```javascript
// 스케일바 감지
detectScaleBar(forceShowPopup = false) {
  // 1. 팝업이 열려있는지 확인
  // 2. 팝업 방지 플래그 확인
  // 3. manualScaleBarSet 유효성 검증
  // 4. 감지 수행 및 팝업 표시
}

// 스케일바 감지 실패 팝업 표시
showScaleDetectionFailurePopup() {
  // 1. 팝업 표시 조건 확인
  // 2. 팝업 생성 및 표시
}
```

### 4.3 MSA5 프로세스 시작 시 동작

```javascript
// MSA5 이미지 처리 이벤트 핸들러
handleMSA5ImageProcessed(event) {
  // 1. manualScaleBarSet 초기화
  // 2. 측정 결과 초기화 (measurements, segmentedMeasurements, defectMeasurements 등)
  // 3. 팝업 방지 플래그 확인
  // 4. 스케일바 자동 감지 방지 플래그 설정
  // 5. 팝업 열기
}
```

## 5. 중요 플래그 및 작동 방식

### 5.1 msa6_no_scale_popup 플래그

- **용도**: MSA5 프로세스 시작 시 스케일바 자동 감지 팝업이 뜨지 않도록 방지
- **설정 위치**: `handleMSA5ImageProcessed` 메소드
- **확인 위치**:
  - `loadImage` 메소드
  - `handleImageLoad` 메소드
  - `detectScaleBar` 메소드
  - `showScaleDetectionFailurePopup` 메소드
  - `popupOverride.js`의 관련 함수들
- **특징**: 일회성 플래그 (사용 후 제거)

### 5.2 manualScaleBarSet 플래그

- **용도**: 수동 스케일바가 설정되었는지 여부 추적
- **설정 위치**: 
  - `endMeasurement` (수동 스케일바 그리기 완료 시)
  - `handleScaleBarValueInput` (스케일바 값 입력 시)
- **초기화 위치**: `handleMSA5ImageProcessed` (MSA5 프로세스 시작 시)
- **검증 위치**: `validateScaleBarSettings` (유효성 검증)

## 6. DOM 오버라이드 시스템 (popupOverride.js)

### 6.1 개요

`popupOverride.js`는 Vue 컴포넌트 시스템을 우회하고 직접 DOM을 조작하여 스케일바 감지 실패 시 팝업을 표시하는 시스템입니다. 이는 Vue 컴포넌트의 렌더링 문제를 해결하기 위한 방법으로, 두 시스템이 동기화되어야 합니다.

### 6.2 주요 함수

- `createScaleChoicePopup`: DOM에 직접 팝업 요소 생성
- `showScaleDetectionFailurePopup`: 팝업 표시 로직
- `patchDetectScaleBar`: Vue 컴포넌트의 detectScaleBar 메소드 패치

### 6.3 Vue 컴포넌트와의 동기화 포인트

1. **msa6_no_scale_popup 플래그 처리**: 양쪽 모두 동일한 방식으로 체크하고 처리
2. **isVisible 체크**: 팝업이 열려있을 때만 동작하도록 처리
3. **manualScaleBarSet 및 hasValidManualScaleBar 검증**: 수동 스케일바 설정 유효성 확인

## 7. 주요 작동 시나리오

### 7.1 MSA5 프로세스 시작 시 (자동 감지 팝업 방지 및 측정 초기화)

1. `handleMSA5ImageProcessed` 호출됨
2. `manualScaleBarSet`을 false로 초기화
3. 모든 측정 결과 초기화 (`measurements`, `segmentedMeasurements`, `defectMeasurements` 등)
4. `msa6_no_scale_popup` 플래그 설정
5. 팝업 열기 (`openPopup` 호출)
6. 이미지 로드 시 `loadImage`에서 플래그 확인 후 스케일바 팝업 표시 방지

### 7.2 수동으로 MSA6 팝업 열기 (스케일바 감지 허용)

1. 사용자가 MSA6 팝업 버튼 클릭
2. `openPopup` 호출됨
3. 이미지 로드 시 스케일바 자동 감지 시도 (`detectScaleBar` 호출)
4. 감지 실패 시 스케일바 선택 팝업 표시

### 7.3 수동 스케일바 설정 시

1. 사용자가 수동 스케일바 그리기 선택
2. 사용자가 이미지에 스케일바 선 그리기
3. `endMeasurement`에서 `manualScaleBarSet`을 true로 설정
4. 설정 저장 (`saveScaleBarSettings` 호출)
5. 이후 이미지 로드 시 스케일바 자동 감지 시도하지 않음

## 8. 수정 시 주의사항

1. **플래그 처리 로직**: `msa6_no_scale_popup` 플래그 처리는 모든 관련 함수에서 동일하게 유지되어야 함
2. **DOM 오버라이드 동기화**: `popupOverride.js`와 Vue 컴포넌트의 관련 함수는 항상 동기화되어야 함
3. **스케일바 설정 유효성 검증**: `manualScaleBarSet`이 true인 경우 항상 유효한 스케일바 설정이 있는지 확인해야 함
4. **일회성 플래그 처리**: 플래그 사용 후 항상 제거하여 다음 작업에 영향을 주지 않도록 해야 함
5. **측정 결과 초기화**: MSA5 프로세스 시작 시 측정 결과는 항상 초기화되지만, 스케일바 설정 로직은 변경하지 않도록 주의해야 함

## 9. 디버깅 및 로깅

코드 전반에 걸쳐 상세한 로깅이 구현되어 있습니다. 문제 발생 시 브라우저 콘솔의 로그를 확인하면 원인 파악에 도움이 됩니다:

- `[handleMSA5ImageProcessed]`: MSA5 이미지 처리 관련 로그
- `[loadImage]`: 이미지 로드 및 스케일바 설정 관련 로그
- `[detectScaleBar]`: 스케일바 자동 감지 관련 로그
- `[popupOverride]`: DOM 오버라이드 시스템 관련 로그

## 10. 결론

MSA6 이미지 팝업 컴포넌트의 스케일바 처리 로직은 복잡하지만 체계적으로 구성되어 있습니다. 코드 수정 시 이 문서를 참고하여 기존 흐름과 로직을 유지하면서 변경하는 것이 중요합니다. 특히 플래그 처리와 두 시스템(Vue 컴포넌트와 DOM 오버라이드)의 동기화에 주의해야 합니다. 