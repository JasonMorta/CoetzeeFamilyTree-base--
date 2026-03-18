import React, { useMemo } from 'react';
import { Button, Tag } from 'rsuite';
import styles from './AppHeader.module.css';
import { APP_METADATA } from '../../constants/defaults';
import { buildFamily3FormUrl } from '../../utils/family3FormUrl';

export default function AppHeader({ isAdminAuthenticated, onLogin }) {
  const submitFamilyMemberUrl = useMemo(() => buildFamily3FormUrl(), []);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1 className={styles.title}>{APP_METADATA.appName}</h1>
        <div className={styles.subtitle}>
          Version {APP_METADATA.version} • Created:  {APP_METADATA.author}
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          as="a"
          href={submitFamilyMemberUrl}
          target="_blank"
          rel="noreferrer"
          size="sm"
          className={styles.submitFamilyButton}
        >
          Submit family member
        </Button>

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
