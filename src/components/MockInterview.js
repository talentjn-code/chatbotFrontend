import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import './MockInterview.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const MockInterview = ({ jobData, resumeFile }) => {
  const [interviewSession, setInterviewSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const [proceedWithoutCamera, setProceedWithoutCamera] = useState(false);
  
  // New states for conversation flow
  const [conversationState, setConversationState] = useState('greeting'); // greeting, question, waiting, listening, analyzing, feedback
  const [messages, setMessages] = useState([]);
  const [candidateResponse, setCandidateResponse] = useState('');
  const [showGreeting, setShowGreeting] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  
  // Local storage for Q&A data (will be sent to backend on end interview)
  const [qaData, setQaData] = useState([]);
  
  // New state for conversation history (for scrolling)
  const [conversationHistory, setConversationHistory] = useState([]);
  const [overallFeedback, setOverallFeedback] = useState(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    const initializeInterview = async () => {
      if (mounted) {
        await startInterview();
        if (!proceedWithoutCamera) {
          await initializeCamera();
        }
        
        // Show greeting for 3 seconds
        setTimeout(() => {
          if (mounted) {
            setShowGreeting(false);
            setConversationState('question');
            // After showing question, set to waiting state
            setTimeout(() => {
              if (mounted) {
                setConversationState('waiting');
              }
            }, 1000);
          }
        }, 3000);
      }
    };
    
    initializeInterview();
    
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [proceedWithoutCamera]);

  // Scroll to top when interview is complete and feedback is available
  useEffect(() => {
    if (interviewComplete && overallFeedback) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        const completionScreen = document.querySelector('.completion-screen');
        if (completionScreen) {
          completionScreen.scrollTop = 0;
        }
        // Also scroll the main window
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 200);
    }
  }, [interviewComplete, overallFeedback]);

  const initializeCamera = async () => {
    try {
      // Skip camera initialization if user chose to proceed without camera
      if (proceedWithoutCamera) {
        return;
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia is not supported in this browser');
        setError('Camera access is not supported in your browser. Please use a modern browser.');
        setCameraError(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Handle video play promise properly
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Camera initialized and playing successfully');
            })
            .catch(error => {
              console.log('Video play was interrupted:', error);
              // Try again after a short delay
              setTimeout(() => {
                if (videoRef.current && videoRef.current.srcObject) {
                  videoRef.current.play().catch(e => {
                    console.log('Second video play attempt failed:', e);
                  });
                }
              }, 100);
            });
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMessage = 'Camera access denied or not available';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and refresh the page.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      }
      
      setError(errorMessage);
      setCameraError(true);
    }
  };

  const startInterview = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('jwt');
      
      // Create FormData to send resume file along with job data
      const formData = new FormData();
      formData.append('job_role', jobData?.jobname || 'Software Engineer');
      formData.append('company', jobData?.company || 'Tech Company');
      formData.append('job_description', jobData?.description || jobData?.jd || '');
      
      // Add resume file if available
      if (resumeFile) {
        formData.append('resume', resumeFile);
        console.log('Sending resume file:', resumeFile.name);
      }
      
      const response = await fetch(`${BACKEND_URL}/api/interview/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type header - let browser set it for FormData
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Handle AI generation failure
        if (response.status === 503) {
          throw new Error('AI question generation is currently unavailable. Please try again in a few moments.');
        }
        throw new Error(data.error || 'Failed to start interview');
      }

      console.log('Interview started with personalized questions:', data);
      console.log('AI Generated:', data.ai_generated);
      setInterviewSession(data);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error('Interview start error:', err);
      setError(`Failed to start interview: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      streamRef.current = stream;
      
      // Try different audio formats for better compatibility
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'audio/wav' };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = {};
          }
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      console.log('Using MIME type:', mediaRecorder.mimeType);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        console.log('Created audio blob:', { size: audioBlob.size, type: audioBlob.type });
        await transcribeAndEvaluate(audioBlob);
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setRecordingTime(0);
      setConversationState('listening');
      setCandidateResponse('');
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const transcribeAndEvaluate = async (audioBlob) => {
    try {
      setIsLoading(true);
      setConversationState('analyzing');
      const token = localStorage.getItem('jwt');
      
      console.log('Starting transcription...', { 
        audioBlob: audioBlob, 
        size: audioBlob.size,
        type: audioBlob.type 
      });
      
      // Convert to MP3 format if needed for better compatibility
      const formData = new FormData();
      formData.append('audio', audioBlob, 'response.wav');
      
      const transcribeResponse = await fetch(`${BACKEND_URL}/api/interview/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      console.log('Transcribe response status:', transcribeResponse.status);

      if (!transcribeResponse.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const transcriptionData = await transcribeResponse.json();
      const transcription = transcriptionData.transcription;
      
      // Update candidate response
      setCandidateResponse(transcription);

      // Prepare question data for evaluation
      const currentQuestion = interviewSession.questions[currentQuestionIndex];
      const requestBody = {
        response: transcription,
        job_role: jobData?.jobname || 'Software Engineer'
      };

      // Check if we have the new question object format
      if (typeof currentQuestion === 'object' && currentQuestion.question) {
        requestBody.question_obj = currentQuestion;
      } else {
        // Fallback to old format
        requestBody.question = currentQuestion;
      }

      // Evaluate response
      const evaluateResponse = await fetch(`${BACKEND_URL}/api/interview/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!evaluateResponse.ok) {
        throw new Error('Failed to evaluate response');
      }

      const evaluationData = await evaluateResponse.json();
      
      // Check if AI evaluation failed
      if (evaluationData.evaluation?.error || evaluationData.evaluation?.answer_score === null) {
        // AI evaluation failed - show error message and allow user to continue
        setEvaluation({
          error: true,
          feedback: evaluationData.evaluation?.feedback || "AI evaluation service is currently busy. Please try again in a moment.",
          transcription: transcription
        });
        
        // Store Q&A without score
        const newQA = {
          question: currentQuestion,
          answer: candidateResponse,
          transcription: transcription,
          score: null,
          feedback: 'Evaluation unavailable - AI service busy',
          improvements: ['Please try evaluating again later']
        };
        
        setQaData(prevQA => [...prevQA, newQA]);
        console.log('Stored Q&A without evaluation (AI busy):', newQA);
      } else {
        // Normal evaluation
        setEvaluation({
          ...evaluationData.evaluation,
          transcription: transcription
        });
        
        // Store Q&A data locally for later saving to DB
        const newQA = {
          question: currentQuestion,
          answer: candidateResponse,
          transcription: transcription,
          score: evaluationData.evaluation.answer_score || 0,
          feedback: evaluationData.evaluation.feedback || '',
          improvements: evaluationData.evaluation.improvements || []
        };
        
        setQaData(prevQA => [...prevQA, newQA]);
        console.log('Stored Q&A locally:', newQA);
      }
      
      setShowEvaluation(true);
      setConversationState('feedback');
    } catch (err) {
      setError(`Failed to process response: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const nextQuestion = () => {
    // Save current Q&A to conversation history before moving to next
    if (interviewSession && candidateResponse) {
      const currentQuestion = interviewSession.questions[currentQuestionIndex];
      const questionText = typeof currentQuestion === 'object' ? currentQuestion.question : currentQuestion;
      
      const historyItem = {
        questionNumber: currentQuestionIndex + 1,
        question: questionText,
        response: candidateResponse,
        evaluation: evaluation,
        timestamp: new Date().toISOString()
      };
      
      setConversationHistory(prev => {
        const newHistory = [...prev, historyItem];
        
        // Check if this is the last question
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= interviewSession.questions.length) {
          console.log('Last question completed, generating overall feedback...');
          // Generate overall feedback with the complete history
          setTimeout(() => {
            generateOverallFeedbackWithHistory(newHistory);
          }, 100);
        }
        
        return newHistory;
      });
    }
    
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= interviewSession.questions.length) {
      // Don't set interview complete yet, let generateOverallFeedback handle it
      console.log('Interview questions completed');
    } else {
      setCurrentQuestionIndex(nextIndex);
      setShowEvaluation(false);
      setEvaluation(null);
      setConversationState('question');
      setCandidateResponse('');
      // Set intro to false after first question
      if (currentQuestionIndex === 0) {
        setShowIntro(false);
      }
      // Show waiting state after a brief delay
      setTimeout(() => {
        setConversationState('waiting');
      }, 500);
    }
  };

  const skipQuestion = () => {
    // Add the skipped question to history
    const currentQuestion = interviewSession.questions[currentQuestionIndex];
    const questionText = typeof currentQuestion === 'object' ? currentQuestion.question : currentQuestion;
    
    const skippedItem = {
      questionNumber: currentQuestionIndex + 1,
      question: questionText,
      response: 'Question skipped',
      evaluation: null,
      timestamp: new Date().toISOString(),
      skipped: true
    };
    
    // Add to conversation history
    setConversationHistory(prev => [...prev, skippedItem]);
    
    // Store in QA data for saving
    const skippedQA = {
      question: currentQuestion,
      answer: '',
      transcription: '',
      score: null,
      feedback: '',
      improvements: [],
      answered: false
    };
    
    setQaData(prevQA => [...prevQA, skippedQA]);
    
    // If this is the last question, trigger the interview completion flow
    if (currentQuestionIndex + 1 >= interviewSession.questions.length) {
      // Generate overall feedback with the complete history
      setTimeout(() => {
        generateOverallFeedbackWithHistory([...conversationHistory, skippedItem]);
      }, 100);
    } else {
      // Not the last question, proceed normally
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowEvaluation(false);
      setEvaluation(null);
      setConversationState('question');
      setCandidateResponse('');
      // Set intro to false after first question
      if (currentQuestionIndex === 0) {
        setShowIntro(false);
      }
      // Show waiting state after a brief delay
      setTimeout(() => {
        setConversationState('waiting');
      }, 500);
    }
  };

  const saveInterviewToHistory = async (completeHistory, feedbackData = null) => {
    try {
      // Create complete Q&A data for saving
      const completeQAData = [];
      
      if (interviewSession && interviewSession.questions) {
        interviewSession.questions.forEach((question, index) => {
          // Find if this question was answered
          const answeredQA = completeHistory.find(item => {
            const itemQuestion = typeof item.question === 'object' ? item.question.question : item.question;
            const sessionQuestion = typeof question === 'object' ? question.question : question;
            return itemQuestion === sessionQuestion;
          });
          
          if (answeredQA) {
            // Question was answered
            completeQAData.push({
              question: answeredQA.question,
              answer: answeredQA.response || answeredQA.transcription || '',
              score: answeredQA.evaluation?.answer_score || answeredQA.evaluation?.score || null,
              feedback: answeredQA.evaluation?.feedback || '',
              improvements: answeredQA.evaluation?.improvements || [],
              answered: true
            });
          } else {
            // Question was not answered (skipped)
            const questionText = typeof question === 'object' ? question.question : question;
            completeQAData.push({
              question: questionText,
              answer: '',
              score: null,
              feedback: '',
              improvements: [],
              answered: false
            });
          }
        });
      }
      
      // Save to DB
      const response = await fetch(`${BACKEND_URL}/api/interview/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_name: interviewSession?.job_role || jobData?.jobname || 'Interview',
          company_name: interviewSession?.company || jobData?.company || 'Unknown',
          qa_data: completeQAData,
          overall_feedback: feedbackData || overallFeedback
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Interview history saved: ${data.session_name} with ${completeQAData.length} questions`);
      } else {
        console.error('Failed to save interview history');
      }
    } catch (error) {
      console.error('Error saving interview history:', error);
    }
  };

  const generateOverallFeedbackWithHistory = async (completeHistory) => {
    try {
      setIsLoading(true);
      setIsGeneratingFeedback(true);
      const token = localStorage.getItem('jwt');
      
      console.log('Generating overall feedback with history:', completeHistory);
      
      // Prepare interview data for overall feedback
      const interviewData = {
        job_role: jobData?.jobname || 'Software Engineer',
        company: jobData?.company || 'Company',
        conversation_history: completeHistory,
        session_id: interviewSession?.session_id
      };
      
      const response = await fetch(`${BACKEND_URL}/api/interview/overall-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(interviewData)
      });

      const data = await response.json();
      if (data.success) {
        setOverallFeedback(data.feedback);
        
        // Also save the interview to history with the feedback
        await saveInterviewToHistory(completeHistory, data.feedback);
      } else {
        console.error('Failed to get overall feedback:', data.error);
        // NO FALLBACK - Show error message
        setOverallFeedback({
          error: data.error || "AI feedback generation service is currently busy. Please try again in a moment.",
          overall_performance: "",
          strengths: [],
          areas_for_improvement: [],
          score: "0/100"
        });
        
        // Still save the interview to history even if feedback failed
        await saveInterviewToHistory(completeHistory);
      }
      setInterviewComplete(true);
    } catch (error) {
      console.error('Error generating overall feedback:', error);
      // NO FALLBACK - Show error message
      setOverallFeedback({
        error: "AI feedback generation service is currently busy. Please try again in a moment.",
        overall_performance: "",
        strengths: [],
        areas_for_improvement: [],
        score: "0/100"
      });
      
      // Still save the interview to history even if everything failed
      try {
        await saveInterviewToHistory(completeHistory);
      } catch (saveError) {
        console.error('Error saving interview after failure:', saveError);
      }
      
      setInterviewComplete(true);
    } finally {
      setIsLoading(false);
      setIsGeneratingFeedback(false);
    }
  };

  const endInterview = async () => {
    try {
      setIsLoading(true);
      setIsGeneratingFeedback(true);
      
      // If user ends interview early, generate feedback with current history first
      let finalHistory = [...conversationHistory];
      if (interviewSession && candidateResponse) {
        const currentQuestion = interviewSession.questions[currentQuestionIndex];
        const questionText = typeof currentQuestion === 'object' ? currentQuestion.question : currentQuestion;
        
        const currentItem = {
          questionNumber: currentQuestionIndex + 1,
          question: questionText,
          response: candidateResponse,
          evaluation: evaluation,
          timestamp: new Date().toISOString()
        };
        
        finalHistory = [...conversationHistory, currentItem];
      }
      
      // Generate overall feedback before saving
      await generateOverallFeedbackWithHistory(finalHistory);
      
      // Create complete Q&A data including unanswered questions
      const completeQAData = [];
      
      if (interviewSession && interviewSession.questions) {
        interviewSession.questions.forEach((question, index) => {
          // Find if this question was answered
          const answeredQA = qaData.find(qa => {
            const qaQuestion = typeof qa.question === 'object' ? qa.question.question : qa.question;
            const currentQuestion = typeof question === 'object' ? question.question : question;
            return qaQuestion === currentQuestion;
          });
          
          if (answeredQA) {
            // Question was answered - use the existing data
            completeQAData.push(answeredQA);
          } else {
            // Question was not answered - create unanswered entry
            completeQAData.push({
              question: question,
              answer: null,
              transcription: null,
              score: null,
              feedback: null,
              improvements: [],
              answered: false
            });
          }
        });
      }
      
      // Save to DB - always save, even if no answers
      const response = await fetch(`${BACKEND_URL}/api/interview/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_name: interviewSession.job_role || 'Interview',
          company_name: interviewSession.company || 'Unknown',
          qa_data: completeQAData
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Interview history saved: ${data.session_name} with ${completeQAData.length} questions (${qaData.length} answered)`);
      } else {
        console.error('Failed to save interview history');
      }
    } catch (error) {
      console.error('Error saving interview history:', error);
    } finally {
      setIsLoading(false);
      setInterviewComplete(true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading && !interviewSession) {
    return (
      <div className="mock-interview-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mock-interview-container">
        <div className="error-screen">
          <h3>🤖 AI Service Unavailable</h3>
          <p>{error}</p>
          {cameraError ? (
            <>
              <p style={{ fontSize: '14px', color: '#ccc', marginTop: '10px' }}>
                Our AI is temporarily busy generating personalized questions. Please try again in a moment.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={async () => {
                  setError('');
                  setCameraError(false);
                  setProceedWithoutCamera(false);
                  setIsLoading(true);
                  try {
                    await initializeCamera();
                    // If camera initialization succeeds, continue with interview flow
                    setIsLoading(false);
                  } catch (err) {
                    console.error('Failed to reinitialize camera:', err);
                    setIsLoading(false);
                  }
                }}>
                  Try Again
                </button>
                <button 
                  onClick={() => {
                    setError('');
                    setCameraError(false);
                    setProceedWithoutCamera(true);
                    setIsLoading(false);
                  }}
                  style={{
                    backgroundColor: '#6c757d',
                    border: 'none',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Proceed Without Camera
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '14px', color: '#ccc', marginTop: '10px' }}>
                Our AI is temporarily busy generating personalized questions. Please try again in a moment.
              </p>
              <button onClick={() => {
                setError('');
                setIsLoading(false);
                startInterview();
              }}>
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show feedback generation loading screen
  if (isGeneratingFeedback && !interviewComplete) {
    return (
      <div className="mock-interview-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
          maxWidth: '500px',
          width: '90%'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid #f3f3f3',
            borderTop: '6px solid #2c3e99',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2 style={{ color: '#2c3e99', marginBottom: '15px' }}>
            Generating Your Feedback
          </h2>
          <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6', marginBottom: '10px' }}>
            Hold on! We are analyzing your responses and generating personalized feedback...
          </p>
          <p style={{ color: '#888', fontSize: '14px' }}>
            This may take a few moments ⏳
          </p>
        </div>
      </div>
    );
  }

  if (interviewComplete) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ 
          maxWidth: '900px',
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '30px'
        }}>
          
          <h1 style={{ 
            textAlign: 'center',
            color: '#2c3e99',
            marginBottom: '30px'
          }}>
            🎉 Interview Complete!
          </h1>

          {overallFeedback ? (
            <div>
              {/* Scores Section */}
              {overallFeedback.parameter_scores && (
                <div style={{ 
                  backgroundColor: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '30px'
                }}>
                  <h2 style={{ marginBottom: '20px' }}>Your Interview Scores</h2>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Grammar & Communication</span>
                      <strong>{overallFeedback.parameter_scores.grammar_communication_score || 0}/10</strong>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                      <div style={{ 
                        height: '100%',
                        width: `${((overallFeedback.parameter_scores.grammar_communication_score || 0) / 10) * 100}%`,
                        backgroundColor: '#28a745',
                        borderRadius: '4px'
                      }}></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Technical Skills</span>
                      <strong>{overallFeedback.parameter_scores.technical_skills_score || 0}/45</strong>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                      <div style={{ 
                        height: '100%',
                        width: `${((overallFeedback.parameter_scores.technical_skills_score || 0) / 45) * 100}%`,
                        backgroundColor: '#17a2b8',
                        borderRadius: '4px'
                      }}></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Relevant Experience</span>
                      <strong>{overallFeedback.parameter_scores.relevant_experience_score || 0}/45</strong>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                      <div style={{ 
                        height: '100%',
                        width: `${((overallFeedback.parameter_scores.relevant_experience_score || 0) / 45) * 100}%`,
                        backgroundColor: '#ffc107',
                        borderRadius: '4px'
                      }}></div>
                    </div>
                  </div>

                  <div style={{ 
                    textAlign: 'center',
                    paddingTop: '20px',
                    borderTop: '1px solid #dee2e6'
                  }}>
                    <div style={{ fontSize: '18px', marginBottom: '10px' }}>Total Score</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2c3e99' }}>
                      {overallFeedback.parameter_scores.total_score}/100
                    </div>
                  </div>
                </div>
              )}

              {/* Parameter Feedback */}
              {overallFeedback.parameter_feedback && (
                <div style={{ marginBottom: '30px' }}>
                  <h2 style={{ marginBottom: '20px' }}>Detailed Feedback</h2>
                  {Object.entries(overallFeedback.parameter_feedback).map(([param, feedback], index) => {
                    let score = '';
                    if (param.includes('grammar') || param.includes('communication')) {
                      score = `${overallFeedback.parameter_scores?.grammar_communication_score || 0}/10`;
                    } else if (param.includes('technical')) {
                      score = `${overallFeedback.parameter_scores?.technical_skills_score || 0}/45`;
                    } else if (param.includes('experience')) {
                      score = `${overallFeedback.parameter_scores?.relevant_experience_score || 0}/45`;
                    }
                    
                    return (
                      <div key={index} style={{ 
                        backgroundColor: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <h3 style={{ margin: 0, textTransform: 'capitalize' }}>
                            {param.replace('_', ' ').replace(' score', '')}
                          </h3>
                          {score && <span style={{ fontWeight: 'bold', color: '#2c3e99' }}>Score: {score}</span>}
                        </div>
                        <p style={{ margin: 0, lineHeight: '1.6', color: '#666' }}>{feedback}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Strengths */}
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#28a745', marginBottom: '15px' }}>Strengths</h2>
                {(overallFeedback.detailed_strengths || overallFeedback.strengths)?.length > 0 ? (
                  <ul style={{ lineHeight: '1.6', color: '#666' }}>
                    {(overallFeedback.detailed_strengths || overallFeedback.strengths).map((strength, index) => (
                      <li key={index} style={{ marginBottom: '8px' }}>{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No specific strengths identified in this interview.</p>
                )}
              </div>

              {/* Areas for Improvement */}
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#dc3545', marginBottom: '15px' }}>Areas for Improvement</h2>
                {(overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement)?.length > 0 ? (
                  <ul style={{ lineHeight: '1.6', color: '#666' }}>
                    {(overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement).map((area, index) => (
                      <li key={index} style={{ marginBottom: '8px' }}>{area}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No specific areas for improvement identified.</p>
                )}
              </div>

              {/* Recommendations */}
              {overallFeedback.recommendations?.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h2 style={{ color: '#17a2b8', marginBottom: '15px' }}>Recommendations</h2>
                  <ul style={{ lineHeight: '1.6', color: '#666' }}>
                    {overallFeedback.recommendations.map((rec, index) => (
                      <li key={index} style={{ marginBottom: '8px' }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Generating your personalized feedback...</p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            marginTop: '40px'
          }}>
            <button 
              onClick={() => window.location.href = '/'}
              style={{
                backgroundColor: '#2c3e99',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
            
            <button 
              onClick={() => {
                const pdf = new jsPDF();
                const pageWidth = pdf.internal.pageSize.getWidth();
                const margin = 20;
                const maxLineWidth = pageWidth - 2 * margin;
                let yPosition = 30;
                
                // Title
                pdf.setFontSize(20);
                pdf.setFont(undefined, 'bold');
                pdf.text('Interview Transcript', margin, yPosition);
                yPosition += 20;
                
                // Session info
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'normal');
                pdf.text(`Position: ${jobData?.jobname || 'Interview'}`, margin, yPosition);
                yPosition += 10;
                pdf.text(`Company: ${jobData?.company || 'Company'}`, margin, yPosition);
                yPosition += 10;
                pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
                yPosition += 20;
                
                // Overall Score Section
                if (overallFeedback?.parameter_scores) {
                  pdf.setFontSize(16);
                  pdf.setFont(undefined, 'bold');
                  pdf.text('Overall Score', margin, yPosition);
                  yPosition += 15;
                  
                  pdf.setFontSize(12);
                  pdf.setFont(undefined, 'normal');
                  pdf.text(`Total Score: ${overallFeedback.parameter_scores.total_score}/100`, margin, yPosition);
                  yPosition += 10;
                  pdf.text(`Grammar & Communication: ${overallFeedback.parameter_scores.grammar_communication_score || 0}/10`, margin, yPosition);
                  yPosition += 10;
                  pdf.text(`Technical Skills: ${overallFeedback.parameter_scores.technical_skills_score || 0}/45`, margin, yPosition);
                  yPosition += 10;
                  pdf.text(`Relevant Experience: ${overallFeedback.parameter_scores.relevant_experience_score || 0}/45`, margin, yPosition);
                  yPosition += 20;
                }
                
                // Questions and Answers Section
                pdf.setFontSize(16);
                pdf.setFont(undefined, 'bold');
                pdf.text('Questions and Answers', margin, yPosition);
                yPosition += 15;
                
                // Get all questions from interviewSession
                if (interviewSession && interviewSession.questions) {
                  interviewSession.questions.forEach((question, index) => {
                    // Check if we need a new page
                    if (yPosition > 250) {
                      pdf.addPage();
                      yPosition = 30;
                    }
                    
                    // Find if this question was answered in conversation history
                    const answeredItem = conversationHistory.find(item => item.questionNumber === index + 1);
                    
                    // Question
                    pdf.setFontSize(12);
                    pdf.setFont(undefined, 'bold');
                    pdf.text(`Question ${index + 1}:`, margin, yPosition);
                    yPosition += 7;
                    
                    const questionText = typeof question === 'object' ? question.question : question;
                    const questionLines = pdf.splitTextToSize(questionText, maxLineWidth);
                    pdf.setFont(undefined, 'normal');
                    pdf.text(questionLines, margin, yPosition);
                    yPosition += questionLines.length * 7 + 5;
                    
                    // Answer
                    pdf.setFont(undefined, 'bold');
                    pdf.text('Your Answer:', margin, yPosition);
                    yPosition += 7;
                    
                    let answerText;
                    if (answeredItem) {
                      answerText = answeredItem.response || 'No response recorded';
                    } else {
                      answerText = 'Not answered';
                    }
                    
                    const answerLines = pdf.splitTextToSize(answerText, maxLineWidth);
                    pdf.setFont(undefined, 'normal');
                    pdf.setFontSize(11);
                    pdf.text(answerLines, margin, yPosition);
                    yPosition += answerLines.length * 6 + 5;
                    
                    // Evaluation (if answered)
                    if (answeredItem && answeredItem.evaluation) {
                      pdf.setFontSize(12);
                      if (answeredItem.evaluation.answer_score !== null && answeredItem.evaluation.answer_score !== undefined) {
                        pdf.text(`Score: ${answeredItem.evaluation.answer_score}/100`, margin, yPosition);
                        yPosition += 7;
                      }
                      
                      if (answeredItem.evaluation.feedback) {
                        pdf.setFont(undefined, 'italic');
                        const feedbackLines = pdf.splitTextToSize(`Feedback: ${answeredItem.evaluation.feedback}`, maxLineWidth);
                        pdf.setFontSize(11);
                        pdf.text(feedbackLines, margin, yPosition);
                        yPosition += feedbackLines.length * 6;
                      }
                      pdf.setFont(undefined, 'normal');
                    }
                    
                    yPosition += 15; // Space between questions
                  });
                }
                
                // Overall Feedback Section
                if (overallFeedback) {
                  // Check if we need a new page
                  if (yPosition > 200) {
                    pdf.addPage();
                    yPosition = 30;
                  }
                  
                  pdf.setFontSize(16);
                  pdf.setFont(undefined, 'bold');
                  pdf.text('Overall Feedback', margin, yPosition);
                  yPosition += 15;
                  
                  pdf.setFontSize(12);
                  pdf.setFont(undefined, 'normal');
                  
                  // Strengths
                  if ((overallFeedback.detailed_strengths || overallFeedback.strengths)?.length > 0) {
                    pdf.setFont(undefined, 'bold');
                    pdf.text('Strengths:', margin, yPosition);
                    yPosition += 7;
                    pdf.setFont(undefined, 'normal');
                    
                    (overallFeedback.detailed_strengths || overallFeedback.strengths).forEach((strength, idx) => {
                      const strengthLines = pdf.splitTextToSize(`• ${strength}`, maxLineWidth - 10);
                      pdf.text(strengthLines, margin + 5, yPosition);
                      yPosition += strengthLines.length * 7;
                      
                      // Check for new page
                      if (yPosition > 260) {
                        pdf.addPage();
                        yPosition = 30;
                      }
                    });
                    yPosition += 10;
                  }
                  
                  // Areas for Improvement
                  if ((overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement)?.length > 0) {
                    pdf.setFont(undefined, 'bold');
                    pdf.text('Areas for Improvement:', margin, yPosition);
                    yPosition += 7;
                    pdf.setFont(undefined, 'normal');
                    
                    (overallFeedback.detailed_improvements || overallFeedback.areas_for_improvement).forEach((area, idx) => {
                      const areaLines = pdf.splitTextToSize(`• ${area}`, maxLineWidth - 10);
                      pdf.text(areaLines, margin + 5, yPosition);
                      yPosition += areaLines.length * 7;
                      
                      // Check for new page
                      if (yPosition > 260) {
                        pdf.addPage();
                        yPosition = 30;
                      }
                    });
                    yPosition += 10;
                  }
                  
                  // Recommendations
                  if (overallFeedback.recommendations?.length > 0) {
                    pdf.setFont(undefined, 'bold');
                    pdf.text('Recommendations:', margin, yPosition);
                    yPosition += 7;
                    pdf.setFont(undefined, 'normal');
                    
                    overallFeedback.recommendations.forEach((rec, idx) => {
                      const recLines = pdf.splitTextToSize(`• ${rec}`, maxLineWidth - 10);
                      pdf.text(recLines, margin + 5, yPosition);
                      yPosition += recLines.length * 7;
                      
                      // Check for new page
                      if (yPosition > 260) {
                        pdf.addPage();
                        yPosition = 30;
                      }
                    });
                  }
                }
                
                pdf.save(`interview_${jobData?.jobname || 'transcript'}_${new Date().toISOString().split('T')[0]}.pdf`);
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              📥 Download PDF
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Take Another Interview
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="mock-interview-container">
      <div className="interview-split">
        {/* Left side - Candidate video */}
        <div className="candidate-side">
          {proceedWithoutCamera ? (
            <div 
              className="candidate-video no-camera"
              style={{
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '16px',
                transform: 'none' // Override the scaleX(-1) from candidate-video class
              }}
            >
              Camera Disabled
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline
              className="candidate-video"
              onLoadedMetadata={() => {
                // Ensure video plays when metadata is loaded
                if (videoRef.current) {
                  videoRef.current.play().catch(e => {
                    console.log('Video autoplay prevented:', e);
                  });
                }
              }}
            />
          )}
          <div className="video-overlay">
            <div className="candidate-info">
              <h3>You</h3>
            </div>
          </div>
        </div>

        {/* Right side - AI Interviewer */}
        <div className="interviewer-side">
          <div className="ai-interviewer">
            <div className="ai-avatar">
              <span>🤖</span>
            </div>
            <div className="ai-info">
              <h3>AI Interviewer</h3>
              <p>Jn</p>
            </div>
          </div>
          
          <div className="question-header">
            <span>Question {currentQuestionIndex + 1} of {interviewSession?.questions?.length || 7}</span>
          </div>

          {/* Conversation display */}
          <div className="conversation-container" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {/* Greeting Message */}
            {showGreeting && (
              <div className="message-bubble ai-message fade-in">
                <div className="message-avatar">
                  <span>Jn</span>
                </div>
                <div className="message-content">
                  <p>Glad to meet you,</p>
                  <p>allow a moment for us to get things ready</p>
                </div>
              </div>
            )}
            
            {/* AI Introduction - Only show for first question */}
            {!showGreeting && showIntro && currentQuestionIndex === 0 && conversationState !== 'greeting' && (
              <div className="message-bubble ai-message">
                <div className="message-avatar">
                  <span>Jn</span>
                </div>
                <div className="message-content">
                  <p>So, let's get started with your mock interview for</p>
                  <p><strong>{jobData?.jobname || 'the position'}</strong></p>
                </div>
              </div>
            )}
            
            {/* Previous Q&A History */}
            {conversationHistory.map((item, index) => (
              <div key={index} className="qa-history-item" style={{ 
                opacity: '0.7', 
                marginBottom: '25px',
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                paddingBottom: '15px'
              }}>
                <div className="message-bubble ai-message" style={{ marginBottom: '10px' }}>
                  <div className="message-avatar">
                    <span>Jn</span>
                  </div>
                  <div className="message-content">
                    <p><strong>Q{item.questionNumber}:</strong> {item.question}</p>
                  </div>
                </div>
                {item.skipped ? (
                  <div className="message-bubble candidate-message" style={{ 
                    marginBottom: '10px', 
                    backgroundColor: 'rgba(255, 107, 107, 0.2)',
                    border: '1px solid rgba(255, 107, 107, 0.4)'
                  }}>
                    <div className="message-content">
                      <p style={{ color: '#ff6b6b', fontStyle: 'italic' }}>
                        <strong>Question Skipped</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="message-bubble candidate-message" style={{ marginBottom: '10px' }}>
                      <div className="message-content">
                        <p><strong>Your answer:</strong> {item.response}</p>
                      </div>
                    </div>
                    {item.evaluation && (
                      <div className="message-bubble ai-message feedback-message">
                        <div className="message-avatar">
                          <span>Jn</span>
                        </div>
                        <div className="message-content">
                          <p><strong>Feedback:</strong> {item.evaluation.feedback}</p>
                          {(item.evaluation.score !== null && item.evaluation.score !== undefined) && <p><strong>Score:</strong> {item.evaluation.score}/10</p>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            
            {/* Current Question */}
            {conversationState !== 'greeting' && interviewSession && (
              <div className={`message-bubble ai-message ${conversationState === 'feedback' ? 'faded' : ''}`} 
                   style={{ 
                     marginTop: conversationHistory.length > 0 ? '20px' : '0',
                     marginBottom: '15px'
                   }}>
                <div className="message-avatar">
                  <span>Jn</span>
                </div>
                <div className="message-content">
                  <p><strong>Q{currentQuestionIndex + 1}:</strong> {typeof interviewSession.questions[currentQuestionIndex] === 'object' 
                      ? interviewSession.questions[currentQuestionIndex].question 
                      : interviewSession.questions[currentQuestionIndex]
                    }
                  </p>
                </div>
              </div>
            )}
            
            {/* Status Indicators */}
            {conversationState === 'waiting' && !candidateResponse && (
              <div className="status-indicator" style={{ margin: '15px 0' }}>
                <span className="status-icon">⏳</span>
                <span>Waiting for your response</span>
              </div>
            )}
            
            {conversationState === 'listening' && (
              <div className="status-indicator" style={{ margin: '15px 0' }}>
                <span className="status-icon listening">🎤</span>
                <span>Listening to your response</span>
              </div>
            )}
            
            {/* Candidate Response */}
            {candidateResponse && (
              <div className="message-bubble candidate-message" style={{ margin: '15px 0' }}>
                <div className="message-content">
                  <p><strong>Your answer:</strong> {candidateResponse}</p>
                </div>
              </div>
            )}
            
            {conversationState === 'analyzing' && (
              <div className="status-indicator" style={{ margin: '15px 0' }}>
                <span className="status-icon analyzing">🤔</span>
                <span>Analyzing your response</span>
              </div>
            )}
            
            {/* Feedback */}
            {showEvaluation && conversationState === 'feedback' && (
              <div className="message-bubble ai-message feedback-message" style={{ margin: '15px 0' }}>
                <div className="message-avatar">
                  <span>Jn</span>
                </div>
                <div className="message-content">
                  {(() => {
                    // Check if evaluation failed
                    if (evaluation?.error) {
                      return (
                        <>
                          <p style={{ color: '#ff6b35', fontWeight: 'bold' }}>🤖 AI Evaluation Currently Unavailable</p>
                          <p className="evaluation-feedback">{evaluation.feedback}</p>
                          <p style={{ fontSize: '14px', color: '#888' }}>
                            Our AI evaluation service is temporarily busy. You can continue with the interview and try again later, or proceed to the next question.
                          </p>
                        </>
                      );
                    }
                    
                    // Normal evaluation
                    const answerScore = evaluation?.answer_score ?? 0;
                    
                    let feedbackIntro;
                    if (answerScore >= 80) {
                      feedbackIntro = `Excellent response 🔥! You've demonstrated strong knowledge.`;
                    } else if (answerScore >= 60) {
                      feedbackIntro = `Good effort 👍. Your response shows understanding.`;
                    } else if (answerScore >= 40) {
                      feedbackIntro = `Thank you for your response. There's room for improvement.`;
                    } else if (answerScore >= 20) {
                      feedbackIntro = `Your response needs significant work. Let me help you improve.`;
                    } else {
                      feedbackIntro = `This response is not adequate for an interview. You need to prepare much better.`;
                    }
                    
                    return (
                      <>
                        <p>{feedbackIntro}</p>
                        
                        {evaluation?.feedback && (
                          <p className="evaluation-feedback">{evaluation.feedback}</p>
                        )}
                        
                        {evaluation?.improvements && evaluation.improvements.length > 0 && (
                          <>
                            <p className="tips-header">Here are some tips to improve:</p>
                            <div className="feedback-tips">
                              {evaluation.improvements.map((improvement, index) => (
                                <div key={index} className="tip-item">
                                  <span>{index + 1}. {improvement}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        <div className="score-breakdown-section">
                          <div className="score-item">
                            <span className="score-label">Answer Quality:</span>
                            <span className="score-value">{answerScore}/100</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="interview-controls">
        {!showEvaluation ? (
          <>
            <button 
              className={`control-button ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? 'Submit' : 'Speak'}
            </button>
            <button 
              className="control-button secondary"
              onClick={endInterview}
              disabled={isLoading}
            >
              End Interview
            </button>
            <button 
              className="control-button secondary"
              onClick={skipQuestion}
              disabled={isLoading}
            >
              {currentQuestionIndex + 1 >= interviewSession?.questions.length ? 'Skip & Finish' : 'Skip Question'}
            </button>
          </>
        ) : (
          <button 
            className="control-button"
            onClick={nextQuestion}
          >
            {currentQuestionIndex + 1 >= interviewSession?.questions.length ? 'Finish Interview' : 'Next Question'}
          </button>
        )}
      </div>

    </div>
  );
};

export default MockInterview;