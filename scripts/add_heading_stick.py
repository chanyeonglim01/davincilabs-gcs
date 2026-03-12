"""
Blender에서 직접 실행하는 스크립트.
drone.glb 불러오고 주황색 heading stick 추가.

사용법: Blender > Scripting 탭 > 이 파일 열기 > Run Script
변수 수정 후 다시 Run Script → 기존 스틱 삭제 후 새로 생성
"""

import bpy
import bmesh
import math

# ═══════════════════════════════════════════════════════════════════════════════
#  여기서 조절하세요
# ═══════════════════════════════════════════════════════════════════════════════

INPUT_GLB = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone.glb"

# ── 막대기 방향 (Z축 기준 회전, 0° = +Y 방향) ────────────────────────────────
STICK_DIRECTION_DEG = -90     # -90° = +X 방향, +90° = -X 방향, 180° = -Y 방향

# ── 색상 (sRGB, 2D 아이콘 기준: #FFB060 ~ #E87020) ──────────────────────────
STICK_COLOR_R = 0xE8 / 255
STICK_COLOR_G = 0x50 / 255   # 더 진한 주황 (0x70 → 0x50)
STICK_COLOR_B = 0x10 / 255   # 더 진한 주황 (0x20 → 0x10)

# ── 크기 ──────────────────────────────────────────────────────────────────────
STICK_RADIUS  = 0.025         # 굵기 (반지름)
STICK_LENGTH  = 0.75          # 길이

# ── 시작 위치 (모델 중심 기준, 방향 적용 전) ──────────────────────────────────
STICK_OFFSET  = 1             # 중심에서 시작점까지 거리 (노즈 끝 ≈ 0.95)
STICK_Z       = -0.12         # 높이 (엘리베이터 ≈ -0.17, 바닥 ≈ -0.22)

# ── 발광 ──────────────────────────────────────────────────────────────────────
EMISSION_STRENGTH = 0.15      # 낮춰서 하얗게 빠지는 현상 방지

# ═══════════════════════════════════════════════════════════════════════════════


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def main():
    # ── 씬 정리 ───────────────────────────────────────────────────────────────
    for obj in list(bpy.data.objects):
        if obj.name.startswith("HeadingStick"):
            bpy.data.objects.remove(obj, do_unlink=True)

    has_drone = any(o.type == "MESH" and not o.name.startswith("HeadingStick") for o in bpy.data.objects)
    if not has_drone:
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete()
        bpy.ops.import_scene.gltf(filepath=INPUT_GLB)
        print(f"Imported: {INPUT_GLB}")

    # ── 머티리얼 ──────────────────────────────────────────────────────────────
    lr = srgb_to_linear(STICK_COLOR_R)
    lg = srgb_to_linear(STICK_COLOR_G)
    lb = srgb_to_linear(STICK_COLOR_B)

    mat = bpy.data.materials.get("HeadingStick_Mat")
    if mat is None:
        mat = bpy.data.materials.new(name="HeadingStick_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (lr, lg, lb, 1.0)
    bsdf.inputs["Emission Color"].default_value = (lr, lg, lb, 1.0)
    bsdf.inputs["Emission Strength"].default_value = EMISSION_STRENGTH
    bsdf.inputs["Roughness"].default_value = 0.2

    out_node = nodes.new("ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    # ── 방향 계산 ─────────────────────────────────────────────────────────────
    dir_rad = math.radians(STICK_DIRECTION_DEG)
    dir_x = math.sin(dir_rad)
    dir_y = math.cos(dir_rad)

    start_x = dir_x * STICK_OFFSET
    start_y = dir_y * STICK_OFFSET
    end_x = dir_x * (STICK_OFFSET + STICK_LENGTH)
    end_y = dir_y * (STICK_OFFSET + STICK_LENGTH)

    # ── Stick 메쉬 생성 ──────────────────────────────────────────────────────
    mesh_data = bpy.data.meshes.new("HeadingStickMesh")
    bm = bmesh.new()

    segments = 12
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        perp_x = -dir_y
        perp_y = dir_x
        cx = STICK_RADIUS * math.cos(angle)
        cz = STICK_RADIUS * math.sin(angle)

        bm.verts.new((
            start_x + perp_x * cx,
            start_y + perp_y * cx,
            STICK_Z + cz,
        ))
        bm.verts.new((
            end_x + perp_x * cx,
            end_y + perp_y * cx,
            STICK_Z + cz,
        ))

    bm.verts.ensure_lookup_table()

    for i in range(segments):
        i0 = i * 2
        i1 = i * 2 + 1
        i2 = ((i + 1) % segments) * 2
        i3 = ((i + 1) % segments) * 2 + 1
        bm.faces.new([bm.verts[i0], bm.verts[i1], bm.verts[i3], bm.verts[i2]])

    cap_start = [bm.verts[i * 2] for i in range(segments)]
    cap_end = [bm.verts[i * 2 + 1] for i in range(segments)]
    bm.faces.new(cap_start)
    bm.faces.new(list(reversed(cap_end)))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh_data)
    bm.free()

    stick_obj = bpy.data.objects.new("HeadingStick", mesh_data)
    bpy.context.collection.objects.link(stick_obj)
    stick_obj.data.materials.append(mat)

    for poly in stick_obj.data.polygons:
        poly.use_smooth = True

    bpy.ops.object.select_all(action="DESELECT")
    stick_obj.select_set(True)
    bpy.context.view_layer.objects.active = stick_obj

    print(f"HeadingStick 생성 완료")
    print(f"  방향: {STICK_DIRECTION_DEG}°")
    print(f"  시작: ({start_x:.2f}, {start_y:.2f}, {STICK_Z})")
    print(f"  끝:   ({end_x:.2f}, {end_y:.2f}, {STICK_Z})")
    print(f"  색상: #{int(STICK_COLOR_R*255):02X}{int(STICK_COLOR_G*255):02X}{int(STICK_COLOR_B*255):02X}")


main()
