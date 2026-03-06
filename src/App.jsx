import React, { useMemo } from 'react';
import styles from './App.module.css';
import { useAppState } from './context/AppStateContext';
import { ACTIONS } from './context/appReducer';
import AppHeader from './components/layout/AppHeader';
import AdminSaveChangesButton from './components/sync/AdminSaveChangesButton';
import LoginModal from './components/auth/LoginModal';
import FamilyTreeCanvas from './components/tree/FamilyTreeCanvas';
import NodeEditorDrawer from './components/editor/NodeEditorDrawer';
import NodeDetailsModal from './components/inspector/NodeDetailsModal';
import SettingsDrawer from './components/settings/SettingsDrawer';

export default function App() {
  const { state, dispatch } = useAppState();

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
          extraActions={<AdminSaveChangesButton />}
          onLogin={() => dispatch({ type: ACTIONS.OPEN_LOGIN })}
          onLogout={() => dispatch({ type: ACTIONS.LOGOUT })}
          onAddNode={() => dispatch({ type: ACTIONS.ADD_NODE, payload: { x: 280, y: 220 } })}
          onOpenSettings={() => dispatch({ type: ACTIONS.OPEN_SETTINGS })}
        />
      )}

      <main className={styles.content}>
        <section className={`${styles.workspace} ${state.isMapFullPage ? styles.workspaceFullPage : ''}`} style={workspaceStyle}>
          <FamilyTreeCanvas />
        </section>
      </main>

      <LoginModal />
      <NodeEditorDrawer />
      <NodeDetailsModal />
      <SettingsDrawer />
    </div>
  );
}
