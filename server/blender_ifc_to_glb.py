"""
Blender headless script: IFC element JSON → OBJ export → (converted to GLB by caller)
Usage: blender --background --python blender_ifc_to_glb.py -- <input.json> <output.obj>
"""
import bpy
import json
import sys
import os
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)

def make_material(name, r, g, b, a=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = False
    mat.diffuse_color = (r, g, b, a)
    return mat

# Color palette by IFC class
MATERIALS = {
    "IfcWall":          (0.82, 0.78, 0.72, 1.0),   # warm concrete
    "IfcSlab":          (0.65, 0.62, 0.58, 1.0),   # grey concrete
    "IfcRoof":          (0.45, 0.35, 0.28, 1.0),   # dark brown
    "IfcDoor":          (0.55, 0.38, 0.22, 1.0),   # wood brown
    "IfcWindow":        (0.52, 0.78, 0.92, 0.6),   # glass blue
    "IfcOpeningElement":(0.90, 0.90, 0.90, 0.3),   # light grey
    "IfcColumn":        (0.70, 0.70, 0.70, 1.0),   # mid grey
    "IfcBeam":          (0.60, 0.55, 0.50, 1.0),   # steel
    "IfcStair":         (0.75, 0.70, 0.65, 1.0),   # light concrete
}

def add_element(elem, mat_cache):
    ifc_class = elem.get("ifcClass", "IfcWall")
    name = elem.get("name", f"Element_{elem.get('id', 0)}")
    px = float(elem.get("posX", 0))
    py = float(elem.get("posY", 0))
    pz = float(elem.get("posZ", 0))
    w  = max(float(elem.get("width",  1.0)), 0.01)
    h  = max(float(elem.get("height", 1.0)), 0.01)
    d  = max(float(elem.get("depth",  1.0)), 0.01)
    rot = float(elem.get("rotation", 0))

    # Create mesh based on IFC class
    if ifc_class == "IfcRoof":
        # Gabled roof: pyramid-ish shape
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.scale = (w, d, h * 0.5)
        obj.location = (px + w/2, py + d/2, pz + h/4)
    elif ifc_class == "IfcWindow":
        # Thin glass panel
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.scale = (w, max(d, 0.05), h)
        obj.location = (px + w/2, py + d/2, pz + h/2)
    elif ifc_class == "IfcDoor":
        # Door panel with frame
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.scale = (w, max(d, 0.06), h)
        obj.location = (px + w/2, py + d/2, pz + h/2)
    elif ifc_class == "IfcColumn":
        # Cylindrical column
        bpy.ops.mesh.primitive_cylinder_add(radius=max(w, d)/2, depth=h)
        obj = bpy.context.active_object
        obj.location = (px + w/2, py + d/2, pz + h/2)
    elif ifc_class == "IfcStair":
        # Stair as stepped mesh approximation
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.scale = (w, d, h)
        obj.location = (px + w/2, py + d/2, pz + h/2)
    else:
        # Default box (IfcWall, IfcSlab, IfcBeam, etc.)
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.scale = (w, d, h)
        obj.location = (px + w/2, py + d/2, pz + h/2)

    obj.name = name
    obj.rotation_euler[2] = math.radians(rot)

    # Apply material
    rgba = MATERIALS.get(ifc_class, (0.7, 0.7, 0.7, 1.0))
    mat_key = ifc_class
    if mat_key not in mat_cache:
        mat_cache[mat_key] = make_material(mat_key, *rgba)
    if obj.data.materials:
        obj.data.materials[0] = mat_cache[mat_key]
    else:
        obj.data.materials.append(mat_cache[mat_key])

    return obj

def main():
    argv = sys.argv
    try:
        sep = argv.index("--")
        args = argv[sep + 1:]
    except ValueError:
        print("ERROR: No -- separator found")
        sys.exit(1)

    if len(args) < 2:
        print("ERROR: Usage: blender --background --python script.py -- input.json output.obj")
        sys.exit(1)

    input_json = args[0]
    output_obj = args[1]

    with open(input_json, "r") as f:
        data = json.load(f)

    elements = data.get("elements", [])
    clear_scene()

    mat_cache = {}
    added = 0
    for elem in elements:
        try:
            add_element(elem, mat_cache)
            added += 1
        except Exception as e:
            print(f"WARNING: Failed to add element {elem.get('id')}: {e}")

    print(f"INFO: Added {added}/{len(elements)} elements")

    # Export as OBJ (no numpy required)
    os.makedirs(os.path.dirname(output_obj) if os.path.dirname(output_obj) else ".", exist_ok=True)
    bpy.ops.export_scene.obj(
        filepath=output_obj,
        use_selection=False,
        use_materials=True,
        use_triangles=True,
        axis_forward='Y',
        axis_up='Z'
    )
    print(f"INFO: OBJ exported to {output_obj}")

main()
