
import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

interface Requirement {
  id: string;
  text: string;
  regex: RegExp;
}

const requirements: Requirement[] = [
  { id: 'length', text: 'At least 6 characters', regex: /.{6,}/ },
  { id: 'lowercase', text: 'One lowercase letter', regex: /[a-z]/ },
  { id: 'uppercase', text: 'One uppercase letter', regex: /[A-Z]/ },
  { id: 'digit', text: 'One number', regex: /\d/ },
  { id: 'symbol', text: 'One symbol', regex: /[!@#$%^&*(),.?":{}|<>]/ },
];

export function PasswordRequirements({ password, className }: PasswordRequirementsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">Password must contain:</p>
      <div className="space-y-1">
        {requirements.map((req) => {
          const isValid = req.regex.test(password);
          return (
            <div key={req.id} className="flex items-center space-x-2 text-sm">
              <div className={cn(
                "flex items-center justify-center w-4 h-4 rounded-full",
                isValid ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
              )}>
                {isValid ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </div>
              <span className={cn(
                isValid ? "text-green-600" : "text-muted-foreground"
              )}>
                {req.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
