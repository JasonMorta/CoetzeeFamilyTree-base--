import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import { createFamilyNode, duplicateFamilyNode, sanitizeHandleCounts, sanitizeHandleLayout, normalizeNodeData } from '../utils/nodeFactory';
import { logoutAdmin } from '../services/authService';
import { createId } from '../utils/id';
import { DEFAULT_APP_SETTINGS } from '../constants/defaults';

export const ACTIONS = {
  OPEN_LOGIN: 'OPEN_LOGIN',
  CLOSE_LOGIN: 'CLOSE_LOGIN',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_NODES: 'SET_NODES',
  SET_EDGES: 'SET_EDGES',
  APPLY_NODE_CHANGES: 'APPLY_NODE_CHANGES',
  APPLY_EDGE_CHANGES: 'APPLY_EDGE_CHANGES',
  CONNECT_EDGE: 'CONNECT_EDGE',
  ADD_NODE: 'ADD_NODE',
  DUPLICATE_NODE: 'DUPLICATE_NODE',
  DELETE_NODE: 'DELETE_NODE',
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
  SET_SAVED_PEOPLE: 'SET_SAVED_PEOPLE',
  TOGGLE_MAP_FULLPAGE: 'TOGGLE_MAP_FULLPAGE',
  TOGGLE_DRAW_NODE_MODE: 'TOGGLE_DRAW_NODE_MODE',
  SET_DRAW_NODE_MODE: 'SET_DRAW_NODE_MODE',
  SAVE_STARTUP_VIEWPORT: 'SAVE_STARTUP_VIEWPORT'
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

export function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.OPEN_LOGIN:
      return { ...state, isLoginOpen: true };
    case ACTIONS.CLOSE_LOGIN:
      return { ...state, isLoginOpen: false };
    case ACTIONS.LOGIN_SUCCESS:
      return { ...state, isAdminAuthenticated: true, isLoginOpen: false };
    case ACTIONS.LOGOUT:
      logoutAdmin();
      return {
        ...state,
        isAdminAuthenticated: false,
        isEditorOpen: false,
        selectedNodeId: null,
        selectedEdgeId: null,
        isSettingsOpen: false
      };
    case ACTIONS.OPEN_SETTINGS:
      return { ...state, isSettingsOpen: true };
    case ACTIONS.CLOSE_SETTINGS:
      return { ...state, isSettingsOpen: false };
    case ACTIONS.UPDATE_APP_SETTINGS:
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
    case ACTIONS.APPLY_REMOTE_SNAPSHOT: {
      // Keep auth + UI modals as-is. Only replace persisted canvas data.
      const payload = action.payload || {};
      const nodes = (payload.nodes || []).map((node) => ({
        ...node,
        data: normalizeNodeData(node.data || {})
      }));
      const edges = sanitizeEdgesForNodes(payload.edges || [], nodes);
      const savedPeople = Array.isArray(payload.savedPeople) ? payload.savedPeople : [];
      return {
        ...state,
        nodes,
        edges,
        viewport: payload.viewport || state.viewport,
        appSettings: {
          ...DEFAULT_APP_SETTINGS,
          ...(payload.appSettings || {})
        },
        savedPeople,
        selectedEdgeId: edges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null,
        viewportCenter: payload.viewportCenter || state.viewportCenter
      };
    }

    case ACTIONS.SET_NODES:
      return { ...state, nodes: action.payload };
    case ACTIONS.SET_EDGES:
      return { ...state, edges: action.payload };
    case ACTIONS.APPLY_NODE_CHANGES:
      return { ...state, nodes: applyNodeChanges(action.payload, state.nodes) };
    case ACTIONS.APPLY_EDGE_CHANGES:
      return { ...state, edges: applyEdgeChanges(action.payload, state.edges) };
    case ACTIONS.CONNECT_EDGE:
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
        selectedNodeIds: [node.id],
        isDrawNodeMode: false
      };
    }
    case ACTIONS.DELETE_NODE: {
      const nodeId = action.payload;
      return {
        ...state,
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId: null,
        activeNodeId: state.activeNodeId === nodeId ? null : state.activeNodeId,
        isNodeModalOpen: state.activeNodeId === nodeId ? false : state.isNodeModalOpen,
        isEditorOpen: state.selectedNodeId === nodeId ? false : state.isEditorOpen
      };
    }
    case ACTIONS.DELETE_EDGE:
      return {
        ...state,
        edges: state.edges.filter((edge) => edge.id !== action.payload),
        selectedEdgeId: state.selectedEdgeId === action.payload ? null : state.selectedEdgeId
      };
    case ACTIONS.SET_SELECTED_NODES: {
      const ids = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        selectedNodeIds: ids,
        selectedNodeId: ids.length ? ids[ids.length - 1] : null,
        selectedEdgeId: null
      };
    }

    case ACTIONS.SELECT_NODE:
      return {
        ...state,
        selectedNodeIds: [action.payload],
        selectedNodeId: action.payload,
        selectedEdgeId: null,
        activeNodeId: action.payload
      };
    case ACTIONS.SELECT_EDGE:
      return {
        ...state,
        selectedEdgeId: action.payload,
        selectedNodeId: null,
        isEditorOpen: false
      };
    case ACTIONS.CLEAR_SELECTION:
      return {
        ...state,
        selectedNodeIds: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        isEditorOpen: false
      };
    case ACTIONS.OPEN_EDITOR:
      return {
        ...state,
        isEditorOpen: true,
        isNodeModalOpen: false,
        isDrawNodeMode: false,
        selectedNodeIds: [action.payload],
        selectedNodeId: action.payload,
        selectedEdgeId: null,
        activeNodeId: action.payload
      };
    case ACTIONS.CLOSE_EDITOR:
      return { ...state, isEditorOpen: false };
    case ACTIONS.OPEN_NODE_MODAL:
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
    case ACTIONS.UPDATE_NODE_DATA: {
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
      return { ...state, savedPeople: action.payload || [] };
    case ACTIONS.TOGGLE_MAP_FULLPAGE:
      return { ...state, isMapFullPage: !state.isMapFullPage };
    case ACTIONS.SET_DRAW_NODE_MODE:
      return { ...state, isDrawNodeMode: Boolean(action.payload) };
    case ACTIONS.TOGGLE_DRAW_NODE_MODE:
      return { ...state, isDrawNodeMode: !state.isDrawNodeMode };
    case ACTIONS.SAVE_STARTUP_VIEWPORT:
      return {
        ...state,
        appSettings: {
          ...DEFAULT_APP_SETTINGS,
          ...state.appSettings,
          startupViewport: state.viewport
        }
      };
    case ACTIONS.SET_VIEWPORT:
      return { ...state, viewport: action.payload };
    case ACTIONS.SET_VIEWPORT_CENTER:
      return { ...state, viewportCenter: action.payload || state.viewportCenter };
    default:
      return state;
  }
}
