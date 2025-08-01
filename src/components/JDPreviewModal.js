// src/components/JDPreviewModal.js
import React, { useState, useEffect } from 'react';
import './JDPreviewModal.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const JDPreviewModal = ({ isOpen, onClose, jdId, isPredefine = false, onJobUpdated }) => {
  const [jd, setJd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ company: '', jobname: '', description: '' });

  useEffect(() => {
    if (isOpen && jdId) {
      fetchJDDetails();
    }
  }, [isOpen, jdId]);

  const fetchJDDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('jwt');
      let response;
      if (isPredefine) {
        // Fetch predefined JD details (auth required)
        response = await fetch(`${BACKEND_URL}/jd/predefined_jd/${jdId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } else {
        // Fetch user's JD details
        response = await fetch(`${BACKEND_URL}/jd/jd/${jdId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch job description details');
      }
      
      const data = await response.json();
      setJd(data);
      // Initialize edit form with current data
      setEditForm({
        company: data.company || '',
        jobname: data.jobname || '',
        description: data.description || ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    const route = isPredefine ? `/resume-upload/predefined/${jdId}` : `/resume-upload/${jdId}`;
    window.location.href = route;
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original data
    setEditForm({
      company: jd.company || '',
      jobname: jd.jobname || '',
      description: jd.description || ''
    });
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('jwt');
      
      const response = await fetch(`${BACKEND_URL}/jd/update/${jdId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update job description');
      }
      
      const updatedData = await response.json();
      setJd(updatedData);
      setIsEditing(false);
      
      // Notify parent component about update
      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="jd-preview-overlay">
      <div className="jd-preview-modal">
        <div className="jd-preview-header">
          <h2>Job Description Preview</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="jd-preview-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading job description...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p className="error-message">❌ {error}</p>
              <button onClick={fetchJDDetails} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {jd && !loading && !error && (
            <>
              {!isEditing ? (
                <>
                  <div className="jd-meta">
                    <div className="jd-meta-item">
                      <strong>Company:</strong> {jd.company}
                    </div>
                    <div className="jd-meta-item">
                      <strong>Position:</strong> {jd.jobname}
                    </div>
                    <div className="jd-meta-item">
                      <strong>Text Length:</strong> {jd.description_length.toLocaleString()} characters
                    </div>
                  </div>

                  <div className="jd-text-container">
                    <h3>Extracted Text:</h3>
                    <div className="jd-text-content">
                      {jd.description.split('\n').map((line, index) => (
                        <p key={index}>
                          {line.trim() === '' ? <br /> : line}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="jd-edit-form">
                  <div className="form-group">
                    <label><strong>Company:</strong></label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => handleFormChange('company', e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label><strong>Position:</strong></label>
                    <input
                      type="text"
                      value={editForm.jobname}
                      onChange={(e) => handleFormChange('jobname', e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label><strong>Description:</strong></label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      rows={15}
                      style={{ 
                        width: '100%', 
                        padding: '8px', 
                        marginTop: '4px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="jd-preview-footer">
          {!isEditing ? (
            <>
              <button className="secondary-btn" onClick={onClose}>
                Close
              </button>
              {jd && !isPredefine && (
                <button 
                  className="secondary-btn" 
                  onClick={handleEdit}
                  style={{ marginLeft: '8px', backgroundColor: '#f0f9ff', color: '#0369a1' }}
                >
                  Edit
                </button>
              )}
              {jd && (
                <button className="primary-btn" onClick={handleContinue}>
                  Continue to Resume Upload
                </button>
              )}
            </>
          ) : (
            <>
              <button className="secondary-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button 
                className="primary-btn" 
                onClick={handleSaveEdit}
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JDPreviewModal;