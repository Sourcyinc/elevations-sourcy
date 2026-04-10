/**
 * FBC Compliance Engine — Florida Building Code 2023 8th Edition
 * Runs passive real-time compliance checks against a project's elements and metadata.
 */

import { IfcElement, Project } from "../drizzle/schema";

export interface ComplianceFlag {
  fbcSection: string;
  severity: "error" | "warning" | "info";
  message: string;
  details: string;
  elementId?: number;
}

interface PropertySets {
  [psetName: string]: Record<string, unknown>;
}

function getPset(element: IfcElement, psetName: string): Record<string, unknown> {
  const psets = element.propertySets as PropertySets | null;
  return psets?.[psetName] ?? {};
}

function getNum(pset: Record<string, unknown>, key: string): number | null {
  const v = pset[key];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Project-level checks ─────────────────────────────────────────────────────

export function checkProjectMetadata(project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (!project.county) {
    flags.push({
      fbcSection: "R301.2",
      severity: "warning",
      message: "County not set — wind speed and flood zone rules cannot be verified.",
      details: "Set the project county to enable county-specific FBC compliance checks.",
    });
  }

  if (!project.floodZone) {
    flags.push({
      fbcSection: "R322.1",
      severity: "warning",
      message: "Flood zone not set — flood compliance checks are disabled.",
      details: "Set the project flood zone (AE, VE, X, etc.) to enable flood compliance checks.",
    });
  }

  if (project.floodZone === "AE" || project.floodZone === "VE") {
    if (project.bfe === null || project.bfe === undefined) {
      flags.push({
        fbcSection: "R322.1",
        severity: "error",
        message: "Base Flood Elevation (BFE) is required for flood zone AE/VE projects.",
        details: "Enter the BFE in ft NAVD from the FIRM map for this parcel.",
      });
    }
  }

  if (project.floodZone === "VE") {
    flags.push({
      fbcSection: "R322.2.2",
      severity: "info",
      message: "Zone VE: Building must be elevated on pilings or columns — no fill permitted under structure.",
      details: "FBC R322.2.2 — Coastal High Hazard Area requirements apply.",
    });
  }

  if (project.hvhz) {
    flags.push({
      fbcSection: "1626.1.2",
      severity: "info",
      message: "HVHZ project: All windows and doors require a Miami-Dade NOA (Notice of Acceptance).",
      details: "FBC Section 1626 — High Velocity Hurricane Zone requirements apply. All opening products must have a valid NOA number.",
    });
  }

  return flags;
}

// ─── Element-level checks ─────────────────────────────────────────────────────

export function checkElement(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  switch (element.ifcClass) {
    case "IfcWall":
      flags.push(...checkWall(element, project));
      break;
    case "IfcSlab":
      flags.push(...checkSlab(element, project));
      break;
    case "IfcDoor":
      flags.push(...checkDoor(element, project));
      break;
    case "IfcWindow":
      flags.push(...checkWindow(element, project));
      break;
    case "IfcRoof":
      flags.push(...checkRoof(element, project));
      break;
    case "IfcOpeningElement":
      flags.push(...checkOpening(element, project));
      break;
  }

  return flags;
}

function checkWall(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const pset = getPset(element, "Pset_WallCommon");
  const height = getNum(pset, "Height") ?? element.height;

  if (height !== null && height < 7.0) {
    flags.push({
      fbcSection: "R305.1",
      severity: "error",
      message: `Wall "${element.name ?? element.globalId}" height ${height.toFixed(2)} ft is below the 7.0 ft minimum ceiling height for habitable rooms.`,
      details: "FBC Residential R305.1 — Minimum ceiling height in habitable rooms is 7 ft 0 in.",
      elementId: element.id,
    });
  }

  if (project.windSpeedMph && project.windSpeedMph >= 110) {
    const hasHurricaneStraps = pset["HurricaneStraps"] as boolean | undefined;
    if (hasHurricaneStraps === false) {
      flags.push({
        fbcSection: "R802.11",
        severity: "error",
        message: `Wall "${element.name ?? element.globalId}": Hurricane straps/rafter ties required at every rafter-to-wall connection (wind speed ${project.windSpeedMph} mph).`,
        details: "FBC Residential R802.11 — Roof-to-wall connections require hurricane straps per ASCE 7-22.",
        elementId: element.id,
      });
    }
  }

  return flags;
}

function checkSlab(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const pset = getPset(element, "Pset_SlabCommon");
  const thickness = getNum(pset, "Thickness") ?? element.depth;

  if (thickness !== null && thickness < 4) {
    flags.push({
      fbcSection: "R506.1",
      severity: "error",
      message: `Slab "${element.name ?? element.globalId}" thickness ${thickness.toFixed(2)} in is below the 4 in minimum for concrete slabs on ground.`,
      details: "FBC Residential R506.1 — Minimum concrete slab thickness for floors on ground is 4 inches.",
      elementId: element.id,
    });
  }

  // Flood zone elevation check
  if ((project.floodZone === "AE" || project.floodZone === "VE") && project.bfe !== null && project.bfe !== undefined) {
    const slabElevation = getNum(pset, "ElevationNAVD") ?? element.positionZ;
    if (slabElevation !== null) {
      const countyFreeboard = getCountyFreeboard(project.county ?? "");
      const requiredElevation = project.bfe + countyFreeboard;
      if (slabElevation < requiredElevation) {
        flags.push({
          fbcSection: "R322.1",
          severity: "error",
          message: `Slab elevation ${slabElevation.toFixed(2)} ft NAVD is below required ${requiredElevation.toFixed(2)} ft (BFE ${project.bfe} ft + ${countyFreeboard} ft county freeboard).`,
          details: `FBC R322.1 — Lowest floor must be at or above BFE. ${project.county} requires +${countyFreeboard} ft freeboard above FBC minimum.`,
          elementId: element.id,
        });
      }
    }
  }

  return flags;
}

function checkDoor(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const pset = getPset(element, "Pset_DoorCommon");
  const flPset = getPset(element, "FL_DoorProperties");

  const width = getNum(pset, "Width") ?? element.width;
  const height = getNum(pset, "Height") ?? element.height;

  // Egress door minimum size
  if (width !== null && width < 32) {
    flags.push({
      fbcSection: "R311.2",
      severity: "error",
      message: `Door "${element.name ?? element.globalId}" width ${width.toFixed(1)} in is below the 32 in minimum egress door width.`,
      details: "FBC Residential R311.2 — Required egress doors must be at least 32 inches wide (clear opening).",
      elementId: element.id,
    });
  }

  if (height !== null && height < 6.75) {
    flags.push({
      fbcSection: "R311.2",
      severity: "error",
      message: `Door "${element.name ?? element.globalId}" height ${height.toFixed(2)} ft is below the 6 ft 8 in minimum egress door height.`,
      details: "FBC Residential R311.2 — Required egress doors must be at least 6 ft 8 in (6.75 ft) in height.",
      elementId: element.id,
    });
  }

  // HVHZ NOA check
  if (project.hvhz) {
    const noaNumber = flPset["NOANumber"] as string | undefined;
    const impactRated = flPset["ImpactRated"] as boolean | undefined;

    if (!noaNumber) {
      flags.push({
        fbcSection: "1626.1.2",
        severity: "error",
        message: `Door "${element.name ?? element.globalId}": NOA number is required for all doors in HVHZ (${project.county}).`,
        details: "FBC Section 1626.1.2 — All doors in HVHZ must have a valid Miami-Dade Notice of Acceptance (NOA) number.",
        elementId: element.id,
      });
    }

    if (impactRated === false || impactRated === undefined) {
      flags.push({
        fbcSection: "1626.1.2",
        severity: "error",
        message: `Door "${element.name ?? element.globalId}": Impact-rated product required in HVHZ (${project.county}).`,
        details: "FBC Section 1626 — All openings in HVHZ must be protected with impact-resistant products or shutters.",
        elementId: element.id,
      });
    }
  }

  return flags;
}

function checkWindow(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const flPset = getPset(element, "FL_WindowProperties");

  // HVHZ NOA check
  if (project.hvhz) {
    const noaNumber = flPset["NOANumber"] as string | undefined;
    const impactRated = flPset["ImpactRated"] as boolean | undefined;

    if (!noaNumber) {
      flags.push({
        fbcSection: "1626.1.2",
        severity: "error",
        message: `Window "${element.name ?? element.globalId}": NOA number is required for all windows in HVHZ (${project.county}).`,
        details: "FBC Section 1626.1.2 — All windows in HVHZ must have a valid Miami-Dade Notice of Acceptance (NOA) number.",
        elementId: element.id,
      });
    }

    if (impactRated === false || impactRated === undefined) {
      flags.push({
        fbcSection: "1626.1.2",
        severity: "error",
        message: `Window "${element.name ?? element.globalId}": Impact-rated glazing required in HVHZ (${project.county}).`,
        details: "FBC Section 1626 — All glazing in HVHZ must be impact-resistant or protected with approved shutters.",
        elementId: element.id,
      });
    }
  }

  return flags;
}

function checkRoof(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (project.windSpeedMph && project.windSpeedMph >= 110) {
    flags.push({
      fbcSection: "R802.11",
      severity: "info",
      message: `Roof "${element.name ?? element.globalId}": Hurricane straps required at every rafter-to-wall connection (wind speed ${project.windSpeedMph} mph).`,
      details: "FBC Residential R802.11 — Roof-to-wall connections must be designed per ASCE 7-22 for the design wind speed.",
      elementId: element.id,
    });
  }

  return flags;
}

function checkOpening(element: IfcElement, project: Project): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (project.hvhz) {
    flags.push({
      fbcSection: "1626.1.2",
      severity: "warning",
      message: `Opening "${element.name ?? element.globalId}": Verify all openings in HVHZ have approved protection (NOA or impact-rated product).`,
      details: "FBC Section 1626 — All openings in HVHZ must be protected.",
      elementId: element.id,
    });
  }

  return flags;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCountyFreeboard(county: string): number {
  const freeboards: Record<string, number> = {
    "Lee County": 1.0,
    "Collier County": 1.0,
    "Miami-Dade County": 1.0,
    "Broward County": 1.0,
    "Palm Beach County": 1.0,
    "Sarasota County": 0.0,
    "Charlotte County": 0.0,
    "Hillsborough County": 1.0,
  };
  return freeboards[county] ?? 0.0;
}

// ─── Full project compliance run ──────────────────────────────────────────────

export function runFullComplianceCheck(project: Project, elements: IfcElement[]): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  flags.push(...checkProjectMetadata(project));
  for (const element of elements) {
    flags.push(...checkElement(element, project));
  }
  return flags;
}
