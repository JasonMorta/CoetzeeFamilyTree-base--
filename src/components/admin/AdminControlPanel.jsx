import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Button, IconButton, Tag } from 'rsuite';
import styles from './AdminControlPanel.module.css';

export default function AdminControlPanel({
  isAdminAuthenticated,
  isDrawNodeMode,
  hasSingleNodeSelection,
  hasAnySelection,
  selectionLabel,
  onLogout,
  onAddNode,
  onEditSelected,
  onOpenFirebasePeople,
  onOpenSavedPeople,
  onOpenUpdateRequests,
  pendingUpdateRequestCount = 0,
  onToggleDrawNodeMode,
  onOpenSettings,
  children
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelWrapRef = useRef(null);

  const toggleLabel = useMemo(() => (isOpen ? 'Hide admin controls' : 'Show admin controls'), [isOpen]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!panelWrapRef.current?.contains(event.target)) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [closePanel, isOpen]);

  const handleAddNode = useCallback(() => {
    closePanel();
    onAddNode?.();
  }, [closePanel, onAddNode]);

  const handleEditSelected = useCallback(() => {
    closePanel();
    onEditSelected?.();
  }, [closePanel, onEditSelected]);

  const handleOpenFirebasePeople = useCallback(() => {
    closePanel();
    onOpenFirebasePeople?.();
  }, [closePanel, onOpenFirebasePeople]);

  const handleOpenSavedPeople = useCallback(() => {
    closePanel();
    onOpenSavedPeople?.();
  }, [closePanel, onOpenSavedPeople]);

  const handleOpenUpdateRequests = useCallback(() => {
    closePanel();
    onOpenUpdateRequests?.();
  }, [closePanel, onOpenUpdateRequests]);

  const handleToggleDrawNodeMode = useCallback(() => {
    closePanel();
    onToggleDrawNodeMode?.();
  }, [closePanel, onToggleDrawNodeMode]);

  const handleOpenSettings = useCallback(() => {
    closePanel();
    onOpenSettings?.();
  }, [closePanel, onOpenSettings]);

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div ref={panelWrapRef} className={styles.panelWrap} aria-label="Admin controls">
      <IconButton
        size="sm"
        appearance="primary"
        color="cyan"
        icon={<span aria-hidden="true">{isOpen ? '✕' : '☰'}</span>}
        className={`${styles.toggleButton} ${isOpen ? styles.toggleButtonOpen : ''}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <span className={styles.toggleButtonText}>{isOpen ? 'Hide admin' : 'Admin panel'}</span>
      </IconButton>

      <aside className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <div className={styles.panelEyebrow}>Admin Controls</div>
            <div className={styles.panelTitle}>Manage the tree from one place</div>
          </div>
          <div className={styles.headerMeta}>
            {selectionLabel ? <div className={styles.selectionText}>{selectionLabel}</div> : null}
            <Tag color="cyan" className={styles.modeTag}>
              {isDrawNodeMode ? 'Draw Mode Active' : 'Admin Mode'}
            </Tag>
          </div>
        </div>

        <div className={styles.actionGrid}>
          <Button size="sm" appearance="subtle" onClick={handleOpenSettings}>
            Settings
          </Button>
          <Button appearance="primary" color="violet" size="sm" onClick={handleAddNode}>
            Add Node
          </Button>
          <Button appearance="ghost" color="blue" size="sm" onClick={handleEditSelected} disabled={!hasSingleNodeSelection}>
            Edit Selected
          </Button>
          <Button appearance="ghost" color="green" size="sm" onClick={handleOpenFirebasePeople}>
            Add form submission
          </Button>
          <Button appearance="ghost" color="cyan" size="sm" onClick={handleOpenSavedPeople}>
            Load saved people
          </Button>
          <Button appearance="ghost" color="red" size="sm" onClick={handleOpenUpdateRequests} className={styles.requestButton}>
            <span>Update requests</span>
            {pendingUpdateRequestCount > 0 ? <span className={styles.requestBadge}>{pendingUpdateRequestCount}</span> : null}
          </Button>
          <Button
            appearance={isDrawNodeMode ? 'primary' : 'ghost'}
            color="cyan"
            size="sm"
            onClick={handleToggleDrawNodeMode}
          >
            {isDrawNodeMode ? 'Cancel Draw Node' : 'Draw Node'}
          </Button>
          {children}
          <Button size="sm" appearance="ghost" color="red" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </aside>
    </div>
  );
}
