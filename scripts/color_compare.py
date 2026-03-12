"""3가지 색상 옵션 비교 렌더링"""
import bpy
import bmesh
import math
import os

INPUT_GLB = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone.glb"
OUT_DIR = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/scripts"

STICK_DIRECTION_DEG = -90
STICK_RADIUS = 0.025
STICK_LENGTH = 0.75
STICK_OFFSET = 1
STICK_Z = -0.12

# 3가지 색상 옵션
OPTIONS = [
    {"name": "A_E85010", "r": 0xE8/255, "g": 0x50/255, "b": 0x10/255, "em": 0.15, "label": "#E85010 (현재)"},
    {"name": "B_E87020", "r": 0xE8/255, "g": 0x70/255, "b": 0x20/255, "em": 0.0,  "label": "#E87020 emission=0"},
    {"name": "C_FF6600", "r": 0xFF/255, "g": 0x66/255, "b": 0x00/255, "em": 0.1,  "label": "#FF6600 (비비드)"},
]


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def build_and_render(opt):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT_GLB)

    lr = srgb_to_linear(opt["r"])
    lg = srgb_to_linear(opt["g"])
    lb = srgb_to_linear(opt["b"])

    mat = bpy.data.materials.new(name="StickMat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (lr, lg, lb, 1.0)
    bsdf.inputs["Emission Color"].default_value = (lr, lg, lb, 1.0)
    bsdf.inputs["Emission Strength"].default_value = opt["em"]
    bsdf.inputs["Roughness"].default_value = 0.2
    out_node = nodes.new("ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    dir_rad = math.radians(STICK_DIRECTION_DEG)
    dx, dy = math.sin(dir_rad), math.cos(dir_rad)
    sx, sy = dx * STICK_OFFSET, dy * STICK_OFFSET
    ex, ey = dx * (STICK_OFFSET + STICK_LENGTH), dy * (STICK_OFFSET + STICK_LENGTH)

    mesh_data = bpy.data.meshes.new("StickMesh")
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

    # render
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
    scene.render.resolution_x = 500
    scene.render.resolution_y = 500
    out = os.path.join(OUT_DIR, f"color_{opt['name']}.png")
    scene.render.filepath = out
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print(f"{opt['label']} -> {out}")


for opt in OPTIONS:
    build_and_render(opt)
print("Done")
