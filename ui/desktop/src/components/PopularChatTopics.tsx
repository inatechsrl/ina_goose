import React, { useEffect, useState } from 'react';
import { FolderTree, MessageSquare, Code } from 'lucide-react';
import { getApiUrl } from '../config';

interface PopularChatTopicsProps {
  append: (text: string) => void;
}

interface ChatTopic {
  id: string;
  icon: React.ReactNode;
  description: string;
  prompt: string;
}

const DEFAULT_TOPICS: ChatTopic[] = [
  {
    id: 'organize-photos',
    icon: <FolderTree className="w-5 h-5" />,
    description: 'Organize the photos on my desktop into neat little folders by subject matter',
    prompt: 'Organize the photos on my desktop into neat little folders by subject matter',
  },
  {
    id: 'government-forms',
    icon: <MessageSquare className="w-5 h-5" />,
    description:
      'Describe in detail how various forms of government works and rank each by units of geese',
    prompt:
      'Describe in detail how various forms of government works and rank each by units of geese',
  },
  {
    id: 'tamagotchi-game',
    icon: <Code className="w-5 h-5" />,
    description:
      'Develop a tamagotchi game that lives on my computer and follows a pixelated styling',
    prompt: 'Develop a tamagotchi game that lives on my computer and follows a pixelated styling',
  },
];

export default function PopularChatTopics({ append }: PopularChatTopicsProps) {
  const [topics, setTopics] = useState<ChatTopic[]>(DEFAULT_TOPICS);
  const [title, setTitle] = useState('Popular chat topics');

  useEffect(() => {
    fetch(getApiUrl('/api/topics'))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.topics?.length) {
          setTopics(
            data.topics.map((t: { description: string; prompt: string }, i: number) => ({
              id: `custom-${i}`,
              icon: <MessageSquare className="w-5 h-5" />,
              description: t.description,
              prompt: t.prompt,
            }))
          );
          if (data.title) setTitle(data.title);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const handleTopicClick = (prompt: string) => {
    append(prompt);
  };

  return (
    <div className="absolute bottom-0 left-0 p-6 max-w-md">
      <h3 className="text-text-secondary text-sm mb-1">{title}</h3>
      <div className="space-y-1">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between py-1.5 hover:bg-background-secondary rounded-md cursor-pointer transition-colors"
            onClick={() => handleTopicClick(topic.prompt)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 text-text-secondary">{topic.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm leading-tight">{topic.description}</p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-4">
              <button
                className="text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopicClick(topic.prompt);
                }}
              >
                Start
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
