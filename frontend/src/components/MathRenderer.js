import React, { useEffect, useRef } from 'react';

// MathRenderer component for rendering mathematical expressions
const MathRenderer = ({ content }) => {
  const mathRef = useRef(null);

  useEffect(() => {
    if (mathRef.current && content) {
      // Check if content contains math expressions
      const hasMath = content.includes('$') || content.includes('\\(') || content.includes('\\[');
      
      if (hasMath) {
        // Load MathJax dynamically if not already loaded
        if (!window.MathJax) {
          const script = document.createElement('script');
          script.src = 'https://polyfill.io/v3/polyfill.min.js?features=es6';
          document.head.appendChild(script);
          
          const mathJaxScript = document.createElement('script');
          mathJaxScript.id = 'MathJax-script';
          mathJaxScript.async = true;
          mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
          document.head.appendChild(mathJaxScript);
          
          window.MathJax = {
            tex: {
              inlineMath: [['$', '$'], ['\\(', '\\)']],
              displayMath: [['$$', '$$'], ['\\[', '\\]']],
              processEscapes: true,
              processEnvironments: true,
            },
            svg: {
              fontCache: 'global'
            },
            startup: {
              ready: () => {
                window.MathJax.startup.defaultReady();
                if (mathRef.current) {
                  window.MathJax.typesetPromise([mathRef.current]);
                }
              }
            }
          };
        } else {
          // MathJax is already loaded, just typeset
          window.MathJax.typesetPromise([mathRef.current]);
        }
      }
    }
  }, [content]);

  if (!content) return null;

  // Check if content contains math expressions
  const hasMath = content.includes('$') || content.includes('\\(') || content.includes('\\[');
  
  if (!hasMath) {
    // If no math, return regular text with line breaks
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <div className="math-content" ref={mathRef}>
      {content}
    </div>
  );
};

export default MathRenderer;