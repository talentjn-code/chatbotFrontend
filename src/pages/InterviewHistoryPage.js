import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import Header from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const InterviewHistoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interviewData, setInterviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInterviewHistory = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const response = await fetch(`${BACKEND_URL}/api/interview/history/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch interview history');
        }

        const data = await response.json();
        setInterviewData(data);
      } catch (err) {
        console.error('Error fetching interview history:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewHistory();
  }, [id]);

  if (loading) {
    return (
      <div className="main-bg">
        <Header logo={{ text: 'TalentJn', icon: 'house' }} backgroundColor="#2c3e99" />
        <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(44,62,153,0.04)', padding: 32 }}>
          <div>Loading interview history...</div>
        </div>
      </div>
    );
  }

  if (error || !interviewData) {
    return (
      <div className="main-bg">
        <Header logo={{ text: 'TalentJn', icon: 'house' }} backgroundColor="#2c3e99" />
        <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(44,62,153,0.04)', padding: 32 }}>
          <div>
            <p>{error || 'Interview history not found'}</p>
            <button 
              onClick={() => navigate('/interview-prep?tab=all-chats')}
              style={{ background: '#2c3e99', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer' }}
            >
              Back to All Chats
            </button>
          </div>
        </div>
      </div>
    );
  }

  const qaData = interviewData.qa_data || [];
  const overallFeedback = interviewData.overall_feedback || null;

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
                session_info: {
                  session_name: interviewData.session_name,
                  job_name: interviewData.job_name,
                  company_name: interviewData.company_name,
                  date: interviewData.created_at,
                  total_questions: qaData.length,
                  questions_answered: qaData.filter(qa => qa.answered !== false).length
                },
                questions_and_answers: qaData.map((qa, index) => ({
                  question_number: index + 1,
                  question: typeof qa.question === 'object' ? qa.question.question : qa.question,
                  answer: qa.answered === false ? 'Not answered' : (qa.answer || qa.transcription || 'No response recorded'),
                  score: qa.score,
                  feedback: qa.feedback,
                  improvements: qa.improvements
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
              pdf.text('Interview History', margin, yPosition);
              yPosition += 20;
              
              // Session info
              pdf.setFontSize(12);
              pdf.setFont(undefined, 'normal');
              pdf.text(`Position: ${exportData.session_info.job_name}`, margin, yPosition);
              yPosition += 10;
              pdf.text(`Company: ${exportData.session_info.company_name}`, margin, yPosition);
              yPosition += 10;
              pdf.text(`Date: ${new Date(exportData.session_info.date).toLocaleDateString()}`, margin, yPosition);
              yPosition += 20;
              
              // Overall Scores Section (if available)
              if (overallFeedback?.average_score || overallFeedback?.total_score) {
                pdf.setFontSize(14);
                pdf.setFont(undefined, 'bold');
                pdf.text('Overall Score', margin, yPosition);
                yPosition += 12;
                
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'normal');
                const displayScore = overallFeedback.average_score ? `${overallFeedback.average_score}/100` : (overallFeedback.total_score || '0/100');
                pdf.text(`Total Score: ${displayScore}`, margin, yPosition);
                yPosition += 8;
                pdf.setFontSize(10);
                pdf.text('Based on answered questions', margin, yPosition);
                yPosition += 15;
              }
              
              // Questions and answers
              exportData.questions_and_answers.forEach((qa, index) => {
                // Check if we need a new page
                if (yPosition > 220) {
                  pdf.addPage();
                  yPosition = 30;
                }
                
                // Question
                pdf.setFont(undefined, 'bold');
                pdf.text(`Q${qa.question_number}: `, margin, yPosition);
                
                const questionLines = pdf.splitTextToSize(qa.question, maxLineWidth - 30);
                pdf.setFont(undefined, 'normal');
                pdf.text(questionLines, margin + 30, yPosition);
                yPosition += questionLines.length * 7 + 5;
                
                // Answer
                pdf.setFont(undefined, 'bold');
                pdf.text('Answer: ', margin, yPosition);
                
                const answerLines = pdf.splitTextToSize(qa.answer, maxLineWidth - 30);
                pdf.setFont(undefined, 'normal');
                pdf.text(answerLines, margin + 30, yPosition);
                yPosition += answerLines.length * 7 + 5;
                
                // Score and feedback
                const score = qa.score ?? 0;
                pdf.text(`Score: ${score}/100`, margin, yPosition);
                yPosition += 7;
                
                if (qa.feedback) {
                  const feedbackLines = pdf.splitTextToSize(`Feedback: ${qa.feedback}`, maxLineWidth);
                  pdf.text(feedbackLines, margin, yPosition);
                  yPosition += feedbackLines.length * 7;
                }
                
                // Add improvements if available
                if (qa.improvements && qa.improvements.length > 0) {
                  yPosition += 5;
                  pdf.text('Areas for Improvement:', margin, yPosition);
                  yPosition += 7;
                  qa.improvements.forEach((improvement) => {
                    const improvementLines = pdf.splitTextToSize(`• ${improvement}`, maxLineWidth - 10);
                    pdf.text(improvementLines, margin + 5, yPosition);
                    yPosition += improvementLines.length * 6;
                  });
                }
                
                yPosition += 10; // Space between questions
              });
              
              // Detailed Feedback Section (Parameter Feedback)
              if (overallFeedback && overallFeedback.parameter_feedback) {
                // Check if we need a new page
                if (yPosition > 160) {
                  pdf.addPage();
                  yPosition = 30;
                }
                
                pdf.setFontSize(14);
                pdf.setFont(undefined, 'bold');
                pdf.text('Detailed Feedback', margin, yPosition);
                yPosition += 12;
                
                pdf.setFontSize(11);
                pdf.setFont(undefined, 'normal');
                
                Object.entries(overallFeedback.parameter_feedback).forEach(([param, feedback]) => {
                  let title = '';
                  if (param.includes('grammar') || param.includes('communication')) {
                    title = 'Grammar & Communication';
                  } else if (param.includes('technical')) {
                    title = 'Technical Knowledge & Skills';
                  } else if (param.includes('experience')) {
                    title = 'Relevant Experience & Examples';
                  }
                  
                  if (title) {
                    // Check if we need a new page
                    if (yPosition > 220) {
                      pdf.addPage();
                      yPosition = 30;
                    }
                    
                    pdf.setFont(undefined, 'bold');
                    pdf.text(title, margin, yPosition);
                    yPosition += 8;
                    
                    pdf.setFont(undefined, 'normal');
                    const feedbackLines = pdf.splitTextToSize(feedback, maxLineWidth);
                    pdf.text(feedbackLines, margin, yPosition);
                    yPosition += feedbackLines.length * 6 + 8;
                  }
                });
                
                yPosition += 10;
              }

              // Overall Feedback Section
              if (overallFeedback) {
                // Check if we need a new page
                if (yPosition > 180) {
                  pdf.addPage();
                  yPosition = 30;
                }
                
                pdf.setFontSize(14);
                pdf.setFont(undefined, 'bold');
                pdf.text('Overall Feedback', margin, yPosition);
                yPosition += 12;
                
                pdf.setFontSize(11);
                pdf.setFont(undefined, 'normal');
                
                // Strengths
                if ((overallFeedback.detailed_strengths || overallFeedback.strengths)?.length > 0) {
                  pdf.setFont(undefined, 'bold');
                  pdf.text('Strengths:', margin, yPosition);
                  yPosition += 8;
                  pdf.setFont(undefined, 'normal');
                  
                  (overallFeedback.detailed_strengths || overallFeedback.strengths).forEach((strength) => {
                    const strengthLines = pdf.splitTextToSize(`• ${strength}`, maxLineWidth - 10);
                    pdf.text(strengthLines, margin + 5, yPosition);
                    yPosition += strengthLines.length * 6 + 2;
                    
                    if (yPosition > 250) {
                      pdf.addPage();
                      yPosition = 30;
                    }
                  });
                  yPosition += 8;
                }
                
                // Areas for Improvement
                if ((overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement)?.length > 0) {
                  pdf.setFont(undefined, 'bold');
                  pdf.text('Areas for Improvement:', margin, yPosition);
                  yPosition += 8;
                  pdf.setFont(undefined, 'normal');
                  
                  (overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement).forEach((area) => {
                    const areaLines = pdf.splitTextToSize(`• ${area}`, maxLineWidth - 10);
                    pdf.text(areaLines, margin + 5, yPosition);
                    yPosition += areaLines.length * 6 + 2;
                    
                    if (yPosition > 250) {
                      pdf.addPage();
                      yPosition = 30;
                    }
                  });
                  yPosition += 8;
                }
                
                // Recommendations
                if (overallFeedback.recommendations?.length > 0) {
                  pdf.setFont(undefined, 'bold');
                  pdf.text('Recommendations:', margin, yPosition);
                  yPosition += 8;
                  pdf.setFont(undefined, 'normal');
                  
                  overallFeedback.recommendations.forEach((rec) => {
                    const recLines = pdf.splitTextToSize(`• ${rec}`, maxLineWidth - 10);
                    pdf.text(recLines, margin + 5, yPosition);
                    yPosition += recLines.length * 6 + 2;
                    
                    if (yPosition > 250) {
                      pdf.addPage();
                      yPosition = 30;
                    }
                  });
                }
              }
              
              pdf.save(`interview_${interviewData.job_name}_${new Date(interviewData.created_at).toISOString().split('T')[0]}.pdf`);
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
            title="Download interview history as JSON"
          >
            📥 Download
          </button>
        </div>
        
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>Interview History</h2>
        
        <div style={{ marginBottom: 24, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 600 }}>{interviewData.session_name}</h3>
          <p style={{ margin: 0, marginBottom: 4, fontSize: 14, color: '#666' }}>{interviewData.job_name} at {interviewData.company_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            {new Date(interviewData.created_at).toLocaleString()}
          </p>
        </div>

        {/* Overall Feedback Section */}
        {overallFeedback && (
          <div style={{ marginBottom: 30, padding: 20, background: '#f0f4ff', borderRadius: 10, border: '1px solid #d4e0ff' }}>
            <h3 style={{ marginTop: 0, marginBottom: 20, color: '#2c3e99' }}>Overall Interview Feedback</h3>
            
            {/* Score Section */}
            {(overallFeedback.average_score || overallFeedback.total_score) && (
              <div style={{ marginBottom: 25, padding: 20, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                <h4 style={{ marginTop: 0, marginBottom: 15, fontSize: 18 }}>Overall Interview Score</h4>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#2c3e99', marginBottom: 8 }}>
                  {overallFeedback.average_score ? `${overallFeedback.average_score}/100` : (overallFeedback.total_score || '0/100')}
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Based on answered questions
                </div>
              </div>
            )}

            {/* Detailed Feedback (Parameter Feedback) */}
            {overallFeedback && overallFeedback.parameter_feedback && (
              <div style={{ marginBottom: 25 }}>
                <h4 style={{ marginBottom: 15, fontSize: 18, color: '#2c3e99' }}>Detailed Feedback</h4>
                {Object.entries(overallFeedback.parameter_feedback).map(([param, feedback], index) => {
                  let title = '';
                  if (param.includes('grammar') || param.includes('communication')) {
                    title = 'Grammar & Communication';
                  } else if (param.includes('technical')) {
                    title = 'Technical Knowledge & Skills';
                  } else if (param.includes('experience')) {
                    title = 'Relevant Experience & Examples';
                  }
                  
                  return title ? (
                    <div key={index} style={{ 
                      backgroundColor: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <h5 style={{ margin: 0, marginBottom: '10px', color: '#495057' }}>
                        {title}
                      </h5>
                      <p style={{ margin: 0, lineHeight: '1.6', color: '#666' }}>{feedback}</p>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Strengths */}
            {(overallFeedback.detailed_strengths || overallFeedback.strengths)?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: '#28a745', marginBottom: 10, fontSize: 16 }}>Strengths</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(overallFeedback.detailed_strengths || overallFeedback.strengths).map((strength, idx) => (
                    <li key={idx} style={{ marginBottom: 5, color: '#555' }}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Areas for Improvement */}
            {(overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement)?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: '#dc3545', marginBottom: 10, fontSize: 16 }}>Areas for Improvement</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement).map((area, idx) => (
                    <li key={idx} style={{ marginBottom: 5, color: '#555' }}>{area}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {overallFeedback.recommendations?.length > 0 && (
              <div>
                <h4 style={{ color: '#17a2b8', marginBottom: 10, fontSize: 16 }}>Recommendations</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {overallFeedback.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: 5, color: '#555' }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {qaData.map((qa, index) => (
            <div key={index} style={{ marginBottom: 32, borderBottom: index < qaData.length - 1 ? '1px solid #eee' : 'none', paddingBottom: 24 }}>
              {/* Question */}
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#e0e7fa',
                  color: '#2c3e99',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  marginRight: 10
                }}>AI</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#2c3e99', fontSize: 15, marginBottom: 4 }}>
                    Question {index + 1}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    {typeof qa.question === 'object' ? qa.question.question : qa.question}
                  </div>
                </div>
              </div>
              
              {/* Answer */}
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: qa.answered === false ? '#f5f5f5' : '#2c3e99',
                  color: qa.answered === false ? '#999' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                  marginRight: 10
                }}>U</div>
                <div>
                  <div style={{ 
                    fontWeight: 500, 
                    color: qa.answered === false ? '#999' : '#2c3e99', 
                    fontSize: 15, 
                    marginBottom: 4 
                  }}>
                    Your Answer
                  </div>
                  <div style={{ 
                    fontSize: 14, 
                    color: qa.answered === false ? '#999' : 'inherit',
                    fontStyle: qa.answered === false ? 'italic' : 'normal'
                  }}>
                    {qa.answered === false ? 'Not answered' : (qa.answer || qa.transcription || 'No response recorded')}
                  </div>
                </div>
              </div>
              
              {/* Evaluation - only show for answered questions */}
              {qa.answered !== false && (qa.score !== undefined || qa.feedback) && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{
                    minWidth: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#f0f8ff',
                    color: '#1976d2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    marginRight: 10
                  }}>📊</div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1976d2', fontSize: 15, marginBottom: 8 }}>
                      Evaluation
                    </div>
                    <div style={{ fontSize: 14 }}>
                      <p style={{ margin: 0, marginBottom: 8, fontWeight: 600 }}>
                        <strong>Score:</strong> {qa.score ?? 0}/100
                      </p>
                      {qa.feedback && (
                        <p style={{ margin: 0, marginBottom: 8 }}>
                          <strong>Feedback:</strong> {qa.feedback}
                        </p>
                      )}
                      {qa.improvements && qa.improvements.length > 0 && (
                        <div>
                          <strong>Areas for Improvement:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {qa.improvements.map((improvement, idx) => (
                              <li key={idx} style={{ marginBottom: 4 }}>{improvement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {qaData.length === 0 && (
            <div style={{ color: '#888', fontSize: 16, marginTop: 40, textAlign: 'center' }}>
              No questions were answered in this interview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewHistoryPage;