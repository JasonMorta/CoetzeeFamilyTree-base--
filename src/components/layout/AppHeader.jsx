import React from 'react';
import { Button, ButtonGroup, Tag } from 'rsuite';
import styles from './AppHeader.module.css';
import { APP_METADATA } from '../../constants/defaults';

export default function AppHeader({ isAdminAuthenticated, onLogin, onLogout, onAddNode, onOpenSettings, extraActions }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1 className={styles.title}>{APP_METADATA.appName}</h1>
        <div className={styles.subtitle}>
          Version {APP_METADATA.version} • Author {APP_METADATA.author}
        </div>
      </div>

      <div className={styles.actions}>
        <Tag color={isAdminAuthenticated ? 'green' : 'blue'}>
          {isAdminAuthenticated ? 'Admin Mode' : 'Viewer Mode'}
        </Tag>

        <ButtonGroup>
          {isAdminAuthenticated && (
            <>
              <Button appearance="subtle" onClick={onOpenSettings}>
                Settings
              </Button>
              <Button appearance="primary" color="violet" onClick={onAddNode}>
                Add Node
              </Button>
              {extraActions}
            </>
       
           
          )}

          {!isAdminAuthenticated ? (
            <Button appearance="ghost" onClick={onLogin}>Login</Button>
          ) : (
            <Button appearance="ghost" color="red" onClick={onLogout}>Logout</Button>
          )}
        </ButtonGroup>
      </div>
    </header>
  );
}
