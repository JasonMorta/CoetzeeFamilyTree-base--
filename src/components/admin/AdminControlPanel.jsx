import React, { useMemo, useState, useCallback } from 'react';
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
  onToggleDrawNodeMode,
  onOpenSettings,
  children
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleLabel = useMemo(() => (isOpen ? 'Hide admin controls' : 'Show admin controls'), [isOpen]);

  const handleAddNode = useCallback(() => {
    setIsOpen(false);
    onAddNode?.();
  }, [onAddNode]);

  const handleOpenFirebasePeople = useCallback(() => {
    setIsOpen(false);
    onOpenFirebasePeople?.();
  }, [onOpenFirebasePeople]);

  const handleOpenSavedPeople = useCallback(() => {
    setIsOpen(false);
    onOpenSavedPeople?.();
  }, [onOpenSavedPeople]);

  const handleToggleDrawNodeMode = useCallback(() => {
    setIsOpen(false);
    onToggleDrawNodeMode?.();
  }, [onToggleDrawNodeMode]);

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className={styles.panelWrap} aria-label="Admin controls">
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
          <Button size="sm" appearance="subtle" onClick={onOpenSettings}>
            Settings
          </Button>
          <Button appearance="primary" color="violet" size="sm" onClick={handleAddNode}>
            Add Node
          </Button>
          <Button appearance="ghost" color="blue" size="sm" onClick={onEditSelected} disabled={!hasSingleNodeSelection}>
            Edit Selected
          </Button>
          <Button appearance="ghost" color="green" size="sm" onClick={handleOpenFirebasePeople}>
            Add form submission
          </Button>
          <Button appearance="ghost" color="cyan" size="sm" onClick={handleOpenSavedPeople}>
            Load saved people
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
