import json
import os
import random

# 디렉토리 생성
os.makedirs('./storage/vector', exist_ok=True)

# 이미지 파일 목록 가져오기
files = os.listdir('./storage/images')
print(f'발견된 이미지 파일: {len(files)}개')
print(f'이미지 파일 샘플: {files[:5]}')

# 3차원 벡터 생성
vectors = []
for _ in range(len(files)):
    vector = [random.random() for _ in range(3)]
    vectors.append(vector)

print(f'생성된 벡터: {len(vectors)}개')

# 벡터 파일 저장
with open('./storage/vector/processed_vectors.json', 'w', encoding='utf-8') as f:
    json.dump(vectors, f, ensure_ascii=False, indent=2)

# 메타데이터 파일 저장
with open('./storage/vector/processed_metadata.json', 'w', encoding='utf-8') as f:
    json.dump(files, f, ensure_ascii=False, indent=2)

# 태그 파일 저장
empty_tags = [[] for _ in range(len(files))]
with open('./storage/vector/tags.json', 'w', encoding='utf-8') as f:
    json.dump(empty_tags, f, ensure_ascii=False, indent=2)

print('벡터 파일이 성공적으로 생성되었습니다.')
print(f'processed_vectors.json: {len(vectors)}개 벡터')
print(f'processed_metadata.json: {len(files)}개 파일명')
print(f'tags.json: {len(empty_tags)}개 태그') 