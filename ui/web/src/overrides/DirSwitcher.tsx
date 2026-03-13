/**
 * Web override for DirSwitcher.
 *
 * Replaces the Electron native directoryChooser dialog with an inline text
 * input so users can type a path directly in the browser.
 */
import React, { useState } from 'react';
import { FolderDot, Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@desktop/components/ui/Tooltip';
import { updateWorkingDir } from '@desktop/api';
import { toast } from 'react-toastify';
import { featureFlags } from '../feature-flags';

interface DirSwitcherProps {
  className: string;
  sessionId: string | undefined;
  workingDir: string;
  onWorkingDirChange?: (newDir: string) => void;
  onRestartStart?: () => void;
  onRestartEnd?: () => void;
}

export const DirSwitcher: React.FC<DirSwitcherProps> = ({
  className,
  sessionId,
  workingDir,
  onWorkingDirChange,
  onRestartStart,
  onRestartEnd,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Feature flag: hide DirSwitcher when working directory feature is disabled
  if (!featureFlags.features.workingDirectory) return null;

  const handleClick = () => {
    setInputValue(workingDir);
    setIsEditing(true);
  };

  const handleConfirm = async () => {
    const newDir = inputValue.trim();
    setIsEditing(false);
    if (!newDir || newDir === workingDir) return;

    onWorkingDirChange?.(newDir);

    if (sessionId) {
      onRestartStart?.();
      try {
        await updateWorkingDir({
          body: { session_id: sessionId, working_dir: newDir },
        });
      } catch (error) {
        console.error('[DirSwitcher] Failed to update working directory:', error);
        toast.error('Failed to update working directory');
      } finally {
        onRestartEnd?.();
      }
    }
  };

  const handleCancel = () => setIsEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div className={`z-[100] flex items-center gap-1 ${className}`}>
        <FolderDot size={16} className="shrink-0 text-text-primary/70" />
        <input
          autoFocus
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-xs px-1 py-0.5 border border-border-primary rounded bg-background-default text-text-primary min-w-0 w-52"
        />
        <button
          onClick={handleConfirm}
          title="Confirm"
          className="text-green-500 hover:text-green-400 shrink-0"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          title="Cancel"
          className="text-text-secondary hover:text-text-primary shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`z-[100] hover:cursor-pointer hover:text-text-primary text-text-primary/70 text-xs flex items-center transition-colors pl-1 [&>svg]:size-4 ${className}`}
            onClick={handleClick}
          >
            <FolderDot className="mr-1" size={16} />
            <div className="max-w-[200px] truncate [direction:rtl]">{workingDir}</div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Click to change working directory</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
