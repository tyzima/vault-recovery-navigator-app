import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface MessageContentProps {
  content: string;
  mentions?: string[];
  currentUserId?: string;
  className?: string;
  users?: User[];
}

export function MessageContent({ 
  content, 
  mentions = [], 
  currentUserId, 
  className,
  users = []
}: MessageContentProps) {
  
  // Parse mentions and convert them to JSX elements
  const renderContentWithMentions = (text: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        parts.push(
          <ReactMarkdown
            key={`text-${match.index}`}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => (
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 mb-1 overflow-x-auto">
                  {children}
                </pre>
              ),
              ul: ({ children }) => <ul className="list-disc list-inside my-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 my-1 italic">
                  {children}
                </blockquote>
              ),
              h1: ({ children }) => <h1 className="text-lg font-bold my-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold my-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
              a: ({ href, children }) => (
                <a 
                  href={href} 
                  className="text-blue-600 dark:text-blue-400 hover:underline" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              )
            }}
          >
            {beforeText}
          </ReactMarkdown>
        );
      }

      // Add mention as a styled tag
      const displayName = match[1];
      const userId = match[2];
      const isCurrentUser = currentUserId === userId;

      parts.push(
        <span
          key={`mention-${match.index}-${userId}`}
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mx-0.5",
            "bg-blue-100 text-blue-800 border border-blue-200",
            "dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
            "hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer",
            isCurrentUser && "bg-blue-200 dark:bg-blue-800/60 ring-1 ring-blue-300 dark:ring-blue-600"
          )}
          title={`@${displayName}`}
        >
          @{displayName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text with markdown support
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(
        <ReactMarkdown
          key={`text-${lastIndex}`}
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <span>{children}</span>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            code: ({ children }) => (
              <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 mb-1 overflow-x-auto">
                {children}
              </pre>
            ),
            ul: ({ children }) => <ul className="list-disc list-inside my-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 my-1 italic">
                {children}
              </blockquote>
            ),
            h1: ({ children }) => <h1 className="text-lg font-bold my-1">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold my-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
            a: ({ href, children }) => (
              <a 
                href={href} 
                className="text-blue-600 dark:text-blue-400 hover:underline" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {children}
              </a>
            )
          }}
        >
          {remainingText}
        </ReactMarkdown>
      );
    }

    return parts;
  };

  return (
    <div className={cn("break-words leading-relaxed", className)}>
      {renderContentWithMentions(content)}
    </div>
  );
} 