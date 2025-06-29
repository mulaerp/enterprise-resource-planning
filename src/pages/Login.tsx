import React, { useState, useEffect } from 'react';
import { Monitor, Lock, Mail, Image, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../hooks/useConfig';

export default function Login() {
  const [email, setEmail] = useState('demo@demo.net');
  const [password, setPassword] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [imageVerified, setImageVerified] = useState(false);
  const [loadingPrelogin, setLoadingPrelogin] = useState(false);
  const [verifyingImage, setVerifyingImage] = useState(false);
  const [casPreloginFailed, setCasPreloginFailed] = useState(false);
  
  const { 
    login, 
    preloginImages,
    securityPhrase,
    loadPreloginData,
    verifySecurityImage,
    resetPassword 
  } = useAuth();

  const { config } = useConfig();
  const companyName = config?.companyName || 'MulaERP';

  const handleLoadPreloginData = async () => {
    if (!email || email.includes('demo')) {
      setError('Please enter a valid username/email first');
      return;
    }

    setLoadingPrelogin(true);
    setError('');
    setShowImageSelection(false);
    setImageVerified(false);
    setSelectedImageId('');
    setCasPreloginFailed(false);
    
    try {
      await loadPreloginData(email);
      setShowImageSelection(true);
    } catch (error) {
      setError('Failed to load security data. You can still proceed with password login.');
      setCasPreloginFailed(true);
    } finally {
      setLoadingPrelogin(false);
    }
  };

  const handleImageSelect = async (imageId: string) => {
    setSelectedImageId(imageId);
    setVerifyingImage(true);
    setError('');
    
    try {
      const isValid = await verifySecurityImage(email, imageId);
      if (isValid) {
        setImageVerified(true);
        setError('');
      } else {
        setError('Incorrect security image selected. Please try again.');
        setSelectedImageId('');
        setImageVerified(false);
      }
    } catch (error) {
      setError('Failed to verify security image. Please try again.');
      setSelectedImageId('');
      setImageVerified(false);
    } finally {
      setVerifyingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const success = await login(email, password, selectedImageId || undefined);
      if (!success) {
        setError('Invalid credentials. For demo access, use demo@demo.net / demo');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    setLoading(true);
    try {
      const success = await resetPassword(email, email);
      if (success) {
        setError('Password reset instructions have been sent to your email');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } catch (error) {
      setError('Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDemoMode = email.includes('demo');
  const canProceedToPassword = isDemoMode || imageVerified || casPreloginFailed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center items-center space-x-2 mb-4">
            <Monitor className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">{companyName}</h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700">Sign in to your account</h2>
          <p className="mt-2 text-gray-600">Open Source Enterprise Resource Planning</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
              <AlertCircle size={16} className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {isDemoMode ? 'Email Address' : 'Username/Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Reset verification state when email changes
                    setImageVerified(false);
                    setSelectedImageId('');
                    setShowImageSelection(false);
                    setCasPreloginFailed(false);
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your username/email"
                />
              </div>
            </div>

            {!isDemoMode && !showImageSelection && !casPreloginFailed && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleLoadPreloginData}
                  disabled={loadingPrelogin || !email}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPrelogin ? (
                    <RefreshCw className="animate-spin mr-2" size={16} />
                  ) : (
                    <Image className="mr-2" size={16} />
                  )}
                  Load Security Data
                </button>
              </div>
            )}

            {!isDemoMode && casPreloginFailed && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Security data could not be loaded. You can still proceed with password login.
                </p>
                <button
                  type="button"
                  onClick={handleLoadPreloginData}
                  disabled={loadingPrelogin}
                  className="mt-2 inline-flex items-center px-3 py-1 border border-yellow-300 rounded text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 disabled:opacity-50"
                >
                  {loadingPrelogin ? (
                    <RefreshCw className="animate-spin mr-1" size={12} />
                  ) : (
                    <RefreshCw className="mr-1" size={12} />
                  )}
                  Retry Loading Security Data
                </button>
              </div>
            )}

            {!isDemoMode && securityPhrase && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-1">Security Phrase:</p>
                <p className="text-sm text-blue-800">"{securityPhrase}"</p>
              </div>
            )}

            {!isDemoMode && showImageSelection && preloginImages.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Your Security Image
                  {imageVerified && (
                    <CheckCircle className="inline ml-2 text-green-600" size={16} />
                  )}
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {preloginImages.map((image) => (
                    <div
                      key={image.id}
                      onClick={() => !verifyingImage && handleImageSelect(image.id)}
                      className={`relative cursor-pointer border-2 rounded-lg p-1 transition-all ${
                        selectedImageId === image.id
                          ? imageVerified 
                            ? 'border-green-500 bg-green-50'
                            : 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${verifyingImage && selectedImageId === image.id ? 'opacity-50' : ''}`}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-12 object-cover rounded"
                      />
                      <p className="text-xs text-center mt-1 truncate">{image.name}</p>
                      {selectedImageId === image.id && verifyingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                          <RefreshCw className="animate-spin text-blue-600" size={16} />
                        </div>
                      )}
                      {selectedImageId === image.id && imageVerified && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="text-green-600" size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {imageVerified && (
                  <p className="text-sm text-green-600 mt-2 flex items-center">
                    <CheckCircle size={16} className="mr-1" />
                    Security image verified. You can now enter your password.
                  </p>
                )}
              </div>
            )}
            
            {canProceedToPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}
            
            {canProceedToPassword && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            )}

            {!isDemoMode && canProceedToPassword && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </form>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Demo Access</h3>
            <p className="text-sm text-blue-700">
              <strong>Email:</strong> demo@demo.net<br />
              <strong>Password:</strong> demo
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Use these credentials for demo access, or enter your CAS username above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}