/**
 * IFC Parser — Server-side IFC file parsing
 * Parses IFC STEP format files and extracts building elements with property sets.
 * This is a lightweight parser for IFC2x3/IFC4 STEP files without IfcOpenShell dependency.
 * In production, replace with a Python microservice using IfcOpenShell.
 */

import { v4 as uuidv4 } from "uuid";

export interface ParsedElement {
  globalId: string;
  ifcClass: string;
  name: string | null;
  description: string | null;
  storey: string | null;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  propertySets: Record<string, Record<string, unknown>>;
}

const SUPPORTED_CLASSES = new Set([
  "IFCWALL", "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCROOF",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCOPENINGELEMENT",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCFOOTING",
]);

const CLASS_DISPLAY_MAP: Record<string, string> = {
  IFCWALL: "IfcWall",
  IFCWALLSTANDARDCASE: "IfcWall",
  IFCSLAB: "IfcSlab",
  IFCROOF: "IfcRoof",
  IFCDOOR: "IfcDoor",
  IFCWINDOW: "IfcWindow",
  IFCOPENINGELEMENT: "IfcOpeningElement",
  IFCBEAM: "IfcBeam",
  IFCCOLUMN: "IfcColumn",
  IFCFOOTING: "IfcFooting",
};

/**
 * Parse IFC STEP file content and extract building elements.
 */
export function parseIfcContent(content: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const lines = content.split("\n");

  // Build entity map: #id -> { class, params }
  const entityMap = new Map<string, { cls: string; params: string }>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const id = trimmed.substring(0, eqIdx).trim();
    const rest = trimmed.substring(eqIdx + 1).trim();
    const parenIdx = rest.indexOf("(");
    if (parenIdx === -1) continue;
    const cls = rest.substring(0, parenIdx).trim().toUpperCase();
    const params = rest.substring(parenIdx + 1, rest.lastIndexOf(")"));
    entityMap.set(id, { cls, params });
  }

  // Extract supported elements
  for (const entity of Array.from(entityMap.values())) {
    if (!SUPPORTED_CLASSES.has(entity.cls)) continue;

    const params = parseParams(entity.params);
    const globalId = cleanString(params[0]) ?? uuidv4();
    const name = cleanString(params[2]);
    const description = cleanString(params[3]);

    const element: ParsedElement = {
      globalId,
      ifcClass: CLASS_DISPLAY_MAP[entity.cls] ?? entity.cls,
      name,
      description,
      storey: null,
      positionX: null,
      positionY: null,
      positionZ: null,
      width: null,
      height: null,
      depth: null,
      propertySets: buildDefaultPropertySets(CLASS_DISPLAY_MAP[entity.cls] ?? entity.cls),
    };

    elements.push(element);
  }

  return elements;
}

function parseParams(paramStr: string): string[] {
  const params: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;

  for (let i = 0; i < paramStr.length; i++) {
    const ch = paramStr[i];
    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      inString = false;
      current += ch;
    } else if (inString) {
      current += ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      params.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function cleanString(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === "$" || trimmed === "") return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/\\X2\\[0-9A-F]+\\X0\\/g, "").trim() || null;
  }
  return null;
}

function buildDefaultPropertySets(ifcClass: string): Record<string, Record<string, unknown>> {
  const psets: Record<string, Record<string, unknown>> = {};

  switch (ifcClass) {
    case "IfcWall":
      psets["Pset_WallCommon"] = {
        IsExternal: false,
        LoadBearing: false,
        FireRating: null,
        AcousticRating: null,
        Height: null,
        HurricaneStraps: null,
      };
      break;
    case "IfcSlab":
      psets["Pset_SlabCommon"] = {
        IsExternal: false,
        LoadBearing: true,
        Thickness: null,
        ElevationNAVD: null,
      };
      break;
    case "IfcDoor":
      psets["Pset_DoorCommon"] = {
        Width: null,
        Height: null,
        FireRating: null,
        AcousticRating: null,
        Remarks: null,
      };
      psets["FL_DoorProperties"] = {
        NOANumber: null,
        ImpactRated: null,
        HardwareSet: null,
        Material: null,
        Manufacturer: null,
        ProductModel: null,
      };
      break;
    case "IfcWindow":
      psets["Pset_WindowCommon"] = {
        Width: null,
        Height: null,
        UFactor: null,
        SHGC: null,
        AcousticRating: null,
      };
      psets["FL_WindowProperties"] = {
        NOANumber: null,
        ImpactRated: null,
        Material: null,
        Manufacturer: null,
        ProductModel: null,
      };
      break;
    case "IfcRoof":
      psets["Pset_RoofCommon"] = {
        TotalArea: null,
        Slope: null,
        Material: null,
      };
      break;
    case "IfcOpeningElement":
      psets["Pset_OpeningElementCommon"] = {
        Width: null,
        Height: null,
      };
      break;
  }

  return psets;
}

/**
 * Generate a sample IFC STEP file for testing.
 * Creates a simple Florida residential model with walls, slab, roof, doors, and windows.
 */
export function generateSampleIfc(): string {
  const now = new Date().toISOString().replace(/[-:T]/g, "").substring(0, 15);
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Elevations by Sourcy - Sample Florida Residential Model'),'2;1');
FILE_NAME('sample_florida_residence.ifc','${now}',('Elevations by Sourcy'),('Sourcy Inc.'),'IfcOpenShell 0.8.4','Elevations by Sourcy BIM Platform','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('${uuidv4().substring(0,22)}',#2,'Sample Florida Residence',$,$,$,$,(#20),#30);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);
#3=IFCPERSONANDORGANIZATION(#5,#6,$);
#4=IFCAPPLICATION(#6,'0.8.4','IfcOpenShell','IfcOpenShell');
#5=IFCPERSON($,'Sourcy','Elevations',$,$,$,$,$);
#6=IFCORGANIZATION($,'Sourcy Inc.',$,$,$);
#10=IFCSITE('${uuidv4().substring(0,22)}',#2,'Lee County Site',$,$,#11,$,$,.ELEMENT.,$,$,$,$,$);
#11=IFCLOCALPLACEMENT($,#12);
#12=IFCAXIS2PLACEMENT3D(#13,$,$);
#13=IFCCARTESIANPOINT((0.,0.,0.));
#20=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#21,$);
#21=IFCAXIS2PLACEMENT3D(#13,$,$);
#30=IFCUNITASSIGNMENT((#31,#32,#33));
#31=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#32=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#33=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#40=IFCBUILDING('${uuidv4().substring(0,22)}',#2,'Sample Florida Residence',$,$,#41,$,$,.ELEMENT.,$,$,$);
#41=IFCLOCALPLACEMENT(#11,#42);
#42=IFCAXIS2PLACEMENT3D(#43,$,$);
#43=IFCCARTESIANPOINT((0.,0.,0.));
#50=IFCBUILDINGSTOREY('${uuidv4().substring(0,22)}',#2,'First Floor',$,$,#51,$,$,.ELEMENT.,0.);
#51=IFCLOCALPLACEMENT(#41,#52);
#52=IFCAXIS2PLACEMENT3D(#53,$,$);
#53=IFCCARTESIANPOINT((0.,0.,2.7432));
/* Walls */
#100=IFCWALLSTANDARDCASE('${uuidv4().substring(0,22)}',#2,'South Exterior Wall',$,'CBS 8in Block',#101,$,$);
#101=IFCLOCALPLACEMENT(#51,#102);
#102=IFCAXIS2PLACEMENT3D(#103,$,$);
#103=IFCCARTESIANPOINT((0.,0.,0.));
#110=IFCWALLSTANDARDCASE('${uuidv4().substring(0,22)}',#2,'North Exterior Wall',$,'CBS 8in Block',#111,$,$);
#111=IFCLOCALPLACEMENT(#51,#112);
#112=IFCAXIS2PLACEMENT3D(#113,$,$);
#113=IFCCARTESIANPOINT((0.,12.192,0.));
#120=IFCWALLSTANDARDCASE('${uuidv4().substring(0,22)}',#2,'East Exterior Wall',$,'CBS 8in Block',#121,$,$);
#121=IFCLOCALPLACEMENT(#51,#122);
#122=IFCAXIS2PLACEMENT3D(#123,$,$);
#123=IFCCARTESIANPOINT((9.144,0.,0.));
#130=IFCWALLSTANDARDCASE('${uuidv4().substring(0,22)}',#2,'West Exterior Wall',$,'CBS 8in Block',#131,$,$);
#131=IFCLOCALPLACEMENT(#51,#132);
#132=IFCAXIS2PLACEMENT3D(#133,$,$);
#133=IFCCARTESIANPOINT((0.,0.,0.));
/* Slab */
#200=IFCSLAB('${uuidv4().substring(0,22)}',#2,'Ground Floor Slab',$,'4in Concrete Slab on Grade',#201,$,$,.FLOOR.);
#201=IFCLOCALPLACEMENT(#51,#202);
#202=IFCAXIS2PLACEMENT3D(#203,$,$);
#203=IFCCARTESIANPOINT((0.,0.,-0.1016));
/* Roof */
#300=IFCROOF('${uuidv4().substring(0,22)}',#2,'Hip Roof',$,'Metal Panel Roof',#301,$,$,.HIP_ROOF.);
#301=IFCLOCALPLACEMENT(#51,#302);
#302=IFCAXIS2PLACEMENT3D(#303,$,$);
#303=IFCCARTESIANPOINT((0.,0.,2.7432));
/* Doors */
#400=IFCDOOR('${uuidv4().substring(0,22)}',#2,'Front Entry Door',$,'Impact Fiberglass 3070',#401,$,$,2.1336,0.9144);
#401=IFCLOCALPLACEMENT(#51,#402);
#402=IFCAXIS2PLACEMENT3D(#403,$,$);
#403=IFCCARTESIANPOINT((1.524,0.,0.));
#410=IFCDOOR('${uuidv4().substring(0,22)}',#2,'Rear Sliding Glass Door',$,'Impact SGD 6068',#411,$,$,2.1336,1.8288);
#411=IFCLOCALPLACEMENT(#51,#412);
#412=IFCAXIS2PLACEMENT3D(#413,$,$);
#413=IFCCARTESIANPOINT((3.048,12.192,0.));
/* Windows */
#500=IFCWINDOW('${uuidv4().substring(0,22)}',#2,'Living Room Window South',$,'Impact Casement 4040',#501,$,$,1.2192,1.2192);
#501=IFCLOCALPLACEMENT(#51,#502);
#502=IFCAXIS2PLACEMENT3D(#503,$,$);
#503=IFCCARTESIANPOINT((4.572,0.,0.9144));
#510=IFCWINDOW('${uuidv4().substring(0,22)}',#2,'Bedroom Window East',$,'Impact Single Hung 3030',#511,$,$,0.9144,0.9144);
#511=IFCLOCALPLACEMENT(#51,#512);
#512=IFCAXIS2PLACEMENT3D(#513,$,$);
#513=IFCCARTESIANPOINT((9.144,3.048,0.9144));
#520=IFCWINDOW('${uuidv4().substring(0,22)}',#2,'Kitchen Window North',$,'Impact Single Hung 2030',#521,$,$,0.9144,0.6096);
#521=IFCLOCALPLACEMENT(#51,#522);
#522=IFCAXIS2PLACEMENT3D(#523,$,$);
#523=IFCCARTESIANPOINT((6.096,12.192,0.9144));
/* Opening Elements */
#600=IFCOPENINGELEMENT('${uuidv4().substring(0,22)}',#2,'Front Door Opening',$,$,#601,$,$);
#601=IFCLOCALPLACEMENT(#51,#602);
#602=IFCAXIS2PLACEMENT3D(#603,$,$);
#603=IFCCARTESIANPOINT((1.524,0.,0.));
ENDSEC;
END-ISO-10303-21;
`;
}
