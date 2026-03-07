import AnimatedIcons from './AnimatedIcons';
import { ChatState } from '../types/chatState';

interface LoadingGooseProps {
  message?: string;
  chatState?: ChatState;
}

const STATE_MESSAGES: Record<ChatState, string> = {
  [ChatState.LoadingConversation]: 'loading conversation...',
  [ChatState.Thinking]: 'Agent Core is thinking...',
  [ChatState.Streaming]: 'Agent Core is working on it...',
  [ChatState.WaitingForUserInput]: 'Agent Core is waiting...',
  [ChatState.Compacting]: 'Agent Core is compacting the conversation...',
  [ChatState.Idle]: 'Agent Core is working on it...',
  [ChatState.RestartingAgent]: 'restarting session...',
};

const STATE_ICONS: Record<ChatState, React.ReactNode> = {
  [ChatState.LoadingConversation]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
  [ChatState.Thinking]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
  [ChatState.Streaming]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
  [ChatState.WaitingForUserInput]: (
    <AnimatedIcons className="flex-shrink-0" cycleInterval={600} variant="waiting" />
  ),
  [ChatState.Compacting]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
  [ChatState.Idle]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
  [ChatState.RestartingAgent]: <AnimatedIcons className="flex-shrink-0" cycleInterval={600} />,
};

const LoadingGoose = ({ message, chatState = ChatState.Idle }: LoadingGooseProps) => {
  const displayMessage = message || STATE_MESSAGES[chatState];
  const icon = STATE_ICONS[chatState];

  return (
    <div className="w-full animate-fade-slide-up">
      <div
        data-testid="loading-indicator"
        className="flex items-center gap-2 text-xs text-text-primary py-2"
      >
        {icon}
        {displayMessage}
      </div>
    </div>
  );
};

export default LoadingGoose;
