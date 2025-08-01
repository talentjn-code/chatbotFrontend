import React, { useState } from 'react';
import './JobDescriptionModal.css';

const JobDescriptionModal = ({ open, onClose, onSubmit, loading }) => {
  const [company, setCompany] = useState('');
  const [job, setJob] = useState('');
  const [mode, setMode] = useState('manual');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!company || !job || (mode === 'manual' ? !description : !file)) {
      setError('Please fill all required fields.');
      return;
    }
    onSubmit({ company, job, description: mode === 'manual' ? description : null, file, mode });
  };

  if (!open) return null;

  return (
    <div className="jd-modal-overlay">
      <div className="jd-modal">
        <div className="jd-modal-header">
          <span>Provide your own job description</span>
          <button className="jd-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="jd-modal-row">
            <input
              className="jd-modal-input"
              placeholder="Company Name"
              value={company}
              onChange={e => setCompany(e.target.value)}
              required
            />
            <input
              className="jd-modal-input"
              placeholder="Job Function"
              value={job}
              onChange={e => setJob(e.target.value)}
              required
            />
          </div>
          <div className="jd-modal-section-label">Provide job details</div>
          <div className="jd-modal-radio-row">
            <label>
              <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Enter manually
            </label>
            <label style={{ marginLeft: 16 }}>
              <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> Upload file
            </label>
          </div>
          {mode === 'manual' ? (
            <textarea
              className="jd-modal-textarea"
              placeholder="Enter job details"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{ minHeight: 120 }}
            />
          ) : (
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              required
              className="jd-modal-file"
            />
          )}
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          <button
            type="submit"
            className="jd-modal-submit"
            disabled={loading}
            style={{ marginTop: 24 }}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JobDescriptionModal;
