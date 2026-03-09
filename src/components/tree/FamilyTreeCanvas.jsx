import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  BackgroundVariant,
  ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, ButtonGroup } from 'rsuite';
import styles from './FamilyTreeCanvas.module.css';
import FamilyNode from './FamilyNode';
import { useAppState } from '../../context/AppStateContext';
import RemoteRefreshPanel from '../sync/RemoteRefreshPanel';
import { ACTIONS } from '../../context/appReducer';
import { createDefaultHandles } from '../../utils/nodeFactory';

const nodeTypes = {
  familyNode: React.memo(FamilyNode)
};

function buildConnectedHandleMaps(edges) {
  const connectedSlotsByNode = new Map();
  const handleUsage = new Map();

  edges.forEach((edge) => {
    if (edge.source && edge.sourceHandle) {
      const key = `${edge.source}:${edge.sourceHandle}`;
      if (!connectedSlotsByNode.has(edge.source)) {
        connectedSlotsByNode.set(edge.source, []);
      }
      connectedSlotsByNode.get(edge.source).push(key);
      handleUsage.set(key, (handleUsage.get(key) || 0) + 1);
    }

    if (edge.target && edge.targetHandle) {
      const key = `${edge.target}:${edge.targetHandle}`;
      if (!connectedSlotsByNode.has(edge.target)) {
        connectedSlotsByNode.set(edge.target, []);
      }
      connectedSlotsByNode.get(edge.target).push(key);
      handleUsage.set(key, (handleUsage.get(key) || 0) + 1);
    }
  });

  return { connectedSlotsByNode, handleUsage };
}

function toBackgroundVariant(value) {
  if (value === 'lines') return BackgroundVariant.Lines;
  if (value === 'cross') return BackgroundVariant.Cross;
  return BackgroundVariant.Dots;
}

function toConnectionLineType(value) {
  if (value === 'smoothstep') return ConnectionLineType.SmoothStep;
  if (value === 'straight') return ConnectionLineType.Straight;
  return ConnectionLineType.Bezier;
}

function toReactFlowEdgeType(value) {
  if (value === 'bezier') return 'default';
  if (value === 'smoothstep') return 'smoothstep';
  if (value === 'straight') return 'straight';
  return 'default';
}

function isHandleAvailable(edgeList, nodeId, handleId) {
  if (!nodeId || !handleId) {
    return false;
  }

  return !edgeList.some(
    (edge) =>
      (edge.source === nodeId && edge.sourceHandle === handleId) ||
      (edge.target === nodeId && edge.targetHandle === handleId)
  );
}

function isHandleDefinedOnNode(node, handleId) {
  const match = String(handleId || '').match(/^(top|right|bottom|left)-(\d+)$/);
  if (!match) {
    return false;
  }

  const side = match[1];
  const index = Number(match[2]) || 0;
  const count = Number(node?.data?.handles?.[side]) || 0;
  return index >= 1 && index <= count;
}

function sanitizeRenderableEdges(edges, nodes) {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

  return edges.filter((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    if (!isHandleDefinedOnNode(sourceNode, edge.sourceHandle)) {
      return false;
    }

    if (!isHandleDefinedOnNode(targetNode, edge.targetHandle)) {
      return false;
    }

    return true;
  });
}

function getClientPoint(event) {
  if (!event) return { x: 0, y: 0 };
  if (event.touches?.[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function normalizeRect(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return { left, top, width, height };
}

export default function FamilyTreeCanvas({ refreshWithCooldown }) {
  const { state, dispatch } = useAppState();
  const { connectedSlotsByNode, handleUsage } = useMemo(() => buildConnectedHandleMaps(state.edges), [state.edges]);
  const flowWrapperRef = useRef(null);
  const reactFlowRef = useRef(null);
  const [draftRect, setDraftRect] = useState(null);
  const dragStartRef = useRef(null);

  const handleEdit = useCallback((nodeId) => dispatch({ type: ACTIONS.OPEN_EDITOR, payload: nodeId }), [dispatch]);
  const handleDuplicate = useCallback((nodeId) => dispatch({ type: ACTIONS.DUPLICATE_NODE, payload: nodeId }), [dispatch]);
  const handleDelete = useCallback((nodeId) => {
    if (window.confirm('Delete this node and all of its current links?')) {
      dispatch({ type: ACTIONS.DELETE_NODE, payload: nodeId });
    }
  }, [dispatch]);

  const syncViewportCenter = useCallback(() => {
    if (!reactFlowRef.current || !flowWrapperRef.current) {
      return;
    }

    const bounds = flowWrapperRef.current.getBoundingClientRect();
    if (!bounds || (!bounds.width && !bounds.height)) {
      return;
    }

    const center = reactFlowRef.current.screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2
    });

    dispatch({ type: ACTIONS.SET_VIEWPORT_CENTER, payload: center });
  }, [dispatch]);

  useEffect(() => {
    syncViewportCenter();
  }, [syncViewportCenter, state.viewport, state.hasInitialRemoteSyncCompleted]);

  useEffect(() => {
    if (!flowWrapperRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => syncViewportCenter());
    observer.observe(flowWrapperRef.current);
    return () => observer.disconnect();
  }, [syncViewportCenter]);

  useEffect(() => {
    if (!state.isDrawNodeMode) {
      setDraftRect(null);
      dragStartRef.current = null;
    }
  }, [state.isDrawNodeMode]);

  const nodes = useMemo(
    () =>
      state.nodes.map((node) => ({
        ...node,
        draggable: state.isAdminAuthenticated,
        selected: (state.selectedNodeIds || []).includes(node.id),
        data: {
          ...node.data,
          connectedSlotIds: connectedSlotsByNode.get(node.id) || [],
          handleUsage: Object.fromEntries(
            Array.from(handleUsage.entries())
              .filter(([key]) => key.startsWith(`${node.id}:`))
              .map(([key, count]) => [key.replace(`${node.id}:`, ''), count])
          ),
          isAdminAuthenticated: state.isAdminAuthenticated,
          nodeAccent: state.appSettings.nodeAccent,
          nodeGlow: state.appSettings.nodeGlow,
          onEdit: handleEdit,
          onDuplicate: handleDuplicate,
          onDelete: handleDelete
        }
      })),
    [state.nodes, state.isAdminAuthenticated, state.selectedNodeIds, connectedSlotsByNode, handleUsage, state.appSettings, handleEdit, handleDuplicate, handleDelete]
  );

  const edges = useMemo(
    () =>
      sanitizeRenderableEdges(state.edges, state.nodes).map((edge) => ({
        ...edge,
        type: toReactFlowEdgeType(state.appSettings.edgeType),
        animated: state.appSettings.edgeAnimated,
        selected: state.selectedEdgeId === edge.id,
        style: {
          strokeWidth: state.selectedEdgeId === edge.id ? Math.max(3, state.appSettings.edgeWidth + 1) : state.appSettings.edgeWidth,
          stroke: state.selectedEdgeId === edge.id ? '#22d3ee' : state.appSettings.edgeColor
        }
      })),
    [state.edges, state.nodes, state.selectedEdgeId, state.appSettings]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: toReactFlowEdgeType(state.appSettings.edgeType),
      animated: state.appSettings.edgeAnimated
    }),
    [state.appSettings.edgeAnimated, state.appSettings.edgeType]
  );

  const validateConnection = useCallback(
    (connection) => {
      const { source, sourceHandle, target, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) {
        return false;
      }
      if (source === target && sourceHandle === targetHandle) {
        return false;
      }
      if (!isHandleAvailable(state.edges, source, sourceHandle)) {
        return false;
      }
      if (!isHandleAvailable(state.edges, target, targetHandle)) {
        return false;
      }
      return true;
    },
    [state.edges]
  );

  const onNodesChange = useCallback(
    (changes) => dispatch({ type: ACTIONS.APPLY_NODE_CHANGES, payload: changes }),
    [dispatch]
  );

  const onEdgesChange = useCallback(
    (changes) => dispatch({ type: ACTIONS.APPLY_EDGE_CHANGES, payload: changes }),
    [dispatch]
  );

  const onConnect = useCallback(
    (params) => {
      if (state.isAdminAuthenticated && validateConnection(params)) {
        dispatch({ type: ACTIONS.CONNECT_EDGE, payload: params });
      }
    },
    [dispatch, state.isAdminAuthenticated, validateConnection]
  );

  const onNodeClick = useCallback(
    (_, node) => {
      if (state.isDrawNodeMode) return;
      dispatch({ type: ACTIONS.SELECT_NODE, payload: node.id });
      dispatch({ type: ACTIONS.OPEN_NODE_MODAL, payload: node.id });
    },
    [dispatch, state.isDrawNodeMode]
  );

  const onEdgeClick = useCallback(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent?.stopImmediatePropagation?.();
      if (state.isAdminAuthenticated && !state.isDrawNodeMode) {
        dispatch({ type: ACTIONS.SELECT_EDGE, payload: edge.id });
      }
    },
    [dispatch, state.isAdminAuthenticated, state.isDrawNodeMode]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (!state.isAdminAuthenticated || state.isDrawNodeMode) return;

      const nodeIds = Array.isArray(selectedNodes) ? selectedNodes.map((node) => node.id).filter(Boolean) : [];
      if (nodeIds.length) {
        dispatch({ type: ACTIONS.SET_SELECTED_NODES, payload: nodeIds });
        return;
      }

      const edgeIds = Array.isArray(selectedEdges) ? selectedEdges.map((edge) => edge.id).filter(Boolean) : [];
      if (edgeIds.length) {
        dispatch({ type: ACTIONS.SELECT_EDGE, payload: edgeIds[edgeIds.length - 1] });
        return;
      }

      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },
    [dispatch, state.isAdminAuthenticated, state.isDrawNodeMode]
  );

  const onPaneClick = useCallback((event) => {
    if (state.isDrawNodeMode || event?.defaultPrevented) return;
    const cls = event?.target?.classList;
    if (cls && (cls.contains('react-flow__edge-path') || cls.contains('react-flow__edge') || cls.contains('react-flow__edge-interaction'))) return;

    dispatch({ type: ACTIONS.CLEAR_SELECTION });
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  }, [dispatch, state.isDrawNodeMode]);

  const onMoveEnd = useCallback((_, viewport) => {
    dispatch({ type: ACTIONS.SET_VIEWPORT, payload: viewport });
    window.requestAnimationFrame(syncViewportCenter);
  }, [dispatch, syncViewportCenter]);

  const onInit = useCallback((instance) => {
    reactFlowRef.current = instance;
    window.requestAnimationFrame(syncViewportCenter);
  }, [syncViewportCenter]);

  const createDrawnNode = useCallback((clientStart, clientEnd) => {
    if (!reactFlowRef.current || !flowWrapperRef.current) {
      return;
    }

    const startFlow = reactFlowRef.current.screenToFlowPosition(clientStart);
    const endFlow = reactFlowRef.current.screenToFlowPosition(clientEnd);

    const width = Math.max(100, Math.round(Math.abs(endFlow.x - startFlow.x)));
    const height = Math.max(100, Math.round(Math.abs(endFlow.y - startFlow.y)));
    const position = {
      x: Math.min(startFlow.x, endFlow.x),
      y: Math.min(startFlow.y, endFlow.y)
    };

    dispatch({
      type: ACTIONS.ADD_NODE,
      payload: {
        position,
        dataOverrides: {
          nodeWidth: width,
          nodeHeight: height,
          handles: createDefaultHandles()
        }
      }
    });

    dispatch({ type: ACTIONS.SET_DRAW_NODE_MODE, payload: false });
    setDraftRect(null);
    dragStartRef.current = null;
  }, [dispatch]);

  const handleDrawStart = useCallback((event) => {
    if (!state.isAdminAuthenticated || !state.isDrawNodeMode) {
      return;
    }
    const point = getClientPoint(event);
    dragStartRef.current = point;
    setDraftRect(normalizeRect(point, point));
    event.preventDefault();
    event.stopPropagation();
  }, [state.isAdminAuthenticated, state.isDrawNodeMode]);

  const handleDrawMove = useCallback((event) => {
    if (!dragStartRef.current) {
      return;
    }
    const point = getClientPoint(event);
    setDraftRect(normalizeRect(dragStartRef.current, point));
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrawEnd = useCallback((event) => {
    if (!dragStartRef.current) {
      return;
    }

    const point = getClientPoint(event);
    const rect = normalizeRect(dragStartRef.current, point);
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (rect.width < 12 || rect.height < 12) {
      setDraftRect(null);
      dispatch({
        type: ACTIONS.ADD_NODE,
        payload: {
          position: state.viewportCenter,
          dataOverrides: {
            handles: createDefaultHandles()
          }
        }
      });
      dispatch({ type: ACTIONS.SET_DRAW_NODE_MODE, payload: false });
      return;
    }

    createDrawnNode(start, point);
    event.preventDefault();
    event.stopPropagation();
  }, [createDrawnNode, dispatch, state.viewportCenter]);

  const initialViewport = state.appSettings?.startupViewport || state.viewport;

  return (
    <div className={styles.canvas} ref={flowWrapperRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={toConnectionLineType(state.appSettings.edgeType)}
        connectionLineStyle={{ stroke: state.appSettings.edgeColor, strokeWidth: state.appSettings.edgeWidth }}
        isValidConnection={validateConnection}
        nodesDraggable={state.isAdminAuthenticated && !state.isDrawNodeMode}
        nodesConnectable={state.isAdminAuthenticated && !state.isDrawNodeMode}
        elementsSelectable={!state.isDrawNodeMode}
        selectionOnDrag={state.isAdminAuthenticated && !state.isDrawNodeMode}
        panOnDrag={!state.isDrawNodeMode}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        minZoom={Number(state.appSettings.minZoom) || 0.2}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
      >
        <Background variant={toBackgroundVariant(state.appSettings.backgroundVariant)} gap={18} size={1.2} color="rgba(255,255,255,0.25)" />
        <Controls />
        <Panel position="top-right" className={styles.fullPagePanel}>
          <Button
            size="sm"
            appearance="ghost"
            className={styles.fullPageButton}
            aria-label={state.isMapFullPage ? 'Exit full screen' : 'Enter full screen'}
            title={state.isMapFullPage ? 'Exit full screen' : 'Enter full screen'}
            onClick={() => dispatch({ type: ACTIONS.TOGGLE_MAP_FULLPAGE })}
          >
            {state.isMapFullPage ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.fullPageIcon}>
                <path d="M9 15H5v4M15 15h4v4M9 9H5V5M15 9h4V5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.fullPageIcon}>
                <path d="M9 3H5v4M15 3h4v4M9 21H5v-4M15 21h4v-4" />
              </svg>
            )}
          </Button>
        </Panel>

        {state.appSettings.showMiniMap && <MiniMap />}

        {!state.isAdminAuthenticated && (
          <Panel
            position="bottom-right"
            className={state.appSettings.showMiniMap ? styles.remotePanelAboveMiniMap : undefined}
          >
            <RemoteRefreshPanel
              isUpdating={state.isRemoteUpdating}
              cooldownUntil={state.remoteCooldownUntil}
              onRefresh={refreshWithCooldown}
              description="Reload saved JSON file every 30s"
            />
          </Panel>
        )}

        {state.isAdminAuthenticated && state.selectedEdgeId && !state.isDrawNodeMode && (
          <Panel position="top-right">
            <div className={styles.edgePanel}>
              <div className={styles.edgeText}>Connection selected</div>
              <ButtonGroup>
                <Button
                  appearance="primary"
                  color="red"
                  size="sm"
                  onClick={() => dispatch({ type: ACTIONS.DELETE_EDGE, payload: state.selectedEdgeId })}
                >
                  Remove Link
                </Button>
                <Button appearance="ghost" size="sm" onClick={() => dispatch({ type: ACTIONS.CLEAR_SELECTION })}>
                  Clear
                </Button>
              </ButtonGroup>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {state.isAdminAuthenticated && state.isDrawNodeMode && (
        <div
          className={styles.drawOverlay}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onMouseLeave={handleDrawEnd}
        >
          <div className={styles.drawHint}>Drag on the map to draw a new node rectangle.</div>
          {draftRect && (
            <div
              className={styles.drawPreview}
              style={{
                left: `${draftRect.left}px`,
                top: `${draftRect.top}px`,
                width: `${draftRect.width}px`,
                height: `${draftRect.height}px`
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
