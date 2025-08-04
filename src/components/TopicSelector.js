// src/components/TopicSelector.js
import React from 'react';
import './TopicSelector.css';

const TopicSelector = ({ title, subtitle, searchBar, selectedTopic, topicList, onSearch, onSelect }) => (
  <section className="topic-selector">
    <h2>{title}</h2>
    <p className="subtitle">{subtitle}</p>
    <ul className="topic-list">
      <li
          className={selectedTopic && selectedTopic.name === "My JDs" ? 'selected' : ''}
          onClick={() => onSelect(topicList.find(topic => topic.name === "My JDs"))}
        >
          Interview Prep
        </li>

        {/* <li
          className={selectedTopic && selectedTopic.name === "TJ JDs" ? 'selected' : ''}
          onClick={() => onSelect(topicList.find(topic => topic.name === "TJ JDs"))}
        >
          TJ JDs
        </li> */}
    </ul>
  </section>
);

export default TopicSelector;
