import React, { useState } from 'react';
import { Modal, Button, Form, Message } from 'rsuite';
import styles from './LoginModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { loginAdmin, getAdminLockoutStatus } from '../../services/authService';
import { getPersistedSnapshot, saveAppMeta } from '../../services/localStorageService';
import { hashObject } from '../../utils/stableHash';
import { hasConfiguredAdminCredentials } from '../../constants/auth';

export default function LoginModal() {
  const { state, dispatch } = useAppState();
  const [formValue, setFormValue] = useState({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const isConfigured = hasConfiguredAdminCredentials();
  const lockout = getAdminLockoutStatus();

  function handleLogin() {
    if (!isConfigured) {
      setErrorMessage('Admin login is not configured. Add VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD to your environment variables.');
      return;
    }

    const result = loginAdmin(formValue.username, formValue.password);

    if (!result.ok) {
      if (result.lockoutUntil) {
        const remainingMinutes = Math.max(1, Math.ceil((result.remainingMs || 0) / 60000));
        setErrorMessage(`Admin login locked. Try again in about ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`);
        return;
      }

      if (typeof result.remainingAttempts === 'number' && result.remainingAttempts > 0) {
        setErrorMessage(`${result.error} ${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? '' : 's'} remaining.`);
        return;
      }

      setErrorMessage(result.error || 'Invalid admin credentials.');
      return;
    }

    setErrorMessage('');

    // When an admin logs in, treat the current state as the "baseline".
    // This keeps the Save button hidden until an actual change is made.
    const baselineHash = hashObject(getPersistedSnapshot(state));
    saveAppMeta({ hash: baselineHash, exportedAt: new Date().toISOString() });
    dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: baselineHash });

    dispatch({ type: ACTIONS.LOGIN_SUCCESS, payload: result.authState });
  }

  return (
    <Modal open={state.isLoginOpen} onClose={() => dispatch({ type: ACTIONS.CLOSE_LOGIN })} className={styles.modal} backdropClassName={styles.backdrop}>
      <Modal.Header>
        <Modal.Title>Admin Login</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form fluid formValue={formValue} onChange={setFormValue}>
          <Form.Group>
            <Form.ControlLabel>Username</Form.ControlLabel>
            <Form.Control name="username" autoComplete="username" />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Password</Form.ControlLabel>
            <Form.Control name="password" type="password" autoComplete="current-password" />
          </Form.Group>
        </Form>


        {lockout.isLocked && (
          <Message type="warning" showIcon>
            Admin login is temporarily locked after repeated failed attempts.
          </Message>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="primary" onClick={handleLogin}>Login</Button>
        <Button appearance="subtle" onClick={() => dispatch({ type: ACTIONS.CLOSE_LOGIN })}>Cancel</Button>
      </Modal.Footer>
    </Modal>
  );
}
