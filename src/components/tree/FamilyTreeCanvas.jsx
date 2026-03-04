import React, { useMemo, useCallback } from 'react';
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
import { ACTIONS } from '../../context/appReducer';

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

export default function FamilyTreeCanvas() {
  const { state, dispatch } = useAppState();
  const { connectedSlotsByNode, handleUsage } = useMemo(() => buildConnectedHandleMaps(state.edges), [state.edges]);

  const handleEdit = useCallback((nodeId) => dispatch({ type: ACTIONS.OPEN_EDITOR, payload: nodeId }), [dispatch]);
  const handleDuplicate = useCallback((nodeId) => dispatch({ type: ACTIONS.DUPLICATE_NODE, payload: nodeId }), [dispatch]);
  const handleDelete = useCallback((nodeId) => {
    if (window.confirm('Delete this node and all of its current links?')) {
      dispatch({ type: ACTIONS.DELETE_NODE, payload: nodeId });
    }
  }, [dispatch]);

  const nodes = useMemo(
    () =>
      state.nodes.map((node) => ({
        ...node,
        draggable: state.isAdminAuthenticated,
        selected: state.selectedNodeId === node.id,
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
    [state.nodes, state.isAdminAuthenticated, state.selectedNodeId, connectedSlotsByNode, handleUsage, state.appSettings, handleEdit, handleDuplicate, handleDelete]
  );

  const edges = useMemo(
    () =>
      state.edges.map((edge) => ({
        ...edge,
        type: state.appSettings.edgeType,
        animated: state.appSettings.edgeAnimated,
        selected: state.selectedEdgeId === edge.id,
        style: {
          strokeWidth: state.selectedEdgeId === edge.id ? Math.max(3, state.appSettings.edgeWidth + 1) : state.appSettings.edgeWidth,
          stroke: state.selectedEdgeId === edge.id ? '#22d3ee' : state.appSettings.edgeColor
        }
      })),
    [state.edges, state.selectedEdgeId, state.appSettings]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: state.appSettings.edgeType,
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
      dispatch({ type: ACTIONS.SELECT_NODE, payload: node.id });
      dispatch({ type: ACTIONS.OPEN_NODE_MODAL, payload: node.id });
    },
    [dispatch]
  );

  const onEdgeClick = useCallback(
    (event, edge) => {
      event.stopPropagation();
      if (state.isAdminAuthenticated) {
        dispatch({ type: ACTIONS.SELECT_EDGE, payload: edge.id });
      }
    },
    [dispatch, state.isAdminAuthenticated]
  );

  const onPaneClick = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_SELECTION });
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  }, [dispatch]);

  const onMoveEnd = useCallback((_, viewport) => {
    dispatch({ type: ACTIONS.SET_VIEWPORT, payload: viewport });
  }, [dispatch]);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={state.viewport}
        fitView
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={toConnectionLineType(state.appSettings.edgeType)}
        connectionLineStyle={{ stroke: state.appSettings.edgeColor, strokeWidth: state.appSettings.edgeWidth }}
        isValidConnection={validateConnection}
        nodesDraggable={state.isAdminAuthenticated}
        nodesConnectable={state.isAdminAuthenticated}
        elementsSelectable
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
      >
        <Background variant={toBackgroundVariant(state.appSettings.backgroundVariant)} gap={18} size={1.2} color="rgba(255,255,255,0.25)" />
        <Controls />
        {state.appSettings.showMiniMap && <MiniMap />}

        <Panel position="top-left">
          <div className={styles.tipPanel}>
            {state.isAdminAuthenticated
              ? 'Admin: click a node to preview it, use Edit on the node to open the side editor, and click a connection to remove it.'
              : 'Viewer: click a node to open its details modal.'}
          </div>
        </Panel>

        {state.isAdminAuthenticated && state.selectedEdgeId && (
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
    </div>
  );
}
