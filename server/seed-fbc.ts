/**
 * FBC Seed Script — Florida Building Code 2023 8th Edition
 * Seeds fbc_rules and county_requirements tables.
 * Run once: npx tsx server/seed-fbc.ts
 */
import { drizzle } from "drizzle-orm/mysql2";
import { countyRequirements, fbcRules } from "../drizzle/schema";

async function seed() {
  const db = drizzle(process.env.DATABASE_URL!);

  // --- FBC Rules (2023 8th Edition) -----------------------------------------

  const rules = [
    // Ceiling Heights
    { section: "R305.1", description: "Minimum ceiling height in habitable rooms", category: "egress" as const, value: 7.0, unit: "ft", condition: "Habitable rooms", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R305.1.1", description: "Minimum ceiling height in bathrooms, toilet rooms, laundry rooms", category: "egress" as const, value: 6.5, unit: "ft", condition: "Bathrooms, toilet rooms, laundry", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },

    // Room Dimensions
    { section: "R304.1", description: "Minimum floor area for every dwelling unit", category: "egress" as const, value: 120, unit: "SF", condition: "Efficiency dwelling unit", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R304.2", description: "Minimum floor area for bedrooms", category: "egress" as const, value: 70, unit: "SF", condition: "Bedroom", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R304.3", description: "Minimum horizontal dimension of habitable room", category: "egress" as const, value: 7.0, unit: "ft", condition: "Habitable room", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },

    // Egress / Stairs
    { section: "R311.7.4.1", description: "Maximum stair riser height", category: "egress" as const, value: 7.75, unit: "in", condition: "Residential stairs", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R311.7.4.2", description: "Minimum stair tread depth", category: "egress" as const, value: 10.0, unit: "in", condition: "Residential stairs", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R311.7.2", description: "Minimum stair width", category: "egress" as const, value: 36, unit: "in", condition: "Residential stairs", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R311.2", description: "Minimum egress door width", category: "egress" as const, value: 32, unit: "in", condition: "Required egress door", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R311.2", description: "Minimum egress door height", category: "egress" as const, value: 6.75, unit: "ft", condition: "Required egress door", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },

    // Structural
    { section: "R506.1", description: "Minimum concrete slab thickness for floors on ground", category: "structural" as const, value: 4, unit: "in", condition: "Slab-on-grade", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R403.1", description: "Minimum footing width for 1-story", category: "structural" as const, value: 12, unit: "in", condition: "1-story building", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R403.1", description: "Minimum footing depth below grade", category: "structural" as const, value: 12, unit: "in", condition: "Frost depth (Florida — no frost)", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed." },
    { section: "R802.11", description: "Hurricane strap / rafter tie required at every rafter-to-wall connection", category: "wind" as const, value: null, unit: null, condition: "Wind speed > 110 mph or HVHZ", occupancy: "R-3", notes: "FBC Residential 2023 8th Ed. — ASCE 7-22" },

    // Flood Zone
    { section: "R322.1", description: "Lowest floor elevation in flood zone AE must be at or above BFE", category: "flood" as const, value: 0, unit: "ft above BFE", condition: "Flood Zone AE", occupancy: "All", notes: "FBC Residential 2023 8th Ed. — ASCE 24-14" },
    { section: "R322.1.6", description: "Flood vents required in enclosed areas below BFE in Zone AE", category: "flood" as const, value: 1, unit: "sq in per sq ft of enclosed area", condition: "Flood Zone AE, enclosed area below BFE", occupancy: "All", notes: "FEMA TB-1, FBC R322.1.6" },
    { section: "R322.2", description: "Lowest floor elevation in flood zone VE must be at or above BFE", category: "flood" as const, value: 0, unit: "ft above BFE", condition: "Flood Zone VE", occupancy: "All", notes: "FBC Residential 2023 8th Ed." },
    { section: "R322.2.1", description: "No fill permitted under buildings in Coastal High Hazard Zone VE", category: "flood" as const, value: null, unit: null, condition: "Flood Zone VE", occupancy: "All", notes: "FBC Residential 2023 8th Ed." },
    { section: "R322.2.2", description: "Buildings in Zone VE must be elevated on pilings or columns", category: "flood" as const, value: null, unit: null, condition: "Flood Zone VE", occupancy: "All", notes: "FBC Residential 2023 8th Ed." },

    // Wind
    { section: "R301.2.1", description: "Design wind speed for Lee County (non-HVHZ)", category: "wind" as const, value: 155, unit: "mph", condition: "Lee County, Exposure C", occupancy: "All", notes: "FBC 2023 Table R301.2(1)" },
    { section: "R301.2.1", description: "Design wind speed for Miami-Dade County (HVHZ)", category: "wind" as const, value: 185, unit: "mph", condition: "Miami-Dade County, HVHZ, Exposure D", occupancy: "All", notes: "FBC 2023 Table R301.2(1)" },

    // HVHZ
    { section: "1626.1.2", description: "All windows and doors in HVHZ must have NOA (Notice of Acceptance)", category: "wind" as const, value: null, unit: null, condition: "HVHZ (Miami-Dade, Broward)", occupancy: "All", notes: "FBC 2023 Section 1626 — Miami-Dade Product Control" },
    { section: "1626.1.2", description: "Impact-rated glazing required in HVHZ for all openings", category: "wind" as const, value: null, unit: null, condition: "HVHZ", occupancy: "All", notes: "FBC 2023 Section 1626" },

    // Energy
    { section: "R402.1.2", description: "Minimum ceiling insulation R-value, Climate Zone 1 (South FL)", category: "energy" as const, value: 30, unit: "R-value", condition: "Climate Zone 1 (Monroe, Miami-Dade, Collier, Lee, Charlotte, Sarasota, Broward, Palm Beach, Hillsborough)", occupancy: "R-3", notes: "FBC Energy 2023 Table R402.1.2" },
    { section: "R402.4.1", description: "Maximum window-to-wall ratio for energy compliance", category: "energy" as const, value: 0.30, unit: "ratio", condition: "Climate Zone 1", occupancy: "R-3", notes: "FBC Energy 2023 R402.4.1" },
  ];

  console.log("Seeding FBC rules...");
  for (const rule of rules) {
    await db.insert(fbcRules).values(rule).onDuplicateKeyUpdate({ set: { description: rule.description } });
  }
  console.log(`Seeded ${rules.length} FBC rules.`);

  // --- County Requirements ---------------------------------------------------

  const counties = [
    {
      county: "Lee County",
      freeboardFt: 1.0,
      windSpeedMph: 155,
      hvhz: false,
      floodZones: "AE,VE,X,AH",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://www.leegov.com/dcd/building",
      digitalSignatureRequired: false,
      notes: "Lee County: +1.0 ft freeboard above BFE minimum. Wind speed 155 mph. Unincorporated Lee County amendments apply.",
    },
    {
      county: "Collier County",
      freeboardFt: 1.0,
      windSpeedMph: 160,
      hvhz: false,
      floodZones: "AE,VE,X,AO",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://www.colliercountyfl.gov/government/growth-management/divisions/building-plan-review-inspection",
      digitalSignatureRequired: false,
      notes: "Collier County: +1.0 ft freeboard. Wind speed 160 mph. Coastal areas may require additional flood analysis.",
    },
    {
      county: "Miami-Dade County",
      freeboardFt: 1.0,
      windSpeedMph: 185,
      hvhz: true,
      floodZones: "AE,VE,X,AH,AO",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy", "hvhz_product_approval"]),
      submittalPortalUrl: "https://www.miamidade.gov/permits/",
      digitalSignatureRequired: true,
      notes: "Miami-Dade: HVHZ — all windows/doors require NOA. Wind 185 mph. Digital signature required. Miami-Dade Product Control approval required for all openings.",
    },
    {
      county: "Broward County",
      freeboardFt: 1.0,
      windSpeedMph: 170,
      hvhz: true,
      floodZones: "AE,VE,X",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy", "hvhz_product_approval"]),
      submittalPortalUrl: "https://www.broward.org/Building/Pages/Default.aspx",
      digitalSignatureRequired: true,
      notes: "Broward County: HVHZ — NOA required for all openings. Wind 170 mph. Digital signature required.",
    },
    {
      county: "Palm Beach County",
      freeboardFt: 1.0,
      windSpeedMph: 165,
      hvhz: false,
      floodZones: "AE,VE,X,AH",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://discover.pbcgov.org/pzb/building/Pages/default.aspx",
      digitalSignatureRequired: false,
      notes: "Palm Beach County: +1.0 ft freeboard. Wind 165 mph. Coastal municipalities may have additional requirements.",
    },
    {
      county: "Sarasota County",
      freeboardFt: 0.0,
      windSpeedMph: 150,
      hvhz: false,
      floodZones: "AE,VE,X",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://www.scgov.net/government/planning-and-development-services/building-division",
      digitalSignatureRequired: false,
      notes: "Sarasota County: FBC minimum freeboard only. Wind 150 mph. City of Sarasota may have additional requirements.",
    },
    {
      county: "Charlotte County",
      freeboardFt: 0.0,
      windSpeedMph: 150,
      hvhz: false,
      floodZones: "AE,VE,X",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://www.charlottecountyfl.gov/departments/community-development/building-construction-services/",
      digitalSignatureRequired: false,
      notes: "Charlotte County: FBC minimum only. Wind 150 mph.",
    },
    {
      county: "Hillsborough County",
      freeboardFt: 1.0,
      windSpeedMph: 145,
      hvhz: false,
      floodZones: "AE,VE,X,AH",
      requiredSheets: JSON.stringify(["cover", "site", "floor_plan", "elevations", "sections", "structural", "energy"]),
      submittalPortalUrl: "https://www.hillsboroughcounty.org/en/businesses/permits-and-licenses/building-permits",
      digitalSignatureRequired: false,
      notes: "Hillsborough County: +1.0 ft freeboard. Wind 145 mph. City of Tampa has separate jurisdiction.",
    },
  ];

  console.log("Seeding county requirements...");
  for (const county of counties) {
    await db.insert(countyRequirements).values(county).onDuplicateKeyUpdate({ set: { windSpeedMph: county.windSpeedMph } });
  }
  console.log(`Seeded ${counties.length} county requirements.`);
  console.log("FBC seed complete.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
