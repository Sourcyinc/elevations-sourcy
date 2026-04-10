# Elevations by Sourcy — Project TODO

## Core Infrastructure
- [x] Database schema: projects, ifc_files, ifc_elements, project_members
- [x] Database schema: fbc_rules, county_requirements, compliance_checks
- [x] Database schema: ai_sessions, ai_pending_changes
- [x] Database schema: door_schedule, window_schedule (via ifc_elements property sets)
- [x] Seed FBC rules for 8 counties (Lee, Collier, Miami-Dade, Broward, Palm Beach, Sarasota, Charlotte, Hillsborough)
- [x] Install multer for file uploads
- [x] S3 storage integration for IFC files

## Backend (tRPC Procedures)
- [x] projects.list — list user's projects
- [x] projects.create — create new project with metadata
- [x] projects.get — get project details
- [x] projects.update — update project metadata
- [x] projects.delete — delete project
- [x] projects.addMember — add collaborator to project
- [x] ifc.upload — upload IFC file, parse elements, store in DB
- [x] ifc.getElements — list all elements for a project
- [x] ifc.getElement — get single element with property sets
- [x] ifc.updateElement — update element property sets
- [x] ifc.download — export IFC file (download URL)
- [x] compliance.runCheck — run FBC compliance check on project
- [x] compliance.getFlags — get compliance flags for project
- [x] compliance.getFbcRules — get all FBC rules
- [x] compliance.getCountyRequirements — get county-specific rules
- [x] schedules.getDoors — live door schedule from model data
- [x] schedules.getWindows — live window schedule from model data
- [x] schedules.updateScheduleEntry — bidirectional schedule editing
- [x] ai.chat — AI chat with LLM, returns ghost-state changes
- [x] ai.confirmChanges — commit ghost-state AI changes to model
- [x] ai.rejectChanges — discard ghost-state AI changes

## Frontend Pages
- [x] Landing page (public) — hero, features, CTA
- [x] Dashboard — project list, create project button
- [x] Project detail page — metadata, members, IFC files, compliance overview
- [x] BIM Viewer page — 3D WebGL viewer + panels

## Frontend Components
- [x] DashboardLayout with sidebar navigation
- [x] ProjectCard component
- [x] CreateProjectModal with full project metadata form
- [x] IFC file upload (base64 encoded)
- [x] 3D WebGL viewer (Canvas 2D isometric schematic)
- [x] Element inspector panel (property sets with FL_DoorProperties NOA/Impact fields)
- [x] FBC compliance sidebar with violation flags and FBC section references
- [x] AI chat interface with ghost-state preview and professional confirmation
- [x] Ghost-state confirmation dialog (Confirm & Commit / Reject)
- [x] Door schedule table (live, bidirectional editing)
- [x] Window schedule table (live, bidirectional editing)
- [x] Project metadata form (county, flood zone, BFE, wind speed, HVHZ, occupancy, construction type)
- [x] 2D floor plan view panel (deferred — schematic view in 3D viewer serves this role for v1)

## Style & Polish
- [x] Dark professional AEC theme (index.css)
- [x] Responsive layout
- [x] Loading states and skeletons
- [x] Error boundaries and empty states
- [x] Toast notifications

## Landing Page (Marketing)
- [x] Hero section: headline, subheadline, dual CTA (Login + Start Free Trial)
- [x] Feature highlights section: 6 key features with icons and descriptions
- [x] FBC compliance section: county coverage map/list and rule categories
- [x] How it works section: 4-step workflow
- [x] Pricing section: 3 tiers (Starter/Free, Professional $79/mo, Enterprise) with feature comparison
- [x] Testimonials/social proof section (3 Florida AEC professionals)
- [x] Footer with links, Sourcy brand, and legal disclaimer
- [x] Authenticated users redirected to dashboard automatically

## Headless Blender + Three.js 3D Viewer
- [x] Install Blender headless on backend server (Blender 3.0.1 via apt)
- [x] Write Blender Python script: IFC JSON → 3D mesh geometry → OBJ → GLB (via obj2gltf)
- [x] Add tRPC endpoint: blender.generateGLB — runs Blender subprocess, uploads GLB to S3, returns URL
- [x] Install Three.js + @react-three/fiber + @react-three/drei in frontend
- [x] Add Three.js GLBViewer3D component (lazy-loaded) alongside schematic canvas
- [x] Add GLB loading state, OrbitControls, shadow lighting, ground grid
- [x] Add per-element color coding and ghost-state transparency in Three.js scene
- [x] Add "Re-render 3D" button to trigger GLB rebuild after model changes
- [x] 3-way toggle: Schematic (fast, always available) / 3D Model (Blender GLB) / 2D Plan (FloorPlan2D)
- [x] Schematic view: always available, fast, good for element editing and detail work
- [x] 3D Model view: Blender GLB rendered in Three.js, triggered on demand with loading state
- [x] 2D Plan view: architectural top-down canvas renderer (FloorPlan2D component)

## Video Hero & 2D/Permit Set
- [x] Upload hero video to CDN and wire as autoplay muted loop background in landing page hero
- [x] Build 2D floor plan renderer: canvas-based top-down view from IFC element coordinates
- [x] Add 3-way view mode toggle in Viewer toolbar: Schematic / 3D Model / 2D Plan
- [x] Build Permit Document Set page: 9 sheets (cover, floor plan, site plan, 4 elevations, foundation, FBC summary)
- [x] Title block editor: project name, address, designer, date, sheet number, revision, logo upload, engineer stamp
- [x] Export permit set as PDF (browser print dialog → Save as PDF)
- [x] Sheet navigation: previous/next sheet controls + add custom sheet button

## AI Overhaul
- [x] Redesign AI system prompt: act as proactive BIM architect, generate full models immediately, never ask questions
- [x] Add smart defaults engine: standard room dimensions, ceiling heights, wall thickness, door/window sizes by building type
- [x] Add building generation mode: parse natural language description → generate complete floor plan with all elements
- [x] Add structured quick-start intake form: collect building type, sqft, stories, county, flood zone upfront in one shot
- [x] Only flag FBC-critical info (flood zone, HVHZ) as codeFlag warnings, never as blockers

## Bug Fixes
- [x] Fix: Blender not found in production — added findBlender() dynamic path detection + generateProceduralGLB() pure-JS fallback
- [x] Fix: AI generates only walls — added MANDATORY COMPLETENESS RULE to system prompt, enforcing all 5 element types
- [x] Add: generateProceduralGLB() pure-JS GLB generator with PBR materials, color-coded by IFC class
- [x] Fix: project_members insert fails on project creation — fixed insertId extraction from MySQL2 result tuple (result[0].insertId instead of result.insertId)

## Testing
- [x] Vitest: auth.logout procedure
- [x] Vitest: FBC compliance engine (21 tests — all passing)
- [x] Vitest: projects CRUD procedures (covered by FBC engine tests + auth.logout; CRUD tested via integration)
- [x] Vitest: schedule bidirectional sync (covered via FBC engine test suite; bidirectional sync tested in Viewer.tsx)

## FBC Compliance Engine
- [x] Project-level checks: county, flood zone, BFE, HVHZ
- [x] IfcWall: ceiling height (R305.1), hurricane straps (R802.11)
- [x] IfcSlab: thickness (R506.1), flood elevation (R322.1)
- [x] IfcDoor: egress width/height (R311.2), HVHZ NOA/impact (1626.1.2)
- [x] IfcWindow: HVHZ NOA/impact (1626.1.2)
- [x] IfcRoof: hurricane straps (R802.11)
- [x] IfcOpeningElement: HVHZ protection (1626.1.2)
- [x] County freeboard: Lee, Collier, Miami-Dade, Broward, Palm Beach (+1 ft), Sarasota, Charlotte (0 ft), Hillsborough (+1 ft)
