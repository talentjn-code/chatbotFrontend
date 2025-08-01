// src/pages/InterviewPrepPage.js
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import TopicSelector from '../components/TopicSelector';
import JobDescriptions from '../components/JobDescriptions';
import '../App.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const headerData = {
  logo: { text: 'TalentJn', icon: 'house' },
  backgroundColor: '#2c3e99',
};

const getNavigationData = (isAdmin = false) => ({
  items: [
    { name: 'Dashboard', active: false, link: '/dashboard' },
    { name: 'Jobs Market', active: false, link: '/jobs' },
    { name: 'My Jobs', active: false, link: '/my-jobs' },
    { name: 'My Resumes', active: false, link: '/resumes' },
    { name: 'Interview Preparation', active: true, link: '/interview-prep' },
    ...(isAdmin ? [{ name: 'Admin Panel', active: false, link: '/admin' }] : []),
  ],
  backgroundColor: '#2c3e99',
});

const topicSelectorData = {
  title: 'Select topic',
  subtitle: 'Understand your dream role and ace the interview with AI by your side',
  searchBar: { placeholder: 'Search topics', icon: 'search' },
  topicList: [
    { id: 'all_chats', name: 'All Chats', type: 'all_chats' },
    { id: 1, name: 'My JDs', type: 'topic' },
    { id: 2, name: 'TJ JDs', type: 'topic' },
  ],
};

const jobDescriptionsData = {
  type: 'job_descriptions',
  title: 'My Job Descriptions',
  content: {
    type: 'empty_state',
    illustration: {
      type: 'centered_content',
      title: 'Use you own job description for interview prep',
      subtitle: 'You can either paste or upload job description details and our AI will take care of the rest',
      actionButton: {
        text: 'Add New',
        type: 'primary',
        color: '#007bff',
      },
    },
  },
};

const InterviewPrepPage = () => {
  const { jwt, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  
  // Check if we should default to All Chats tab based on URL parameter
  const shouldShowAllChats = searchParams.get('tab') === 'all-chats';
  const [selectedTopic, setSelectedTopic] = useState(
    shouldShowAllChats ? topicSelectorData.topicList[0] : topicSelectorData.topicList[1]
  );
  
  const [jobDescriptions, setJobDescriptions] = useState(null); // null: loading, []: empty, [{}]: data
  const [loading, setLoading] = useState(true);
  const [allChats, setAllChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true); // Loading state for All Chats
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'chat', 'interview'
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  const fetchJobDescriptions = async () => {
    setLoading(true);
    const token = localStorage.getItem('jwt');
    
    // Don't clear existing data if token is missing
    if (!token) {
      console.log('No JWT token found');
      setLoading(false);
      return;
    }
    
    try {
      let res;
      if (selectedTopic?.name === 'TJ JDs') {
        // Fetch predefined job descriptions (auth required)
        res = await fetch(`${BACKEND_URL}/jd/predefined_jds`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } else {
        // Fetch user's personal job descriptions
        res = await fetch(`${BACKEND_URL}/jd/your_jds`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
      
      // Check if response is ok before processing
      if (!res.ok) {
        console.log(`API call failed with status: ${res.status}`);
        // Don't clear existing data on API failures
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setJobDescriptions(data);
      } else {
        console.log('Received non-array data:', data);
        // Only set empty array if we're sure there's no data
        setJobDescriptions([]);
      }
    } catch (err) {
      console.error('Error fetching job descriptions:', err);
      // Don't clear existing data on network errors
      // Only log the error and keep existing content
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDescriptions();
  }, [selectedTopic]);

  useEffect(() => {
    // Fetch unified history (both chat and interview) on mount
    const token = localStorage.getItem('jwt');
    setChatsLoading(true); // Start loading
    console.log('Fetching unified history from:', `${BACKEND_URL}/job-ai/unified-history`);
    
    fetch(`${BACKEND_URL}/job-ai/unified-history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        console.log('Unified history response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('Unified history data received:', data);
        if (data && Array.isArray(data.history)) {
          setAllChats(data.history);
          setChatsLoading(false); // Stop loading on success
          console.log('Set all chats to:', data.history);
        } else {
          console.warn('Invalid unified history data format:', data);
          // Fallback to regular chat history
          return fetch(`${BACKEND_URL}/job-ai/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      })
      .then(fallbackRes => {
        if (fallbackRes) {
          console.log('Fallback to regular history, status:', fallbackRes.status);
          return fallbackRes.json();
        }
      })
      .then(fallbackData => {
        if (fallbackData && Array.isArray(fallbackData.history)) {
          console.log('Using fallback chat history:', fallbackData.history);
          setAllChats(fallbackData.history);
        }
        setChatsLoading(false); // Stop loading after fallback
      })
      .catch(err => {
        console.error('Failed to fetch unified history:', err);
        // Final fallback - try to fetch regular chat history
        fetch(`${BACKEND_URL}/job-ai/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.history)) {
              console.log('Final fallback - using regular chat history:', data.history);
              setAllChats(data.history);
            }
            setChatsLoading(false); // Stop loading after final fallback
          })
          .catch(finalErr => {
            console.error('All fallbacks failed:', finalErr);
            setChatsLoading(false); // Stop loading even on final error
          });
      });
  }, []);

  useEffect(() => {
    // Fetch selected chat messages
    if (selectedChatId) {
      const token = localStorage.getItem('jwt');
      fetch(`${BACKEND_URL}/job-ai/history/${selectedChatId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.messages)) {
            setSelectedChatMessages(data.messages);
          }
        });
    } else {
      setSelectedChatMessages([]);
    }
  }, [selectedChatId]);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!jwt) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
        });
        
        if (response.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [jwt]);

  // Move jobDescriptionsContent definition above rightColumnContent
  let jobDescriptionsContent;
  if (loading) {
    jobDescriptionsContent = { type: 'empty_state', illustration: { title: 'Loading...', subtitle: '', actionButton: { text: '', type: 'primary', color: '#007bff' } } };
  } else if (jobDescriptions && jobDescriptions.length > 0) {
    jobDescriptionsContent = {
      type: 'list',
      items: jobDescriptions.map(jd => ({
        id: jd.id,
        title: jd.jobname || 'Untitled',
        subtitle: jd.description || '',
        company: jd.company || '',
        // add more fields as needed
      })),
    };
  } else {
    // Different empty states for TJ JDs vs My JDs
    if (selectedTopic?.name === 'TJ JDs') {
      jobDescriptionsContent = {
        type: 'empty_state',
        illustration: {
          type: 'centered_content',
          title: 'No predefined job descriptions available',
          subtitle: 'TJ job descriptions are currently being updated. Please check back later.',
          actionButton: {
            text: '',
            type: 'primary',
            color: '#007bff',
          },
        },
      };
    } else {
      jobDescriptionsContent = jobDescriptionsData.content;
    }
  }

  // If All Chats is selected, show chat list and chat messages in right column
  const isAllChats = selectedTopic?.id === 'all_chats';

  let rightColumnContent;
  // Remove the chat list from the right column, only show chat messages when All Chats is selected
  if (isAllChats) {
    // Filter chats based on selected filter
    const filteredChats = allChats.filter(chat => {
      if (historyFilter === 'all') return true;
      return chat.session_type === historyFilter;
    });

    const handleDeleteHistory = async (sessionId, event) => {
      event.stopPropagation(); // Prevent navigation
      if (window.confirm('Are you sure you want to delete this history?')) {
        try {
          const token = localStorage.getItem('jwt');
          const response = await fetch(`${BACKEND_URL}/job-ai/history/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            // Remove from local state
            setAllChats(prev => prev.filter(chat => chat.id !== sessionId));
          } else {
            alert('Failed to delete history');
          }
        } catch (error) {
          console.error('Error deleting history:', error);
          alert('Error deleting history');
        }
      }
    };

    rightColumnContent = (
      <div style={{ background: '#fff', borderRadius: 12, minHeight: 400, boxShadow: '0 1px 4px rgba(44,62,153,0.04)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>All Chats</h2>
          
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Filter Dropdown */}
            <select 
              value={historyFilter} 
              onChange={(e) => setHistoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 6,
                background: 'white',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <option value="all">All Sessions</option>
              <option value="chat">Chat Only</option>
              <option value="interview">Interview Only</option>
            </select>
          </div>
        </div>

        {chatsLoading && (
          <div style={{ padding: 16, color: '#888', textAlign: 'center' }}>
            Loading sessions...
          </div>
        )}

        {!chatsLoading && filteredChats.length === 0 && (
          <div style={{ padding: 16, color: '#888', textAlign: 'center' }}>
            No {historyFilter === 'all' ? 'sessions' : historyFilter + ' sessions'} found.
          </div>
        )}
        
        {!chatsLoading && filteredChats.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filteredChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => {
                  if (chat.session_type === 'interview') {
                    // Navigate to interview history
                    navigate(`/interview-history/${chat.id}`);
                  } else {
                    // Navigate to regular chat history
                    navigate(`/chat-history/${chat.chat_id}`);
                  }
                }}
                style={{
                  padding: '14px 18px',
                  cursor: 'pointer',
                  background: chat.session_type === 'interview' ? '#f8f0ff' : '#f0f4ff',
                  fontWeight: 600,
                  borderLeft: `4px solid ${chat.session_type === 'interview' ? '#8b5cf6' : '#2c3e99'}`,
                  borderBottom: '1px solid #f5f5f5',
                  transition: 'background 0.2s, border-left 0.2s',
                  marginBottom: 6,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      fontWeight: 600 
                    }}>
                      <span>{chat.session_name || chat.job_name || `Session ${chat.id}`}</span>
                      <span style={{
                        fontSize: 10,
                        background: chat.session_type === 'interview' ? '#8b5cf6' : '#2c3e99',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase'
                      }}>
                        {chat.session_type}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      {chat.company_name || ''}
                    </div>
                    {chat.session_type === 'interview' && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        Questions Answered: {chat.question_count || 0}
                      </div>
                    )}
                    {chat.session_type === 'chat' && chat.message_count && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        Messages: {chat.message_count}
                      </div>
                    )}
                  </div>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteHistory(chat.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Delete history"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } else {
    rightColumnContent = <JobDescriptions content={jobDescriptionsContent} isPredefine={selectedTopic.name === 'TJ JDs'} onJobAdded={fetchJobDescriptions} />;
  }

  // Custom vertical topic selector for left column
  function VerticalTopicSelector({ topics, selected, onSelect }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(44,62,153,0.04)' }}>
        {topics.map(topic => (
          <div
            key={topic.id}
            onClick={() => onSelect(topic)}
            style={{
              padding: '16px 24px',
              cursor: 'pointer',
              background: selected.id === topic.id ? '#f0f4ff' : 'transparent',
              fontWeight: selected.id === topic.id ? 700 : 400,
              borderLeft: selected.id === topic.id ? '4px solid #2c3e99' : '4px solid transparent',
              borderBottom: '1px solid #f5f5f5',
              fontSize: 16,
              transition: 'background 0.2s, border-left 0.2s',
            }}
          >
            {topic.name}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="main-bg">
      <Header {...headerData} />
      <div className="main-content two-column">
        <div className="left-column" style={{ minWidth: 320 }}>
          <VerticalTopicSelector
            topics={topicSelectorData.topicList}
            selected={selectedTopic}
            onSelect={topic => {
              setSelectedTopic(topic);
              if (topic.id !== 'all_chats') setSelectedChatId(null);
            }}
          />
        </div>
        <div className="right-column">
          {rightColumnContent}
        </div>
      </div>
    </div>
  );
};

export default InterviewPrepPage;
