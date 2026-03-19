import React, { useMemo, useState, useCallback, useEffect } from 'react';
import styles from './App.module.css';
import { useAppState } from './context/AppStateContext';
import { ACTIONS } from './context/appReducer';
import AppHeader from './components/layout/AppHeader';
import AdminControlPanel from './components/admin/AdminControlPanel';
import AdminMigrateFirebaseButton from './components/admin/AdminMigrateFirebaseButton';
import AdminDeleteSelectionButton from './components/admin/AdminDeleteSelectionButton';
import AdminSaveChangesButton from './components/sync/AdminSaveChangesButton';
import AdminSaveViewButton from './components/sync/AdminSaveViewButton';
import LoginModal from './components/auth/LoginModal';
import FamilyTreeCanvas from './components/tree/FamilyTreeCanvas';
import NodeEditorDrawer from './components/editor/NodeEditorDrawer';
import NodeDetailsModal from './components/inspector/NodeDetailsModal';
import SettingsDrawer from './components/settings/SettingsDrawer';
import FirebasePeopleModal from './components/admin/FirebasePeopleModal';
import UpdateRequestsModal from './components/admin/UpdateRequestsModal';
import { fetchPendingUpdateRequestCount } from './services/firebaseUpdateRequestService';
import { useRemoteStateSync } from './hooks/useRemoteStateSync';

export default function App() {
  const { state, dispatch } = useAppState();
  useRemoteStateSync(state, dispatch);
  const [isFirebasePeopleOpen, setIsFirebasePeopleOpen] = useState(false);
  const [isSavedPeopleOpen, setIsSavedPeopleOpen] = useState(false);
  const [isUpdateRequestsOpen, setIsUpdateRequestsOpen] = useState(false);
  const [pendingUpdateRequestCount, setPendingUpdateRequestCount] = useState(0);

  const selectedNodes = useMemo(() => state.nodes.filter((node) => (state.selectedNodeIds || []).includes(node.id)), [state.nodes, state.selectedNodeIds]);
  const selectedNode = useMemo(() => state.nodes.find((node) => node.id === state.selectedNodeId) || null, [state.nodes, state.selectedNodeId]);
  const selectedEdgeCount = state.selectedEdgeId ? 1 : 0;
  const connectedSelectedNodeEdgeCount = useMemo(() => {
    const selectedIds = new Set((state.selectedNodeIds || []).filter(Boolean));
    if (!selectedIds.size) return 0;
    return state.edges.filter((edge) => selectedIds.has(edge.source) || selectedIds.has(edge.target)).length;
  }, [state.edges, state.selectedNodeIds]);

  const selectionLabel = useMemo(() => {
    const nodeCount = (state.selectedNodeIds || []).length;
    if (nodeCount > 1) return `${nodeCount} nodes selected`;
    if (nodeCount === 1) return '1 node selected';
    if (state.selectedEdgeId) return '1 link selected';
    return '';
  }, [state.selectedEdgeId, state.selectedNodeIds]);

  const handleEditSelected = useCallback(() => {
    if (!selectedNode) return;
    dispatch({ type: ACTIONS.OPEN_EDITOR, payload: selectedNode.id });
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  }, [dispatch, selectedNode]);

  const handleDeleteSelection = useCallback(() => {
    dispatch({
      type: ACTIONS.DELETE_SELECTION,
      payload: {
        nodeIds: state.selectedNodeIds || [],
        edgeIds: state.selectedEdgeId ? [state.selectedEdgeId] : []
      }
    });
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  }, [dispatch, state.selectedEdgeId, state.selectedNodeIds]);


  useEffect(() => {
    if (!state.isAdminAuthenticated) {
      setPendingUpdateRequestCount(0);
      return undefined;
    }

    let cancelled = false;
    const refreshCount = async () => {
      try {
        const count = await fetchPendingUpdateRequestCount();
        if (!cancelled) setPendingUpdateRequestCount(count);
      } catch (error) {
        if (!cancelled) setPendingUpdateRequestCount(0);
      }
    };

    void refreshCount();
    const timer = window.setInterval(() => { void refreshCount(); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state.isAdminAuthenticated]);

  const workspaceStyle = useMemo(
    () => ({
      '--canvas-bg': state.appSettings?.backgroundColor || '#031131'
    }),
    [state.appSettings?.backgroundColor]
  );

  return (
    <div className={`${styles.appShell} ${state.isMapFullPage ? styles.mapFullPage : ''}`}>
      {!state.isMapFullPage && (
        <AppHeader
          isAdminAuthenticated={state.isAdminAuthenticated}
          onLogin={() => dispatch({ type: ACTIONS.OPEN_LOGIN })}
        />
      )}


      <main className={styles.content}>
        <section className={`${styles.workspace} ${state.isMapFullPage ? styles.workspaceFullPage : ''}`} style={workspaceStyle}>
          {!state.hasInitialRemoteSyncCompleted ? (
            <div className={styles.loadingStage} aria-live="polite" aria-busy="true">
              <div className={styles.loadingCard}>
                <span className={styles.loadingSpinner} aria-hidden="true" />
                <div className={styles.loadingTitle}>Loading family tree…</div>
                <div className={styles.loadingText}>Fetching the saved map state before rendering the canvas.</div>
              </div>
            </div>
          ) : (
            <FamilyTreeCanvas />
          )}
        </section>
      </main>



      <AdminControlPanel
        isAdminAuthenticated={state.isAdminAuthenticated}
        isDrawNodeMode={state.isDrawNodeMode}
        hasSingleNodeSelection={Boolean(selectedNode)}
        hasAnySelection={Boolean((state.selectedNodeIds || []).length || state.selectedEdgeId)}
        selectionLabel={selectionLabel}
        onLogout={() => dispatch({ type: ACTIONS.LOGOUT })}
        onAddNode={() => dispatch({ type: ACTIONS.ADD_NODE, payload: { position: state.viewportCenter } })}
        onEditSelected={handleEditSelected}
        onOpenFirebasePeople={() => setIsFirebasePeopleOpen(true)}
        onOpenSavedPeople={() => setIsSavedPeopleOpen(true)}
        onOpenUpdateRequests={() => setIsUpdateRequestsOpen(true)}
        pendingUpdateRequestCount={pendingUpdateRequestCount}
        onToggleDrawNodeMode={() => dispatch({ type: ACTIONS.TOGGLE_DRAW_NODE_MODE })}
        onOpenSettings={() => dispatch({ type: ACTIONS.OPEN_SETTINGS })}
      >
        <AdminDeleteSelectionButton
          selectedNodes={selectedNodes}
          selectedEdgeCount={selectedEdgeCount}
          connectedEdgeCount={connectedSelectedNodeEdgeCount}
          hasUnsavedChanges={state.editorHasUnsavedChanges}
          onConfirmDelete={handleDeleteSelection}
        />
        <AdminSaveViewButton />
        <AdminSaveChangesButton />
        <AdminMigrateFirebaseButton />
      </AdminControlPanel>

      <LoginModal />
      <NodeEditorDrawer />
      <NodeDetailsModal />
      <SettingsDrawer />
      <FirebasePeopleModal mode="submissions" open={isFirebasePeopleOpen} onClose={() => setIsFirebasePeopleOpen(false)} />
      <FirebasePeopleModal mode="savedPeople" open={isSavedPeopleOpen} onClose={() => setIsSavedPeopleOpen(false)} />
      <UpdateRequestsModal open={isUpdateRequestsOpen} onClose={() => setIsUpdateRequestsOpen(false)} onPendingCountChange={setPendingUpdateRequestCount} />
    </div>
  );
}
