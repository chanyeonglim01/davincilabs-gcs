# scripts/

드론 3D 모델 (`drone.glb`) 색상/스틱 조정용 일회성 파이썬 스크립트들.

## 용도

- `add_heading_stick.py` — drone.glb 모델에 헤딩 표시용 스틱 추가 (Cesium 회전 기준점)
- `build_and_preview.py` — glb 빌드 후 미리보기 png 렌더
- `build_final.py` — 최종 glb 산출
- `color_compare.py` — color_A_*.png / color_B_*.png 색상 비교
- `inspect_stick.py` — 스틱 메시/normals 검사
- `preview_*.png` — 결과물

## 의존성

`pyglet`, `trimesh`, `pygltflib` 등. requirements.txt 없음 (필요 시 setup).

## 활성도

drone.glb 변경 필요 시에만 실행. 일반 GCS 빌드/실행 파이프라인과 무관.
색상 토큰 보존 자료 — 폐기 금지.
