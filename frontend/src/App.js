import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { ScrollArea } from './components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { useToast } from './hooks/use-toast';
import { MessageCircle, Plus, Trash2, Send, Bot, User, Star, Clock, Settings, LogOut, CreditCard, Shield, Bell, FileText, AlertTriangle, HelpCircle, Moon, Sun, Globe } from 'lucide-react';
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
  
  // Modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [reportText, setReportText] = useState('');
  
  // Settings states
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState('tr');
  const [notifications, setNotifications] = useState(true);
  
  const messagesEndRef = useRef(null);
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Matrix animation effect
  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        const canvas = document.getElementById('matrixCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        const resizeCanvas = () => {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
        };
        
        resizeCanvas();
        
        const matrix = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789@#$%^&*()_+-=[]{}|;:,.<>?";
        const matrixArray = matrix.split("");
        
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        
        const drops = [];
        for (let x = 0; x < columns; x++) {
          drops[x] = 1;
        }
        
        function draw() {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = '#00FF00';
          ctx.font = fontSize + 'px monospace';
          
          for (let i = 0; i < drops.length; i++) {
            const text = matrixArray[Math.floor(Math.random() * matrixArray.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
              drops[i] = 0;
            }
            drops[i]++;
          }
        }
        
        const interval = setInterval(draw, 50);
        
        window.addEventListener('resize', resizeCanvas);
        
        return () => {
          clearInterval(interval);
          window.removeEventListener('resize', resizeCanvas);
        };
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

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

  // Submit bug report
  const submitReport = async () => {
    if (!reportText.trim()) {
      toast({
        description: "Lütfen hata açıklamasını yazın",
        variant: "destructive"
      });
      return;
    }

    try {
      await axios.post(`${BACKEND_URL}/api/reports`, {
        message: reportText,
        user_agent: navigator.userAgent,
        url: window.location.href
      });
      
      toast({
        description: "Hata bildiriminiz başarıyla gönderildi!"
      });
      
      setReportText('');
      setShowReportModal(false);
    } catch (error) {
      toast({
        description: "Hata bildirimi gönderilirken bir sorun oluştu",
        variant: "destructive"
      });
    }
  };

  // Toggle functions
  const toggleNotifications = () => setNotifications(!notifications);
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleLanguage = () => setLanguage(language === 'tr' ? 'en' : 'tr');
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
        {/* Login Form Section */}
        <div className="login-form-section">
          <div className="brand-section">
            <img src="/digital-brain-logo.png" alt="BİLGİN Digital Brain" className="brand-logo" />
            <span className="brand-text">BİLGİN</span>
          </div>
          
          <h1 className="welcome-title">Merhaba!</h1>
          
          <div className="social-buttons">
            <button onClick={handleGoogleLogin} className="social-button">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google ile giriş yap
            </button>
            
            <button className="social-button">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple ile giriş yap
            </button>
          </div>
          
          <div className="divider">OR</div>
          
          {authMode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="text"
                  placeholder="Your email address"
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <div className="password-group">
                  <label className="form-label">Password</label>
                </div>
                <input
                  type="password"
                  placeholder="Your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <button type="submit" className="login-button">
                Log in
              </button>
              
              <a href="#" className="forgot-password">Forgot password?</a>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  placeholder="Your username"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <button type="submit" className="login-button">
                Sign up
              </button>
            </form>
          )}
          
          <div className="signup-link">
            {authMode === 'login' ? (
              <>Don't have an account? <a href="#" onClick={() => setAuthMode('register')}>Sign up</a></>
            ) : (
              <>Already have an account? <a href="#" onClick={() => setAuthMode('login')}>Log in</a></>
            )}
          </div>
        </div>

        {/* Matrix Section */}
        <div className="matrix-section">
          <canvas className="matrix-canvas" id="matrixCanvas"></canvas>
          <div className="matrix-overlay"></div>
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
        <div className="border-t border-gray-800 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-700 text-white text-sm">
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
                <User className="w-4 h-4 mr-2" />
                Ayarlar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowReportModal(true)}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Hata Bildir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPrivacyModal(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Kullanıcı Sözleşmesi
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="w-4 h-4 mr-2" />
                Yardım & Destek
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user?.is_admin && (
                <DropdownMenuItem onClick={toggleAdmin}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
              )}
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
            <div className="text-center space-y-6 max-w-3xl">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 animate-fade-in">
                  Merhaba {user?.name || user?.username}, ne öğrenmek istersin?
                </h2>
                <p className="text-gray-300 mb-8 text-base animate-fade-in-delay">
                  Merak ettiğin her şeyi sorabilirsin!
                </p>
                <button
                  onClick={createNewConversation}
                  className="bg-transparent border border-gray-500 hover:border-white text-white px-6 py-2.5 rounded-full transition-all duration-500 hover:bg-white/10 animate-bounce-subtle text-sm"
                >
                  Ayrıca yeni bir sohbet başlatmak için tıkla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bug Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="bg-black border border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
              Hata Bildir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Karşılaştığınız hatayı detaylı bir şekilde açıklayın:
            </p>
            <Textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Hata açıklamasını buraya yazın..."
              className="bg-gray-900 border-gray-700 text-white placeholder-gray-400 min-h-[100px]"
            />
            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => setShowReportModal(false)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                İptal
              </Button>
              <Button
                onClick={submitReport}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Gönder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="bg-black border border-gray-800 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center text-lg">
              <FileText className="w-5 h-5 mr-2 text-blue-500" />
              Kullanıcı Sözleşmesi ve Gizlilik Politikası
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
            <div>
              <h3 className="text-white font-semibold mb-2">BİLGİN TEKNOLOJİ A.Ş.</h3>
              <h4 className="text-blue-400 font-medium mb-3">Kişisel Verilerin Korunması, İşlenmesi ve Gizlilik Politikası</h4>
            </div>

            <section>
              <h4 className="text-white font-medium mb-2">1. Amaç ve Kapsam</h4>
              <p>Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK"), ilgili ikincil mevzuat ve Kişisel Verileri Koruma Kurulu ("Kurul") kararları çerçevesinde, Bilgin Teknoloji A.Ş. ("Bilgin") tarafından işlenen kişisel verilerin korunması, işlenmesi, saklanması, silinmesi, yok edilmesi ve anonim hale getirilmesi süreçlerini düzenlemektedir.</p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">2. Veri Sorumlusu</h4>
              <p>Bilgin Teknoloji A.Ş. KVKK uyarınca Veri Sorumlusu sıfatına sahiptir.</p>
              <p className="mt-2">Adres: [adresinizi ekleyin]<br />E-posta: privacy@bilgin.com</p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">3. Temel İlkeler</h4>
              <p>Bilgin, kişisel verileri aşağıdaki KVKK m.4'te sayılan ilkelere uygun olarak işler:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Hukuka ve dürüstlük kurallarına uygunluk</li>
                <li>Doğru ve güncel olma</li>
                <li>Belirli, açık ve meşru amaçlarla işlenme</li>
                <li>Amaçla bağlantılı, sınırlı ve ölçülü olma</li>
                <li>İlgili mevzuatta öngörülen süreler veya işleme amaçları için gerekli olan süre kadar muhafaza edilme</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">4. İşlenen Kişisel Veri Kategorileri</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, doğum tarihi</li>
                <li><strong>İletişim Bilgileri:</strong> Telefon, e-posta, adres</li>
                <li><strong>Hesap Bilgileri:</strong> Kullanıcı adı, şifre, üyelik kayıtları, giriş/çıkış saatleri</li>
                <li><strong>Finansal Veriler:</strong> Gelir-gider bilgileri, fatura ve ödeme bilgileri (kart verileri maskelenmiş)</li>
                <li><strong>Kullanım Verileri:</strong> Uygulama içi işlemler, tercih bilgileri, oturum süreleri</li>
                <li><strong>Teknik Veriler:</strong> IP adresi, cihaz bilgisi, log kayıtları, çerez verileri</li>
                <li><strong>İçerik Verileri:</strong> Kullanıcıların yüklediği dosyalar, tablolar, metinler</li>
                <li><strong>Hukuki İşlem Bilgileri:</strong> Talep, şikâyet, dava ve resmi makam yazışmaları</li>
                <li><strong>Pazarlama Verileri (açık rıza ile):</strong> Kampanya tercihleri, kullanım alışkanlıklarına göre öneriler</li>
                <li><strong>Özel Nitelikli Kişisel Veriler:</strong> Sağlık, biyometrik veya dini veriler talep edilmez</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">5. Veri Sahibi Grupları</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Kullanıcılar</li>
                <li>Çalışanlar</li>
                <li>Tedarikçiler</li>
                <li>İş ortakları</li>
                <li>Potansiyel müşteri adayları</li>
                <li>Ziyaretçiler</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">6. Kişisel Verilerin İşlenme Amaçları</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Platform hizmetlerinin sunulması, üyelik ve hesap yönetimi</li>
                <li>Raporlama, analiz ve finansal çıktılar oluşturma</li>
                <li>Güvenlik, dolandırıcılık önleme, bilgi güvenliği denetimleri</li>
                <li>Kullanıcı deneyimini geliştirme</li>
                <li>Hukuki yükümlülüklerin yerine getirilmesi</li>
                <li>Meşru menfaatlerin korunması</li>
                <li>Açık rıza varsa pazarlama ve iletişim faaliyetleri</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">7. Hukuki Sebepler</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>m.5/2-c:</strong> Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması</li>
                <li><strong>m.5/2-ç:</strong> Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi</li>
                <li><strong>m.5/2-f:</strong> İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaatler</li>
                <li><strong>m.5/1:</strong> Açık rıza alınması gereken haller</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">8. Kişisel Verilerin Paylaşımı</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Resmî kurumlar:</strong> Yalnızca yasal zorunluluk veya milli güvenlik/kamu düzeni durumlarında</li>
                <li><strong>Hizmet sağlayıcılar:</strong> Barındırma, güvenlik, bakım, destek, ödeme altyapısı gibi zorunlu tedarikçiler</li>
                <li><strong>İştirakler/iş ortakları:</strong> Sadece hizmetin ifası için gerekli olması halinde</li>
                <li><strong>Üçüncü kişiler:</strong> Kişisel veriler pazarlama amacıyla paylaşılmaz</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">9. Yurt Dışı Aktarım</h4>
              <p>Kullanıcı verileri yalnızca açık rızanız ile yurt dışına aktarılır.</p>
              <p className="mt-2">Aktarımlar sırasında TLS/SSL şifreleme ve gerekli teknik/idari güvenlik tedbirleri uygulanır.</p>
              <p className="mt-2">Veriler yalnızca hizmetin ifası için işlenir; model eğitimi, reklam veya üçüncü kişilerle paylaşım amacıyla kullanılmaz.</p>
              <p className="mt-2 text-yellow-400">Üyelik işlemini tamamlayarak bu sözleşmeyi onayladığınızda, kişisel verilerinizin yurt dışına aktarılmasına dair bu sorumluluğu da kabul etmiş olursunuz.</p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">10. Saklama ve İmha</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Kişisel veriler, işleme amaçları için gerekli süre boyunca saklanır</li>
                <li>Süre dolduğunda KVKK m.7 uyarınca silinir, yok edilir veya anonimleştirilir</li>
                <li>Hukuki uyuşmazlıklarda zamanaşımı sürelerince saklama yapılabilir</li>
                <li>Bilgin, Kişisel Veri Saklama ve İmha Politikası oluşturmuştur</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">11. Güvenlik Önlemleri</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Teknik önlemler:</strong> Şifreleme, loglama, erişim kontrolleri, düzenli sızma testleri</li>
                <li><strong>İdari önlemler:</strong> Personel eğitimi, gizlilik taahhütnameleri, yetki sınırlamaları</li>
                <li><strong>Sözleşmesel önlemler:</strong> Tedarikçi sözleşmelerine veri güvenliği hükümleri eklenmesi</li>
              </ul>
              <p className="mt-2 text-red-300 text-xs">
                <strong>Gerçekçi güvenlik uyarısı:</strong> Kişisel verileri kayıp, kötüye kullanım ve yetkisiz erişim, açıklama, değiştirme veya imhaya karşı korumak için ticari açıdan makul teknik, idari ve organizasyonel önlemler uygulanır. Ancak hiçbir internet veya e-posta iletimi tamamen güvenli ya da hatasız değildir. Bu nedenle kullanıcıların Hizmetlere hangi bilgileri sağlayacaklarına karar verirken dikkatli olmaları gerekir.
              </p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">12. Veri Sahiplerinin Hakları (KVKK m.11)</h4>
              <p>Veri sahipleri, Bilgin'e başvurarak şu haklara sahiptir:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Kişisel verilerinin işlenip işlenmediğini öğrenme</li>
                <li>İşlenmişse buna ilişkin bilgi talep etme</li>
                <li>İşlenme amacını öğrenme</li>
                <li>Eksik/yanlış işlenmişse düzeltilmesini isteme</li>
                <li>Silinmesini veya yok edilmesini talep etme</li>
                <li>Aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
                <li>Otomatik işleme sonuçlarına itiraz etme</li>
                <li>Zarara uğraması hâlinde tazminat talep etme</li>
              </ul>
              <p className="mt-2">Başvurular: privacy@bilgin.com<br />Yanıt süresi: 30 gün</p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">13. İstisnalar</h4>
              <p>KVKK m.28 uyarınca; milli güvenlik, kamu düzeni, suç soruşturması, araştırma, sanat, tarih, bilimsel amaçlı anonim işleme hallerinde bu haklar sınırlanabilir.</p>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">14. Çocukların Verileri</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Platform 18 yaş altı kişiler için tasarlanmamıştır</li>
                <li>18 yaşından küçüklerin verileri yalnızca veli/vasi izni ile işlenir</li>
                <li>13 yaş altından bilinçli veri toplanmaz, tespit edilirse silinir</li>
              </ul>
            </section>

            <section>
              <h4 className="text-white font-medium mb-2">15. Güncellemeler</h4>
              <p>Bu politika, yasal düzenlemeler veya hizmetlerdeki değişikliklere bağlı olarak güncellenebilir. Güncel sürüm her zaman platformda yayımlanır.</p>
              <p className="mt-2 text-blue-400 font-medium">Yürürlük tarihi: 19.09.2025</p>
            </section>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setShowPrivacyModal(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Anladım
            </Button>
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