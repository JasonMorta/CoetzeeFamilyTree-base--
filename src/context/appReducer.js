import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import { createFamilyNode, duplicateFamilyNode, sanitizeHandleCounts, sanitizeHandleLayout, normalizeNodeData } from '../utils/nodeFactory';
import { normalizeSavedPeopleCollection } from '../utils/family3Schema';
import { isAdminSessionValid, logoutAdmin } from '../services/authService';
import { createId } from '../utils/id';
import { DEFAULT_APP_SETTINGS } from '../constants/defaults';
import { createStartupViewportPatch, VIEWPORT_PROFILES } from '../utils/viewportProfiles';
import { hashObject } from '../utils/stableHash';

export const ACTIONS = {
  OPEN_LOGIN: 'OPEN_LOGIN',
  CLOSE_LOGIN: 'CLOSE_LOGIN',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_NODES: 'SET_NODES',
  SET_EDGES: 'SET_EDGES',
  APPLY_NODE_CHANGES: 'APPLY_NODE_CHANGES',
  APPLY_EDGE_CHANGES: 'APPLY_EDGE_CHANGES',
  APPLY_NODE_POSITIONS: 'APPLY_NODE_POSITIONS',
  CONNECT_EDGE: 'CONNECT_EDGE',
  ADD_NODE: 'ADD_NODE',
  DUPLICATE_NODE: 'DUPLICATE_NODE',
  DELETE_NODE: 'DELETE_NODE',
  DELETE_SELECTION: 'DELETE_SELECTION',
  DELETE_EDGE: 'DELETE_EDGE',
  SELECT_NODE: 'SELECT_NODE',
  SELECT_EDGE: 'SELECT_EDGE',
  SET_SELECTED_NODES: 'SET_SELECTED_NODES',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  OPEN_EDITOR: 'OPEN_EDITOR',
  CLOSE_EDITOR: 'CLOSE_EDITOR',
  OPEN_NODE_MODAL: 'OPEN_NODE_MODAL',
  CLOSE_NODE_MODAL: 'CLOSE_NODE_MODAL',
  UPDATE_NODE_DATA: 'UPDATE_NODE_DATA',
  SET_VIEWPORT: 'SET_VIEWPORT',
  SET_VIEWPORT_CENTER: 'SET_VIEWPORT_CENTER',
  OPEN_SETTINGS: 'OPEN_SETTINGS',
  CLOSE_SETTINGS: 'CLOSE_SETTINGS',
  UPDATE_APP_SETTINGS: 'UPDATE_APP_SETTINGS',
  SET_DIRTY: 'SET_DIRTY',
  SET_CLEAN: 'SET_CLEAN',
  SET_EXPORT_HASH: 'SET_EXPORT_HASH',
  REMOTE_SYNC_START: 'REMOTE_SYNC_START',
  REMOTE_SYNC_END: 'REMOTE_SYNC_END',
  APPLY_REMOTE_SNAPSHOT: 'APPLY_REMOTE_SNAPSHOT',
  SET_REMOTE_COOLDOWN: 'SET_REMOTE_COOLDOWN',
  SET_REMOTE_SNAPSHOT_META: 'SET_REMOTE_SNAPSHOT_META',
  SET_SAVED_PEOPLE: 'SET_SAVED_PEOPLE',
  TOGGLE_MAP_FULLPAGE: 'TOGGLE_MAP_FULLPAGE',
  TOGGLE_DRAW_NODE_MODE: 'TOGGLE_DRAW_NODE_MODE',
  SET_DRAW_NODE_MODE: 'SET_DRAW_NODE_MODE',
  SAVE_STARTUP_VIEWPORT: 'SAVE_STARTUP_VIEWPORT',
  SET_EDITOR_UNSAVED_CHANGES: 'SET_EDITOR_UNSAVED_CHANGES'
};

function parseHandleId(handleId) {
  const match = String(handleId || '').match(/^(top|right|bottom|left)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    side: match[1],
    index: Number(match[2]) || 1
  };
}

function isHandleWithinRequestedCount(handleId, requestedHandles) {
  const parsed = parseHandleId(handleId);
  if (!parsed) {
    return true;
  }

  const requestedCount = Math.max(0, Number(requestedHandles?.[parsed.side]) || 0);
  return requestedCount > 0 && parsed.index <= requestedCount;
}

function pruneNodeEdges(edges, nodeId, requestedHandles) {
  return edges.filter((edge) => {
    if (edge.source === nodeId && !isHandleWithinRequestedCount(edge.sourceHandle, requestedHandles)) {
      return false;
    }

    if (edge.target === nodeId && !isHandleWithinRequestedCount(edge.targetHandle, requestedHandles)) {
      return false;
    }

    return true;
  });
}

function buildNodeLookup(nodes = []) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function edgeHandleExistsOnNode(node, handleId) {
  if (!node || !handleId) {
    return false;
  }

  return isHandleWithinRequestedCount(handleId, node.data?.handles || {});
}

function sanitizeEdgesForNodes(edges = [], nodes = []) {
  const nodeLookup = buildNodeLookup(nodes);

  return edges.filter((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    if (!edgeHandleExistsOnNode(sourceNode, edge.sourceHandle)) {
      return false;
    }

    if (!edgeHandleExistsOnNode(targetNode, edge.targetHandle)) {
      return false;
    }

    return true;
  });
}

function ensureConnectedSidesHaveCapacity(edges, nodeId, requestedHandles) {
  const nextHandles = { ...requestedHandles };

  edges.forEach((edge) => {
    const handleIds = [];
    if (edge.source === nodeId) {
      handleIds.push(edge.sourceHandle);
    }
    if (edge.target === nodeId) {
      handleIds.push(edge.targetHandle);
    }

    handleIds.forEach((handleId) => {
      const parsed = parseHandleId(handleId);
      if (!parsed) {
        return;
      }
      if ((nextHandles[parsed.side] || 0) <= 0) {
        nextHandles[parsed.side] = 1;
      }
    });
  });

  return nextHandles;
}

function mergeNodeData(existingData, nextData, edges, nodeId) {
  const merged = normalizeNodeData({ ...existingData, ...nextData });
  const requestedHandles = ensureConnectedSidesHaveCapacity(edges, nodeId, sanitizeHandleCounts(merged.handles));

  return {
    ...merged,
    handles: requestedHandles,
    handleLayout: sanitizeHandleLayout(merged.handleLayout)
  };
}

function getNodeById(nodes, nodeId) {
  return nodes.find((node) => node.id === nodeId);
}

function preserveReferenceIfEqual(currentValue, nextValue) {
  const currentHash = hashObject(currentValue);
  const nextHash = hashObject(nextValue);
  return currentHash === nextHash ? currentValue : nextValue;
}


function canAdminMutate(state) {
  return Boolean(state?.isAdminAuthenticated) && isAdminSessionValid();
}

function denyAdminMutation(state, action) {
  if (import.meta.env.DEV) {
    console.warn(`Blocked admin-only action without a valid admin session: ${action?.type || 'UNKNOWN_ACTION'}`);
  }
  return state;
}

export function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.OPEN_LOGIN:
      return { ...state, isLoginOpen: true };
    case ACTIONS.CLOSE_LOGIN:
      return { ...state, isLoginOpen: false };
    case ACTIONS.LOGIN_SUCCESS:
      return { ...state, ...action.payload, isAdminAuthenticated: true, isLoginOpen: false };
    case ACTIONS.LOGOUT:
      logoutAdmin();
      return {
        ...state,
        isAdminAuthenticated: false,
        isEditorOpen: false,
        selectedNodeId: null,
        selectedEdgeId: null,
        isSettingsOpen: false,
        authVersion: null,
        authenticatedAt: null,
        lastActivityAt: null,
        expiresAt: null
      };
    case ACTIONS.OPEN_SETTINGS:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, isSettingsOpen: true };
    case ACTIONS.CLOSE_SETTINGS:
      return { ...state, isSettingsOpen: false };
    case ACTIONS.UPDATE_APP_SETTINGS:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return {
        ...state,
        appSettings: {
          ...DEFAULT_APP_SETTINGS,
          ...state.appSettings,
          ...action.payload
        }
      };

    case ACTIONS.SET_DIRTY:
      return { ...state, isDirty: true };
    case ACTIONS.SET_CLEAN:
      return { ...state, isDirty: false };
    case ACTIONS.SET_EXPORT_HASH:
      return { ...state, lastExportHash: action.payload, isDirty: false };
    case ACTIONS.REMOTE_SYNC_START:
      return { ...state, isRemoteUpdating: true, remoteSyncError: null };
    case ACTIONS.REMOTE_SYNC_END:
      return {
        ...state,
        isRemoteUpdating: false,
        remoteSyncError: action.payload?.error || null,
        lastRemoteSyncAt: action.payload?.syncedAt || state.lastRemoteSyncAt,
        hasInitialRemoteSyncCompleted: true
      };
    case ACTIONS.SET_REMOTE_COOLDOWN:
      return { ...state, remoteCooldownUntil: action.payload };
    case ACTIONS.SET_REMOTE_SNAPSHOT_META:
      return {
        ...state,
        remoteSnapshotHash: action.payload?.hash || action.payload?.computedHash || state.remoteSnapshotHash,
        remoteSnapshotExportedAt: action.payload?.exportedAt || state.remoteSnapshotExportedAt
      };
    case ACTIONS.APPLY_REMOTE_SNAPSHOT: {
      // Keep auth + UI modals as-is. Only replace persisted canvas data.
      const payload = action.payload || {};
      const nextNodes = (payload.nodes || []).map((node) => ({
        ...node,
        data: normalizeNodeData(node.data || {})
      }));
      const nextEdges = sanitizeEdgesForNodes(payload.edges || [], nextNodes);
      const nextSavedPeople = normalizeSavedPeopleCollection(payload.savedPeople || []);
      const nextViewport = payload.viewport || state.viewport;
      const nextAppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...(payload.appSettings || {})
      };
      const nodes = preserveReferenceIfEqual(state.nodes, nextNodes);
      const edges = preserveReferenceIfEqual(state.edges, nextEdges);
      const savedPeople = preserveReferenceIfEqual(state.savedPeople, nextSavedPeople);
      const viewport = preserveReferenceIfEqual(state.viewport, nextViewport);
      const appSettings = preserveReferenceIfEqual(state.appSettings, nextAppSettings);

      return {
        ...state,
        nodes,
        edges,
        viewport,
        appSettings,
        savedPeople,
        remoteSnapshotHash: payload.meta?.hash || payload.meta?.computedHash || state.remoteSnapshotHash,
        remoteSnapshotExportedAt: payload.meta?.exportedAt || state.remoteSnapshotExportedAt,
        selectedEdgeId: edges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null,
        viewportCenter: payload.viewportCenter || state.viewportCenter
      };
    }

    case ACTIONS.SET_NODES:
      return { ...state, nodes: action.payload };
    case ACTIONS.SET_EDGES:
      return { ...state, edges: action.payload };
    case ACTIONS.APPLY_NODE_CHANGES:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, nodes: applyNodeChanges(action.payload, state.nodes) };
    case ACTIONS.APPLY_EDGE_CHANGES:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, edges: applyEdgeChanges(action.payload, state.edges) };
    case ACTIONS.APPLY_NODE_POSITIONS: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const updates = Array.isArray(action.payload) ? action.payload.filter((item) => item?.id && item?.position) : [];
      if (!updates.length) {
        return state;
      }

      const updateById = new Map(updates.map((item) => [item.id, item.position]));
      let hasAnyChange = false;
      const nextNodes = state.nodes.map((node) => {
        const nextPosition = updateById.get(node.id);
        if (!nextPosition) {
          return node;
        }

        const sameX = Number(node.position?.x) === Number(nextPosition.x);
        const sameY = Number(node.position?.y) === Number(nextPosition.y);
        if (sameX && sameY) {
          return node;
        }

        hasAnyChange = true;
        return {
          ...node,
          position: {
            x: Number(nextPosition.x) || 0,
            y: Number(nextPosition.y) || 0
          }
        };
      });

      return hasAnyChange ? { ...state, nodes: nextNodes } : state;
    }
    case ACTIONS.CONNECT_EDGE:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return {
        ...state,
        selectedEdgeId: null,
        edges: addEdge(
          {
            ...action.payload,
            id: createId('edge')
          },
          state.edges
        )
      };
    case ACTIONS.ADD_NODE: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const position = action.payload?.position || action.payload || state.viewportCenter || { x: 250, y: 180 };
      const dataOverrides = action.payload?.dataOverrides || {};
      const node = createFamilyNode(position, dataOverrides);
      return {
        ...state,
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        selectedEdgeId: null,
        activeNodeId: node.id,
        isNodeModalOpen: false,
        isEditorOpen: true,
        selectedNodeIds: [node.id],
        isDrawNodeMode: false
      };
    }
    case ACTIONS.DUPLICATE_NODE: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const originalNode = state.nodes.find((node) => node.id === action.payload);
      if (!originalNode) {
        return state;
      }

      const duplicatedNode = duplicateFamilyNode(originalNode);
      const relatedEdges = state.edges.filter(
        (edge) => edge.source === originalNode.id || edge.target === originalNode.id
      );

      const duplicatedEdges = relatedEdges.map((edge) => ({
        ...edge,
        id: createId('edge'),
        source: edge.source === originalNode.id ? duplicatedNode.id : edge.source,
        target: edge.target === originalNode.id ? duplicatedNode.id : edge.target,
        selected: false
      }));

      return {
        ...state,
        nodes: [...state.nodes, duplicatedNode],
        edges: [...state.edges, ...duplicatedEdges],
        selectedNodeId: duplicatedNode.id,
        selectedEdgeId: null,
        activeNodeId: duplicatedNode.id,
        isNodeModalOpen: false,
        isEditorOpen: true,
        selectedNodeIds: [duplicatedNode.id],
        isDrawNodeMode: false
      };
    }
    case ACTIONS.DELETE_NODE: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const nodeId = action.payload;
      const nextEdges = state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      const nextSelectedNodeIds = (state.selectedNodeIds || []).filter((id) => id !== nodeId);
      const selectedEdgeStillExists = nextEdges.some((edge) => edge.id === state.selectedEdgeId);
      return {
        ...state,
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: nextEdges,
        selectedNodeIds: nextSelectedNodeIds,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId: selectedEdgeStillExists ? state.selectedEdgeId : null,
        activeNodeId: state.activeNodeId === nodeId ? null : state.activeNodeId,
        isNodeModalOpen: state.activeNodeId === nodeId ? false : state.isNodeModalOpen,
        isEditorOpen: state.selectedNodeId === nodeId ? false : state.isEditorOpen,
        editorHasUnsavedChanges: state.selectedNodeId === nodeId ? false : state.editorHasUnsavedChanges
      };
    }
    case ACTIONS.DELETE_SELECTION: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const payload = action.payload || {};
      const nodeIds = new Set(Array.isArray(payload.nodeIds) ? payload.nodeIds.filter(Boolean) : []);
      const edgeIds = new Set(Array.isArray(payload.edgeIds) ? payload.edgeIds.filter(Boolean) : []);
      if (!nodeIds.size && !edgeIds.size) {
        return state;
      }

      const nextNodes = state.nodes.filter((node) => !nodeIds.has(node.id));
      const nextEdges = state.edges.filter((edge) => {
        if (edgeIds.has(edge.id)) return false;
        if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) return false;
        return true;
      });
      const nextSelectedNodeIds = (state.selectedNodeIds || []).filter((id) => !nodeIds.has(id));
      const nextSelectedNodeId = nextSelectedNodeIds.length ? nextSelectedNodeIds[nextSelectedNodeIds.length - 1] : null;
      const isDeletingActiveNode = state.activeNodeId && nodeIds.has(state.activeNodeId);
      const selectedEdgeStillExists = nextEdges.some((edge) => edge.id === state.selectedEdgeId);

      return {
        ...state,
        nodes: nextNodes,
        edges: nextEdges,
        selectedNodeIds: nextSelectedNodeIds,
        selectedNodeId: nextSelectedNodeId,
        selectedEdgeId: selectedEdgeStillExists ? state.selectedEdgeId : null,
        activeNodeId: isDeletingActiveNode ? null : state.activeNodeId,
        isNodeModalOpen: isDeletingActiveNode ? false : state.isNodeModalOpen,
        isEditorOpen: isDeletingActiveNode ? false : state.isEditorOpen,
        editorHasUnsavedChanges: isDeletingActiveNode ? false : state.editorHasUnsavedChanges
      };
    }
    case ACTIONS.DELETE_EDGE:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return {
        ...state,
        edges: state.edges.filter((edge) => edge.id !== action.payload),
        selectedEdgeId: state.selectedEdgeId === action.payload ? null : state.selectedEdgeId
      };
    case ACTIONS.SET_SELECTED_NODES: {
      const ids = Array.isArray(action.payload) ? action.payload : [];
      if (state.isEditorOpen && state.editorHasUnsavedChanges) {
        const currentId = state.selectedNodeId;
        const onlyCurrentNodeSelected = ids.length === 1 && ids[0] === currentId;
        if (!onlyCurrentNodeSelected) {
          return state;
        }
      }
      return {
        ...state,
        selectedNodeIds: ids,
        selectedNodeId: ids.length ? ids[ids.length - 1] : null,
        selectedEdgeId: null
      };
    }

    case ACTIONS.SELECT_NODE:
      if (state.isEditorOpen && state.editorHasUnsavedChanges && state.selectedNodeId !== action.payload) {
        return state;
      }
      return {
        ...state,
        selectedNodeIds: [action.payload],
        selectedNodeId: action.payload,
        selectedEdgeId: null,
        activeNodeId: action.payload
      };
    case ACTIONS.SELECT_EDGE:
      if (state.isEditorOpen && state.editorHasUnsavedChanges) {
        return state;
      }
      return {
        ...state,
        selectedEdgeId: action.payload,
        selectedNodeId: null,
        isEditorOpen: false,
        editorHasUnsavedChanges: false
      };
    case ACTIONS.CLEAR_SELECTION:
      if (state.isEditorOpen && state.editorHasUnsavedChanges) {
        return state;
      }
      return {
        ...state,
        selectedNodeIds: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        isEditorOpen: false,
        editorHasUnsavedChanges: false
      };
    case ACTIONS.OPEN_EDITOR:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      if (state.isEditorOpen && state.editorHasUnsavedChanges && state.selectedNodeId !== action.payload) {
        return state;
      }
      return {
        ...state,
        isEditorOpen: true,
        isNodeModalOpen: false,
        isDrawNodeMode: false,
        selectedNodeIds: [action.payload],
        selectedNodeId: action.payload,
        selectedEdgeId: null,
        activeNodeId: action.payload,
        editorHasUnsavedChanges: false
      };
    case ACTIONS.CLOSE_EDITOR:
      if (state.editorHasUnsavedChanges) {
        return state;
      }
      return { ...state, isEditorOpen: false, editorHasUnsavedChanges: false };
    case ACTIONS.OPEN_NODE_MODAL:
      if (state.isEditorOpen && state.editorHasUnsavedChanges && state.selectedNodeId !== action.payload) {
        return state;
      }
      return {
        ...state,
        isNodeModalOpen: true,
        activeNodeId: action.payload,
        selectedNodeIds: [action.payload],
        selectedNodeId: action.payload,
        selectedEdgeId: null
      };
    case ACTIONS.CLOSE_NODE_MODAL:
      return { ...state, isNodeModalOpen: false };
    case ACTIONS.SET_EDITOR_UNSAVED_CHANGES:
      return { ...state, editorHasUnsavedChanges: Boolean(action.payload) };
    case ACTIONS.UPDATE_NODE_DATA: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const { id, data } = action.payload;
      const targetNode = getNodeById(state.nodes, id);
      if (!targetNode) {
        return state;
      }

      const mergedNodeData = normalizeNodeData({ ...targetNode.data, ...data });
      const requestedHandles = sanitizeHandleCounts(mergedNodeData.handles);
      const prunedEdges = pruneNodeEdges(state.edges, id, requestedHandles);
      const nextNodeData = {
        ...mergedNodeData,
        handles: ensureConnectedSidesHaveCapacity(prunedEdges, id, requestedHandles),
        handleLayout: sanitizeHandleLayout(mergedNodeData.handleLayout)
      };

      return {
        ...state,
        edges: prunedEdges,
        selectedEdgeId: prunedEdges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null,
        nodes: state.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: nextNodeData
              }
            : node
        )
      };
    }
    case ACTIONS.SET_SAVED_PEOPLE:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, savedPeople: normalizeSavedPeopleCollection(action.payload || []) };
    case ACTIONS.TOGGLE_MAP_FULLPAGE:
      return { ...state, isMapFullPage: !state.isMapFullPage };
    case ACTIONS.SET_DRAW_NODE_MODE:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, isDrawNodeMode: Boolean(action.payload) };
    case ACTIONS.TOGGLE_DRAW_NODE_MODE:
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      return { ...state, isDrawNodeMode: !state.isDrawNodeMode };
    case ACTIONS.SAVE_STARTUP_VIEWPORT: {
      if (!canAdminMutate(state)) return denyAdminMutation(state, action);
      const profile = action.payload?.profile === VIEWPORT_PROFILES.MOBILE
        ? VIEWPORT_PROFILES.MOBILE
        : VIEWPORT_PROFILES.DESKTOP;
      return {
        ...state,
        appSettings: {
          ...DEFAULT_APP_SETTINGS,
          ...state.appSettings,
          ...createStartupViewportPatch(profile, state.viewport)
        }
      };
    }
    case ACTIONS.SET_VIEWPORT: {
      const nextViewport = action.payload || state.viewport;
      if (hashObject(nextViewport) === hashObject(state.viewport)) {
        return state;
      }
      return { ...state, viewport: nextViewport };
    }
    case ACTIONS.SET_VIEWPORT_CENTER: {
      const nextViewportCenter = action.payload || state.viewportCenter;
      if (hashObject(nextViewportCenter) === hashObject(state.viewportCenter)) {
        return state;
      }
      return { ...state, viewportCenter: nextViewportCenter };
    }
    default:
      return state;
  }
}
