import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { chatClient } from '@/lib/chatClient';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  channelId?: string;
}

export function MentionInput({ 
  value, 
  onChange, 
  onSubmit, 
  onKeyDown,
  placeholder, 
  disabled, 
  className,
  channelId
}: MentionInputProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load users for mentions
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        console.log('🔄 Loading users for mentions...');
        const fetchedUsers = await chatClient.getUsers(channelId);
        console.log('✅ Users loaded for mentions:', fetchedUsers.length, 'users:', fetchedUsers);
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('❌ Failed to load users for mentions:', error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [channelId]);

  // Parse mentions from text
  const parseMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]); // User ID from the mention
    }
    
    return mentions;
  };

  // Format display text (remove mention markdown for input display)
  const formatDisplayText = (text: string): string => {
    return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
  };

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    console.log('📝 Input changed:', { newValue, cursorPos });
    
    // Check if we're typing an @ mention
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    console.log('🔍 Checking for @:', { textBeforeCursor, atIndex });
    
    if (atIndex !== -1) {
      const mentionText = textBeforeCursor.substring(atIndex + 1);
      
      // Only show suggestions if @ is at start of word and no spaces after @
      const isValidMention = (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1])) && 
                            !mentionText.includes(' ');
      
      console.log('🎯 Mention detection:', { mentionText, isValidMention });
      
      if (isValidMention) {
        let filtered;
        
        if (mentionText.length === 0) {
          // Show all users when just "@" is typed
          filtered = users.slice(0, 8); // Limit to 8 suggestions for initial display
        } else {
          // Filter users based on search text
          filtered = users.filter(user => {
            const displayName = user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}`
              : user.email;
            return displayName.toLowerCase().includes(mentionText.toLowerCase()) ||
                   user.email.toLowerCase().includes(mentionText.toLowerCase());
          }).slice(0, 5); // Limit to 5 suggestions for filtered results
        }
        
        console.log('📋 Filtered users:', filtered, 'from total users:', users.length);
        
        setFilteredUsers(filtered);
        setShowSuggestions(filtered.length > 0);
        setMentionStart(atIndex);
        setSuggestionIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
    
    // Convert the display text back to markdown format, preserving existing mentions
    const markdownValue = convertDisplayTextToMarkdown(newValue);
    onChange(markdownValue);
  };

  // Convert display text back to markdown format, preserving existing mentions
  const convertDisplayTextToMarkdown = (displayText: string): string => {
    // First, get the original value to see what mentions already exist
    const existingMentions = new Map<string, string>();
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    // Extract existing mentions from the original value
    while ((match = mentionRegex.exec(value)) !== null) {
      const displayName = match[1];
      const userId = match[2];
      existingMentions.set(`@${displayName}`, `@[${displayName}](${userId})`);
    }
    
    // Start with the display text
    let result = displayText;
    
    // First, restore any existing mentions that are still in the text
    existingMentions.forEach((markdownMention, plainMention) => {
      result = result.replace(new RegExp(escapeRegExp(plainMention), 'g'), markdownMention);
    });
    
    // Then look for new plain text mentions that aren't already converted
    const plainMentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
    const newReplacements: { original: string; replacement: string }[] = [];
    
    while ((match = plainMentionRegex.exec(result)) !== null) {
      const fullMatch = match[0];
      const mentionText = match[1];
      
      // Skip if this is already a markdown mention
      if (result.includes(`@[${mentionText}](`)) continue;
      
      const user = users.find(u => {
        const displayName = u.first_name && u.last_name 
          ? `${u.first_name} ${u.last_name}`
          : u.email;
        return displayName === mentionText;
      });
      
      if (user) {
        const displayName = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`
          : user.email;
        newReplacements.push({
          original: fullMatch,
          replacement: `@[${displayName}](${user.id})`
        });
      }
    }
    
    // Apply new replacements
    newReplacements.forEach(({ original, replacement }) => {
      result = result.replace(original, replacement);
    });
    
    return result;
  };

  // Helper function to escape special regex characters
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (filteredUsers.length > 0) {
          e.preventDefault();
          selectUser(filteredUsers[suggestionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
    
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Select a user from suggestions
  const selectUser = (user: User) => {
    console.log('👤 Selecting user:', user);
    
    const currentDisplayText = formatDisplayText(value);
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeMention = currentDisplayText.substring(0, mentionStart);
    const afterCursor = currentDisplayText.substring(cursorPos);
    
    const displayName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`
      : user.email;
    
    // Create mention in markdown format: @[Display Name](user_id)
    const mention = `@[${displayName}](${user.id})`;
    const newValue = beforeMention + mention + ' ' + afterCursor;
    
    console.log('💾 New value with mention:', newValue);
    
    onChange(newValue);
    setShowSuggestions(false);
    
    // Focus input and set cursor after mention
    setTimeout(() => {
      if (inputRef.current) {
        const newDisplayText = formatDisplayText(newValue);
        const newCursorPos = beforeMention.length + displayName.length + 2; // +2 for "@" and space
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Get user display name
  const getUserDisplayName = (user: User) => {
    return user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`
      : user.email;
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={formatDisplayText(value)}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {/* Mention Suggestions */}
      {showSuggestions && (
        <div 
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50"
        >
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading users...
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user, index) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-none",
                  index === suggestionIndex && "bg-blue-50 dark:bg-blue-900/30"
                )}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {getUserDisplayName(user)}
                </div>
                {user.first_name && user.last_name && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
} 