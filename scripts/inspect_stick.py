import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(
    filepath="/Users/limchanyeong/Desktop/vtol_workspace/davincilabs_GCS/src/renderer/public/models/drone_with_stick.glb"
)

for obj in bpy.data.objects:
    if obj.type == "MESH":
        bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        xs = [v.x for v in bbox]
        ys = [v.y for v in bbox]
        zs = [v.z for v in bbox]
        print(obj.name)
        print("  X:", round(min(xs), 3), "~", round(max(xs), 3))
        print("  Y:", round(min(ys), 3), "~", round(max(ys), 3))
        print("  Z:", round(min(zs), 3), "~", round(max(zs), 3))
