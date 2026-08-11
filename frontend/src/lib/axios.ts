import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://opstack-backend.onrender.com/api';
  }
  return 'http://localhost:5000/api';
};

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject baseURL and JWT Token on every request
axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('token');
    
    if (token && token !== 'undefined' && token !== 'null' && token.trim() !== '') {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
      }
    } else if (token === 'undefined' || token === 'null') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 globally (logout user if token is expired/invalid)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[Auth]: Invalid or expired token. Clearing session.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
