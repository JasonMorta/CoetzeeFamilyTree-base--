import React from 'react';
import { Button, Tag } from 'rsuite';
import styles from './AppHeader.module.css';
import { APP_METADATA } from '../../constants/defaults';

export default function AppHeader({ isAdminAuthenticated, onLogin }) {
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

        {!isAdminAuthenticated && (
          <Button size="xs" appearance="ghost" onClick={onLogin}>Login</Button>
        )}
      </div>
    </header>
  );
}
