import React, { useState } from 'react';
import { Modal, Button, Form, Message } from 'rsuite';
import styles from './LoginModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { loginAdmin } from '../../services/authService';
import { hasConfiguredAdminCredentials } from '../../constants/auth';

export default function LoginModal() {
  const { state, dispatch } = useAppState();
  const [formValue, setFormValue] = useState({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const isConfigured = hasConfiguredAdminCredentials();

  function handleLogin() {
    if (!isConfigured) {
      setErrorMessage('Admin login is not configured. Add VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD to your environment variables.');
      return;
    }

    const isValid = loginAdmin(formValue.username, formValue.password);

    if (!isValid) {
      setErrorMessage('Invalid admin credentials.');
      return;
    }

    setErrorMessage('');
    dispatch({ type: ACTIONS.LOGIN_SUCCESS });
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

        <div className={styles.note}>
          This is still a front-end-only demo login. On Netlify, these values are injected at build time and are not a secure replacement for real backend authentication.
        </div>

        {!isConfigured && (
          <Message type="warning" showIcon>
            Missing environment variables: VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD.
          </Message>
        )}

        {errorMessage && <Message type="error" showIcon>{errorMessage}</Message>}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="primary" onClick={handleLogin}>Login</Button>
        <Button appearance="subtle" onClick={() => dispatch({ type: ACTIONS.CLOSE_LOGIN })}>Cancel</Button>
      </Modal.Footer>
    </Modal>
  );
}
