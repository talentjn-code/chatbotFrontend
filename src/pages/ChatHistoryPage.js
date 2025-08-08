import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import Header from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const ChatHistoryPage = () => {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    fetch(`${BACKEND_URL}/job-ai/history/${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .finally(() => setLoading(false));
  }, [chatId]);

  return (
    <div className="main-bg">
      <Header logo={{ text: 'TalentJn', icon: 'house' }} backgroundColor="#2c3e99" />
      <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(44,62,153,0.04)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button 
            onClick={() => navigate('/interview-prep?tab=all-chats')} 
            style={{ background: 'none', border: 'none', color: '#2c3e99', fontWeight: 600, cursor: 'pointer', fontSize: 16 }}
          >
            &larr; Back
          </button>
          
          <button
            onClick={() => {
              // Prepare data for export
              const exportData = {
                chat_id: chatId,
                date: new Date().toISOString(),
                total_messages: messages.length,
                messages: messages.map((msg, index) => ({
                  index: index + 1,
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp || null
                }))
              };
              
              // Generate PDF
              const pdf = new jsPDF();
              const pageWidth = pdf.internal.pageSize.getWidth();
              const margin = 20;
              const maxLineWidth = pageWidth - 2 * margin;
              let yPosition = 30;
              
              // Title
              pdf.setFontSize(18);
              pdf.setFont(undefined, 'bold');
              pdf.text('Chat History', margin, yPosition);
              yPosition += 20;
              
              // Chat info
              pdf.setFontSize(12);
              pdf.setFont(undefined, 'normal');
              pdf.text(`Chat ID: ${exportData.chat_id}`, margin, yPosition);
              yPosition += 10;
              pdf.text(`Date: ${new Date(exportData.date).toLocaleDateString()}`, margin, yPosition);
              yPosition += 10;
              pdf.text(`Total Messages: ${exportData.total_messages}`, margin, yPosition);
              yPosition += 20;
              
              // Helper function to check page boundaries
              const checkPageBreak = (additionalSpace = 30) => {
                const pageHeight = pdf.internal.pageSize.getHeight();
                if (yPosition + additionalSpace > pageHeight - 40) {
                  pdf.addPage();
                  yPosition = 30;
                  return true;
                }
                return false;
              };

              // Messages
              exportData.messages.forEach((msg, index) => {
                const contentLines = pdf.splitTextToSize(msg.content, maxLineWidth - 30);
                
                // Check if we need a new page for this message
                checkPageBreak(contentLines.length * 7 + 20);
                
                // Message header
                pdf.setFont(undefined, 'bold');
                pdf.text(`${msg.role === 'user' ? 'You' : 'AI'}: `, margin, yPosition);
                
                // Message content
                pdf.setFont(undefined, 'normal');
                pdf.text(contentLines, margin + 30, yPosition);
                yPosition += contentLines.length * 7 + 10;
              });
              
              pdf.save(`chat_${chatId}_${new Date().toISOString().split('T')[0]}.pdf`);
            }}
            style={{ 
              padding: '8px 16px',
              background: '#2c3e99',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 600
            }}
            title="Download chat history as JSON"
          >
            📥 Download
          </button>
        </div>
        
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>Chat History</h2>
        {loading ? (
          <div>Loading...</div>
        ) : messages.length > 0 ? (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: msg.role === 'user' ? '#2c3e99' : '#e0e7fa',
                  color: msg.role === 'user' ? '#fff' : '#2c3e99',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                  marginRight: 10
                }}>{msg.role === 'user' ? 'U' : 'AI'}</div>
                <div>
                  <div style={{ fontWeight: msg.role === 'user' ? 500 : 400, color: msg.role === 'user' ? '#2c3e99' : '#333', fontSize: 15 }}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{msg.content}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#888', fontSize: 16, marginTop: 40 }}>No messages found for this chat.</div>
        )}
      </div>
    </div>
  );
};

export default ChatHistoryPage;
