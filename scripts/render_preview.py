"""Top-down + perspective 렌더링으로 스틱 위치 확인"""
import bpy
import math

GLB = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone_with_stick.glb"
OUT_TOP  = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/scripts/preview_top.png"
OUT_PERSP = "/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/scripts/preview_persp.png"


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    scene = bpy.context.scene
    # Dark background
    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.094, 0.11, 0.078, 1)
    # Light
    bpy.ops.object.light_add(type="SUN", location=(2, -2, 5))
    bpy.context.active_object.data.energy = 3
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 600
    scene.render.resolution_y = 600
    return scene


# ── Top-down (Cesium 3D 맵 시점) ──────────────────────────────────────────────
scene = setup_scene()
bpy.ops.object.camera_add(location=(0, 0, 4), rotation=(0, 0, 0))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 3.5
scene.camera = cam
scene.render.filepath = OUT_TOP
bpy.ops.render.render(write_still=True)
print("Top-down done")

# ── Perspective (Blender 기본 뷰포트 비슷) ────────────────────────────────────
setup_scene()
bpy.ops.object.camera_add(
    location=(2.5, -2.5, 2.5),
    rotation=(math.radians(55), 0, math.radians(45)),
)
cam2 = bpy.context.active_object
cam2.data.type = "PERSP"
cam2.data.lens = 50
scene = bpy.context.scene
scene.camera = cam2
scene.render.filepath = OUT_PERSP
bpy.ops.render.render(write_still=True)
print("Perspective done")
