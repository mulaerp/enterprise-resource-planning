import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

interface PreloginImage {
  id: string;
  url: string;
  name: string;
}

interface PreloginData {
  phrase: string;
  images: PreloginImage[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, imageId?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  preloginImages: PreloginImage[];
  securityPhrase: string;
  loadPreloginData: (username: string) => Promise<void>;
  verifySecurityImage: (username: string, imageId: string) => Promise<boolean>;
  resetPassword: (username: string, email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preloginImages, setPreloginImages] = useState<PreloginImage[]>([]);
  const [securityPhrase, setSecurityPhrase] = useState('');

  useEffect(() => {
    // Check for stored auth on mount
    const storedUser = localStorage.getItem('erp-user');
    const storedToken = localStorage.getItem('erp-token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const loadPreloginData = async (username: string): Promise<void> => {
    try {
      const response = await fetch('/api/auth/cas/prelogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load prelogin data: ${response.statusText}`);
      }

      const data: PreloginData = await response.json();
      setPreloginImages(data.images || []);
      setSecurityPhrase(data.phrase || '');
    } catch (error) {
      console.error('Error loading prelogin data:', error);
      throw error;
    }
  };

  const verifySecurityImage = async (username: string, imageId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/cas/verify-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          imageId
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('Error verifying security image:', error);
      return false;
    }
  };

  const login = async (username: string, password: string, imageId?: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Demo authentication bypass - handle locally
      if (username === 'demo@demo.net' && password === 'demo') {
        const mockUser: User = {
          id: '1',
          username: 'demo',
          email: 'demo@demo.net',
          name: 'Demo User',
          role: 'administrator'
        };
        
        setUser(mockUser);
        localStorage.setItem('erp-user', JSON.stringify(mockUser));
        localStorage.setItem('erp-token', 'demo-token');
        setIsLoading(false);
        return true;
      }

      // For non-demo users, try API authentication
      let response;
      
      if (imageId) {
        // CAS authentication with image verification
        response = await fetch('/api/auth/cas/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
            imageId
          }),
        });
      } else {
        // Standard authentication
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: username, // Use email field for standard login
            password
          }),
        });
      }

      if (!response.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await response.json();
      
      if (data.token && data.user) {
        setUser(data.user);
        localStorage.setItem('erp-user', JSON.stringify(data.user));
        localStorage.setItem('erp-token', data.token);
        setIsLoading(false);
        return true;
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const resetPassword = async (username: string, email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/cas/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          email
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Password reset error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setPreloginImages([]);
    setSecurityPhrase('');
    localStorage.removeItem('erp-user');
    localStorage.removeItem('erp-token');
    
    // Clear configuration cache on logout
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('config-')) {
        localStorage.removeItem(key);
      }
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      isLoading,
      preloginImages,
      securityPhrase,
      loadPreloginData,
      verifySecurityImage,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};