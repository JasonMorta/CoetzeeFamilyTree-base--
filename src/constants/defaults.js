import { createId } from '../utils/id';
import { getFamilyAppTitle } from '../config/familyConfig';
import { createDefaultHandles, createDefaultHandleLayout, NODE_TYPES, createDefaultImageSettings, createEmptyStandardPerson } from '../utils/nodeFactory';

export const STORAGE_KEYS = {
  APP_DATA: 'familyTreeAppData',
  AUTH: 'familyTreeAuthData',
  APP_DATA_META: 'familyTreeAppDataMeta'
};

export const APP_METADATA = {
  appName: getFamilyAppTitle(),
  version: '2.30.14',
  author: 'Jason Morta'
};

export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 3 };

// Global settings stay focused on canvas-wide appearance only.
// Per-node image layout now lives on each node so mixed node types stay manageable.
export const DEFAULT_APP_SETTINGS = {
  backgroundColor: '#031131',
  minZoom: 0.2,
  backgroundVariant: 'dots',
  edgeType: 'bezier',
  edgeAnimated: true,
  edgeColor: '#dbe7f8',
  edgeWidth: 2,
  nodeAccent: '#22d3ee',
  nodeGlow: true,
  showMiniMap: true,
  startupViewport: DEFAULT_VIEWPORT,
  startupViewportDesktop: DEFAULT_VIEWPORT,
  startupViewportMobile: DEFAULT_VIEWPORT
};

export const DEFAULT_APP_STATE = {
  nodes: [
    {
      id: createId('node'),
      type: 'familyNode',
      position: { x: 100, y: 100 },
      data: {
        nodeType: NODE_TYPES.STANDARD,
        title: 'Founding Family Photo',
        photo: '',
        photoCaption: 'Example starter node',
        location: 'Cape Town',
        eventDate: '1998-04-14',
        notes: 'Click a node to view details. Login to edit this tree.',
        tags: 'starter,family',
        nodeWidth: 220,
        nodeHeight: 220,
        nodeRadius: 18,
        handles: createDefaultHandles(),
        handleLayout: createDefaultHandleLayout(),
        imageSettings: createDefaultImageSettings(),
        people: [],
        standardPerson: createEmptyStandardPerson()}
    }
  ],
  edges: [],
  viewport: DEFAULT_VIEWPORT,
  appSettings: DEFAULT_APP_SETTINGS,
  savedPeople: [],
  selectedNodeIds: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  activeNodeId: null,
  isNodeModalOpen: false,
  isAdminAuthenticated: false,
  isLoginOpen: false,
  isEditorOpen: false,
  isSettingsOpen: false,
  isMapFullPage: false,
  // UI sync state
  isDirty: false,
  lastExportHash: null,
  isRemoteUpdating: false,
  remoteSyncError: null,
  lastRemoteSyncAt: null,
  remoteCooldownUntil: 0,
  remoteSnapshotHash: null,
  remoteSnapshotExportedAt: null,
  hasInitialRemoteSyncCompleted: false,
  viewportCenter: { x: 0, y: 0 },
  isDrawNodeMode: false,
  editorHasUnsavedChanges: false
};
