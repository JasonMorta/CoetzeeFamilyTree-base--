import React, { useMemo } from 'react';
import styles from './App.module.css';
import { useAppState } from './context/AppStateContext';
import { ACTIONS } from './context/appReducer';
import AppHeader from './components/layout/AppHeader';
import AdminSaveChangesButton from './components/sync/AdminSaveChangesButton';
import AdminSaveViewButton from './components/sync/AdminSaveViewButton';
import LoginModal from './components/auth/LoginModal';
import FamilyTreeCanvas from './components/tree/FamilyTreeCanvas';
import NodeEditorDrawer from './components/editor/NodeEditorDrawer';
import NodeDetailsModal from './components/inspector/NodeDetailsModal';
import SettingsDrawer from './components/settings/SettingsDrawer';
import { useRemoteStateSync } from './hooks/useRemoteStateSync';

export default function App() {
  const { state, dispatch } = useAppState();
  const { refreshWithCooldown } = useRemoteStateSync(state, dispatch);

  const workspaceStyle = useMemo(
    () => ({
      '--canvas-bg': state.appSettings?.backgroundColor || '#031131'
    }),
    [state.appSettings]
  );

  return (
    <div className={`${styles.appShell} ${state.isMapFullPage ? styles.mapFullPage : ''}`}>
      {!state.isMapFullPage && (
        <AppHeader
          isAdminAuthenticated={state.isAdminAuthenticated}
          extraActions={<>
            <AdminSaveViewButton />
            <AdminSaveChangesButton />
          </>}
          onLogin={() => dispatch({ type: ACTIONS.OPEN_LOGIN })}
          onLogout={() => dispatch({ type: ACTIONS.LOGOUT })}
          onAddNode={() => dispatch({ type: ACTIONS.ADD_NODE, payload: { x: 280, y: 220 } })}
          onOpenSettings={() => dispatch({ type: ACTIONS.OPEN_SETTINGS })}
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
            <FamilyTreeCanvas refreshWithCooldown={refreshWithCooldown} />
          )}
        </section>
      </main>

      <LoginModal />
      <NodeEditorDrawer />
      <NodeDetailsModal />
      <SettingsDrawer />
    </div>
  );
}
