// src/components/EmptyState.js
import React from 'react';
import './EmptyState.css';

const EmptyState = ({ title, subtitle, actionButton, onAction }) => (
  <div className="empty-state">
    <div className="empty-illustration">📄</div>
    <h3>{title}</h3>
    <p>{subtitle}</p>
    <button
      className="primary-btn"
      style={{ backgroundColor: actionButton.color }}
      onClick={onAction}
    >
      {actionButton.text}
    </button>
  </div>
);

export default EmptyState;
