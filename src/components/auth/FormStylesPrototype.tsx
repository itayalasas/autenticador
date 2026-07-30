import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Shield, Sparkles, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

type FormStyle = 'modern-glass' | 'minimal-clean' | 'corporate' | 'gradient-bold' | 'neumorphic';
type MessageStatus = 'idle' | 'loading' | 'success' | 'error';

export default function FormStylesPrototype() {
  const [activeStyle, setActiveStyle] = useState<FormStyle>('modern-glass');
  const [showPassword, setShowPassword] = useState(false);
  const [messageStatus, setMessageStatus] = useState<MessageStatus>('idle');
  const [messageText, setMessageText] = useState('');

  const styles: Record<FormStyle, { name: string; description: string }> = {
    'modern-glass': {
      name: 'Modern Glass',
      description: 'Efecto glassmorphism con blur y transparencias'
    },
    'minimal-clean': {
      name: 'Minimal Clean',
      description: 'Diseño minimalista con líneas limpias'
    },
    'corporate': {
      name: 'Corporate Professional',
      description: 'Estilo corporativo con sombras pronunciadas'
    },
    'gradient-bold': {
      name: 'Gradient Bold',
      description: 'Gradientes vibrantes con efectos modernos'
    },
    'neumorphic': {
      name: 'Neumorphic Soft',
      description: 'Diseño soft UI con sombras suaves'
    }
  };

  const handleSubmit = (e: React.FormEvent, status: 'success' | 'error') => {
    e.preventDefault();

    // Show loading
    setMessageStatus('loading');
    setMessageText('Authenticating...');

    // Simulate API call
    setTimeout(() => {
      if (status === 'success') {
        setMessageStatus('success');
        setMessageText('Welcome back! Redirecting to your dashboard...');

        // Simulate redirect after success
        setTimeout(() => {
          // window.location.href = callbackUrl;
        }, 2000);
      } else {
        setMessageStatus('error');
        setMessageText('Invalid credentials. Please check your email and password.');
      }
    }, 1500);
  };

  const renderModernGlass = () => (
    <div className="relative min-h-screen flex items-center justify-center p-8 overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Animated Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse delay-500"></div>

      {/* Glass Card */}
      <div className="relative w-full max-w-md">
        {/* Logo/Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-white/80 text-lg">Sign in to continue</p>
        </div>

        {/* Glass Form */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Status Message - Modern Glass Style */}
          {messageStatus !== 'idle' && (
            <div className={`mb-6 p-4 rounded-2xl backdrop-blur-xl border transition-all duration-500 transform ${
              messageStatus === 'loading'
                ? 'bg-blue-500/20 border-blue-300/30 animate-pulse'
                : messageStatus === 'success'
                ? 'bg-green-500/20 border-green-300/30 animate-slideIn'
                : 'bg-red-500/20 border-red-300/30 animate-shake'
            }`}>
              <div className="flex items-center gap-3">
                {messageStatus === 'loading' && (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                )}
                {messageStatus === 'success' && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-400/30 backdrop-blur-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                )}
                {messageStatus === 'error' && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-400/30 backdrop-blur-xl flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white font-medium">{messageText}</p>
                  {messageStatus === 'error' && (
                    <p className="text-white/70 text-sm mt-1">Please try again or reset your password</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/90">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-white/50 group-focus-within:text-white transition-colors" />
                </div>
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/90">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-white/50 group-focus-within:text-white transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-12 pr-12 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={(e) => handleSubmit(e, 'success')}
                disabled={messageStatus === 'loading'}
                className="flex-1 bg-white text-purple-600 py-3.5 rounded-xl font-semibold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {messageStatus === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Test Success
                    <CheckCircle className="w-5 h-5" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'error')}
                disabled={messageStatus === 'loading'}
                className="flex-1 bg-red-500/20 backdrop-blur-xl border border-red-300/30 text-white py-3.5 rounded-xl font-semibold hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  Test Error
                  <XCircle className="w-5 h-5" />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-white/80 hover:text-white transition-colors">Forgot password?</a>
              <a href="#" className="text-white/80 hover:text-white transition-colors">Create account</a>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-white/60 text-sm">
            <Shield className="w-4 h-4" />
            <span>Protected by AuthSystem</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMinimalClean = () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-900 mb-6">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-3xl font-light text-gray-900 mb-2">Sign In</h1>
          <p className="text-gray-500">Enter your credentials to continue</p>
        </div>

        {/* Status Message - Minimal Style */}
        {messageStatus !== 'idle' && (
          <div className={`mb-8 transition-all duration-500 ${
            messageStatus === 'loading'
              ? 'animate-pulse'
              : messageStatus === 'success'
              ? 'animate-slideIn'
              : 'animate-shake'
          }`}>
            <div className={`border-l-4 p-4 ${
              messageStatus === 'loading'
                ? 'bg-blue-50 border-blue-500'
                : messageStatus === 'success'
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-start gap-3">
                {messageStatus === 'loading' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin mt-0.5" />}
                {messageStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                {messageStatus === 'error' && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                <div className="flex-1">
                  <p className={`font-medium ${
                    messageStatus === 'loading'
                      ? 'text-blue-900'
                      : messageStatus === 'success'
                      ? 'text-green-900'
                      : 'text-red-900'
                  }`}>
                    {messageText}
                  </p>
                  {messageStatus === 'error' && (
                    <p className="text-red-700 text-sm mt-1">Double-check your credentials and try again</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <form className="space-y-8">
          <div className="relative">
            <input
              type="email"
              id="email-minimal"
              className="peer w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-300 text-gray-900 placeholder-transparent focus:border-gray-900 focus:outline-none transition-colors"
              placeholder="Email"
            />
            <label
              htmlFor="email-minimal"
              className="absolute left-0 -top-6 text-gray-600 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-focus:-top-6 peer-focus:text-gray-600 peer-focus:text-sm"
            >
              Email Address
            </label>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password-minimal"
              className="peer w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-300 text-gray-900 placeholder-transparent focus:border-gray-900 focus:outline-none transition-colors"
              placeholder="Password"
            />
            <label
              htmlFor="password-minimal"
              className="absolute left-0 -top-6 text-gray-600 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-focus:-top-6 peer-focus:text-gray-600 peer-focus:text-sm"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              onClick={(e) => handleSubmit(e, 'success')}
              disabled={messageStatus === 'loading'}
              className="flex-1 bg-gray-900 text-white py-4 font-medium hover:bg-gray-800 transition-colors relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {messageStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    Success Test
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'error')}
              disabled={messageStatus === 'loading'}
              className="flex-1 bg-red-600 text-white py-4 font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                Error Test
                <XCircle className="w-5 h-5" />
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors border-b border-transparent hover:border-gray-900">Forgot password?</a>
            <span className="text-gray-300">|</span>
            <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors border-b border-transparent hover:border-gray-900">Create account</a>
          </div>
        </form>

        <div className="mt-12 text-center text-sm text-gray-400">Protected by AuthSystem</div>
      </div>
    </div>
  );

  const renderCorporate = () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-blue-600 shadow-2xl shadow-blue-600/50 mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Corporate Access</h1>
          <p className="text-slate-600">Secure authentication portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
          {/* Status Message - Corporate Style */}
          {messageStatus !== 'idle' && (
            <div className={`mb-6 rounded-xl p-5 shadow-lg transition-all duration-500 ${
              messageStatus === 'loading'
                ? 'bg-blue-50 border-2 border-blue-200 animate-pulse'
                : messageStatus === 'success'
                ? 'bg-green-50 border-2 border-green-200 animate-slideIn'
                : 'bg-red-50 border-2 border-red-200 animate-shake'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                  messageStatus === 'loading'
                    ? 'bg-blue-100'
                    : messageStatus === 'success'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}>
                  {messageStatus === 'loading' && <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />}
                  {messageStatus === 'success' && <CheckCircle className="w-6 h-6 text-green-600" />}
                  {messageStatus === 'error' && <XCircle className="w-6 h-6 text-red-600" />}
                </div>
                <div className="flex-1 pt-1">
                  <h4 className={`font-bold text-sm mb-1 ${
                    messageStatus === 'loading'
                      ? 'text-blue-900'
                      : messageStatus === 'success'
                      ? 'text-green-900'
                      : 'text-red-900'
                  }`}>
                    {messageStatus === 'loading' && 'Authenticating'}
                    {messageStatus === 'success' && 'Authentication Successful'}
                    {messageStatus === 'error' && 'Authentication Failed'}
                  </h4>
                  <p className={`text-sm ${
                    messageStatus === 'loading'
                      ? 'text-blue-700'
                      : messageStatus === 'success'
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}>
                    {messageText}
                  </p>
                  {messageStatus === 'success' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                      <div className="w-full bg-green-200 rounded-full h-1.5">
                        <div className="bg-green-600 h-1.5 rounded-full animate-progress"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={(e) => handleSubmit(e, 'success')}
                disabled={messageStatus === 'loading'}
                className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {messageStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    <>
                      Success Test
                      <CheckCircle className="w-5 h-5" />
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'error')}
                disabled={messageStatus === 'loading'}
                className="flex-1 bg-red-600 text-white py-4 rounded-xl font-semibold hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/50 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  Error Test
                  <XCircle className="w-5 h-5" />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Forgot password?</a>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Request access</a>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm bg-white px-4 py-2 rounded-full shadow-md">
            <Shield className="w-4 h-4" />
            <span>256-bit SSL Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGradientBold = () => (
    <div className="relative min-h-screen flex items-center justify-center p-8 overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl shadow-blue-500/50 mb-6 transform hover:scale-110 transition-transform">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          {/* Status Message - Gradient Bold Style */}
          {messageStatus !== 'idle' && (
            <div className={`mb-6 rounded-2xl p-4 relative overflow-hidden transition-all duration-500 ${
              messageStatus === 'loading'
                ? 'animate-pulse'
                : messageStatus === 'success'
                ? 'animate-slideIn'
                : 'animate-shake'
            }`}>
              <div className={`absolute inset-0 ${
                messageStatus === 'loading'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20'
                  : messageStatus === 'success'
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                  : 'bg-gradient-to-r from-red-500/20 to-orange-500/20'
              }`}></div>
              <div className={`absolute inset-0 border-2 rounded-2xl ${
                messageStatus === 'loading'
                  ? 'border-cyan-500/30'
                  : messageStatus === 'success'
                  ? 'border-green-500/30'
                  : 'border-red-500/30'
              }`}></div>
              <div className="relative flex items-center gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  messageStatus === 'loading'
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                    : messageStatus === 'success'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                    : 'bg-gradient-to-br from-red-500 to-orange-500'
                }`}>
                  {messageStatus === 'loading' && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                  {messageStatus === 'success' && <CheckCircle className="w-5 h-5 text-white" />}
                  {messageStatus === 'error' && <XCircle className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{messageText}</p>
                  {messageStatus === 'error' && (
                    <p className="text-slate-300 text-sm mt-1">Verify your information and try again</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <div className="relative group">
                <input
                  type="email"
                  className="w-full px-4 py-4 bg-slate-900/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  placeholder="you@example.com"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-4 bg-slate-900/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={(e) => handleSubmit(e, 'success')}
                disabled={messageStatus === 'loading'}
                className="relative flex-1 py-4 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center justify-center gap-2">
                  {messageStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      Success
                      <CheckCircle className="w-5 h-5" />
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'error')}
                disabled={messageStatus === 'loading'}
                className="relative flex-1 py-4 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center justify-center gap-2">
                  Error
                  <XCircle className="w-5 h-5" />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">Forgot password?</a>
              <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">Create account</a>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>Secured by AuthSystem</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNeumorphic = () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shadow-neumorphic mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h1>
          <p className="text-gray-600">Access your account</p>
        </div>

        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl p-8 shadow-neumorphic">
          {/* Status Message - Neumorphic Style */}
          {messageStatus !== 'idle' && (
            <div className={`mb-6 rounded-2xl p-5 transition-all duration-500 ${
              messageStatus === 'loading'
                ? 'shadow-neumorphic-inset animate-pulse'
                : messageStatus === 'success'
                ? 'shadow-neumorphic animate-slideIn'
                : 'shadow-neumorphic animate-shake'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-neumorphic ${
                  messageStatus === 'loading'
                    ? 'bg-blue-400'
                    : messageStatus === 'success'
                    ? 'bg-green-400'
                    : 'bg-red-400'
                }`}>
                  {messageStatus === 'loading' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                  {messageStatus === 'success' && <CheckCircle className="w-6 h-6 text-white" />}
                  {messageStatus === 'error' && <XCircle className="w-6 h-6 text-white" />}
                </div>
                <div className="flex-1 pt-2">
                  <p className={`font-bold text-sm mb-1 ${
                    messageStatus === 'loading'
                      ? 'text-blue-900'
                      : messageStatus === 'success'
                      ? 'text-green-900'
                      : 'text-red-900'
                  }`}>
                    {messageStatus === 'loading' && 'Authenticating...'}
                    {messageStatus === 'success' && 'Success!'}
                    {messageStatus === 'error' && 'Authentication Error'}
                  </p>
                  <p className="text-gray-700 text-sm">{messageText}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none shadow-neumorphic-inset transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-12 pr-12 py-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none shadow-neumorphic-inset transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={(e) => handleSubmit(e, 'success')}
                disabled={messageStatus === 'loading'}
                className="flex-1 py-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl font-semibold text-gray-800 shadow-neumorphic hover:shadow-neumorphic-hover active:shadow-neumorphic-inset transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {messageStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading
                    </>
                  ) : (
                    <>
                      Success
                      <CheckCircle className="w-5 h-5" />
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'error')}
                disabled={messageStatus === 'loading'}
                className="flex-1 py-4 bg-red-400 rounded-xl font-semibold text-white shadow-neumorphic hover:shadow-neumorphic-hover active:shadow-neumorphic-inset transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  Error
                  <XCircle className="w-5 h-5" />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-gray-600 hover:text-gray-800 transition-colors">Forgot password?</a>
              <a href="#" className="text-gray-600 hover:text-gray-800 transition-colors">Create account</a>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500 text-sm bg-gradient-to-br from-gray-100 to-gray-200 px-4 py-2 rounded-full shadow-neumorphic-sm">
            <Shield className="w-4 h-4" />
            <span>Protected by AuthSystem</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Style Selector */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-4 border border-gray-200">
          <div className="flex items-center gap-2">
            {Object.entries(styles).map(([key, { name, description }]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveStyle(key as FormStyle);
                  setMessageStatus('idle');
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeStyle === key
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={description}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-3 text-center text-xs text-gray-500">
            Click "Test Success" or "Test Error" to see message states
          </div>
        </div>
      </div>

      {/* Render Active Style */}
      <div className="transition-all duration-500">
        {activeStyle === 'modern-glass' && renderModernGlass()}
        {activeStyle === 'minimal-clean' && renderMinimalClean()}
        {activeStyle === 'corporate' && renderCorporate()}
        {activeStyle === 'gradient-bold' && renderGradientBold()}
        {activeStyle === 'neumorphic' && renderNeumorphic()}
      </div>

      {/* Custom Styles */}
      <style>{`
        .shadow-neumorphic {
          box-shadow: 8px 8px 16px rgba(163, 177, 198, 0.6),
                      -8px -8px 16px rgba(255, 255, 255, 0.5);
        }
        .shadow-neumorphic-hover {
          box-shadow: 4px 4px 8px rgba(163, 177, 198, 0.6),
                      -4px -4px 8px rgba(255, 255, 255, 0.5);
        }
        .shadow-neumorphic-inset {
          box-shadow: inset 4px 4px 8px rgba(163, 177, 198, 0.5),
                      inset -4px -4px 8px rgba(255, 255, 255, 0.5);
        }
        .shadow-neumorphic-sm {
          box-shadow: 4px 4px 8px rgba(163, 177, 198, 0.4),
                      -4px -4px 8px rgba(255, 255, 255, 0.4);
        }
        .delay-500 {
          animation-delay: 500ms;
        }
        .delay-1000 {
          animation-delay: 1000ms;
        }
        @keyframes slideIn {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-progress {
          animation: progress 2s ease-in-out;
        }
      `}</style>
    </div>
  );
}
