import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { NODE_TYPES } from '../../utils/nodeFactory';
import StandardNodeDetailsModal from './StandardNodeDetailsModal';
import PeopleNodeDetailsModal from './PeopleNodeDetailsModal';

export default function NodeDetailsModal() {
  const { state } = useAppState();
  const node = state.nodes.find((item) => item.id === state.activeNodeId);

  if (!state.isNodeModalOpen || !node) return null;

  const nodeType = node.data?.nodeType || NODE_TYPES.STANDARD;
  return nodeType === NODE_TYPES.PERSONS
    ? <PeopleNodeDetailsModal node={node} />
    : <StandardNodeDetailsModal node={node} />;
}
