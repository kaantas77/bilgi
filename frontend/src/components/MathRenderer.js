import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// MathRenderer component for rendering mathematical expressions using KaTeX
const MathRenderer = ({ content }) => {
  if (!content) return null;

  // Check if content contains math expressions
  const hasMath = content.includes('$') || content.includes('\\(') || content.includes('\\[');
  
  if (!hasMath) {
    // If no math, return regular text with line breaks
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Process content to extract and render math expressions
  const processContentWithMath = (text) => {
    const parts = [];
    let currentIndex = 0;
    
    // Regular expressions for different math delimiters
    const patterns = [
      { regex: /\$\$([^$]+)\$\$/g, type: 'display' }, // Display math $$...$$
      { regex: /\$([^$]+)\$/g, type: 'inline' },      // Inline math $...$
      { regex: /\\?\[([^\]]+)\\?\]/g, type: 'display' }, // Display math \[...\]
      { regex: /\\?\(([^)]+)\\?\)/g, type: 'inline' }    // Inline math \(...\)
    ];

    // Find all math expressions
    const matches = [];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          type: pattern.type,
          fullMatch: match[0]
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep the first one)
    const cleanMatches = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const hasOverlap = cleanMatches.some(existing => 
        (current.start >= existing.start && current.start < existing.end) ||
        (current.end > existing.start && current.end <= existing.end)
      );
      if (!hasOverlap) {
        cleanMatches.push(current);
      }
    }

    // Build the result with math and text parts
    cleanMatches.forEach((match, index) => {
      // Add text before this math expression
      if (currentIndex < match.start) {
        const textContent = text.slice(currentIndex, match.start);
        if (textContent) {
          parts.push(
            <span key={`text-${index}`} className="whitespace-pre-wrap">
              {textContent}
            </span>
          );
        }
      }

      // Add the math expression
      try {
        if (match.type === 'display') {
          parts.push(
            <BlockMath key={`math-${index}`} math={match.content} />
          );
        } else {
          parts.push(
            <InlineMath key={`math-${index}`} math={match.content} />
          );
        }
      } catch (error) {
        console.warn('KaTeX rendering error:', error);
        // Fallback to showing the raw math expression
        parts.push(
          <span key={`error-${index}`} className="text-red-400 font-mono">
            {match.fullMatch}
          </span>
        );
      }

      currentIndex = match.end;
    });

    // Add remaining text after the last math expression
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) {
        parts.push(
          <span key="remaining-text" className="whitespace-pre-wrap">
            {remainingText}
          </span>
        );
      }
    }

    return parts.length > 0 ? parts : [
      <span key="fallback" className="whitespace-pre-wrap">{text}</span>
    ];
  };

  return (
    <div className="math-content">
      {processContentWithMath(content)}
    </div>
  );
};

export default MathRenderer;