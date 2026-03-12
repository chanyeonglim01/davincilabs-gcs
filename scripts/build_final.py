"""최종 GLB 빌드: #E87020, emission=0, 유저 확정 파라미터"""
import bpy
import bmesh
import math
import os

INPUT_GLB  = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone.glb"
OUTPUT_GLB = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone_with_stick.glb"

# 확정값
STICK_DIRECTION_DEG = -90
STICK_RADIUS = 0.025
STICK_LENGTH = 0.75
STICK_OFFSET = 1
STICK_Z = -0.12
COLOR_R, COLOR_G, COLOR_B = 0xE8/255, 0x70/255, 0x20/255
EMISSION = 0.0


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INPUT_GLB)

lr, lg, lb = srgb_to_linear(COLOR_R), srgb_to_linear(COLOR_G), srgb_to_linear(COLOR_B)

mat = bpy.data.materials.new(name="HeadingStick_Mat")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Base Color"].default_value = (lr, lg, lb, 1.0)
bsdf.inputs["Roughness"].default_value = 0.2
out_node = nodes.new("ShaderNodeOutputMaterial")
links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

dir_rad = math.radians(STICK_DIRECTION_DEG)
dx, dy = math.sin(dir_rad), math.cos(dir_rad)
sx, sy = dx * STICK_OFFSET, dy * STICK_OFFSET
ex, ey = dx * (STICK_OFFSET + STICK_LENGTH), dy * (STICK_OFFSET + STICK_LENGTH)

mesh_data = bpy.data.meshes.new("HeadingStickMesh")
bm = bmesh.new()
segs = 12
for i in range(segs):
    a = 2 * math.pi * i / segs
    px, py = -dy, dx
    cx = STICK_RADIUS * math.cos(a)
    cz = STICK_RADIUS * math.sin(a)
    bm.verts.new((sx + px*cx, sy + py*cx, STICK_Z + cz))
    bm.verts.new((ex + px*cx, ey + py*cx, STICK_Z + cz))
bm.verts.ensure_lookup_table()
for i in range(segs):
    i0, i1 = i*2, i*2+1
    i2, i3 = ((i+1)%segs)*2, ((i+1)%segs)*2+1
    bm.faces.new([bm.verts[i0], bm.verts[i1], bm.verts[i3], bm.verts[i2]])
bm.faces.new([bm.verts[i*2] for i in range(segs)])
bm.faces.new(list(reversed([bm.verts[i*2+1] for i in range(segs)])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(mesh_data)
bm.free()

obj = bpy.data.objects.new("HeadingStick", mesh_data)
bpy.context.collection.objects.link(obj)
obj.data.materials.append(mat)
for p in obj.data.polygons:
    p.use_smooth = True

bpy.ops.export_scene.gltf(filepath=OUTPUT_GLB, export_format="GLB", use_selection=False, export_apply=True)
sz = os.path.getsize(OUTPUT_GLB) / 1024
print(f"Done: {OUTPUT_GLB} ({sz:.0f}KB)")
