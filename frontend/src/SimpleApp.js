import React, { useState } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Send, Bot, User } from 'lucide-react';
import MathRenderer from './components/MathRenderer';
import axios from 'axios';

const ANYTHINGLLM_API_URL = "https://pilj1jbx.rcsrv.com/api/v1/workspace/bilgin/chat";
const ANYTHINGLLM_API_KEY = "FC6CT8Q-QRE433A-J9K8SV8-S7E2M4N";

function SimpleApp() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState('normal');

  // Conversation modes
  const conversationModes = {
    normal: { name: "Normal", description: "Standart BİLGİN", color: "bg-blue-500" },
    friend: { name: "Arkadaş Canlısı", description: "Samimi, motive, esprili", color: "bg-green-500" },
    realistic: { name: "Gerçekci", description: "Eleştirel, kanıt odaklı", color: "bg-yellow-500" },
    coach: { name: "Koç", description: "Soru sorarak düşündürür", color: "bg-purple-500" },
    lawyer: { name: "Avukat", description: "Karşı argüman üretir", color: "bg-red-500" },
    teacher: { name: "Öğretmen", description: "Adım adım öğretir", color: "bg-indigo-500" },
    minimalist: { name: "Minimalist", description: "Kısa, madde işaretli", color: "bg-gray-500" }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Add mode prefix to message
      let finalMessage = inputMessage;
      if (selectedMode !== 'normal') {
        const modePrompts = {
          friend: "Lütfen samimi, motive edici ve esprili bir şekilde yanıtla. 3 küçük adım önerebilirsin. Arkadaş canlısı ol:",
          realistic: "Eleştirel ve kanıt odaklı düşün. Güçlü ve zayıf yönleri belirt. Test planı öner. Gerçekci ol:",
          coach: "Soru sorarak kullanıcının düşünmesini sağla. Hedef ve adım listesi çıkar. Koç gibi yaklaş:",
          lawyer: "Bilinçli karşı argüman üret. Kör noktaları göster. Avukat perspektifiyle yaklaş:",
          teacher: "Adım adım öğret. Örnek ver ve mini quiz ekle. Öğretmen gibi açıkla:",
          minimalist: "En kısa, madde işaretli, süssüz yanıt ver. Minimalist ol:"
        };
        if (modePrompts[selectedMode]) {
          finalMessage = `${modePrompts[selectedMode]} ${inputMessage}`;
        }
      }

      const response = await axios.post(ANYTHINGLLM_API_URL, {
        message: finalMessage,
        mode: "chat",
        sessionId: "bilgin-session"
      }, {
        headers: {
          'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const botMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.textResponse || 'Üzgünüm, bir sorun oluştu.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Üzgünüm, bağlantı sorunu yaşıyoruz. Lütfen tekrar deneyin.',
        timestamp: new Date()
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
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="w-80 bg-black border-r border-gray-800 p-4">
        <h1 className="text-xl font-bold mb-6">BİLGİN</h1>
        
        {/* Conversation Modes */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Konuşma Tarzını Seç</h3>
          
          {Object.entries(conversationModes).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => setSelectedMode(key)}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                selectedMode === key 
                  ? 'bg-gray-800 border border-gray-600' 
                  : 'bg-gray-900 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${mode.color}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{mode.name}</div>
                  <div className="text-xs text-gray-400 truncate">{mode.description}</div>
                </div>
                {selectedMode === key && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 p-3 bg-gray-900 rounded-lg border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Seçili Mod:</div>
          <div className="text-sm text-white font-medium">
            {conversationModes[selectedMode]?.name || 'Normal'}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-black border-b border-gray-900 p-4">
          <h2 className="text-lg font-semibold">
            {conversationModes[selectedMode]?.name} Sohbet
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <h3 className="text-2xl font-bold mb-4">Merhaba! Ne öğrenmek istersin?</h3>
              <p className="text-lg mb-4">
                {conversationModes[selectedMode]?.name} modunda matematik sorularınızı yanıtlıyorum.
              </p>
              <p className="text-sm text-gray-400">
                Matematik desteği: $x^2 + y^2 = r^2$ veya $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-4 ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-3xl p-4 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-white'
                }`}>
                  <MathRenderer content={message.content} />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {message.timestamp.toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-800 p-4 rounded-2xl">
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
        </div>

        {/* Input Area */}
        <div className="bg-black border-t border-gray-900 p-4">
          <div className="flex items-end space-x-3 bg-gray-900 rounded-2xl p-3">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`${conversationModes[selectedMode]?.name} modda matematik sorunuzu yazın...`}
              className="flex-1 border-0 bg-transparent focus:ring-0 text-white placeholder-gray-500"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">
            {conversationModes[selectedMode]?.name} modunda. LaTeX matematik desteği aktif: $x^2$, $$\\int$$
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleApp;