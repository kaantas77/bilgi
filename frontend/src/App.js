import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { ScrollArea } from './components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Badge } from './components/ui/badge';
import { MessageCircle, Plus, Trash2, Send, Bot, User, Star, Clock, Settings, LogOut, CreditCard, Shield } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set axios to include credentials
axios.defaults.withCredentials = true;

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Auth states
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [onboardingData, setOnboardingData] = useState({ name: '' });
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Admin states
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication on mount and handle Google OAuth
  useEffect(() => {
    checkAuth();
    handleGoogleCallback();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      setIsAuthenticated(true);
      
      // Check if user needs onboarding
      if (!response.data.onboarding_completed) {
        setShowOnboarding(true);
      } else {
        loadConversations();
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCallback = async () => {
    // Check for session_id in URL fragment
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const sessionId = params.get('session_id');
    
    if (sessionId) {
      setIsLoading(true);
      try {
        const response = await axios.post(`${API}/auth/google/callback`, {
          session_id: sessionId
        });
        
        setUser(response.data.user);
        setIsAuthenticated(true);
        
        // Check if user needs onboarding
        if (!response.data.user.onboarding_completed) {
          setShowOnboarding(true);
        } else {
          loadConversations();
        }
        
      } catch (error) {
        console.error('Google OAuth error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

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

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      setUser(response.data.user);
      setIsAuthenticated(true);
      
      // Check if user needs onboarding
      if (!response.data.user.onboarding_completed) {
        setShowOnboarding(true);
      } else {
        loadConversations();
      }
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, registerData);
      alert('Registration successful! Please login.');
      setAuthMode('login');
    } catch (error) {
      alert('Registration failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await axios.get(`${API}/auth/google`);
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const handleOnboarding = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/onboarding`, onboardingData);
      setUser(response.data.user);
      setShowOnboarding(false);
      loadConversations();
    } catch (error) {
      alert('Onboarding failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(null);
      setIsAuthenticated(false);
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
      setShowAdmin(false);
      setShowOnboarding(false);
    } catch (error) {
      console.error('Logout error:', error);
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
        mode: 'chat'
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

  const loadAdminStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setAdminStats(response.data);
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  const toggleAdmin = () => {
    if (!showAdmin) {
      loadAdminStats();
    }
    setShowAdmin(!showAdmin);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="futuristic-loading">
        <div className="futuristic-bg"></div>
        <div className="grid-overlay"></div>
        <div className="cosmic-particles">
          {[...Array(15)].map((_, i) => (
            <div 
              key={i} 
              className="cosmic-particle" 
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`
              }}
            ></div>
          ))}
        </div>
        <div className="text-center">
          <div className="loading-logo">
            <img src="/bilgin-ai-logo.png" alt="BİLGİN AI" />
          </div>
          <div className="loading-text">BİLGİN AI Yükleniyor...</div>
        </div>
      </div>
    );
  }

  // Onboarding screen
  if (isAuthenticated && showOnboarding) {
    return (
      <div className="flex h-screen">
        <div className="futuristic-bg"></div>
        <div className="grid-overlay"></div>
        <div className="cosmic-particles">
          {[...Array(15)].map((_, i) => (
            <div 
              key={i} 
              className="cosmic-particle" 
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`
              }}
            ></div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center p-8 relative z-10">
          <div className="w-full max-w-lg">
            <div className="text-center mb-12">
              <div className="logo-container mx-auto mb-8">
                <div className="animated-logo-main">
                  <img src="/bilgin-ai-logo.png" alt="BİLGİN AI" />
                </div>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="logo-particle"></div>
                ))}
              </div>
              <h1 className="welcome-title !text-5xl mb-4">Hoş Geldiniz!</h1>
              <p className="welcome-subtitle text-xl">Size nasıl hitap etmemizi istiyorsunuz?</p>
            </div>

            <div className="futuristic-form">
              <form onSubmit={handleOnboarding} className="space-y-8">
                <div>
                  <label className="block text-xl font-bold text-white mb-6 text-center">
                    <span className="typing-animation">İsminiz Nedir?</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Adınızı giriniz..."
                    value={onboardingData.name}
                    onChange={(e) => setOnboardingData({...onboardingData, name: e.target.value})}
                    className="futuristic-input text-xl py-5"
                    required
                    autoFocus
                  />
                  <p className="text-sm text-white/60 mt-4 text-center">
                    Bu isim ile size hitap edeceğiz ve sohbetlerinizde görünecektir.
                  </p>
                </div>
                
                <button 
                  type="submit" 
                  className="futuristic-button text-xl py-5"
                  disabled={!onboardingData.name.trim()}
                >
                  Harika! Devam Edelim
                </button>
              </form>
            </div>

            <div className="text-center text-sm text-white/50 mt-8">
              Merhaba <span className="text-white font-medium">{user?.username}</span>, profilinizi tamamlayalım ✨
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="futuristic-login-container">
        <div className="futuristic-bg"></div>
        <div className="grid-overlay"></div>
        <div className="cosmic-particles">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="cosmic-particle" 
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`
              }}
            ></div>
          ))}
        </div>
        
        {/* Login Form Section */}
        <div className="login-form-section">
          <div className="futuristic-form">
            <h2 className="form-title">BİLGİN AI</h2>
            
            <div className="futuristic-tabs">
              <button
                onClick={() => setAuthMode('login')}
                className={`futuristic-tab ${authMode === 'login' ? 'active' : ''}`}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`futuristic-tab ${authMode === 'register' ? 'active' : ''}`}
              >
                Kayıt Ol
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <input
                  type="text"
                  placeholder="Kullanıcı Adı"
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  className="futuristic-input"
                  required
                />
                <input
                  type="password"
                  placeholder="Şifre"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  className="futuristic-input"
                  required
                />
                <button type="submit" className="futuristic-button">
                  Giriş Yap
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-6">
                <input
                  type="text"
                  placeholder="Kullanıcı Adı"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                  className="futuristic-input"
                  required
                />
                <input
                  type="email"
                  placeholder="E-posta"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  className="futuristic-input"
                  required
                />
                <input
                  type="password"
                  placeholder="Şifre"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  className="futuristic-input"
                  required
                />
                <button type="submit" className="futuristic-button">
                  Kayıt Ol
                </button>
              </form>
            )}

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-white/60">veya</span>
                </div>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="futuristic-button w-full mt-6 !bg-white !text-gray-900 hover:!bg-gray-100"
              >
                Google ile Giriş Yap
              </button>
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="welcome-section">
          <h1 className="welcome-title">WELCOME</h1>
          <p className="welcome-subtitle">Yapay Zeka Geleceğine Hoş Geldiniz</p>
          
          <div className="logo-container">
            <div className="animated-logo-main">
              <img src="/bilgin-ai-logo.png" alt="BİLGİN AI Logo" />
            </div>
            
            {/* Logo Particles */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="logo-particle"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Admin Panel
  if (showAdmin && user?.is_admin) {
    return (
      <div className="flex h-screen bg-black text-white">
        <div className="w-80 bg-black border-r border-gray-800 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-white">BİLGİN Admin</h1>
            <Button
              onClick={toggleAdmin}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              ←
            </Button>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="text-sm text-gray-400">Admin: {user.username}</div>
            
            {adminStats && (
              <div className="space-y-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{adminStats.total_users}</div>
                        <div className="text-xs text-gray-400">Toplam Üye</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-400">{adminStats.verified_users}</div>
                        <div className="text-xs text-gray-400">Doğrulanmış</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-400">{adminStats.total_conversations}</div>
                        <div className="text-xs text-gray-400">Sohbet</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-400">{adminStats.total_messages}</div>
                        <div className="text-xs text-gray-400">Mesaj</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h3 className="text-sm font-medium mb-2">Son Kayıt Olanlar</h3>
                  <div className="space-y-2">
                    {adminStats.recent_users.slice(0, 5).map((recentUser) => (
                      <div key={recentUser.id} className="flex items-center space-x-2 p-2 bg-gray-900 rounded text-xs">
                        <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{recentUser.username}</div>
                          <div className="text-gray-400 truncate">{recentUser.email}</div>
                        </div>
                        {recentUser.is_verified && (
                          <Badge variant="secondary" className="text-xs">✓</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-8">
          <h2 className="text-2xl font-bold mb-6">Üye Yönetimi</h2>
          
          {adminStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminStats.recent_users.map((adminUser) => (
                <Card key={adminUser.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gray-700 text-white">
                          {adminUser.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{adminUser.username}</div>
                        <div className="text-sm text-gray-400 truncate">{adminUser.email}</div>
                      </div>
                      {adminUser.is_admin && (
                        <Shield className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    
                    <div className="space-y-2 text-xs text-gray-400">
                      <div>Kayıt: {new Date(adminUser.created_at).toLocaleDateString('tr-TR')}</div>
                      {adminUser.last_login && (
                        <div>Son Giriş: {new Date(adminUser.last_login).toLocaleDateString('tr-TR')}</div>
                      )}
                      <div className="flex space-x-2">
                        <Badge variant={adminUser.is_verified ? "default" : "secondary"} className="text-xs">
                          {adminUser.is_verified ? "Doğrulandı" : "Beklemede"}
                        </Badge>
                        {adminUser.is_admin && (
                          <Badge variant="destructive" className="text-xs">Admin</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <div className={`bg-black text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden flex flex-col border-r border-gray-900`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>BİLGİN</h1>
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
            className="w-full bg-gray-800 hover:bg-gray-700 text-white border-0"
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
                  <Clock className="w-4 h-4 text-gray-400" />
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

        {/* User Profile Section */}
        <div className="border-t border-gray-900 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-800 text-white text-sm">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user?.username}</div>
                  <div className="text-xs text-gray-500">
                    {user?.is_admin ? 'Admin' : 'Free Plan'}
                  </div>
                </div>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 mb-2">
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Ayarlar
              </DropdownMenuItem>
              {user?.is_admin && (
                <DropdownMenuItem onClick={toggleAdmin}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <CreditCard className="w-4 h-4 mr-2" />
                Üyelik Yükselt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Çıkış Yap
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
                        <AvatarFallback className="bg-gray-700 text-white">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-gray-800 text-white">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-3xl p-4 rounded-2xl ${
                        message.role === 'user' 
                          ? 'bg-gray-700 text-white' 
                          : 'bg-gray-900 text-white border border-gray-800'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
                      <AvatarFallback className="bg-gray-800 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
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
                    placeholder="BİLGİN'e mesajınızı yazın..."
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
                  BİLGİN AI hata yapabilir. Önemli bilgileri kontrol edin.
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <div className="text-center space-y-8 max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-3">Hoş Geldiniz, {user?.name || user?.username}!</h2>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  BİLGİN AI ile sohbet etmeye başlayın. 
                  Sorularınızı sorabilir, yardım alabilir ve bilgi edinebilirsiniz.
                </p>
                <div className="space-y-3 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Doğal dil işleme</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <span>Akıllı yanıtlar</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>7/24 erişim</span>
                  </div>
                </div>
                <Button
                  onClick={createNewConversation}
                  className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white mt-8"
                  size="lg"
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