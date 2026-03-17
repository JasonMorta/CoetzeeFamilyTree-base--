import React, { useEffect, useMemo, useState } from 'react';
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
  description = 'Reload file available every 30s'
}) {
  // Tick while cooldown is active so the countdown text updates.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const ms = Math.max(0, (cooldownUntil || 0) - now);
    if (ms <= 0) return;

    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const msRemaining = useMemo(() => Math.max(0, (cooldownUntil || 0) - Date.now()), [cooldownUntil, tick]);
  const isCooldownActive = msRemaining > 0;

  return (
    <div className={styles.wrap} aria-live="polite">
      <div className={styles.row}>
        <span className={`${styles.dot} ${isUpdating ? styles.dotActive : ''}`} />
        <span className={styles.label}>{isUpdating ? 'Updating' : 'Firebase loaded'}</span>

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
