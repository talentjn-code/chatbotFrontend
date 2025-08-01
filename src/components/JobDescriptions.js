// src/components/JobDescriptions.js
import React, { useState } from 'react';
import EmptyState from './EmptyState';
import JobDescriptionModal from './JobDescriptionModal';
import JDPreviewModal from './JDPreviewModal';
import './JobDescriptions.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const JobDescriptions = ({ content, isPredefine = false, onJobAdded }) => {
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedJdId, setSelectedJdId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteJdId, setDeleteJdId] = useState(null);

  const handleAddNew = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);

  const handleSubmit = async ({ company, job, description, file, mode }) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('jwt');
      let body, headers;
      if (mode === 'manual') {
        body = JSON.stringify({ company, job, description });
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
      } else {
        const formData = new FormData();
        formData.append('company', company);
        formData.append('job', job);
        formData.append('description_file', file);
        body = formData;
        headers = { 'Authorization': `Bearer ${token}` };
      }
      const res = await fetch(`${BACKEND_URL}/jd/add_jds`, {
        method: 'POST',
        headers,
        body,
      });
      if (!res.ok) throw new Error('Failed to add job description');
      setShowModal(false);
      // Instead of hard refresh, trigger a re-fetch by calling a callback
      if (onJobAdded) {
        onJobAdded();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (content.type === 'list') {
    content.items = content.items.map(jd => ({
      ...jd,
      title: jd.jobname || jd.title || 'Untitled',
      subtitle: jd.description || '',
      company: jd.company || '',
    }));
  }

  const handlePreviewClick = (e, id) => {
    e.stopPropagation();
    setSelectedJdId(id);
    setShowPreview(true);
  };

  const handleCardClick = (id) => {
    const route = isPredefine ? `/resume-upload/predefined/${id}` : `/resume-upload/${id}`;
    window.location.href = route;
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedJdId(null);
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setDeleteJdId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwt');
      const response = await fetch(`${BACKEND_URL}/jd/delete/${deleteJdId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete job description');
      }
      
      setShowDeleteConfirm(false);
      setDeleteJdId(null);
      
      // Refresh the list
      if (onJobAdded) {
        onJobAdded();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteJdId(null);
  };

  return (
    <section className="job-descriptions">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{isPredefine ? 'TJ Job Descriptions' : 'My Job Descriptions'}</h2>
        {!isPredefine && (
          <button className="primary-btn" style={{ backgroundColor: '#007bff' }} onClick={handleAddNew}>
            Add New
          </button>
        )}
      </div>
      <JobDescriptionModal open={showModal} onClose={handleCloseModal} onSubmit={handleSubmit} loading={loading} />
      <JDPreviewModal 
        isOpen={showPreview} 
        onClose={handleClosePreview} 
        jdId={selectedJdId} 
        isPredefine={isPredefine}
        onJobUpdated={onJobAdded}
      />
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              Confirm Delete
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#666' }}>
              Are you sure you want to delete this job description? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {content.type === 'empty_state' && (
        <EmptyState {...content.illustration} onAction={isPredefine ? () => {} : handleAddNew} />
      )}
      {content.type === 'list' && (
        <div className="jd-grid">
          {content.items.map(jd => (
            <div className="jd-card" key={jd.id} onClick={() => handleCardClick(jd.id)} style={{ cursor: 'pointer' }}>
              <div className="jd-card-header">
                <button 
                  className="preview-btn" 
                  onClick={(e) => handlePreviewClick(e, jd.id)}
                  title="Preview extracted text"
                >
                  👁️
                </button>
                {!isPredefine && (
                  <button 
                    className="delete-btn" 
                    onClick={(e) => handleDeleteClick(e, jd.id)}
                    title="Delete job description"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: '#dc2626',
                      marginLeft: '8px'
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div className="jd-card-illustration">
                {/* Replace with image if available, else fallback icon */}
                {jd.imageUrl ? (
                  <img src={jd.imageUrl} alt={jd.title} />
                ) : (
                  <span role="img" aria-label="job">📝</span>
                )}
              </div>
              <div className="jd-card-title">{jd.title}</div>
              <div className="jd-card-company">{jd.company}</div>
              <div className="jd-card-description">{jd.subtitle.substring(0, 100)}...</div>
              {/* Example meta info, can be dynamic if available */}
              <div className="jd-card-meta">Click to continue</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default JobDescriptions;
