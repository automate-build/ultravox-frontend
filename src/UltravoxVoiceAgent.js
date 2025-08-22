import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Settings, Volume2, MessageCircle } from 'lucide-react';
import { UltravoxSession } from 'ultravox-client';

const UltravoxVoiceAgent = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  const ultravoxSessionRef = useRef(null);
  const processedTranscriptsRef = useRef(new Set());

  const starterPrompts = [
    "Give me a project status update",
    "Create a new task: Draft API spec, due Friday", 
    "Any significant risks this week?",
    "Summarise yesterday's standup"
  ];

  const projectFiles = [
    // "Requirements.md",
    // "Risks-and-Issues.xlsx", 
    // "Architecture.pdf"
    "Project Brief (Project Phoenix).pdf",
    "Responsible AI & Guardrails Policy.pdf",
    "Stakeholders Overview.docx", 
    "Statement of Work (SOW).docx"
  ];

  // Connection functions
  const connectToAgent = async () => {
    try {
      setConnectionStatus('Creating call...');
      
      // Step 1: Create call via local API (no CORS issues)
      const callResponse = await fetch('/api/create-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          medium: {
            webRtc: {}
          }
        })
      });

      if (!callResponse.ok) {
        const errorText = await callResponse.text();
        throw new Error(`API error: ${callResponse.status} - ${errorText}`);
      }

      const result = await callResponse.json();
      console.log('Call created successfully:', result);
      
      if (!result.joinUrl) {
        throw new Error('No joinUrl received from Ultravox');
      }

      setConnectionStatus('Connecting to voice session...');
      
      // Step 2: Connect using Ultravox SDK
      await connectToUltravoxCall(result.joinUrl);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('Connection Failed');
      alert(`Connection failed: ${error.message}`);
    }
  };

  const connectToUltravoxCall = async (joinUrl) => {
    try {
      // Clear previous transcripts
      processedTranscriptsRef.current.clear();
      
      // Create and configure Ultravox session
      const session = new UltravoxSession();
      ultravoxSessionRef.current = session;
      
      // Set up event listeners
      session.addEventListener('status', (event) => {
        console.log('Session status changed:', session.status);
        
        switch (session.status) {
          case 'disconnected':
            setConnectionStatus('Disconnected');
            setIsConnected(false);
            setIsRecording(false);
            setIsProcessing(false);
            break;
          case 'connecting':
            setConnectionStatus('Connecting...');
            break;
          case 'idle':
            setConnectionStatus('Connected');
            setIsConnected(true);
            setIsRecording(false);
            setIsProcessing(false);
            if (!conversation.length) {
              addMessage('system', 'Connected to Cassidy (Project Manager Agent). You can now speak or type messages.');
            }
            break;
          case 'listening':
            setIsRecording(true);
            setIsProcessing(false);
            break;
          case 'thinking':
            setIsRecording(false);
            setIsProcessing(true);
            break;
          case 'speaking':
            setIsRecording(false);
            setIsProcessing(false);
            break;
        }
      });
      
      session.addEventListener('transcripts', (event) => {
        console.log('Transcripts updated:', session.transcripts);
        
        // Process only the most recent final transcript
        const finalTranscripts = session.transcripts.filter(t => t.isFinal);
        const lastTranscript = finalTranscripts[finalTranscripts.length - 1];
        
        if (lastTranscript) {
          const transcriptId = `${lastTranscript.speaker}-${lastTranscript.text}`;
          
          if (!processedTranscriptsRef.current.has(transcriptId)) {
            processedTranscriptsRef.current.add(transcriptId);
            
            addMessage(
              lastTranscript.speaker === 'user' ? 'user' : 'agent',
              lastTranscript.text
            );
          }
        }
      });

      // Handle experimental messages for debugging
      session.addEventListener('experimental_message', (msg) => {
        console.log('Ultravox debug message:', msg);
      });
      
      // Join the call
      await session.joinCall(joinUrl);
      
    } catch (error) {
      console.error('Error connecting to Ultravox call:', error);
      setConnectionStatus('Connection Failed');
      setIsConnected(false);
      throw error;
    }
  };

  const disconnectFromAgent = async () => {
    try {
      if (ultravoxSessionRef.current) {
        await ultravoxSessionRef.current.leaveCall();
        ultravoxSessionRef.current = null;
      }
      setIsConnected(false);
      setIsRecording(false);
      setIsProcessing(false);
      setConnectionStatus('Disconnected');
      addMessage('system', 'Disconnected from voice agent');
      processedTranscriptsRef.current.clear();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  // Audio functions - with Ultravox SDK, these are simplified
  const startRecording = async () => {
    if (!isConnected) {
      alert('Please connect to the voice agent first');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // With Ultravox SDK, just ensure mic is unmuted
      if (ultravoxSessionRef.current && ultravoxSessionRef.current.isMicMuted()) {
        ultravoxSessionRef.current.unmuteMic();
      }
      
      // The SDK automatically handles voice detection and recording
      console.log('Ready to listen - speak now');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions and try again.');
    }
  };

  const stopRecording = () => {
    // With Ultravox SDK, you typically don't manually stop recording
    // The SDK handles voice activity detection automatically
    // But you can mute the mic if needed
    if (ultravoxSessionRef.current && !ultravoxSessionRef.current.isMicMuted()) {
      ultravoxSessionRef.current.muteMic();
      setTimeout(() => {
        if (ultravoxSessionRef.current) {
          ultravoxSessionRef.current.unmuteMic();
        }
      }, 1000); // Brief pause then re-enable
    }
  };

  // Text message functions
  const sendTextMessage = (text = null) => {
    const message = text || textInput.trim();
    if (!message) return;

    if (!isConnected) {
      alert('Please connect to the voice agent first');
      return;
    }

    // Send text message via SDK
    if (ultravoxSessionRef.current) {
      ultravoxSessionRef.current.sendText(message);
    }
    
    setTextInput('');
  };

  // Utility functions
  const addMessage = (role, content) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setConversation(prev => [...prev, newMessage]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isRecording && isConnected) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ultravoxSessionRef.current) {
        ultravoxSessionRef.current.leaveCall().catch(console.error);
      }
    };
  }, []);

  const getStatusColor = () => {
    if (isConnected) return 'bg-emerald-100 text-emerald-800';
    if (connectionStatus.includes('...')) return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cassidy - Project Manager Agent</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                {connectionStatus}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Connection Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            
            {!isConnected ? (
              <button
                onClick={connectToAgent}
                disabled={connectionStatus.includes('...')}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {connectionStatus.includes('...') ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={disconnectFromAgent}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Connection Settings */}
        {showSettings && (
          <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Connection Settings</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                <strong>Full Integration Active:</strong> Real-time voice conversation with Ultravox AI.
              </p>
              <p className="text-xs text-emerald-600 mt-2">
                Agent ID: b4475bec-5d89-4970-83a2-abe67246ac0b
              </p>
              <p className="text-xs text-emerald-600">
                SDK: ultravox-client with WebRTC audio
              </p>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Agent Column */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-500 mb-4">Agent</h2>
              
              {/* Avatar */}
              <div className="relative mb-6">
                <div className="w-48 h-48 mx-auto bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
                  {/* Simple face */}
                  <div className="relative">
                    <div className="w-32 h-32 bg-gray-300 rounded-full relative">
                      {/* Eyes */}
                      <div className="absolute top-10 left-8 w-3 h-3 bg-gray-700 rounded-full"></div>
                      <div className="absolute top-10 right-8 w-3 h-3 bg-gray-700 rounded-full"></div>
                      {/* Mouth */}
                      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 w-12 h-2 bg-gray-700 rounded-full transition-all duration-200 ${
                        isProcessing ? 'animate-pulse scale-110' : ''
                      }`}></div>
                    </div>
                  </div>
                  
                  {/* Status indicator */}
                  <div className="absolute top-4 right-4">
                    <div className={`w-3 h-3 rounded-full ${
                      isRecording ? 'bg-red-500 animate-pulse' : 
                      isProcessing ? 'bg-amber-500 animate-pulse' :
                      isConnected ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                </div>
              </div>

              {/* Voice Controls */}
              <div className="space-y-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isConnected}
                  className={`w-full py-4 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      Listening... (Space to pause)
                    </>
                  ) : isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      Hold Space to Talk
                    </>
                  )}
                </button>

                {/* Text Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
                    placeholder="Type your message..."
                    disabled={!isConnected}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  />
                  <button
                    onClick={() => sendTextMessage()}
                    disabled={!isConnected || !textInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Starter Prompts */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Starter Prompts</h3>
                <div className="space-y-2">
                  {starterPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => sendTextMessage(prompt)}
                      disabled={!isConnected}
                      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 disabled:bg-gray-50 disabled:opacity-50 text-sm rounded-lg transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Column */}
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[600px] flex flex-col">
              <h2 className="text-sm font-medium text-gray-500 mb-4">Conversation</h2>
              
              <div className="flex-1 overflow-y-auto space-y-4">
                {conversation.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Connect and start talking Cassidy.</p>
                  </div>
                ) : (
                  conversation.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : message.role === 'system'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-900 border border-gray-200'
                      }`}>
                        <div className={`text-xs mb-1 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Agent'} · {message.timestamp}
                        </div>
                        <div className="text-sm">{message.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Project Files Column */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[600px] flex flex-col">
              <h2 className="text-sm font-medium text-gray-500 mb-4">Project Files (RAG)</h2>

          <div className="space-y-2 mb-6">
  <a
    href="https://docs.google.com/document/d/your-requirements-doc-id/edit"
    target="_blank"
    rel="noopener noreferrer"
    className="block px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm transition-colors"
  >
    <span className="text-blue-600 hover:text-blue-800">Project Brief (Project Phoenix).pdf</span>
  </a>
  <a
    href="https://docs.google.com/spreadsheets/d/your-risks-sheet-id/edit"
    target="_blank"
    rel="noopener noreferrer"
    className="block px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm transition-colors"
  >
    <span className="text-blue-600 hover:text-blue-800">Responsible AI & Guardrails Policy.pdf</span>
  </a>
  <a
    href="https://docs.google.com/document/d/your-architecture-doc-id/edit"
    target="_blank"
    rel="noopener noreferrer"
    className="block px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm transition-colors"
  >
    <span className="text-blue-600 hover:text-blue-800">Stakeholders Overview.docx</span>
  </a>
    <a
    href="https://docs.google.com/document/d/your-architecture-doc-id/edit"
    target="_blank"
    rel="noopener noreferrer"
    className="block px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm transition-colors"
  >
    <span className="text-blue-600 hover:text-blue-800">Statement of Work (SOW).docx</span>
  </a>
</div>
             
              <div className="mt-auto pt-4 border-t border-gray-200">
                <label className="block text-xs text-gray-500 mb-2">Upload Files</label>
                <input
                  type="file"
                  multiple
                  className="block w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UltravoxVoiceAgent;
