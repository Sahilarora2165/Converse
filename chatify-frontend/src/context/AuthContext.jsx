/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi, logout as logoutApi, register as registerApi } from '../api/auth';
import { getCurrentUser } from '../api/users';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const logout = useCallback(async (showToast = true) => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      if (showToast) {
        toast.success('Logged out successfully');
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          // Verify token by fetching current user
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          localStorage.setItem('user', JSON.stringify(currentUser));
        } catch (error) {
          console.error('Token validation failed:', error);
          // Clear localStorage and state without showing toast
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await loginApi({ email, password });
      const { accessToken, refreshToken, username, email: userEmail } = response;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Add a small delay to ensure token is available for axios interceptor
      await new Promise(resolve => setTimeout(resolve, 50));

      // Fetch full user details with fallback to login response data
      let currentUser;
      try {
        currentUser = await getCurrentUser();
      } catch (fetchError) {
        console.error('Failed to fetch user details, using login response data:', fetchError);
        // Fallback to basic user data from login response
        currentUser = { username, email: userEmail };
      }
      
      localStorage.setItem('user', JSON.stringify(currentUser));
      
      setUser(currentUser);
      setIsAuthenticated(true);
      toast.success(`Welcome back, ${username}!`);
      return { success: true };
    } catch (error) {
      const errorData = error.response?.data;
      let message;
      if (typeof errorData === 'string') {
        message = errorData;
      } else if (errorData?.message) {
        message = errorData.message;
      } else if (errorData?.error) {
        message = errorData.error;
      } else {
        message = 'Login failed. Please try again.';
      }
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (username, email, password) => {
    try {
      await registerApi({ username, email, password });
      toast.success('Registration successful! Please login.');
      return { success: true };
    } catch (error) {
      const errorData = error.response?.data;
      const message = typeof errorData === 'string' 
        ? errorData 
        : errorData?.message || 'Registration failed. Please try again.';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
