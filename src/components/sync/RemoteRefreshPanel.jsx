import React, { useMemo } from 'react';
import { Button } from 'rsuite';
import styles from './RemoteRefreshPanel.module.css';

function formatCooldown(msRemaining) {
  const seconds = Math.ceil(msRemaining / 1000);
  return `${seconds}s`;
}

export default function RemoteRefreshPanel({
  isUpdating,
  cooldownUntil,
  onRefresh,
  description = 'Refresh available every 30s'
}) {
  const now = Date.now();
  const msRemaining = useMemo(() => Math.max(0, (cooldownUntil || 0) - now), [cooldownUntil, now]);
  const isCooldownActive = msRemaining > 0;

  return (
    <div className={styles.wrap} aria-live="polite">
      <div className={styles.row}>
        <span className={`${styles.dot} ${isUpdating ? styles.dotActive : ''}`} />
        <span className={styles.label}>{isUpdating ? 'Updating' : 'Up to date'}</span>

        <Button
          size="xs"
          appearance="ghost"
          onClick={onRefresh}
          disabled={isUpdating || isCooldownActive}
          className={styles.refreshButton}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.sub}>
        {isCooldownActive ? `Please wait ${formatCooldown(msRemaining)}…` : description}
      </div>
    </div>
  );
}
