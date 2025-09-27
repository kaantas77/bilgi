import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { ScrollArea } from './components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { useToast } from './hooks/use-toast';
import { MessageCircle, Plus, Trash2, Send, Bot, User, Settings, Moon, Sun, Globe, Bell } from 'lucide-react';
import MathRenderer from './components/MathRenderer';
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // Main app states - no auth required
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Settings states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState('tr');
  const [notifications, setNotifications] = useState(true);
  
  // Konuşma Modları Test - Yeni eklenen states
  const [activeTab, setActiveTab] = useState('normal'); // 'normal' or 'modes'
  const [selectedMode, setSelectedMode] = useState('normal');
  
  // Konuşma modları tanımları
  const conversationModes = {
    normal: { name: "Normal", description: "Standart BİLGİN", color: "bg-blue-500" },
    friend: { name: "Arkadaş Canlısı", description: "Samimi, motive, esprili", color: "bg-green-500" },
    realistic: { name: "Gerçekci", description: "Eleştirel, kanıt odaklı", color: "bg-yellow-500" },
    coach: { name: "Koç", description: "Soru sorarak düşündürür", color: "bg-purple-500" },
    lawyer: { name: "Avukat", description: "Karşı argüman üretir", color: "bg-red-500" },
    teacher: { name: "Öğretmen", description: "Adım adım öğretir", color: "bg-indigo-500" },
    minimalist: { name: "Minimalist", description: "Kısa, madde işaretli", color: "bg-gray-500" }
  };
  
  const messagesEndRef = useRef(null);
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    const savedTheme = localStorage.getItem('theme');
    const savedNotifications = localStorage.getItem('notifications');

    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === 'true');
    }

    // Load conversations directly on mount
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      // Remove auth requirement - load conversations directly
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
        title: "Yeni Sohbet"
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
    if (!inputMessage.trim() || isMessageLoading) return;
    
    let conversationToUse = currentConversation;
    
    if (!conversationToUse) {
      // Create new conversation first
      try {
        const response = await axios.post(`${API}/conversations`, {
          title: "Yeni Sohbet"
        });
        conversationToUse = response.data;
        setCurrentConversation(conversationToUse);
        setConversations([conversationToUse, ...conversations]);
      } catch (error) {
        console.error('Error creating conversation:', error);
        return;
      }
    }

    const userMessage = {
      id: Date.now().toString(),
      conversation_id: conversationToUse.id,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsMessageLoading(true);

    try {
      const response = await axios.post(`${API}/conversations/${conversationToUse.id}/messages`, {
        content: inputMessage,
        mode: activeTab === 'modes' ? selectedMode : 'chat',
        conversationMode: activeTab === 'modes' ? selectedMode : null
      });
      
      setMessages(prev => [...prev, response.data]);
      
      // Refresh conversation list to get updated title
      await loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now().toString(),
        conversation_id: conversationToUse.id,
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsMessageLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Settings toggle functions
  const toggleNotifications = () => {
    const newNotifications = !notifications;
    setNotifications(newNotifications);
    localStorage.setItem('notifications', newNotifications.toString());
    toast({
      description: `Bildirimler ${newNotifications ? 'açıldı' : 'kapatıldı'}`,
    });
  };
  
  const toggleDarkMode = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    // Apply theme to document and save to localStorage
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    
    toast({
      description: `${newTheme ? 'Koyu' : 'Açık'} tema etkinleştirildi`,
    });
  };
  
  const toggleLanguage = () => {
    const newLang = language === 'tr' ? 'en' : 'tr';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
    toast({
      description: `Dil ${newLang === 'tr' ? 'Türkçe' : 'İngilizce'} olarak değiştirildi`,
    });
  };

  // Main Chat Interface - Direct access, no auth
  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <div className={`bg-black text-white transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'} overflow-hidden flex flex-col border-r border-gray-800`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">BİLGİN</h1>
            <Button
              onClick={() => setSidebarOpen(false)}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-900"
            >
              ←
            </Button>
          </div>
          <Button
            onClick={createNewConversation}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white border-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Sohbet
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {/* Recent Section */}
            {conversations.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 px-3 py-2">
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-white">Son Sohbetler</span>
                </div>
                {conversations.slice(0, 10).map((conversation) => (
                  <ConversationItem 
                    key={conversation.id}
                    conversation={conversation}
                    isActive={currentConversation?.id === conversation.id}
                    onSelect={() => selectConversation(conversation)}
                    onDelete={(e) => deleteConversation(conversation.id, e)}
                  />
                ))}
              </div>
            )}

            {conversations.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                Henüz sohbet bulunmuyor
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Settings Section */}
        <div className="border-t border-gray-800 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-700 text-white text-sm">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">BİLGİN AI</div>
                  <div className="text-xs text-gray-500">
                    Matematik Desteği Aktif
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 mb-2">
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Ayarlar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="ghost"
            size="sm"
            className="absolute top-4 left-4 z-10 text-gray-400 hover:text-white bg-gray-900 border border-gray-700 hover:bg-gray-800"
          >
            →
          </Button>
        )}

        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-black border-b border-gray-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{currentConversation.title}</h2>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6 bg-black">
              <div className="space-y-6 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-4 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      {message.role === 'user' ? (
                        <AvatarFallback className="bg-gray-900 text-white">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-gray-900 text-white">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-3xl p-4 rounded-2xl ${
                        message.role === 'user' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-900 text-white border border-gray-900'
                      }`}>
                        <div className="text-sm leading-relaxed">
                          <MathRenderer content={message.content} />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {isMessageLoading && (
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gray-900 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-900 border border-gray-900 p-4 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-sm text-gray-400">BİLGİN yazıyor...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="bg-black border-t border-gray-900 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end space-x-3 bg-gray-900 rounded-2xl p-3 border border-gray-900">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="BİLGİN'e matematik sorunuzu yazın... Örnek: $x^2 + y^2 = r^2$"
                    className="flex-1 border-0 bg-transparent focus:ring-0 text-white placeholder-gray-500"
                    disabled={isMessageLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isMessageLoading}
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-xl"
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2">
                  BİLGİN AI matematik ifadelerini LaTeX formatında anlayabilir. KaTeX ile profesyonel render.
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <div className="text-center space-y-6 max-w-3xl">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 animate-fade-in">
                  Merhaba, ne öğrenmek istersin?
                </h2>
                <p className="text-gray-300 mb-8 text-base animate-fade-in-delay">
                  Matematik problemlerini KaTeX ile profesyonel kalitede görebilirsin!
                </p>
                <button
                  onClick={createNewConversation}
                  className="bg-transparent border border-gray-500 hover:border-white text-white px-6 py-2.5 rounded-full transition-all duration-500 hover:bg-white/10 animate-bounce-subtle text-sm"
                >
                  Matematik sorusu sormak için tıkla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-black border border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-500" />
              Ayarlar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <button
                onClick={toggleNotifications}
                className="w-full flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center">
                  <Bell className="w-4 h-4 mr-3" />
                  <span>Bildirimler</span>
                </div>
                <span className={`text-sm ${notifications ? 'text-green-400' : 'text-red-400'}`}>
                  {notifications ? 'Açık' : 'Kapalı'}
                </span>
              </button>

              <button
                onClick={toggleDarkMode}
                className="w-full flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center">
                  {isDarkMode ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
                  <span>Tema</span>
                </div>
                <span className="text-sm text-gray-400">
                  {isDarkMode ? 'Koyu' : 'Açık'}
                </span>
              </button>

              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-3" />
                  <span>Dil</span>
                </div>
                <span className="text-sm text-gray-400">
                  {language === 'tr' ? 'Türkçe' : 'English'}
                </span>
              </button>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setShowSettingsModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Tamam
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Conversation Item Component
const ConversationItem = ({ conversation, isActive, onSelect, onDelete }) => {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer group transition-colors ${
        isActive ? 'bg-gray-900' : 'hover:bg-gray-900'
      }`}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <MessageCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm truncate text-white">{conversation.title}</span>
      </div>
      <div className="flex items-center pr-2">
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-300 hover:bg-gray-800 p-1.5 opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default App;