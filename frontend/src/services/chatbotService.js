import api from './api';

export const chatbotService = {
  sendMessage: (message) => api.post('/chatbot/message', { message }).then((r) => r.data)
};
