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
import MathRenderer from './components/MathRenderer';
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set axios to include credentials
axios.defaults.withCredentials = true;

function App() {
  // Remove all auth states - direct to chat
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Settings states only
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState('tr');
  const [notifications, setNotifications] = useState(true);
  
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

  // Remove all auth functions - direct access to chat

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

  // Remove all auth functions - direct chat access

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

  // Settings toggle functions only
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
    // Store in localStorage for persistence
    localStorage.setItem('language', newLang);
    toast({
      description: `Dil ${newLang === 'tr' ? 'Türkçe' : 'İngilizce'} olarak değiştirildi`,
    });
  };

  // Direct to main chat interface - no auth screens

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
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
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

      {/* Settings Modal */}
    <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
      <DialogContent className="bg-black border border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-500" />
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