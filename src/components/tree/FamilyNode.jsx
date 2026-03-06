import React, { useEffect, memo, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { Button } from 'rsuite';
import styles from './FamilyNode.module.css';
import { NODE_TYPES } from '../../utils/nodeFactory';

const SIDE_CONFIG = {
  top: { position: Position.Top, axis: 'left' },
  right: { position: Position.Right, axis: 'top' },
  bottom: { position: Position.Bottom, axis: 'left' },
  left: { position: Position.Left, axis: 'top' }
};

function clampOffset(value) {
  return Math.max(8, Math.min(92, value));
}

function buildOffsets(count, layout = { anchor: 50, spread: 40 }) {
  if (count <= 0) return [];
  const anchor = Number(layout.anchor) || 50;
  const spread = Number(layout.spread) || 0;
  if (count === 1) return [clampOffset(anchor)];
  const start = anchor - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  return Array.from({ length: count }, (_, index) => clampOffset(start + step * index));
}

function renderHandles({ nodeId, side, count, layout, connectedSlotIds, showAllHandles, handleUsage, accent }) {
  const config = SIDE_CONFIG[side];
  const offsets = buildOffsets(count, layout);

  return offsets.map((offset, index) => {
    const slotId = `${side}-${index + 1}`;
    const slotKey = `${nodeId}:${slotId}`;
    const isConnected = connectedSlotIds.has(slotKey);
    const usageCount = Number(handleUsage?.[slotId] || 0);

    if (!showAllHandles && !isConnected) {
      return null;
    }

    const classes = [styles.handle];
    if (isConnected) classes.push(styles.handleConnected);
    if (showAllHandles && !isConnected) classes.push(styles.handleEditable);

    return (
      <Handle
        key={`${nodeId}-${slotId}-${usageCount}`}
        id={slotId}
        type="source"
        position={config.position}
        isConnectable={usageCount < 1}
        className={classes.join(' ')}
        style={{ [config.axis]: `${offset}%`, '--node-accent': accent }}
      />
    );
  });
}

function imageTileStyle(photo, imageSettings, size) {
  return {
    width: size,
    height: size,
    backgroundImage: photo ? `url(${photo})` : 'none',
    backgroundSize: imageSettings?.nodeImageSize || 'cover',
    backgroundRepeat: imageSettings?.nodeImageRepeat || 'no-repeat',
    backgroundPosition: imageSettings?.nodeImagePosition || 'center center',
    width: '100%',
    // height: '150px'
  };
}

function displayName(person) {
  const full = person?.fullName || 'Unnamed person';
  return person?.nickname ? `${full} ${person.nickname}` : full;
}

function renderPersonMiniCard(person, imageSettings) {
  const thumbSize = Math.max(44, Math.min(140, Number(imageSettings?.personImageSize) || 72));

  return (
    <div key={person.id} className={styles.personCardMini}>
      {person.photo ? (
        <div className={styles.personTile} style={imageTileStyle(person.photo, imageSettings, `${thumbSize}px`)} />
      ) : (
        <div className={styles.personPlaceholder} style={{ width: thumbSize, height: thumbSize }}>No image</div>
      )}
      <div className={styles.personMeta}>
        <div className={styles.personName}>{person.fullName || 'Unnamed person'}</div>
        {person.nickname && <div className={styles.personNick}>{person.nickname}</div>}
      </div>
    </div>
  );
}

function renderImageArea(data) {
  const nodeType = data.nodeType || NODE_TYPES.STANDARD;
  const imageSettings = data.imageSettings || {};

  if (nodeType === NODE_TYPES.STANDARD) {
    return data.photo ? (
      <div className={styles.heroImage} style={imageTileStyle(data.photo, imageSettings, '100%')} />
    ) : (
      <div className={styles.placeholder}>No image</div>
    );
  }

  const people = data.people || [];

  return (
    <div className={styles.peopleGrid}>
      {people.length === 0 && <div className={styles.placeholder}>No people yet</div>}
      {people.map((person) => renderPersonMiniCard(person, imageSettings))}
    </div>
  );
}

function FamilyNode({ id, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const handleSyncSignature = useMemo(() => JSON.stringify({
    handles: data.handles || {},
    handleLayout: data.handleLayout || {},
    nodeWidth: data.nodeWidth,
    nodeHeight: data.nodeHeight,
    nodeType: data.nodeType,
    peopleCount: Array.isArray(data.people) ? data.people.length : 0,
    connectedSlotIds: Array.isArray(data.connectedSlotIds) ? [...data.connectedSlotIds].sort() : [],
    handleUsage: data.handleUsage || {}
  }), [data.handles, data.handleLayout, data.nodeWidth, data.nodeHeight, data.nodeType, data.people, data.connectedSlotIds, data.handleUsage]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleSyncSignature, updateNodeInternals]);

  const width = Math.max(100, Number(data.nodeWidth) || 220);
  const height = Math.max(100, Number(data.nodeHeight) || 220);
  const radius = Math.max(8, Math.min(36, Number(data.nodeRadius) || 18));
  const handles = data.handles || { top: 0, right: 0, bottom: 1, left: 0 };
  const handleLayout = data.handleLayout || {};
  const connectedSlotIds = new Set(data.connectedSlotIds || []);
  const showAllHandles = Boolean(data.isAdminAuthenticated);
  const accent = data.nodeAccent || '#22d3ee';

  return (
    <div
      className={`${styles.node} ${selected ? styles.selected : ''}`}
      style={{ width, height, borderRadius: radius, '--node-accent': accent, '--node-glow-opacity': data.nodeGlow ? 1 : 0 }}
      data-admin={data.isAdminAuthenticated ? 'true' : 'false'}
    >
      {renderHandles({ nodeId: id, side: 'top', count: handles.top, layout: handleLayout.top, connectedSlotIds, showAllHandles, handleUsage: data.handleUsage, accent })}
      {renderHandles({ nodeId: id, side: 'right', count: handles.right, layout: handleLayout.right, connectedSlotIds, showAllHandles, handleUsage: data.handleUsage, accent })}
      {renderHandles({ nodeId: id, side: 'bottom', count: handles.bottom, layout: handleLayout.bottom, connectedSlotIds, showAllHandles, handleUsage: data.handleUsage, accent })}
      {renderHandles({ nodeId: id, side: 'left', count: handles.left, layout: handleLayout.left, connectedSlotIds, showAllHandles, handleUsage: data.handleUsage, accent })}

      {data.isAdminAuthenticated && (
        <div className={`${styles.quickActions} nodrag nopan`} onClick={(event) => event.stopPropagation()}>
          <Button size="xs" appearance="subtle" className={styles.actionButton} onClick={() => data.onEdit?.(id)}>Edit</Button>
          <Button size="xs" appearance="subtle" className={styles.actionButton} onClick={() => data.onDuplicate?.(id)}>Copy</Button>
          <Button size="xs" appearance="subtle" color="red" className={styles.actionButton} onClick={() => data.onDelete?.(id)}>Delete</Button>
        </div>
      )}

      <div className={styles.imageWrap}>{renderImageArea(data)}</div>
      <div className={styles.title}>{data.title || 'Untitled Node'}</div>
    </div>
  );
}

export default memo(FamilyNode);
