import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { ScrollArea } from './components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from './components/ui/sidebar';
import { MessageCircle, Plus, Trash2, Send, Bot, User } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await axios.get(`${API}/conversations/${conversationId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await axios.post(`${API}/conversations`, {
        title: `Sohbet ${conversations.length + 1}`
      });
      const newConversation = response.data;
      setConversations([newConversation, ...conversations]);
      setCurrentConversation(newConversation);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const selectConversation = async (conversation) => {
    setCurrentConversation(conversation);
    await loadMessages(conversation.id);
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/conversations/${conversationId}`);
      setConversations(conversations.filter(conv => conv.id !== conversationId));
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    if (!currentConversation) {
      await createNewConversation();
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      conversation_id: currentConversation.id,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/conversations/${currentConversation.id}/messages`, {
        content: inputMessage,
        mode: 'chat'
      });
      
      setMessages(prev => [...prev, response.data]);
      
      // Update conversation list
      await loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMessage = {
        id: Date.now().toString(),
        conversation_id: currentConversation.id,
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-blue-400">BİLGİN AI</h1>
              <Button
                onClick={() => setSidebarOpen(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                ←
              </Button>
            </div>
            <Button
              onClick={createNewConversation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Sohbet
            </Button>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer group transition-colors ${
                    currentConversation?.id === conversation.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                    <span className="text-sm truncate">{conversation.title}</span>
                  </div>
                  <Button
                    onClick={(e) => deleteConversation(conversation.id, e)}
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="ghost"
            size="sm"
            className="absolute top-4 left-4 z-10"
          >
            →
          </Button>
        )}

        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b p-4">
              <h2 className="text-lg font-semibold text-gray-800">{currentConversation.title}</h2>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <Avatar className="w-8 h-8">
                      {message.role === 'user' ? (
                        <>
                          <AvatarFallback className="bg-blue-600 text-white">
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </>
                      ) : (
                        <>
                          <AvatarFallback className="bg-green-600 text-white">
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <Card className={`max-w-2xl ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white ml-auto' 
                        : 'bg-white border'
                    }`}>
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-green-600 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Card className="bg-white border">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <div className="animate-pulse flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span className="text-sm text-gray-500">Yazıyor...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="bg-white border-t p-4">
              <div className="max-w-4xl mx-auto flex items-center space-x-3">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">BİLGİN AI'ye Hoş Geldiniz</h2>
                <p className="text-gray-600 mb-6">
                  Yapay zeka destekli asistanınız ile sohbet etmeye başlayın
                </p>
                <Button
                  onClick={createNewConversation}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Sohbet Başlat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;