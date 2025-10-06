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
import { MessageCircle, Plus, Trash2, Send, Bot, User, Settings, Moon, Sun, Globe, Bell, Upload, Paperclip, FileText, ChevronDown, Crown, Zap, Image, Camera } from 'lucide-react';
import MathRenderer from './components/MathRenderer';
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Backend API URL - Frontend artık backend'e bağlanacak
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  // Separate conversation states for each tab - Safe initialization
  const [normalMessages, setNormalMessages] = useState([]); // Safe empty array
  const [modesMessages, setModesMessages] = useState([]); // Safe empty array
  
  // Normal chat conversations (separate from modes) - Safe initialization  
  const [normalConversations, setNormalConversations] = useState([]);
  const [currentNormalConversation, setCurrentNormalConversation] = useState(null);
  
  // Modes chat conversations (separate from normal) - Safe initialization
  const [modesConversations, setModesConversations] = useState([]);
  const [currentModesConversation, setCurrentModesConversation] = useState(null);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
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
  
  // File upload states
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Version selection states
  const [selectedVersion, setSelectedVersion] = useState('pro'); // 'pro' or 'free'
  
  // Auto-scroll ref
  const messagesEndRef = useRef(null);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load settings and conversations from localStorage on component mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    const savedTheme = localStorage.getItem('theme');
    const savedNotifications = localStorage.getItem('notifications');
    const savedNormalConversations = localStorage.getItem('bilgin-normal-conversations');
    const savedModesConversations = localStorage.getItem('bilgin-modes-conversations');

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

    // Load conversations
    if (savedNormalConversations) {
      try {
        const conversations = JSON.parse(savedNormalConversations);
        setNormalConversations(conversations);
      } catch (error) {
        console.error('Error loading normal conversations:', error);
      }
    }

    if (savedModesConversations) {
      try {
        const conversations = JSON.parse(savedModesConversations);
        setModesConversations(conversations);
      } catch (error) {
        console.error('Error loading modes conversations:', error);
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('bilgin-normal-conversations', JSON.stringify(normalConversations));
  }, [normalConversations]);

  useEffect(() => {
    localStorage.setItem('bilgin-modes-conversations', JSON.stringify(modesConversations));
  }, [modesConversations]);

  // Auto-scroll to bottom when messages change - smooth streaming behavior
  useEffect(() => {
    const hasStreamingMessage = [...normalMessages, ...modesMessages].some(msg => msg.streaming);
    
    if (hasStreamingMessage) {
      // During streaming, scroll immediately and smoothly to follow content
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      // When not streaming, normal scroll with slight delay
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [normalMessages, modesMessages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isVersionDropdownOpen && !event.target.closest('.version-dropdown')) {
        setIsVersionDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVersionDropdownOpen]);

  // Helper function to generate conversation title from first message
  const generateConversationTitle = (message) => {
    if (message.length <= 50) return message;
    return message.substring(0, 50) + '...';
  };

  // File upload functions
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = () => {
    imageInputRef.current?.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Dosya çok büyük",
        description: "Maksimum dosya boyutu 10MB'dir.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    const allowedTypes = ['pdf', 'xlsx', 'xls', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Desteklenmeyen dosya türü",
        description: `Desteklenen formatlar: ${allowedTypes.join(', ').toUpperCase()}`,
        variant: "destructive",
      });
      return;
    }

    // Get current conversation ID
    let conversationId;
    if (activeTab === 'normal') {
      if (!currentNormalConversation) {
        // Create new conversation if none exists
        await createNewNormalConversation();
      }
      conversationId = currentNormalConversation?.id;
    } else {
      if (!currentModesConversation) {
        // Create new conversation if none exists
        await createNewModesConversation();
      }
      conversationId = currentModesConversation?.id;
    }

    if (!conversationId) {
      toast({
        title: "Hata",
        description: "Konuşma oluşturulamadı.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Dosya yükleme başarısız');
      }

      const result = await response.json();
      
      // Add uploaded file to state for display in chat
      const uploadedFile = {
        id: result.file_id || Date.now().toString(),
        name: file.name,
        type: fileExtension,
        size: file.size,
        url: result.file_url || URL.createObjectURL(file),
        uploadedAt: new Date().toISOString()
      };
      
      setUploadedFiles(prev => [...prev, uploadedFile]);

      toast({
        title: "Dosya yüklendi!",
        description: `${file.name} başarıyla yüklendi. Şimdi bu dosya hakkında soru sorabilirsiniz.`,
      });

      // Clear file input
      event.target.value = '';
      
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Yükleme hatası",
        description: error.message || "Dosya yüklenirken hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Create new conversation functions
  const createNewNormalConversation = async () => {
    try {
      // Call backend to create conversation
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: 'Yeni Sohbet'
        })
      });

      if (response.ok) {
        const newConversation = await response.json();
        console.log('Created new normal conversation:', newConversation);
        
        // Add to local state
        setNormalConversations(prev => [newConversation, ...prev]);
        setCurrentNormalConversation(newConversation);
        setNormalMessages([]);
        // Clear uploaded files for new conversation
        setUploadedFiles([]);
      } else {
        console.error('Failed to create conversation:', response.status);
        // Fallback to local conversation
        const newConversation = {
          id: Date.now().toString(),
          title: 'Yeni Sohbet',
          messages: [],
          createdAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString()
        };
        
        setNormalConversations(prev => [newConversation, ...prev]);
        setCurrentNormalConversation(newConversation);
        setNormalMessages([]);
        // Clear uploaded files for new conversation
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      // Fallback to local conversation
      const newConversation = {
        id: Date.now().toString(),
        title: 'Yeni Sohbet',
        messages: [],
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      };
      
      setNormalConversations(prev => [newConversation, ...prev]);
      setCurrentNormalConversation(newConversation);
      setNormalMessages([]);
      // Clear uploaded files for new conversation
      setUploadedFiles([]);
    }
  };

  const createNewModesConversation = async () => {
    try {
      // Call backend to create conversation
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: 'Yeni Mod Sohbeti'
        })
      });

      if (response.ok) {
        const newConversation = await response.json();
        console.log('Created new modes conversation:', newConversation);
        
        // Add mode info and add to local state
        newConversation.mode = selectedMode;
        setModesConversations(prev => [newConversation, ...prev]);
        setCurrentModesConversation(newConversation);
        setModesMessages([]);
        // Clear uploaded files for new conversation
        setUploadedFiles([]);
      } else {
        console.error('Failed to create modes conversation:', response.status);
        // Fallback to local conversation
        const newConversation = {
          id: Date.now().toString(),
          title: 'Yeni Mod Sohbeti',
          messages: [],
          mode: selectedMode,
          createdAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString()
        };
        
        setModesConversations(prev => [newConversation, ...prev]);
        setCurrentModesConversation(newConversation);
        setModesMessages([]);
        // Clear uploaded files for new conversation
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Error creating modes conversation:', error);
      // Fallback to local conversation
      const newConversation = {
        id: Date.now().toString(),
        title: 'Yeni Mod Sohbeti',
        messages: [],
        mode: selectedMode,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      };
      
      setModesConversations(prev => [newConversation, ...prev]);
      setCurrentModesConversation(newConversation);
      setModesMessages([]);
      // Clear uploaded files for new conversation
      setUploadedFiles([]);
    }
  };

  // Select conversation functions
  const selectNormalConversation = async (conversation) => {
    try {
      console.log('Selecting normal conversation:', conversation);
      if (!conversation) {
        console.error('Conversation is null or undefined');
        return;
      }
      
      setCurrentNormalConversation(conversation);
      
      // Clear uploaded files when switching conversations
      setUploadedFiles([]);
      
      // Load messages from backend
      const response = await fetch(`${BACKEND_URL}/api/conversations/${conversation.id}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const messages = await response.json();
        console.log(`Loaded ${messages.length} messages from backend`);
        setNormalMessages(messages || []);
      } else {
        console.error('Failed to load messages from backend');
        setNormalMessages([]);
      }
    } catch (error) {
      console.error('Error selecting normal conversation:', error);
      setNormalMessages([]);
    }
  };

  const selectModesConversation = async (conversation) => {
    try {
      console.log('Selecting modes conversation:', conversation);
      if (!conversation) {
        console.error('Conversation is null or undefined');
        return;
      }
      
      setCurrentModesConversation(conversation);
      
      // Clear uploaded files when switching conversations
      setUploadedFiles([]);
      
      // Load messages from backend
      const response = await fetch(`${BACKEND_URL}/api/conversations/${conversation.id}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const messages = await response.json();
        console.log(`Loaded ${messages.length} messages from backend`);
        setModesMessages(messages || []);
      } else {
        console.error('Failed to load messages from backend');
        setModesMessages([]);
      }
      
      if (conversation.mode) {
        setSelectedMode(conversation.mode);
      }
    } catch (error) {
      console.error('Error selecting modes conversation:', error);
      setModesMessages([]);
    }
  };

  // Delete conversation functions  
  const deleteNormalConversation = (conversationId) => {
    setNormalConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentNormalConversation?.id === conversationId) {
      setCurrentNormalConversation(null);
      setNormalMessages([]);
    }
  };

  const deleteModesConversation = (conversationId) => {
    setModesConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentModesConversation?.id === conversationId) {
      setCurrentModesConversation(null);
      setModesMessages([]);
    }
  };

  // Update conversation with new messages - with validation
  const updateConversationMessages = (messages) => {
    // Validate messages array
    if (!Array.isArray(messages)) {
      console.warn('updateConversationMessages called with non-array:', messages);
      return;
    }
    
    // Filter and validate messages
    const validMessages = messages.filter(msg => 
      msg && 
      typeof msg === 'object' && 
      msg.role && 
      msg.content && 
      msg.id && 
      msg.timestamp
    );
    
    if (validMessages.length !== messages.length) {
      console.warn(`Filtered out ${messages.length - validMessages.length} invalid messages`);
    }
    
    if (activeTab === 'normal' && currentNormalConversation) {
      const updatedConversation = {
        ...currentNormalConversation,
        messages: validMessages,
        lastMessageAt: new Date().toISOString()
      };
      
      // Update title if this is the first user message
      if (validMessages.length === 1 && validMessages[0].role === 'user') {
        updatedConversation.title = generateConversationTitle(validMessages[0].content);
      }
      
      setCurrentNormalConversation(updatedConversation);
      setNormalConversations(prev => 
        Array.isArray(prev) ? prev.map(c => c.id === updatedConversation.id ? updatedConversation : c) : []
      );
    } else if (activeTab === 'modes' && currentModesConversation) {
      const updatedConversation = {
        ...currentModesConversation,
        messages: validMessages,
        mode: selectedMode,
        lastMessageAt: new Date().toISOString()
      };
      
      // Update title if this is the first user message
      if (validMessages.length === 1 && validMessages[0].role === 'user') {
        updatedConversation.title = generateConversationTitle(validMessages[0].content);
      }
      
      setCurrentModesConversation(updatedConversation);
      setModesConversations(prev => 
        Array.isArray(prev) ? prev.map(c => c.id === updatedConversation.id ? updatedConversation : c) : []
      );
    }
  };

  // No backend functions - remove all API dependencies
  const createNewConversation = () => {
    if (activeTab === 'normal') {
      createNewNormalConversation();
    } else {
      createNewModesConversation();
    }
  };

  const selectConversation = (conversation) => {
    if (activeTab === 'normal') {
      selectNormalConversation(conversation);
    } else {
      selectModesConversation(conversation);
    }
  };

  const deleteConversation = (conversationId) => {
    if (activeTab === 'normal') {
      deleteNormalConversation(conversationId);
    } else {
      deleteModesConversation(conversationId);
    }
  };

  // Get current messages and conversations with safe defaults
  const getCurrentMessages = () => {
    const messages = activeTab === 'normal' ? normalMessages : modesMessages;
    // Always return array, never undefined
    const result = Array.isArray(messages) ? messages : [];
    console.log(`getCurrentMessages for ${activeTab} tab: ${result.length} messages`);
    return result;
  };

  const getCurrentConversations = () => {
    const conversations = activeTab === 'normal' ? normalConversations : modesConversations;
    // Always return array, never undefined
    return Array.isArray(conversations) ? conversations : [];
  };

  const getCurrentConversation = () => {
    return activeTab === 'normal' ? currentNormalConversation : currentModesConversation;
  };

  const setCurrentMessages = (messages) => {
    // Ensure messages is always an array and filter invalid ones
    const messagesArray = Array.isArray(messages) ? messages : [];
    
    console.log('setCurrentMessages called with:', messagesArray);
    
    const validMessages = messagesArray.filter(msg => {
      const isValid = msg && typeof msg === 'object' && msg.role && msg.content && msg.id;
      if (!isValid) {
        console.warn('Invalid message filtered out:', msg);
      }
      return isValid;
    });
      
    console.log(`Setting ${validMessages.length} valid messages out of ${messagesArray.length} total`);
    
    if (activeTab === 'normal') {
      setNormalMessages(validMessages);
    } else {
      setModesMessages(validMessages);
    }
    
    // Update the conversation with new messages
    updateConversationMessages(validMessages);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isMessageLoading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsMessageLoading(true);

    // Determine conversation ID
    let conversationId;
    
    if (activeTab === 'normal') {
      if (!currentNormalConversation) {
        // Create new conversation if none exists
        try {
          const response = await fetch(`${BACKEND_URL}/api/conversations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              title: 'Yeni Sohbet'
            })
          });

          if (response.ok) {
            const newConversation = await response.json();
            console.log('Created new normal conversation:', newConversation);
            
            // Add to local state
            setNormalConversations(prev => [newConversation, ...prev]);
            setCurrentNormalConversation(newConversation);
            setNormalMessages([]);
            setUploadedFiles([]);
            conversationId = newConversation.id;
          } else {
            console.error('Failed to create conversation:', response.status);
            setIsMessageLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error creating conversation:', error);
          setIsMessageLoading(false);
          return;
        }
      } else {
        conversationId = currentNormalConversation.id;
      }
    } else {
      if (!currentModesConversation) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/conversations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              title: 'Yeni Mod Sohbeti'
            })
          });

          if (response.ok) {
            const newConversation = await response.json();
            console.log('Created new modes conversation:', newConversation);
            
            // Add to local state
            setModesConversations(prev => [newConversation, ...prev]);
            setCurrentModesConversation(newConversation);
            setModesMessages([]);
            setUploadedFiles([]);
            conversationId = newConversation.id;
          } else {
            console.error('Failed to create modes conversation:', response.status);
            setIsMessageLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error creating modes conversation:', error);
          setIsMessageLoading(false);
          return;
        }
      } else {
        conversationId = currentModesConversation.id;
      }
    }

    if (!conversationId) {
      console.error('No conversation ID available');
      setIsMessageLoading(false);
      return;
    }

    // Add user message to appropriate state
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    if (activeTab === 'normal') {
      setNormalMessages(prev => {
        console.log('Adding user message to normal messages. Current count:', prev.length);
        return [...(Array.isArray(prev) ? prev : []), userMessage];
      });
    } else {
      setModesMessages(prev => {
        console.log('Adding user message to modes messages. Current count:', prev.length);
        return [...(Array.isArray(prev) ? prev : []), userMessage];
      });
    }

    try {
      const payload = {
        content: messageText,
        conversationMode: activeTab === 'modes' ? selectedMode : 'normal',
        version: selectedVersion
      };

      console.log('Starting streaming request with payload:', payload);

      // Create AbortController for cancelling request
      const controller = new AbortController();
      setAbortController(controller);

      // Use streaming endpoint
      const response = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create initial bot message
      const botMessageId = (Date.now() + 1).toString();
      const botMessage = {
        id: botMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        streaming: true
      };

      // Add initial empty bot message
      if (activeTab === 'normal') {
        setNormalMessages(prev => [...prev, botMessage]);
      } else {
        setModesMessages(prev => [...prev, botMessage]);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'thinking') {
                // Update message with thinking indicator and hide loading
                const updateMessage = (prev) => prev.map(msg => 
                  msg.id === botMessageId 
                    ? { ...msg, content: data.content, streaming: true }
                    : msg
                );
                
                if (activeTab === 'normal') {
                  setNormalMessages(updateMessage);
                } else {
                  setModesMessages(updateMessage);
                }
                
                // Hide the loading indicator when thinking message arrives
                setIsMessageLoading(false);
              } else if (data.type === 'chunk') {
                // Update message with streaming content
                const updateMessage = (prev) => prev.map(msg => 
                  msg.id === botMessageId 
                    ? { ...msg, content: data.full_content, streaming: true }
                    : msg
                );
                
                if (activeTab === 'normal') {
                  setNormalMessages(updateMessage);
                } else {
                  setModesMessages(updateMessage);
                }
              } else if (data.type === 'complete') {
                // Finalize message
                const updateMessage = (prev) => prev.map(msg => 
                  msg.id === botMessageId 
                    ? { ...msg, content: data.content, streaming: false }
                    : msg
                );
                
                if (activeTab === 'normal') {
                  setNormalMessages(updateMessage);
                } else {
                  setModesMessages(updateMessage);
                }
                
                // Stop loading indicator when streaming completes
                setIsMessageLoading(false);
                
                // Scroll to bottom after completion
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 200);
              } else if (data.type === 'error') {
                // Handle error
                const updateMessage = (prev) => prev.map(msg => 
                  msg.id === botMessageId 
                    ? { ...msg, content: data.content, streaming: false }
                    : msg
                );
                
                if (activeTab === 'normal') {
                  setNormalMessages(updateMessage);
                } else {
                  setModesMessages(updateMessage);
                }
                
                // Stop loading indicator on error
                setIsMessageLoading(false);
              }
            } catch (error) {
              console.error('Error parsing streaming data:', error);
            }
          }
        }
      }
      
      // Clear uploaded files after successful message send
      setUploadedFiles([]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Bağlantı sorunu: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      if (activeTab === 'normal') {
        setNormalMessages(prev => [...prev, errorMessage]);
      } else {
        setModesMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsMessageLoading(false);
      setAbortController(null);
    }
  };

  const stopMessage = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsMessageLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isMessageLoading) {
        sendMessage();
      }
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
      <div className={`bg-black text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden flex flex-col border-r border-gray-800`}>
        {/* Header - Vertical Tab System */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">BİLGİN</h1>
            <Button
              onClick={() => setSidebarOpen(false)}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-900"
            >
              ←
            </Button>
          </div>
          
          {/* New Chat Button - Like in the reference image */}
          <div className="mb-4">
            <button
              onClick={() => {
                if (activeTab === 'normal') {
                  createNewNormalConversation();
                } else {
                  createNewModesConversation();
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-all duration-200"
            >
              <div className="w-4 h-4 border-2 border-white rounded-sm flex items-center justify-center">
                <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </div>

          {/* Tab Navigation - Simplified */}
          <div className="space-y-1 mb-4">
            <button
              onClick={() => setActiveTab('normal')}
              className={`w-full p-2 rounded text-left text-sm transition-all duration-200 ${
                activeTab === 'normal' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Normal Sohbet
            </button>
            
            <button
              onClick={() => setActiveTab('modes')}
              className={`w-full p-2 rounded text-left text-sm transition-all duration-200 ${
                activeTab === 'modes' 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Konuşma Modları
            </button>
          </div>
        </div>

        {/* Content Area - Beautiful Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'normal' ? (
            /* Normal Sohbet Content - Chat History */
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">Normal Sohbet</h3>
                  <Button
                    onClick={createNewNormalConversation}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Yeni
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Standart BİLGİN - mod olmadan</p>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {normalConversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="text-gray-400 mb-3">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Henüz sohbet yok</p>
                      <p className="text-xs opacity-75">Yeni sohbet başlatın</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {normalConversations
                      .sort((a, b) => {
                        try {
                          const dateA = new Date(a.lastMessageAt);
                          const dateB = new Date(b.lastMessageAt);
                          return dateB - dateA;
                        } catch (error) {
                          console.error('Sorting error in normal conversations:', error);
                          return 0;
                        }
                      })
                      .map((conversation) => (
                        <div
                          key={conversation.id}
                          onClick={() => selectNormalConversation(conversation)}
                          className={`p-2 rounded cursor-pointer group transition-colors ${
                            currentNormalConversation?.id === conversation.id
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{conversation.title}</p>
                              <p className="text-xs opacity-75">
                                {(() => {
                                  try {
                                    return new Date(conversation.lastMessageAt).toLocaleDateString('tr-TR', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  } catch (error) {
                                    console.error('Date formatting error:', error);
                                    return 'Tarih yok';
                                  }
                                })()}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNormalConversation(conversation.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 hover:bg-gray-700 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Konuşma Modları Content */
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">Konuşma Modları</h3>
                  <Button
                    onClick={createNewModesConversation}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Yeni
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-1">6 farklı konuşma tarzı</p>
              </div>

              {/* Mode Selection */}
              <div className="p-3 border-b border-gray-700">
                <p className="text-xs text-gray-400 mb-3">Konuşma tarzını seç:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(conversationModes).filter(([key]) => key !== 'normal').map(([key, mode]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedMode(key)}
                      className={`p-2 rounded-lg text-left transition-all duration-200 text-xs ${
                        selectedMode === key 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${mode.color}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{mode.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {modesConversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="text-gray-400 mb-3">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Henüz mod sohbeti yok</p>
                      <p className="text-xs opacity-75">Yeni sohbet başlatın</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {modesConversations
                      .sort((a, b) => {
                        try {
                          const dateA = new Date(a.lastMessageAt);
                          const dateB = new Date(b.lastMessageAt);
                          return dateB - dateA;
                        } catch (error) {
                          console.error('Sorting error in modes conversations:', error);
                          return 0;
                        }
                      })
                      .map((conversation) => (
                        <div
                          key={conversation.id}
                          onClick={() => selectModesConversation(conversation)}
                          className={`p-2 rounded cursor-pointer group transition-colors ${
                            currentModesConversation?.id === conversation.id
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{conversation.title}</p>
                              <p className="text-xs opacity-75">
                                {(() => {
                                  try {
                                    return new Date(conversation.lastMessageAt).toLocaleDateString('tr-TR', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  } catch (error) {
                                    console.error('Date formatting error:', error);
                                    return 'Tarih yok';
                                  }
                                })()}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteModesConversation(conversation.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 hover:bg-gray-700 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
                    AI Asistan
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

        {getCurrentConversation() ? (
          <>
            {/* Chat Header */}
            <div className="bg-black border-b border-gray-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{getCurrentConversation().title}</h2>
                
                {/* Version Selection Dropdown */}
                <div className="relative version-dropdown">
                  <button
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    {selectedVersion === 'pro' ? (
                      <>
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">ATA V1 (PRO)</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">ATA V1 (FREE)</span>
                      </>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isVersionDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isVersionDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={() => {
                          setSelectedVersion('pro');
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors ${
                          selectedVersion === 'pro' ? 'bg-gray-700' : ''
                        }`}
                      >
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">ATA V1 (PRO)</div>
                          <div className="text-xs text-gray-400">Tüm özellikler aktif</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVersion('free');
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors rounded-b-lg ${
                          selectedVersion === 'free' ? 'bg-gray-700' : ''
                        }`}
                      >
                        <Zap className="w-4 h-4 text-blue-400" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">ATA V1 (FREE)</div>
                          <div className="text-xs text-gray-400"></div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dosya listesi kaldırıldı - sadece chat mesajlarında gösterilecek */}

            {/* Messages Area - Clean Document Style */}
            <ScrollArea className="flex-1" style={{background: '#3b3b3b'}}>
              <main className="document-container">
                {(() => {
                  const messages = getCurrentMessages();
                  return Array.isArray(messages) && messages.length > 0 ? (
                    messages
                      .filter(message => message && message.role && message.content) // Null/undefined messages'ları filtrele
                      .map((message) => (
                        <div
                          key={message.id || `msg-${Math.random()}`}
                          className="document-message"
                        >
                          {/* User questions as headings */}
                          {message.role === 'user' && (
                            <h2 className="user-question">{message.content}</h2>
                          )}
                          
                          {/* Bot responses as document content */}
                          {message.role === 'assistant' && (
                            <div className="bot-response">
                              <MathRenderer content={message.content || ''} />
                            </div>
                          )}
                          
                          {/* Show uploaded files for user messages */}
                          {message.role === 'user' && uploadedFiles.length > 0 && (
                            <div className="uploaded-files">
                              {uploadedFiles.map((file) => (
                                <div key={file.id} className="file-attachment">
                                  {file.type && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.type) ? (
                                    <img 
                                      src={file.url} 
                                      alt={file.name}
                                      className="uploaded-image"
                                      onClick={() => {
                                        setSelectedImage(file.url);
                                        setShowImageModal(true);
                                      }}
                                    />
                                  ) : (
                                    <div className="uploaded-document">
                                      <span className="text-2xl">📄</span>
                                      <span className="document-name">{file.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                  ) : null;
                })()}
                {isMessageLoading && (
                  <div className="loading-indicator">
                    <p className="loading-text">BİLGİN düşünüyor...</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </main>
            </ScrollArea>

            {/* Uploaded Files Display */}
            {uploadedFiles.length > 0 && (
              <div className="bg-black border-t border-gray-900 px-4 py-2">
                <div className="max-w-4xl mx-auto">
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center space-x-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                        {file.type && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.type) ? (
                          <div className="flex items-center space-x-2">
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                            <div>
                              <p className="text-xs font-medium text-white truncate max-w-24">{file.name}</p>
                              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-bold">📄</span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white truncate max-w-24">{file.name}</p>
                              <p className="text-xs text-gray-400">{file.type?.toUpperCase()}</p>
                            </div>
                          </div>
                        )}
                        <Button
                          onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 text-gray-400 hover:text-white p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="bg-black border-t border-gray-900 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end space-x-3 bg-gray-900 rounded-2xl p-3 border border-gray-900">
                  <Button
                    onClick={handleFileSelect}
                    disabled={isUploading}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                    title="Dosya ekle (PDF, Word, Excel, TXT)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleImageSelect}
                    disabled={isUploading}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                    title="Görsel ekle (JPG, PNG, GIF, WebP)"
                  >
                    <Image className="w-4 h-4" />
                  </Button>
                  <textarea
                    value={inputMessage}
                    onKeyPress={handleKeyPress}
                    placeholder="Her şeyi sorabilirsin."
                    className="flex-1 border-0 bg-transparent focus:ring-0 text-white placeholder-gray-500 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
                    disabled={isMessageLoading}
                    rows={1}
                    style={{
                      height: 'auto',
                      minHeight: '40px',
                      maxHeight: '120px'
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      // Reset height if content is deleted
                      if (e.target.value === '') {
                        e.target.style.height = '40px';
                      }
                    }}
                  />
                  <Button
                    onClick={isMessageLoading ? stopMessage : sendMessage}
                    disabled={!isMessageLoading && !inputMessage.trim()}
                    className={`${isMessageLoading ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'} text-white rounded-xl`}
                    size="sm"
                  >
                    {isMessageLoading ? (
                      <span className="text-xs font-medium">Durdur</span>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="text-xs text-gray-500 text-center mt-2">
                  BİLGİN AI öneriler üretir. Lütfen verilen bilgileri bağımsız kaynaklardan kontrol etmeyi unutmayın.
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Direct Chat - Always show chat interface */
          <div className="flex-1 flex flex-col bg-black">
            {/* Chat Header */}
            <div className="bg-black border-b border-gray-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {activeTab === 'normal' 
                    ? 'Normal Sohbet' 
                    : `${conversationModes[selectedMode]?.name || 'Normal'} Modu`
                  }
                </h2>
                
                {/* Version Selection Dropdown */}
                <div className="relative version-dropdown">
                  <button
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    {selectedVersion === 'pro' ? (
                      <>
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">ATA V1 (PRO)</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">ATA V1 (FREE)</span>
                      </>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isVersionDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isVersionDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={() => {
                          setSelectedVersion('pro');
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors ${
                          selectedVersion === 'pro' ? 'bg-gray-700' : ''
                        }`}
                      >
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">ATA V1 (PRO)</div>
                          <div className="text-xs text-gray-400">Tüm özellikler aktif</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVersion('free');
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors rounded-b-lg ${
                          selectedVersion === 'free' ? 'bg-gray-700' : ''
                        }`}
                      >
                        <Zap className="w-4 h-4 text-blue-400" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">ATA V1 (FREE)</div>
                          <div className="text-xs text-gray-400"></div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dosya listesi kaldırıldı - sadece chat mesajlarında gösterilecek */}

            {/* Messages Area - Clean Document Style */}
            <div className="flex-1 overflow-y-auto" style={{background: '#3b3b3b'}}>
              <main className="document-container">
                {getCurrentMessages().length === 0 && (
                  <div className="empty-state">
                    <h1>Merhaba! Ne öğrenmek istersin?</h1>
                    <p>
                      {activeTab === 'normal' 
                        ? 'BİLGİN ile sohbet edebilirsiniz.'
                        : `${conversationModes[selectedMode]?.name} modunda matematik sorularınızı yanıtlıyorum.`
                      }
                    </p>
                  </div>
                )}

                {(() => {
                  const messages = getCurrentMessages();
                  return Array.isArray(messages) && messages.length > 0 ? (
                    messages
                      .filter(message => message && message.role && message.content) // Null/undefined messages'ları filtrele
                      .map((message) => (
                        <div
                          key={message.id || `msg-${Math.random()}`}
                          className="document-message"
                        >
                          {/* User questions as headings */}
                          {message.role === 'user' && (
                            <>
                              <h2 className="user-question">{message.content}</h2>
                              {/* Show uploaded files for user messages */}
                              {uploadedFiles.length > 0 && (
                                <div className="uploaded-files">
                                  {uploadedFiles.map((file) => (
                                    <div key={file.id} className="file-attachment">
                                      {file.type && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.type) ? (
                                        <img 
                                          src={file.url} 
                                          alt={file.name}
                                          className="uploaded-image"
                                          onClick={() => {
                                            setSelectedImage(file.url);
                                            setShowImageModal(true);
                                          }}
                                        />
                                      ) : (
                                        <div className="uploaded-document">
                                          <span className="text-2xl">📄</span>
                                          <span className="document-name">{file.name}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          
                          {/* Bot responses as document content */}
                          {message.role === 'assistant' && (
                            <div className="bot-response">
                              <MathRenderer content={message.content || ''} />
                            </div>
                          )}
                          </div>
                        </div>
                      ))
                  ) : null;
                })()}
                
                {isMessageLoading && (
                  <div className="loading-indicator">
                    <p className="loading-text">BİLGİN düşünüyor...</p>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </main>
            </div>

            {/* Uploaded Files Display */}
            {uploadedFiles.length > 0 && (
              <div className="bg-black border-t border-gray-900 px-4 py-2">
                <div className="max-w-4xl mx-auto">
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center space-x-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                        {file.type && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.type) ? (
                          <div className="flex items-center space-x-2">
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                            <div>
                              <p className="text-xs font-medium text-white truncate max-w-24">{file.name}</p>
                              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-bold">📄</span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white truncate max-w-24">{file.name}</p>
                              <p className="text-xs text-gray-400">{file.type?.toUpperCase()}</p>
                            </div>
                          </div>
                        )}
                        <Button
                          onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 text-gray-400 hover:text-white p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="bg-black border-t border-gray-900 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end space-x-3 bg-gray-900 rounded-2xl p-3 border border-gray-900">
                  <Button
                    onClick={handleFileSelect}
                    disabled={isUploading}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                    title="Dosya ekle (PDF, Word, Excel, TXT)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleImageSelect}
                    disabled={isUploading}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                    title="Görsel ekle (JPG, PNG, GIF, WebP)"
                  >
                    <Image className="w-4 h-4" />
                  </Button>
                  <textarea
                    value={inputMessage}
                    onKeyPress={handleKeyPress}
                    placeholder="Her şeyi sorabilirsin."
                    className="flex-1 border-0 bg-transparent focus:ring-0 text-white placeholder-gray-500 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
                    disabled={isMessageLoading}
                    rows={1}
                    style={{
                      height: 'auto',
                      minHeight: '40px',
                      maxHeight: '120px'
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      // Reset height if content is deleted
                      if (e.target.value === '') {
                        e.target.style.height = '40px';
                      }
                    }}
                  />
                  <Button
                    onClick={isMessageLoading ? stopMessage : sendMessage}
                    disabled={!isMessageLoading && !inputMessage.trim()}
                    className={`${isMessageLoading ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl`}
                    size="sm"
                  >
                    {isMessageLoading ? (
                      <span className="text-xs font-medium">Durdur</span>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="text-xs text-gray-500 text-center mt-2">
                  BİLGİN AI öneriler üretir. Lütfen verilen bilgileri bağımsız kaynaklardan kontrol etmeyi unutmayın.
                </div>
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

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={selectedImage}
              alt="Büyütülen resim"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
            >
              ×
            </button>
          </div>
        </div>
      )}
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