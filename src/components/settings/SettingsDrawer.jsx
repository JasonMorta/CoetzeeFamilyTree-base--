import React from 'react';
import { Drawer, Form, SelectPicker, Toggle, Input, Slider, Button } from 'rsuite';
import styles from './SettingsDrawer.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';

const backgroundOptions = [
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'Cross', value: 'cross' }
];
const edgeOptions = [
  { label: 'Bezier', value: 'bezier' },
  { label: 'Smooth step', value: 'smoothstep' },
  { label: 'Straight', value: 'straight' }
];
function SliderField({ label, value, min, max, step = 1, onChange, help }) {
  return (
    <div className={styles.sliderField}>
      <div className={styles.sliderHeader}><span>{label}</span><strong>{value}</strong></div>
      <Slider progress min={min} max={max} step={step} value={Number(value) || 0} onChange={onChange} />
      {help && <div className={styles.help}>{help}</div>}
    </div>
  );
}

export default function SettingsDrawer() {
  const { state, dispatch } = useAppState();
  const settings = state.appSettings;

  function updateSettings(patch) {
    dispatch({ type: ACTIONS.UPDATE_APP_SETTINGS, payload: patch });
  }

  return (
    <Drawer open={state.isSettingsOpen} onClose={() => dispatch({ type: ACTIONS.CLOSE_SETTINGS })} size="sm" className={styles.drawer}>
      <Drawer.Header><Drawer.Title>Canvas & Edge Settings</Drawer.Title></Drawer.Header>
      <Drawer.Body className={styles.body}>
        <div className={styles.note}>These settings affect the whole tree. Per-node image controls now live inside each node editor so mixed node types stay easier to manage.</div>
        <Form fluid>
          <Form.Group><Form.ControlLabel>Background pattern</Form.ControlLabel><SelectPicker cleanable={false} searchable={false} block data={backgroundOptions} value={settings.backgroundVariant} onChange={(value) => updateSettings({ backgroundVariant: value })} /></Form.Group>
          <Form.Group><Form.ControlLabel>Canvas background colour</Form.ControlLabel><Input type="color" value={settings.backgroundColor} onChange={(value) => updateSettings({ backgroundColor: value })} /></Form.Group>
          <Form.Group><Form.ControlLabel>Edge style</Form.ControlLabel><SelectPicker cleanable={false} searchable={false} block data={edgeOptions} value={settings.edgeType} onChange={(value) => updateSettings({ edgeType: value })} /></Form.Group>
          <SliderField label="Edge width" value={settings.edgeWidth} min={1} max={6} onChange={(value) => updateSettings({ edgeWidth: value })} />
          <Form.Group><Form.ControlLabel>Edge colour</Form.ControlLabel><Input type="color" value={settings.edgeColor} onChange={(value) => updateSettings({ edgeColor: value })} /></Form.Group>
          <Form.Group className={styles.toggleRow}><span>Animated edges</span><Toggle checked={Boolean(settings.edgeAnimated)} onChange={(value) => updateSettings({ edgeAnimated: value })} /></Form.Group>
          <Form.Group><Form.ControlLabel>Node accent colour</Form.ControlLabel><Input type="color" value={settings.nodeAccent} onChange={(value) => updateSettings({ nodeAccent: value })} /></Form.Group>
          <Form.Group className={styles.toggleRow}><span>Node glow</span><Toggle checked={Boolean(settings.nodeGlow)} onChange={(value) => updateSettings({ nodeGlow: value })} /></Form.Group>
          <Form.Group className={styles.toggleRow}><span>Show minimap</span><Toggle checked={Boolean(settings.showMiniMap)} onChange={(value) => updateSettings({ showMiniMap: value })} /></Form.Group>
          <SliderField label="Minimum zoom out" value={settings.minZoom} min={0.1} max={1} step={0.05} onChange={(value) => updateSettings({ minZoom: Number(value.toFixed(2)) })} help="Lower values let you zoom further out on the map." />
          <div className={styles.actionGroup}>
            <Button appearance="ghost" block onClick={() => dispatch({ type: ACTIONS.SAVE_STARTUP_VIEWPORT })}>Save current view position</Button>
            <div className={styles.help}>Stores the current map pan and zoom as the startup view used when the page loads.</div>
          </div>
          <Button appearance="primary" block onClick={() => dispatch({ type: ACTIONS.CLOSE_SETTINGS })}>Done</Button>
        </Form>
      </Drawer.Body>
    </Drawer>
  );
}

