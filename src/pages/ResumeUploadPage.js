import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import MockInterview from '../components/MockInterview';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './ResumeUploadPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const ResumeUploadPage = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('prepare');
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startMockInterview, setStartMockInterview] = useState(false);
  const { jobId, type } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPredefine = type === 'predefined';
  
  // Check if user came from chatbot with intent to start interview
  const searchParams = new URLSearchParams(location.search);
  const initialMode = searchParams.get('mode') === 'interview' ? 'mock' : 'prepare';

  useEffect(() => {
    const fetchJobData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        let response;
        
        if (isPredefine) {
          // Fetch predefined JD data
          response = await fetch(`${BACKEND_URL}/jd/predefined_jd/${jobId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } else {
          // Fetch user's JD data
          response = await fetch(`${BACKEND_URL}/jd/jd/${jobId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch job data');
        }
        
        const data = await response.json();
        setJobData(data);
      } catch (err) {
        setError(`Failed to load job data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (jobId) {
      fetchJobData();
    }
  }, [jobId, isPredefine]);

  // Set initial mode based on URL parameter
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Check for stored resume on mount
  useEffect(() => {
    const storedResumeData = localStorage.getItem('resumeFile');
    if (storedResumeData) {
      try {
        const resumeData = JSON.parse(storedResumeData);
        // Create a File object from stored data
        fetch(resumeData.data)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], resumeData.name, { type: resumeData.type });
            setFile(file);
            
            // Auto-start mock interview if coming from chatbot with interview mode
            if (initialMode === 'mock' && jobData) {
              setStartMockInterview(true);
            }
          });
      } catch (error) {
        console.error('Error loading stored resume:', error);
      }
    }
  }, [initialMode, jobData]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError('');
    
    // Store file in localStorage as base64
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileData = {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          data: reader.result,
          uploadedAt: new Date().toISOString()
        };
        localStorage.setItem('resumeFile', JSON.stringify(fileData));
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleContinue = async () => {
    if (mode === 'mock') {
      // Start mock interview with resume file and job data
      setStartMockInterview(true);
    } else {
      // Navigate to chatbot for preparation
      const chatbotRoute = isPredefine ? `/chatbot/predefined/${jobId}` : `/chatbot/${jobId}`;
      navigate(chatbotRoute);
    }
  };

  const headerData = {
    logo: { text: 'TalentJn', icon: 'house' },
    backgroundColor: '#2c3e99',
  };

  // Show mock interview component if mock mode is selected and started
  if (startMockInterview && mode === 'mock') {
    return <MockInterview jobData={jobData} resumeFile={file} />;
  }

  if (loading) {
    return (
      <div className="main-bg">
        <Header {...headerData} />
        <div style={{ maxWidth: 1100, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 32 }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading job details...</div>
        </div>
      </div>
    );
  }

  if (error && !jobData) {
    return (
      <div className="main-bg">
        <Header {...headerData} />
        <div style={{ maxWidth: 1100, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 32 }}>
          <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-bg">
      <Header {...headerData} />
      <div className="resume-upload-container">
        {/* Back button */}
        <button 
          className="back-button" 
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '24px',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ←
        </button>
        
        <div className="resume-job-header">
          <div className="resume-job-illustration">
            <span role="img" aria-label="job" style={{ fontSize: '48px' }}>📝</span>
          </div>
          <div>
            <div className="resume-job-title">{jobData?.jobname || 'Job Title'}</div>
            <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {jobData?.company || 'Company Name'}
            </div>
          </div>
        </div>
        <div className="form-section">
          <h3 className="form-section-title">What would you like to do?</h3>
          <div className="resume-options-row">
            <label className="resume-radio">
              <input type="radio" checked={mode === 'prepare'} onChange={() => setMode('prepare')} /> Prepare for this job
            </label>
            <label className="resume-radio">
              <input type="radio" checked={mode === 'mock'} onChange={() => setMode('mock')} /> Take mock interview
            </label>
          </div>
        </div>
        
        <div className="form-section">
          <h3 className="form-section-title">Upload Resume</h3>
          <div className="form-section-description">
            Your <span className="resume-upload-personalised">interviews are personalised</span> based on the resume provided
            <div className={`resume-upload-note ${mode === 'mock' ? 'visible' : ''}`}>
              <span className="note-icon">💡</span>
              <span>Resume upload recommended for AI-generated questions tailored to your experience</span>
            </div>
          </div>
          <div className="resume-upload-section">
          <div className="file-upload-container">
            <input 
              type="file" 
              accept=".pdf,.doc,.docx" 
              onChange={handleFileChange}
              id="resume-file-input"
              className="file-input-hidden"
            />
            <label htmlFor="resume-file-input" className="file-upload-label">
              <span className="file-upload-icon">📄</span>
              <span className="file-upload-text">
                {file ? file.name : 'Choose file'}
              </span>
            </label>
            {file && (
              <button 
                className="file-remove-btn"
                onClick={() => { 
                  setFile(null); 
                  document.getElementById('resume-file-input').value = ''; 
                  localStorage.removeItem('resumeFile');
                }}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          {file && (
            <div className="file-info">
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          </div>
        </div>
        <button
          className="resume-upload-continue"
          onClick={handleContinue}
          disabled={mode === 'mock' && !file}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ResumeUploadPage;
