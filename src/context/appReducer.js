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
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  OPEN_EDITOR: 'OPEN_EDITOR',
  CLOSE_EDITOR: 'CLOSE_EDITOR',
  OPEN_NODE_MODAL: 'OPEN_NODE_MODAL',
  CLOSE_NODE_MODAL: 'CLOSE_NODE_MODAL',
  UPDATE_NODE_DATA: 'UPDATE_NODE_DATA',
  SET_VIEWPORT: 'SET_VIEWPORT',
  OPEN_SETTINGS: 'OPEN_SETTINGS',
  CLOSE_SETTINGS: 'CLOSE_SETTINGS',
  UPDATE_APP_SETTINGS: 'UPDATE_APP_SETTINGS',
  SET_DIRTY: 'SET_DIRTY',
  SET_CLEAN: 'SET_CLEAN',
  SET_EXPORT_HASH: 'SET_EXPORT_HASH',
  REMOTE_SYNC_START: 'REMOTE_SYNC_START',
  REMOTE_SYNC_END: 'REMOTE_SYNC_END',
  APPLY_REMOTE_SNAPSHOT: 'APPLY_REMOTE_SNAPSHOT',
  SET_REMOTE_COOLDOWN: 'SET_REMOTE_COOLDOWN'
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

function remapHandleId(handleId, requestedHandles) {
  const parsed = parseHandleId(handleId);
  if (!parsed) {
    return handleId;
  }

  const requestedCount = Math.max(0, Number(requestedHandles?.[parsed.side]) || 0);
  if (requestedCount <= 0) {
    return `${parsed.side}-1`;
  }

  const clampedIndex = Math.min(parsed.index, requestedCount);
  return `${parsed.side}-${clampedIndex}`;
}

function remapNodeEdges(edges, nodeId, requestedHandles) {
  return edges.map((edge) => {
    const nextEdge = { ...edge };

    if (edge.source === nodeId) {
      nextEdge.sourceHandle = remapHandleId(edge.sourceHandle, requestedHandles);
    }

    if (edge.target === nodeId) {
      nextEdge.targetHandle = remapHandleId(edge.targetHandle, requestedHandles);
    }

    return nextEdge;
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
        lastRemoteSyncAt: action.payload?.syncedAt || state.lastRemoteSyncAt
      };
    case ACTIONS.SET_REMOTE_COOLDOWN:
      return { ...state, remoteCooldownUntil: action.payload };
    case ACTIONS.APPLY_REMOTE_SNAPSHOT:
      // Keep auth + UI modals as-is. Only replace persisted canvas data.
      return {
        ...state,
        nodes: action.payload.nodes,
        edges: action.payload.edges,
        viewport: action.payload.viewport,
        appSettings: action.payload.appSettings
      };

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
      const node = createFamilyNode(action.payload);
      return {
        ...state,
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        selectedEdgeId: null,
        activeNodeId: node.id,
        isNodeModalOpen: false,
        isEditorOpen: true
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
        isEditorOpen: true
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
    case ACTIONS.SELECT_NODE:
      return {
        ...state,
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
        selectedNodeId: null,
        selectedEdgeId: null,
        isEditorOpen: false
      };
    case ACTIONS.OPEN_EDITOR:
      return {
        ...state,
        isEditorOpen: true,
        isNodeModalOpen: false,
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

      const nextNodeData = mergeNodeData(targetNode.data, data, state.edges, id);
      const remappedEdges = remapNodeEdges(state.edges, id, nextNodeData.handles);

      return {
        ...state,
        edges: remappedEdges,
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
    case ACTIONS.SET_VIEWPORT:
      return { ...state, viewport: action.payload };
    default:
      return state;
  }
}
