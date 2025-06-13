process start 누르면 결과들 다 초기화
(지금 item id 다 유지돼)
초기화 버튼으로 초기화 안돼
이미지 붙여넣으면 바로 연관 이미지 검색 안돼


## To Do List (Out - msa6)
```
 - 삭제 기능 구현
 - 로그인 바로 sso redirect 되게 
 - msa6 팝업 - 결과 저장 - 이미지 이름까지 저장해서 이거 대시보드에서 같이 보여줄 수 있도록
 - 불량 감지 기능 개발

## To Do List (Out - 기타)
 - Analysis 탭 - 크기 크게 변경하면 그래프 변경 안돼
 
```

## To Do List (In)
```
 - SSO 로그인 (LLM mini 참고)
 - VSEM, TEM 기능 테스트
 - BE 블록 기능 구현
```


## Done List
```
 - msa6 - 스케일 바 변환
 - msa6 팝업 - 전/후 이미지 전환 기능
 - msa6 팝업 - 결과에 total값이 나와
 - setting api에서 이미지/벡터 저장할 때
   -> 기존 data 없애고 저장되게
   -> 벡터 변환할 때 애초에 3차원으로 구성하기 (UMAP으로)
   -> 저장 경로 하나 더 추가 여기는 before로 필터링 안하기 
         D:\image_set_url\additional_images   
 - workflow 저장을 누르면
   -> 저장할 때, 성분분석이미지들도 색 다르게 보여주기? tag 설정?
   -> 설명은 workflow이름.txt 로 저장되도록
   -> 3차원 그래프에서 점 누르면,
      -> 유사 이미지 띄워지고, 유사 텍스트도 LLM에서 보여지게
 - 전처리 하면 이미지 저장 뻑나
 - msa6 팝업 - 결과 저장 - lot_wafer 이름으로 저장하고, 중복 검사
   -> 이미지가 유니크한 이름으로 저장되게
   -> images 폴더 말고 image_measure 폴더에 저장

 ```
 


## Version - 사내에서 오류나니까 확인
node -v
v20.13.1
 npm -v
10.5.2
vue --version
@vue/cli 5.0.8
