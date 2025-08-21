import React, { useState } from 'react';

const UltravoxVoiceAgent = () => {
  const [status, setStatus] = useState('Disconnected');

  const connect = () => {
    setStatus('Connected');
    alert('Basic deployment working! Next step: add dependencies.');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Ultravox Agent</h1>
      <p>Status: {status}</p>
      <button onClick={connect} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Connect
      </button>
    </div>
  );
};

export default UltravoxVoiceAgent;
