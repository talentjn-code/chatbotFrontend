import React, { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import '../App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const ChatbotPage = () => {
  const welcomeMessage = "Welcome to your personalized interview assistant!\n\nI'm here to help you prepare for your upcoming interview. I have access to the job description and can provide detailed insights about the role, company, and interview preparation strategies.\n\nFeel free to ask me specific questions, or choose from the suggested topics below to get started!";
  
  const [messages, setMessages] = useState([
    { from: 'bot', text: welcomeMessage }
  ]);
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: welcomeMessage }
  ]);
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showInitialQuestions, setShowInitialQuestions] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isValidatingJob, setIsValidatingJob] = useState(true);
  const [jobValidationError, setJobValidationError] = useState(null);
  const [searchResults, setSearchResults] = useState({});
  const [loadingSearch, setLoadingSearch] = useState({});
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const { jobId, type } = useParams();
  const navigate = useNavigate();
  const isPredefine = type === 'predefined';

  const initialQuestions = [
    "Brief me about the company",
    "Brief me about this job role",
    "How can I prepare for this interview?",
    "What are the key skills required?",
    "What questions should I expect?",
    "How should I present my experience?"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create new chat session when component mounts
  useEffect(() => {
    const createChatSession = async () => {
      if (!jobId) {
        setJobValidationError('No job ID provided');
        setIsValidatingJob(false);
        return;
      }

      const token = localStorage.getItem('jwt');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${BACKEND_URL}/job-ai/create-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            job_id: jobId,
            is_predefined: isPredefine
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();

        if (response.ok && data.success) {
          setChatId(data.session_id);
          setJobValidationError(null);
        } else {
          setJobValidationError(data.error || 'Failed to create chat session');
        }
      } catch (error) {
        console.error('Error creating chat session:', error);
        setJobValidationError('Failed to create chat session');
      } finally {
        setIsValidatingJob(false);
      }
    };

    createChatSession();
  }, [jobId, navigate, isPredefine]);

  // Reset chat state when jobId changes (prevents cross-contamination)
  useEffect(() => {
    const welcomeMessage = "Welcome to your personalized interview assistant!\n\nI'm here to help you prepare for your upcoming interview. I have access to the job description and can provide detailed insights about the role, company, and interview preparation strategies.\n\nFeel free to ask me specific questions, or choose from the suggested topics below to get started!";
    
    setMessages([{ from: 'bot', text: welcomeMessage }]);
    setChatHistory([{ role: 'assistant', content: welcomeMessage }]);
    setChatId(null);
    setSuggestions([]);
    setShowInitialQuestions(true);
    setInput('');
  }, [jobId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading || !chatId) return;
    setShowInitialQuestions(false);
    const newUserMsg = { role: 'user', content: input };
    const updatedHistory = [...chatHistory, newUserMsg];
    setChatHistory(updatedHistory);
    setMessages([...messages, { from: 'user', text: input }]);
    setInput('');
    setLoading(true);
    const token = localStorage.getItem('jwt');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    try {
      
      const res = await fetch(`${BACKEND_URL}/job-ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' , 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          query : input,
          previous_messages: updatedHistory,
        }),
      });
      clearTimeout(timeoutId); // Clear timeout on successful response
      const data = await res.json();
      if (data && data.response) {
        const assistantMsg = { role: 'assistant', content: data.response };
        setChatHistory(hist => [...hist, assistantMsg]);
        const newMessageIndex = messages.length + 1;
        setMessages(msgs => [...msgs, { from: 'bot', text: data.response }]);
        if (data.chat_id) setChatId(data.chat_id);
        // Use suggestions from chat response
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([]);
        }
        setIsLoadingSuggestions(false);
        
        // Fetch search results if search query is provided and is_search_query is true
        if (data.search_query && data.is_search_query) {
          fetchSearchResults(data.search_query, newMessageIndex);
        } else {
          // Clear search results for this message index if no search is needed
          setSearchResults(prev => {
            const updated = { ...prev };
            delete updated[newMessageIndex];
            return updated;
          });
        }
      }
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('Chat error:', err);
      const errorMessage = err.name === 'AbortError' ? 
        'Request timed out. Please try again.' : 
        'Sorry, there was an error. Please try again.';
      setMessages(msgs => [...msgs, { from: 'bot', text: errorMessage }]);
      setSuggestions([]);
      setIsLoadingSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (loading || !chatId) return; // Prevent multiple concurrent requests
    setShowInitialQuestions(false);
    setInput('');
    setLoading(true);
    const token = localStorage.getItem('jwt');
    const newUserMsg = { role: 'user', content: suggestion };
    const updatedHistory = [...chatHistory, newUserMsg];
    setChatHistory(updatedHistory);
    setMessages([...messages, { from: 'user', text: suggestion }]);
    // Send message directly with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    fetch(`${BACKEND_URL}/job-ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: chatId,
        query: suggestion,
        previous_messages: updatedHistory,
      }),
    })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(data => {
        if (data && data.response) {
          const assistantMsg = { role: 'assistant', content: data.response };
          setChatHistory(hist => [...hist, assistantMsg]);
          const newMessageIndex = messages.length + 1;
          setMessages(msgs => [...msgs, { from: 'bot', text: data.response }]);
          if (data.chat_id) setChatId(data.chat_id);
          // Use suggestions from chat response
          if (data.suggestions && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
          } else {
            setSuggestions([]);
          }
          setIsLoadingSuggestions(false);
          
          // Fetch search results if search query is provided and is_search_query is true
          if (data.search_query && data.is_search_query) {
            fetchSearchResults(data.search_query, newMessageIndex);
          } else {
            // Clear search results for this message index if no search is needed
            setSearchResults(prev => {
              const updated = { ...prev };
              delete updated[newMessageIndex];
              return updated;
            });
          }
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error('Suggestion chat error:', err);
        const errorMessage = err.name === 'AbortError' ? 
          'Request timed out. Please try again.' : 
          'Sorry, there was an error. Please try again.';
        setMessages(msgs => [...msgs, { from: 'bot', text: errorMessage }]);
        setSuggestions([]);
        setIsLoadingSuggestions(false);
      })
      .finally(() => setLoading(false));
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const fetchSearchResults = async (searchQuery, messageIndex) => {
    const token = localStorage.getItem('jwt');
    if (!token || !searchQuery) return;
    
    setLoadingSearch(prev => ({ ...prev, [messageIndex]: true }));
    
    try {
      const response = await fetch(`${BACKEND_URL}/job-ai/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ search_query: searchQuery })
      });
      
      const data = await response.json();
      if (data.success && data.results) {
        setSearchResults(prev => ({ ...prev, [messageIndex]: data.results }));
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
    } finally {
      setLoadingSearch(prev => ({ ...prev, [messageIndex]: false }));
    }
  };

  const exportChatToPDF = async () => {
    setIsExportingPDF(true);
    setShowMenu(false);
    
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Add title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Interview Chat Export', margin, yPosition);
      yPosition += 15;

      // Add timestamp
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const timestamp = new Date().toLocaleString();
      pdf.text(`Exported on: ${timestamp}`, margin, yPosition);
      yPosition += 20;

      // Helper function to check page boundaries
      const checkPageBreak = (additionalSpace = 30) => {
        if (yPosition + additionalSpace > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Add messages
      pdf.setFontSize(12);
      messages.forEach((message, index) => {
        const sender = message.from === 'user' ? 'You' : 'Assistant';
        const prefix = `${sender}: `;
        const textLines = pdf.splitTextToSize(message.text, maxWidth - 30);
        
        // Check if we need a new page for this message
        checkPageBreak(textLines.length * 6 + 20);

        // Add sender label
        pdf.setFont('helvetica', 'bold');
        pdf.text(prefix, margin, yPosition);
        
        // Add message content
        pdf.setFont('helvetica', 'normal');
        pdf.text(textLines, margin + 30, yPosition);
        
        yPosition += textLines.length * 6 + 10;
      });

      // Save the PDF
      const filename = `interview-chat-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export chat. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const checkResumeAndStartInterview = async () => {
    setIsCheckingResume(true);
    setShowMenu(false);
    
    try {
      // Check if resume exists for this job
      // For now, redirect to resume upload page which handles the logic
      // The ResumeUploadPage will either show upload form or start interview directly
      const resumeRoute = isPredefine ? `/resume-upload/predefined/${jobId}?mode=interview` : `/resume-upload/${jobId}?mode=interview`;
      navigate(resumeRoute);
    } catch (error) {
      console.error('Error checking resume:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsCheckingResume(false);
    }
  };

  const headerData = {
    logo: { text: 'TalentJn', icon: 'house' },
    backgroundColor: '#2c3e99',
  };

  // Show loading state while validating job access
  if (isValidatingJob) {
    return (
      <div className="main-bg">
        <Header {...headerData} />
        <div className="chatbot-nav">
          <button className="back-to-home-btn" onClick={handleBackToHome}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 19-7-7 7-7"/>
              <path d="m19 12H5"/>
            </svg>
          </button>
        </div>
        <div className="validation-loading">
          <div className="loading-spinner"></div>
          <p>Validating job access...</p>
        </div>
      </div>
    );
  }

  // Show error state if job validation failed
  if (jobValidationError) {
    return (
      <div className="main-bg">
        <Header {...headerData} />
        <div className="chatbot-nav">
          <button className="back-to-home-btn" onClick={handleBackToHome}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 19-7-7 7-7"/>
              <path d="m19 12H5"/>
            </svg>
          </button>
        </div>
        <div className="validation-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="m15 9-6 6"/>
            <path d="m9 9 6 6"/>
          </svg>
          <h3>Access Denied</h3>
          <p>{jobValidationError}</p>
          <button className="primary-btn" onClick={handleBackToHome}>
            Return to Job List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-bg">
      <Header {...headerData} />
      <div className="chatbot-nav">
        <button className="back-to-home-btn" onClick={handleBackToHome}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 19-7-7 7-7"/>
            <path d="m19 12H5"/>
          </svg>
        </button>
      </div>
      <div className="chatbot-container">
        <div className="chatbot-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chatbot-message ${msg.from}`}>
              {msg.from === 'bot' ? (
                <>
                  <div dangerouslySetInnerHTML={{ 
                    __html: msg.text.replace(
                      /\[([^\]]+)\]\(([^)]+)\)/g, 
                      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline;">$1</a>'
                    )
                  }} />
                  {/* Search Results Section */}
                  {(loadingSearch[idx] || (searchResults[idx] && searchResults[idx].length > 0)) && (
                    <div className="search-results-section">
                      <div className="search-results-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span>Relevant Google Links</span>
                      </div>
                      {loadingSearch[idx] ? (
                        <div className="search-loading">
                          <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      ) : (
                        <div className="search-results">
                          {searchResults[idx]?.map((result, i) => (
                            <a 
                              key={i}
                              href={result.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="search-result-item"
                            >
                              <div className="search-result-title">{result.title}</div>
                              <div className="search-result-snippet">{result.snippet}</div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                msg.text
              )}
            </div>
          ))}
          {loading && (
            <div className="chatbot-message bot">
              <span className="typing">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {showInitialQuestions && (
          <div className="initial-questions">
            <div className="initial-questions-header">
              <h4>Quick Start Questions:</h4>
            </div>
            <div className="initial-questions-grid">
              {initialQuestions.map((question, i) => (
                <button
                  key={i}
                  className="initial-question-button"
                  onClick={() => handleSuggestionClick(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        {!showInitialQuestions && (
          <div className="chatbot-suggestions-horizontal">
            {isLoadingSuggestions ? (
              <div className="suggestions-loading">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loading-text">Generating suggestions...</span>
              </div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              ))
            )}
          </div>
        )}
        <div className="chatbot-input-row styled-input-row">
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className="primary-btn" onClick={handleSend}>Send</button>
          <div className="menu-container" ref={menuRef}>
            <button 
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              disabled={isExportingPDF || isCheckingResume}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <button 
                  className="menu-item"
                  onClick={exportChatToPDF}
                  disabled={isExportingPDF || messages.length <= 1}
                >
                  {isExportingPDF ? (
                    <>
                      <span className="loading-spinner"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        <path d="M10.5,17H13.5V15H10.5V17M10.5,13H13.5V11H10.5V13Z"/>
                      </svg>
                      Export Chat as PDF
                    </>
                  )}
                </button>
                <button 
                  className="menu-item"
                  onClick={checkResumeAndStartInterview}
                  disabled={isCheckingResume}
                >
                  {isCheckingResume ? (
                    <>
                      <span className="loading-spinner"></span>
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      Start Mock Interview
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .chatbot-nav {
          padding: 20px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .back-to-home-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          color: #495057;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .back-to-home-btn:hover {
          background: #e9ecef;
          border-color: #adb5bd;
          color: #212529;
        }
        
        .back-to-home-btn svg {
          width: 16px;
          height: 16px;
        }
        
        .typing span {
          animation: blink 1s infinite;
          opacity: 0.3;
          font-size: 1.5em;
        }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        .chatbot-suggestions-horizontal {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 10px 0 8px 0;
        }
        .suggestion-chip {
          background: #f0f4ff;
          border: none;
          border-radius: 16px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 1em;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .suggestion-chip:hover {
          background: #dbe6ff;
        }
        .styled-input-row {
          background: #f5f7fa;
          border-radius: 0 0 16px 16px;
          padding: 16px 16px 12px 16px;
          box-shadow: 0 -2px 8px rgba(44,62,153,0.04);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .styled-input-row input {
          height: 48px;
          padding: 12px 16px;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          font-size: 16px;
          flex: 1;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .styled-input-row input:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        
        .initial-questions {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          margin: 16px 0;
          border: 1px solid #e5e7eb;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .initial-questions-header {
          margin-bottom: 16px;
        }
        
        .initial-questions-header h4 {
          margin: 0;
          color: #374151;
          font-size: 16px;
          font-weight: 600;
        }
        
        .initial-questions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 12px;
        }
        
        .initial-question-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .initial-question-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .initial-question-button:active {
          transform: translateY(0);
        }
        
        .menu-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .menu-btn {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          color: #495057;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 8px;
          transition: all 0.2s ease;
        }
        
        .menu-btn:hover:not(:disabled) {
          background: #e9ecef;
          border-color: #adb5bd;
          color: #212529;
        }
        
        .menu-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .dropdown-menu {
          position: absolute;
          top: -120px;
          right: 0;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 200px;
          overflow: hidden;
        }
        
        .menu-item {
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: white;
          color: #333;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          transition: background-color 0.2s;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .menu-item:last-child {
          border-bottom: none;
        }
        
        .menu-item:hover:not(:disabled) {
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .menu-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .loading-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .suggestions-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 16px;
          color: #6c757d;
          font-size: 14px;
        }
        
        .loading-dots {
          display: flex;
          gap: 4px;
        }
        
        .loading-dots span {
          width: 6px;
          height: 6px;
          background: #007bff;
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite both;
        }
        
        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        .loading-dots span:nth-child(3) {
          animation-delay: 0s;
        }
        
        @keyframes pulse {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .loading-text {
          font-style: italic;
        }
        
        .validation-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        
        .validation-loading .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        
        .validation-loading p {
          color: #6c757d;
          font-size: 16px;
          margin: 0;
        }
        
        .validation-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        
        .validation-error svg {
          color: #dc3545;
          margin-bottom: 16px;
        }
        
        .validation-error h3 {
          color: #dc3545;
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
        }
        
        .validation-error p {
          color: #6c757d;
          margin: 0 0 24px 0;
          font-size: 16px;
        }
        
        .validation-error .primary-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .validation-error .primary-btn:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  );
};

export default ChatbotPage;
