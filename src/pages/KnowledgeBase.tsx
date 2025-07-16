import React from 'react';

export function KnowledgeBase() {
  return (
    <div style={{ 
      position: 'relative', 
      display: 'block', 
      height: '100%', 
      minHeight: '100vh', 
      width: '100%' 
    }}>
      <iframe 
        className="arcade-collection" 
        src="https://app.arcade.software/share/collections/mKqB90a7r2c2E7ifXNB3?embed&show_copy_link=true&force_no_header=true" 
        title="KELYN Runbooks" 
        frameBorder="0" 
        loading="lazy" 
        allowFullScreen 
        sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups" 
        allow="clipboard-write" 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          marginLeft: '10px',
          width: '100%', 
          height: '100%', 
          colorScheme: 'light' 
        }}
      />
    </div>
  );
}
