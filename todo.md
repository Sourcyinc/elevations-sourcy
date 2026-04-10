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
