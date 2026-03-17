import React, { useMemo, useState } from 'react';
import { Button, Modal } from 'rsuite';
import { createStandardPersonWrapper, getRecordName } from '../../utils/family3Schema';
import { NODE_TYPES } from '../../utils/nodeFactory';
import styles from './AdminDeleteSelectionButton.module.css';

function getNodeLabel(node) {
  if (!node) return 'Untitled node';
  const data = node.data || {};
  if ((data.nodeType || NODE_TYPES.STANDARD) === NODE_TYPES.STANDARD) {
    const standard = createStandardPersonWrapper(data.standardPerson || {});
    return data.title || standard.person?.node?.title || getRecordName(standard) || 'Untitled node';
  }
  return data.title || 'Persons node';
}

export default function AdminDeleteSelectionButton({
  selectedNodes,
  selectedEdgeCount,
  connectedEdgeCount,
  hasUnsavedChanges,
  onConfirmDelete,
  disabled = false
}) {
  const [open, setOpen] = useState(false);

  const selectionSummary = useMemo(() => {
    const nodeCount = Array.isArray(selectedNodes) ? selectedNodes.length : 0;
    const edgeCount = Number(selectedEdgeCount) || 0;
    const labels = (selectedNodes || []).slice(0, 4).map(getNodeLabel).filter(Boolean);
    return { nodeCount, edgeCount, labels };
  }, [selectedNodes, selectedEdgeCount]);

  const nothingSelected = selectionSummary.nodeCount === 0 && selectionSummary.edgeCount === 0;
  const isDisabled = disabled || nothingSelected;

  const handleConfirm = () => {
    onConfirmDelete?.();
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" appearance="ghost" color="red" disabled={isDisabled} onClick={() => setOpen(true)}>
        Delete Selected
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} size="xs" className={styles.modal}>
        <Modal.Header>
          <Modal.Title>Delete selection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className={styles.bodyCopy}>
            {selectionSummary.nodeCount > 0 ? (
              <p>
                You are about to delete <strong>{selectionSummary.nodeCount}</strong> node{selectionSummary.nodeCount === 1 ? '' : 's'}
                {connectedEdgeCount > 0 ? <> and <strong>{connectedEdgeCount}</strong> connected link{connectedEdgeCount === 1 ? '' : 's'}</> : null}.
              </p>
            ) : null}
            {selectionSummary.edgeCount > 0 ? (
              <p>
                You are about to delete <strong>{selectionSummary.edgeCount}</strong> selected link{selectionSummary.edgeCount === 1 ? '' : 's'}.
              </p>
            ) : null}
            {hasUnsavedChanges ? (
              <p className={styles.warning}>Unsaved editor changes for the selected node will be lost.</p>
            ) : null}
          </div>

          {selectionSummary.labels.length ? (
            <div className={styles.previewListWrap}>
              <div className={styles.previewTitle}>Selected nodes</div>
              <ul className={styles.previewList}>
                {selectionSummary.labels.map((label, index) => (
                  <li key={`${label}-${index}`}>{label}</li>
                ))}
                {selectionSummary.nodeCount > selectionSummary.labels.length ? (
                  <li>…and {selectionSummary.nodeCount - selectionSummary.labels.length} more</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="primary" color="red" onClick={handleConfirm}>Delete</Button>
          <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
