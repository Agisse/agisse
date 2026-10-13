import { AssistantChat, ChatList } from '@/components/AssistantChat'

/** The assistant as a full page: every chat on the left, the open one on the right. Same chats as the dock. */
export function ChatRoute() {
  return (
    <main className="chat-page">
      <h1 className="sr-only">Chat</h1>
      <AssistantChat showActions aside={<ChatList />} placeholder="Ask anything about your search…" />
    </main>
  )
}
