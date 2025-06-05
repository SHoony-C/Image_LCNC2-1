// 현재 화면에 표시된 측정값만 저장
const displayedMeasurements = this.measurements.filter(m => !m.hidden);

console.log(`[saveWithTableName] 전체 측정값: ${this.measurements.length}개, 화면 표시값: ${displayedMeasurements.length}개`);

if (displayedMeasurements.length === 0) {
  this.showNotification("저장할 측정값이 없습니다. 측정을 추가해주세요.", "warning");
  return;
}

console.log("[saveWithTableName] 저장될 측정값 내용:");

// 중복 값 확인 (디버깅용)
const uniqueValues = new Set();
displayedMeasurements.forEach(m => {
  uniqueValues.add(m.value);
});

console.log(`[saveWithTableName] 고유 값 개수: ${uniqueValues.size}개, 값 목록:`, Array.from(uniqueValues));

// 저장 진행 중 상태로 설정
this.isSaving = true;

// 선택된 테이블에 저장
console.log(`[saveWithTableName] 저장 중... 테이블: ${selectedTable.table_name}, 측정값: ${displayedMeasurements.length}개`);

// 측정값 가공 - 숫자형으로 변환하고 필요한 정보만 추출
const processedMeasurements = displayedMeasurements.map((measurement, idx) => {
  // 측정값을 숫자로 변환 (스케일바로 보정된 값)
  let originalValue = measurement.value;
  let value = parseFloat(originalValue);
  
  // 서브아이템 ID 추출 (결함 위치 정보 등)
  let subItemId = "";
  if (measurement.meta && measurement.meta.subItemId) {
    subItemId = measurement.meta.subItemId;
  } else if (measurement.subItemId) {
    subItemId = measurement.subItemId;
  }
  
  // NaN 체크
  if (isNaN(value)) {
    console.error(`[saveWithTableName] 측정값 #${idx+1} 값을 숫자로 변환할 수 없음: ${originalValue}`);
    value = 0; // 기본값 설정
  }
  
  console.log(`[saveWithTableName] 측정값 #${idx+1} 변환: 원본=${originalValue}, 변환=${value}, ID=${measurement.itemId}, SubID=${subItemId}`);
  
  // API에 필요한 형식으로 반환
  return {
    measurement_id: measurement.id || `m-${Date.now()}-${idx}`,
    item_id: measurement.itemId || `item-${idx}`,
    sub_item_id: subItemId || "",
    value: value,
    unit: this.scaleBarUnit || "px",
    type: measurement.type || "length",
    label: measurement.label || `측정 ${idx+1}`,
    color: measurement.color || "#ff0000",
    comments: measurement.comments || "",
    position_data: JSON.stringify(measurement.points || [])
  };
});

console.log(`[saveWithTableName] 정리된 데이터:`, processedMeasurements);

try {
  // API 호출 준비
  const apiUrl = "http://localhost:8000/api/msa6/save-with-table-name";
  console.log("[saveWithTableName] API 호출 URL:", apiUrl);
  console.log("[saveWithTableName] 요청 본문:", JSON.stringify({
    table_name: selectedTable.table_name,
    department: selectedTable.department || "",
    lot_wafer: lot_wafer,
    user_name: userName,
    measurements: processedMeasurements,
    result_type: selectedTable.is_result ? "result" : "defect",
    metadata: {
      image_urls: {
        before: this.inputImageUrl || "",
        after: this.imageUrl || ""
      },
      scale_bar: {
        value: this.scaleBarValue || 0,
        unit: this.scaleBarUnit || "px",
        manually_set: this.manualScaleBarSet
      },
      device_info: {
        browser: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`
      }
    }
  }));
  
  // API 호출
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      table_name: selectedTable.table_name,
      department: selectedTable.department || "",
      lot_wafer: lot_wafer,
      user_name: userName,
      measurements: processedMeasurements,
      result_type: selectedTable.is_result ? "result" : "defect",
      metadata: {
        image_urls: {
          before: this.inputImageUrl || "",
          after: this.imageUrl || ""
        },
        scale_bar: {
          value: this.scaleBarValue || 0,
          unit: this.scaleBarUnit || "px",
          manually_set: this.manualScaleBarSet
        },
        device_info: {
          browser: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`
        }
      }
    })
  });
  
  console.log(`[saveWithTableName] API 응답 상태 코드: ${response.status}`);
  
  // 응답 텍스트 먼저 가져오기
  const responseText = await response.text();
  console.log("[saveWithTableName] API 응답 텍스트:", responseText);
  
  // 응답 텍스트가 있으면 JSON으로 파싱
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
    console.log("[saveWithTableName] 파싱된 JSON 응답:", result);
  } catch (parseError) {
    console.error("[saveWithTableName] JSON 파싱 오류:", parseError);
    throw new Error(`서버 응답을 처리할 수 없습니다: ${responseText || "응답 없음"}`);
  }
  
  // 응답 상태 확인
  if (!response.ok) {
    console.error("[saveWithTableName] API 오류 응답:", result);
    throw new Error(result.message || `서버 오류: ${response.status}`);
  }
  
  // 성공 여부 확인
  if (result.status !== "success") {
    console.error("[saveWithTableName] 성공이 아닌 응답:", result);
    throw new Error(result.message || "알 수 없는 오류가 발생했습니다.");
  }
  
  // 성공
  console.log("[saveWithTableName] API 성공 응답:", result);
  this.showNotification(`${displayedMeasurements.length}개의 측정값이 성공적으로 저장되었습니다.`, "success");
  
  // 경고 메시지가 있으면 표시
  if (result.warnings && result.warnings.length > 0) {
    console.warn("[saveWithTableName] 저장 경고:", result.warnings);
    setTimeout(() => {
      this.showNotification(`경고: ${result.warnings.join(", ")}`, "warning");
    }, 1000);
  }
  
  // 테이블 선택기 닫기
  this.$nextTick(() => {
    this.closeTableSelector();
  });
} catch (apiError) {
  console.error("[saveWithTableName] API 호출 중 오류:", apiError);
  this.showNotification(`측정 데이터 저장 중 오류: ${apiError.message}`, "error");
  
  // 로그 저장 - API 호출 실패
  LogService.logAction("save_measurements_api_error", {
    error: apiError.message || "API 호출 실패"
  });
} 