import React from 'react';
import { MathJaxPreview } from 'react-mathjax-preview';

// MathRenderer component for rendering mathematical expressions
const MathRenderer = ({ content }) => {
  if (!content) return null;

  // Check if content contains math expressions
  const hasMath = content.includes('$') || content.includes('\\(') || content.includes('\\[');
  
  if (!hasMath) {
    // If no math, return regular text with line breaks
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // MathJax configuration
  const mathConfig = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true,
    },
    svg: {
      fontCache: 'global'
    }
  };

  return (
    <div className="math-content">
      <MathJaxPreview 
        math={content}
        config={mathConfig}
        className="text-inherit"
      />
    </div>
  );
};

export default MathRenderer;