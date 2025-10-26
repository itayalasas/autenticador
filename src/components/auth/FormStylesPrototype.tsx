import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Shield, Sparkles } from 'lucide-react';

type FormStyle = 'modern-glass' | 'minimal-clean' | 'corporate' | 'gradient-bold' | 'neumorphic';

export default function FormStylesPrototype() {
  const [activeStyle, setActiveStyle] = useState<FormStyle>('modern-glass');
  const [showPassword, setShowPassword] = useState(false);

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
          <form className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/90">
                Email Address
              </label>
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

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/90">
                Password
              </label>
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

            {/* Sign In Button */}
            <button
              type="submit"
              className="w-full bg-white text-purple-600 py-3.5 rounded-xl font-semibold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            >
              <span className="flex items-center justify-center gap-2">
                Sign In
                <ArrowRight className="w-5 h-5" />
              </span>
            </button>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-white/80 hover:text-white transition-colors">
                Forgot password?
              </a>
              <a href="#" className="text-white/80 hover:text-white transition-colors">
                Create account
              </a>
            </div>
          </form>
        </div>

        {/* Footer */}
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
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-900 mb-6">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-3xl font-light text-gray-900 mb-2">Sign In</h1>
          <p className="text-gray-500">Enter your credentials to continue</p>
        </div>

        {/* Form */}
        <form className="space-y-8">
          {/* Email Input - Underlined Style */}
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

          {/* Password Input - Underlined Style */}
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

          {/* Sign In Button */}
          <button
            type="submit"
            className="w-full bg-gray-900 text-white py-4 font-medium hover:bg-gray-800 transition-colors relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              Sign In
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
          </button>

          {/* Links */}
          <div className="flex items-center justify-center gap-8 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors border-b border-transparent hover:border-gray-900">
              Forgot password?
            </a>
            <span className="text-gray-300">|</span>
            <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors border-b border-transparent hover:border-gray-900">
              Create account
            </a>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-400">
          Protected by AuthSystem
        </div>
      </div>
    </div>
  );

  const renderCorporate = () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-blue-600 shadow-2xl shadow-blue-600/50 mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Corporate Access</h1>
          <p className="text-slate-600">Secure authentication portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
          <form className="space-y-6">
            {/* Email Input - Filled Style */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Email Address
              </label>
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

            {/* Password Input - Filled Style */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Password
              </label>
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

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-slate-600">
                Keep me signed in
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40"
            >
              <span className="flex items-center justify-center gap-2">
                Sign In Securely
                <ArrowRight className="w-5 h-5" />
              </span>
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">Need help?</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Forgot password?
              </a>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Request access
              </a>
            </div>
          </form>
        </div>

        {/* Security Badge */}
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
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl shadow-blue-500/50 mb-6 transform hover:scale-110 transition-transform">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <form className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="relative group">
                <input
                  type="email"
                  className="w-full px-4 py-4 bg-slate-900/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  placeholder="you@example.com"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
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

            {/* Sign In Button - Gradient */}
            <button
              type="submit"
              className="relative w-full py-4 rounded-xl font-semibold text-white overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center justify-center gap-2">
                Sign In
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </a>
              <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                Create account
              </a>
            </div>
          </form>
        </div>

        {/* Footer */}
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shadow-neumorphic mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h1>
          <p className="text-gray-600">Access your account</p>
        </div>

        {/* Neumorphic Card */}
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl p-8 shadow-neumorphic">
          <form className="space-y-6">
            {/* Email Input - Neumorphic */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
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

            {/* Password Input - Neumorphic */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
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

            {/* Sign In Button - Neumorphic */}
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl font-semibold text-gray-800 shadow-neumorphic hover:shadow-neumorphic-hover active:shadow-neumorphic-inset transition-all transform active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                Sign In
                <ArrowRight className="w-5 h-5" />
              </span>
            </button>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <a href="#" className="text-gray-600 hover:text-gray-800 transition-colors">
                Forgot password?
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-800 transition-colors">
                Create account
              </a>
            </div>
          </form>
        </div>

        {/* Footer */}
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
                onClick={() => setActiveStyle(key as FormStyle)}
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

      {/* Custom Styles for Neumorphic */}
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
      `}</style>
    </div>
  );
}
