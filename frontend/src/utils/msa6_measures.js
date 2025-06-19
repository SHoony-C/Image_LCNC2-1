// 기준선 관련 import 제거
// import { trimMeasurementByReference } from './msa6_measure_Cut.js';

// 기준선 기반 자르기 기능을 위한 import 추가
import { trimMeasurementByReferenceLine } from './msa6_reference_trimmer.js';

export function createAreaMeasurements() {
    // console.log(`[createAreaMeasurements] >>> 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
    
    // 기존 측정값 초기화 코드 제거 - 누적 측정을 위해
    
    const startX = Math.min(this.areaStart.x, this.areaEnd.x);
    const endX = Math.max(this.areaStart.x, this.areaEnd.x);
    const startY = Math.min(this.areaStart.y, this.areaEnd.y);
    const endY = Math.max(this.areaStart.y, this.areaEnd.y);
    
    // console.log('Creating area measurements:', 
    //            `mode=${this.measurementMode}`, 
    //            `hasReferenceLine=${!!this.activeReferenceLine}`,
    //            `lineCount=${this.lineCount}`,
    //            `area=(${startX.toFixed(0)},${startY.toFixed(0)})-(${endX.toFixed(0)},${endY.toFixed(0)})`);
    
    // 기준선 관련 로직을 다시 활성화하여 측정선 자르기
    if (this.measurementMode === 'area-vertical') {
      // console.log(`[createAreaMeasurements] 수직 방향 영역 측정 생성`);
      const width = endX - startX;
      const spacing = width / (this.lineCount - 1);
      
      for (let i = 0; i < this.lineCount; i++) {
        const x = startX + (spacing * i);
        let measurement = {
          start: { x, y: startY },
          end: { x, y: endY },
          itemId: this.nextId.toString(),
          subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
          brightness: 0
        };
        
        // 기준선이 있는 경우 측정선을 기준선으로 자르기
        if (this.activeReferenceLine) {
          measurement = trimMeasurementByReferenceLine(measurement, this.activeReferenceLine);
          measurement.relativeToReference = this.activeReferenceLine.itemId;
        }
        
        // 값 계산
        measurement.value = this.calculateValue(
          measurement.start,
          measurement.end
        );
        
        // this.measurements.push(measurement); // prop이므로 직접 수정 불가
        this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
        this.createBoundedSegments(measurement);
        
        // 개별 라인마다 히스토리 저장하지 않음 - 전체 영역 측정 완료 후 한 번에 처리
      }
      this.nextId++;
    } else if (this.measurementMode === 'area-horizontal') {
      // console.log(`[createAreaMeasurements] 수평 방향 영역 측정 생성`);
      const height = endY - startY;
      const spacing = height / (this.lineCount - 1);
      
      for (let i = 0; i < this.lineCount; i++) {
        const y = startY + (spacing * i);
        
        if (i === 0 || i === this.lineCount - 1) {
          // console.log(`Line ${i}: (${startX.toFixed(0)},${y.toFixed(0)})-(${endX.toFixed(0)},${y.toFixed(0)})`);
        }
        
        let measurement = {
          start: { x: startX, y },
          end: { x: endX, y },
          itemId: this.nextId.toString(),
          subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
          brightness: 0,
          isHorizontal: true // 수평 방향 표시 추가
        };
        
        // 기준선이 있는 경우 측정선을 기준선으로 자르기
        if (this.activeReferenceLine) {
          measurement = trimMeasurementByReferenceLine(measurement, this.activeReferenceLine);
          measurement.relativeToReference = this.activeReferenceLine.itemId;
        }
        
        // 값 계산
        measurement.value = this.calculateValue(
          measurement.start,
          measurement.end
        );
        
        // this.measurements.push(measurement); // prop이므로 직접 수정 불가
        this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
        this.createBoundedSegments(measurement);
        
        // 개별 라인마다 히스토리 저장하지 않음 - 전체 영역 측정 완료 후 한 번에 처리
      }
      this.nextId++;
    }
    
    // console.log(`[createAreaMeasurements] <<< 종료 - 생성된 측정값: ${this.measurements.length}개`);
  }
  
  // 새로운 함수: 경계가 있는 세그먼트 생성
export function  createBoundedSegments(measurement) {
    const samples = 3000; // 샘플링 포인트 수
    const segments = [];
    
    // console.log(`[createBoundedSegments] 시작 - 측정값 ID: ${measurement.itemId}, 기존 세그먼트 수: ${this.segmentedMeasurements.length}`);
    
    // 포인트 및 밝기 샘플링
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = {
        x: measurement.start.x + (measurement.end.x - measurement.start.x) * t,
        y: measurement.start.y + (measurement.end.y - measurement.start.y) * t
      };
      const brightness = this.calculateBrightness(point.x, point.y);
      points.push({ ...point, brightness, t });
    }
    
    // 이동 평균으로 노이즈 제거
    const windowSize = 5;
    const smoothedPoints = points.map((point, i) => {
      if (i < windowSize/2 || i > points.length - windowSize/2 - 1) return point;
      
      let sum = 0;
      for (let j = -Math.floor(windowSize/2); j <= Math.floor(windowSize/2); j++) {
        sum += points[i + j].brightness;
      }
      return { ...point, brightness: sum / windowSize };
    });
    
    // 밝기 변경 지점 찾기
    const transitions = [];
    let prevIsBright = null;
    
    smoothedPoints.forEach((point, index) => {
      const isBright = point.brightness > this.brightnessThreshold;
      
      if (prevIsBright === null) {
        prevIsBright = isBright;
      } else if (isBright !== prevIsBright) {
        transitions.push({
          index,
          point,
          fromBright: prevIsBright,
          toBright: isBright
        });
        prevIsBright = isBright;
      }
    });
    
    // console.log(`[createBoundedSegments] Found ${transitions.length} brightness transitions`);
    
    // 전체 선 측정값 계산 - 정확한 계산을 위해 직접 계산 함수 호출
    const totalValue = this.calculateValue(measurement.start, measurement.end);
    // console.log(`[createBoundedSegments] 전체 선 측정값: ${totalValue}`);
    
    // 전체 선 길이 측정값 저장 코드 제거 (total 값 생성 안함)
    
    // 세그먼트 생성
    if (transitions.length === 0) {
      // 밝기 변화가 없는 경우 전체 라인이 하나의 세그먼트
      const isBright = smoothedPoints[0]?.brightness > this.brightnessThreshold;
      
      // 세그먼트 측정값은 전체 선 길이와 동일하게 설정
      const segmentValue = totalValue;
      // console.log(`[createBoundedSegments] 단일 세그먼트 측정값: ${segmentValue} (전체와 동일)`);
      
      const subItemId = `s${isBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
      
      segments.push({
        start: { ...measurement.start },
        end: { ...measurement.end },
        brightness: isBright ? 255 : 0,
        isBright: isBright,
        itemId: measurement.itemId,
        subItemId: subItemId,
        value: segmentValue
      });
    } else {
      // 첫 세그먼트 (시작점부터 첫 전환점까지)
      const firstTransition = transitions[0];
      const firstIsBright = firstTransition.fromBright;
      
      // 거리에 비례하여 측정값 계산
      const firstSegmentLength = this.getDistanceRatio(
        measurement.start, 
        { x: firstTransition.point.x, y: firstTransition.point.y },
        measurement.start,
        measurement.end
      );
      const firstSegmentValue = totalValue * firstSegmentLength;
      
      // console.log(`[createBoundedSegments] 첫 세그먼트 측정값: ${firstSegmentValue} (비율: ${firstSegmentLength.toFixed(4)})`);
      
      const firstSubItemId = `s${firstIsBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
      
      segments.push({
        start: { ...measurement.start },
        end: { 
          x: firstTransition.point.x, 
          y: firstTransition.point.y 
        },
        brightness: firstIsBright ? 255 : 0,
        isBright: firstIsBright,
        itemId: measurement.itemId,
        subItemId: firstSubItemId,
        value: firstSegmentValue
      });
      
      // 중간 세그먼트들
      for (let i = 0; i < transitions.length - 1; i++) {
        const currentTransition = transitions[i];
        const nextTransition = transitions[i + 1];
        const isBright = currentTransition.toBright;
        
        // 세그먼트 시작/끝점
        const segmentStart = { x: currentTransition.point.x, y: currentTransition.point.y };
        const segmentEnd = { x: nextTransition.point.x, y: nextTransition.point.y };
        
        // 거리에 비례하여 측정값 계산
        const segmentLength = this.getDistanceRatio(
          segmentStart, 
          segmentEnd,
          measurement.start,
          measurement.end
        );
        const segmentValue = totalValue * segmentLength;
        
        // console.log(`[createBoundedSegments] 중간 세그먼트 #${i+1} 측정값: ${segmentValue} (비율: ${segmentLength.toFixed(4)})`);
        
        const subItemId = `s${isBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
        
        segments.push({
          start: segmentStart,
          end: segmentEnd,
          brightness: isBright ? 255 : 0,
          isBright: isBright,
          itemId: measurement.itemId,
          subItemId: subItemId,
          value: segmentValue
        });
      }
      
      // 마지막 세그먼트 (마지막 전환점부터 끝점까지)
      const lastTransition = transitions[transitions.length - 1];
      const lastIsBright = lastTransition.toBright;
      
      // 거리에 비례하여 측정값 계산
      const lastSegmentLength = this.getDistanceRatio(
        { x: lastTransition.point.x, y: lastTransition.point.y },
        measurement.end,
        measurement.start,
        measurement.end
      );
      const lastSegmentValue = totalValue * lastSegmentLength;
      
      // console.log(`[createBoundedSegments] 마지막 세그먼트 측정값: ${lastSegmentValue} (비율: ${lastSegmentLength.toFixed(4)})`);
      
      const lastSubItemId = `s${lastIsBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
      
      segments.push({
        start: { x: lastTransition.point.x, y: lastTransition.point.y },
        end: { ...measurement.end },
        brightness: lastIsBright ? 255 : 0,
        isBright: lastIsBright,
        itemId: measurement.itemId,
        subItemId: lastSubItemId,
        value: lastSegmentValue
      });
    }
    
    // 기준선 관련 속성 복사
    segments.forEach(segment => {
      if (measurement.relativeToReference) {
        segment.relativeToReference = measurement.relativeToReference;
      }
      // 수평/수직 방향 속성 유지
      if (measurement.isHorizontal) {
        segment.isHorizontal = true;
      }
    });
    
    // 총 세그먼트 값의 합과 전체 선 값 비교 (디버깅용)
    const segmentsSum = segments.reduce((sum, segment) => sum + segment.value, 0);
    // console.log(`[createBoundedSegments] 세그먼트 값 합계: ${segmentsSum.toFixed(2)}, 전체 선 값: ${totalValue.toFixed(2)}, 차이: ${(totalValue - segmentsSum).toFixed(2)}`);
    
    // 세그먼트 합계가 전체 값과 약간 다를 경우 보정
    if (Math.abs(totalValue - segmentsSum) > 0.01 && segments.length > 0) {
      // 마지막 세그먼트 보정
      const correction = totalValue - segmentsSum;
      const lastSegment = segments[segments.length - 1];
      lastSegment.value += correction;
      
      // console.log(`[createBoundedSegments] 보정 적용 - 마지막 세그먼트에 ${correction.toFixed(4)} 추가됨`);
      
      // 보정 후 합계 재확인
      const newSum = segments.reduce((sum, segment) => sum + segment.value, 0);
      // console.log(`[createBoundedSegments] 보정 후 세그먼트 합계: ${newSum.toFixed(2)}`);
    }
    
    this.segmentedMeasurements.push(...segments);
    // console.log(`[createBoundedSegments] 종료 - 세그먼트 ${segments.length}개 생성, 총 ${this.segmentedMeasurements.length}개`);
    
    // 생성된 세그먼트 정보 요약 로깅
    segments.forEach((segment, idx) => {
      // console.log(`  세그먼트 #${idx+1}: ID=${segment.itemId}, SubID=${segment.subItemId}, 값=${segment.value.toFixed(2)}, 밝기=${segment.isBright ? '밝음' : '어두움'}`);
    });
  }