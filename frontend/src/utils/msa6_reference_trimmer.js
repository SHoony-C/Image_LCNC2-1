/**
 * MSA6 기준선 기반 측정선 자르기 유틸리티
 * 기존 msa6_measure_Cut.js를 대체하는 새로운 구현
 */

/**
 * 두 선분의 교차점을 계산합니다.
 * @param {Object} line1 - 첫 번째 선분 {start: {x, y}, end: {x, y}}
 * @param {Object} line2 - 두 번째 선분 {start: {x, y}, end: {x, y}}
 * @returns {Object|null} 교차점 {x, y, t, u} 또는 null (교차하지 않는 경우)
 */
export function calculateLineIntersection(line1, line2) {
  const x1 = line1.start.x;
  const y1 = line1.start.y;
  const x2 = line1.end.x;
  const y2 = line1.end.y;
  
  const x3 = line2.start.x;
  const y3 = line2.start.y;
  const x4 = line2.end.x;
  const y4 = line2.end.y;
  
  // 선분 교차점 계산을 위한 행렬식 계산
  const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  
  // 평행한 경우 (교차점 없음)
  if (Math.abs(det) < 1e-10) {
    return null;
  }
  
  // 교차점 매개변수 계산
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / det;
  
  // 두 선분이 실제로 교차하는지 확인 (0 <= t <= 1, 0 <= u <= 1)
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    // 교차점 좌표 계산
    const intersectionX = x1 + t * (x2 - x1);
    const intersectionY = y1 + t * (y2 - y1);
    
    return {
      x: intersectionX,
      y: intersectionY,
      t: t, // 첫 번째 선분에서의 매개변수
      u: u  // 두 번째 선분에서의 매개변수
    };
  }
  
  return null;
}

/**
 * 두 점 사이의 거리를 계산합니다.
 * @param {Object} point1 - 첫 번째 점 {x, y}
 * @param {Object} point2 - 두 번째 점 {x, y}
 * @returns {number} 두 점 사이의 거리
 */
export function calculateDistance(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 기준선을 기반으로 측정선을 자릅니다.
 * 측정선과 기준선의 교차점을 찾아서 더 가까운 끝점을 교차점으로 조정합니다.
 * @param {Object} measurement - 측정 데이터 {start: {x, y}, end: {x, y}, ...}
 * @param {Object} referenceLine - 기준선 데이터 {start: {x, y}, end: {x, y}, ...}
 * @returns {Object} 조정된 측정 데이터
 */
export function trimMeasurementByReferenceLine(measurement, referenceLine) {
  // 기준선이 없으면 원본 측정값 반환
  if (!referenceLine) {
    return { ...measurement };
  }
  
  // 측정값 복사본 생성
  const result = {
    ...measurement,
    start: { ...measurement.start },
    end: { ...measurement.end }
  };
  
  // 교차점 계산
  const intersection = calculateLineIntersection(measurement, referenceLine);
  
  if (intersection) {
    // console.log(`[trimMeasurementByReferenceLine] 기준선 교차점 발견: (${intersection.x.toFixed(0)}, ${intersection.y.toFixed(0)})`);
    
    // 시작점과 끝점 중 교차점에 더 가까운 쪽을 교차점으로 설정
    const distToStart = calculateDistance(intersection, measurement.start);
    const distToEnd = calculateDistance(intersection, measurement.end);
    
    if (distToStart < distToEnd) {
      // 교차점이 시작점에 더 가까우면 시작점을 교차점으로 설정
      result.start = {
        x: intersection.x,
        y: intersection.y
      };
      // console.log(`[trimMeasurementByReferenceLine] 시작점을 교차점으로 조정: (${result.start.x.toFixed(0)}, ${result.start.y.toFixed(0)})`);
    } else {
      // 교차점이 끝점에 더 가까우면 끝점을 교차점으로 설정
      result.end = {
        x: intersection.x,
        y: intersection.y
      };
      // console.log(`[trimMeasurementByReferenceLine] 끝점을 교차점으로 조정: (${result.end.x.toFixed(0)}, ${result.end.y.toFixed(0)})`);
    }
  } else {
    // console.log(`[trimMeasurementByReferenceLine] 기준선과 교차점 없음`);
  }
  
  // 수평/수직 방향 속성 유지
  if (measurement.isHorizontal) {
    result.isHorizontal = true;
  }
  
  return result;
}

/**
 * 여러 측정선을 기준선으로 한번에 자릅니다.
 * @param {Array} measurements - 측정 데이터 배열
 * @param {Object} referenceLine - 기준선 데이터
 * @returns {Array} 조정된 측정 데이터 배열
 */
export function trimMultipleMeasurementsByReferenceLine(measurements, referenceLine) {
  if (!Array.isArray(measurements) || !referenceLine) {
    return measurements;
  }
  
  // console.log(`[trimMultipleMeasurementsByReferenceLine] ${measurements.length}개의 측정선을 기준선으로 자르기 시작`);
  
  return measurements.map((measurement, index) => {
    const trimmed = trimMeasurementByReferenceLine(measurement, referenceLine);
    // console.log(`[trimMultipleMeasurementsByReferenceLine] 측정선 ${index + 1}/${measurements.length} 처리 완료`);
    return trimmed;
  });
}

/**
 * 기준선 기반 영역 측정을 위한 측정선들을 생성하고 자릅니다.
 * @param {Object} areaRect - 영역 정보 {startX, endX, startY, endY}
 * @param {string} direction - 측정 방향 ('vertical' 또는 'horizontal')
 * @param {number} lineCount - 생성할 측정선 개수
 * @param {Object} referenceLine - 기준선 데이터
 * @param {Object} baseInfo - 기본 측정 정보 {itemId, subItemPrefix 등}
 * @returns {Array} 생성되고 조정된 측정선 배열
 */
export function createAndTrimAreaMeasurements(areaRect, direction, lineCount, referenceLine, baseInfo) {
  const { startX, endX, startY, endY } = areaRect;
  const measurements = [];
  
  // console.log(`[createAndTrimAreaMeasurements] 영역 측정 생성 시작 - 방향: ${direction}, 선 개수: ${lineCount}, 기준선: ${!!referenceLine}`);
  
  if (direction === 'vertical') {
    // 수직 방향 측정선 생성
    const width = endX - startX;
    const spacing = width / (lineCount - 1);
    
    for (let i = 0; i < lineCount; i++) {
      const x = startX + (spacing * i);
      const rawMeasurement = {
        start: { x, y: startY },
        end: { x, y: endY },
        itemId: baseInfo.itemId,
        subItemId: `${baseInfo.itemId}-${baseInfo.subItemPrefix}${i + 1}`,
        brightness: 0,
        relativeToReference: referenceLine?.itemId
      };
      
      // 기준선으로 자르기
      const trimmedMeasurement = trimMeasurementByReferenceLine(rawMeasurement, referenceLine);
      measurements.push(trimmedMeasurement);
    }
  } else if (direction === 'horizontal') {
    // 수평 방향 측정선 생성
    const height = endY - startY;
    const spacing = height / (lineCount - 1);
    
    for (let i = 0; i < lineCount; i++) {
      const y = startY + (spacing * i);
      const rawMeasurement = {
        start: { x: startX, y },
        end: { x: endX, y },
        itemId: baseInfo.itemId,
        subItemId: `${baseInfo.itemId}-${baseInfo.subItemPrefix}${i + 1}`,
        brightness: 0,
        relativeToReference: referenceLine?.itemId,
        isHorizontal: true
      };
      
      // 기준선으로 자르기
      const trimmedMeasurement = trimMeasurementByReferenceLine(rawMeasurement, referenceLine);
      trimmedMeasurement.isHorizontal = true; // 수평 방향 속성 유지
      measurements.push(trimmedMeasurement);
    }
  }
  
  // console.log(`[createAndTrimAreaMeasurements] ${measurements.length}개의 측정선 생성 및 자르기 완료`);
  return measurements;
}

/**
 * 단일 선 측정을 기준선으로 자릅니다.
 * @param {Object} measurement - 측정 데이터
 * @param {Object} referenceLine - 기준선 데이터
 * @returns {Object} 조정된 측정 데이터
 */
export function trimSingleMeasurementByReferenceLine(measurement, referenceLine) {
  // console.log(`[trimSingleMeasurementByReferenceLine] 단일 선 측정 자르기 - 기준선: ${!!referenceLine}`);
  
  const trimmed = trimMeasurementByReferenceLine(measurement, referenceLine);
  
  if (referenceLine) {
    trimmed.relativeToReference = referenceLine.itemId;
  }
  
  return trimmed;
}

/**
 * 기준선과 측정선이 실제로 교차하는지 확인합니다.
 * @param {Object} measurement - 측정선 데이터
 * @param {Object} referenceLine - 기준선 데이터
 * @returns {boolean} 교차 여부
 */
export function checkIntersection(measurement, referenceLine) {
  if (!measurement || !referenceLine) {
    return false;
  }
  
  const intersection = calculateLineIntersection(measurement, referenceLine);
  return intersection !== null;
}

/**
 * 디버깅을 위한 교차점 정보를 반환합니다.
 * @param {Object} measurement - 측정선 데이터
 * @param {Object} referenceLine - 기준선 데이터
 * @returns {Object|null} 교차점 정보 또는 null
 */
export function getIntersectionInfo(measurement, referenceLine) {
  if (!measurement || !referenceLine) {
    return null;
  }
  
  const intersection = calculateLineIntersection(measurement, referenceLine);
  
  if (intersection) {
    return {
      point: { x: intersection.x, y: intersection.y },
      distanceToStart: calculateDistance(intersection, measurement.start),
      distanceToEnd: calculateDistance(intersection, measurement.end),
      tParameter: intersection.t,
      uParameter: intersection.u
    };
  }
  
  return null;
}

/**
 * 기준선 기반 자르기 기능을 활성화/비활성화합니다.
 * @param {boolean} enabled - 활성화 여부
 * @returns {Object} 설정 정보
 */
export function setReferenceTrimmingEnabled(enabled) {
  const config = {
    enabled: enabled,
    timestamp: new Date().toISOString()
  };
  
  // console.log(`[setReferenceTrimmingEnabled] 기준선 기반 자르기 기능 ${enabled ? '활성화' : '비활성화'}`);
  
  return config;
} 

/**
 * 기준선이 2개인 경우 두 기준선 사이의 측정선만 남깁니다.
 * @param {Object} measurement - 측정 데이터 {start: {x, y}, end: {x, y}, ...}
 * @param {Array} referenceLines - 기준선 배열 (2개)
 * @returns {Object} 조정된 측정 데이터
 */
export function trimMeasurementBetweenTwoReferences(measurement, referenceLines) {
  if (!referenceLines || referenceLines.length !== 2) {
    return { ...measurement };
  }

  const result = {
    ...measurement,
    start: { ...measurement.start },
    end: { ...measurement.end }
  };

  // 첫 번째와 두 번째 기준선과의 교차점 계산
  const intersection1 = calculateLineIntersection(measurement, referenceLines[0]);
  const intersection2 = calculateLineIntersection(measurement, referenceLines[1]);

  // 두 교차점이 모두 존재하는 경우
  if (intersection1 && intersection2) {
    // 측정선의 시작점과 끝점에서 각 교차점까지의 거리 계산
    const distStart1 = calculateDistance(measurement.start, intersection1);
    const distStart2 = calculateDistance(measurement.start, intersection2);
    const distEnd1 = calculateDistance(measurement.end, intersection1);
    const distEnd2 = calculateDistance(measurement.end, intersection2);

    // 시작점에 가까운 교차점과 끝점에 가까운 교차점 결정
    let startIntersection, endIntersection;
    
    if (distStart1 < distStart2) {
      startIntersection = intersection1;
      endIntersection = intersection2;
    } else {
      startIntersection = intersection2;
      endIntersection = intersection1;
    }

    // 두 교차점 사이의 선분으로 측정선 조정
    result.start = {
      x: startIntersection.x,
      y: startIntersection.y
    };
    result.end = {
      x: endIntersection.x,
      y: endIntersection.y
    };

    console.log(`[trimMeasurementBetweenTwoReferences] 두 기준선 사이 측정: (${result.start.x.toFixed(0)}, ${result.start.y.toFixed(0)}) - (${result.end.x.toFixed(0)}, ${result.end.y.toFixed(0)})`);
  }
  // 하나의 교차점만 있는 경우 기존 로직 사용
  else if (intersection1) {
    return trimMeasurementByReferenceLine(measurement, referenceLines[0]);
  } else if (intersection2) {
    return trimMeasurementByReferenceLine(measurement, referenceLines[1]);
  }

  return result;
}