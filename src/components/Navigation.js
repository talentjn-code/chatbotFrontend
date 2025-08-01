// src/components/Navigation.js
import React from 'react';
import './Navigation.css';

const Navigation = ({ items, backgroundColor }) => (
  <nav className="navigation" style={{ backgroundColor }}>
    <ul>
      {items.map(item => (
        <li key={item.name} className={item.active ? 'active' : ''}>
          <a href={item.link}>{item.name}</a>
        </li>
      ))}
    </ul>
  </nav>
);

export default Navigation;
