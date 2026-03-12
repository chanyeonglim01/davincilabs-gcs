"""Background 모드 전용: stick 추가 → GLB 내보내기 → 미리보기 렌더링"""
import bpy
import bmesh
import math
import os

INPUT_GLB  = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone.glb"
OUTPUT_GLB = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone_with_stick.glb"
PREVIEW    = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/scripts/preview_stick.png"

# ── 유저 확정값 ───────────────────────────────────────────────────────────────
STICK_DIRECTION_DEG = -90
STICK_RADIUS  = 0.025
STICK_LENGTH  = 0.75
STICK_OFFSET  = 1
STICK_Z       = -0.12
EMISSION_STRENGTH = 0.15

# 색상: 더 진한 주황 (발광 낮추고 채도 올림)
STICK_COLOR_R = 0xE8 / 255
STICK_COLOR_G = 0x50 / 255
STICK_COLOR_B = 0x10 / 255


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


# ── 씬 초기화 ─────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INPUT_GLB)

# ── 머티리얼 ──────────────────────────────────────────────────────────────────
lr = srgb_to_linear(STICK_COLOR_R)
lg = srgb_to_linear(STICK_COLOR_G)
lb = srgb_to_linear(STICK_COLOR_B)

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

# ── Stick 메쉬 ────────────────────────────────────────────────────────────────
dir_rad = math.radians(STICK_DIRECTION_DEG)
dir_x = math.sin(dir_rad)
dir_y = math.cos(dir_rad)

start_x = dir_x * STICK_OFFSET
start_y = dir_y * STICK_OFFSET
end_x = dir_x * (STICK_OFFSET + STICK_LENGTH)
end_y = dir_y * (STICK_OFFSET + STICK_LENGTH)

mesh_data = bpy.data.meshes.new("HeadingStickMesh")
bm = bmesh.new()

segments = 12
for i in range(segments):
    angle = 2 * math.pi * i / segments
    perp_x = -dir_y
    perp_y = dir_x
    cx = STICK_RADIUS * math.cos(angle)
    cz = STICK_RADIUS * math.sin(angle)
    bm.verts.new((start_x + perp_x * cx, start_y + perp_y * cx, STICK_Z + cz))
    bm.verts.new((end_x + perp_x * cx, end_y + perp_y * cx, STICK_Z + cz))

bm.verts.ensure_lookup_table()
for i in range(segments):
    i0, i1 = i * 2, i * 2 + 1
    i2, i3 = ((i + 1) % segments) * 2, ((i + 1) % segments) * 2 + 1
    bm.faces.new([bm.verts[i0], bm.verts[i1], bm.verts[i3], bm.verts[i2]])
bm.faces.new([bm.verts[i * 2] for i in range(segments)])
bm.faces.new(list(reversed([bm.verts[i * 2 + 1] for i in range(segments)])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(mesh_data)
bm.free()

stick_obj = bpy.data.objects.new("HeadingStick", mesh_data)
bpy.context.collection.objects.link(stick_obj)
stick_obj.data.materials.append(mat)
for poly in stick_obj.data.polygons:
    poly.use_smooth = True

# ── GLB 내보내기 ──────────────────────────────────────────────────────────────
bpy.ops.export_scene.gltf(filepath=OUTPUT_GLB, export_format="GLB", use_selection=False, export_apply=True)
print(f"GLB: {OUTPUT_GLB} ({os.path.getsize(OUTPUT_GLB)/1024:.0f}KB)")

# ── 미리보기 렌더 (top-down) ──────────────────────────────────────────────────
scene = bpy.context.scene
bpy.ops.object.camera_add(location=(0, 0, 4), rotation=(0, 0, 0))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 4.0
scene.camera = cam

bpy.ops.object.light_add(type="SUN", location=(2, -2, 5))
bpy.context.active_object.data.energy = 3

scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.094, 0.11, 0.078, 1)

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 600
scene.render.resolution_y = 600
scene.render.filepath = PREVIEW
scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print(f"Preview: {PREVIEW}")
