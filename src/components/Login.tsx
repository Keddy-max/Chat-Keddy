import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Github, Mail } from 'lucide-react';

export default function Login() {
  const { signInWithGoogle, signInWithGithub, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login component error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked! Please look for a small icon in your browser address bar to allow popups, or open the app in a "New Tab" using the button in the top right corner.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. If you didn\'t close it, your browser might have blocked the popup. We recommend opening the app in a New Tab (button in the top right corner) for the best sign-in experience.');
      } else if (err.message?.includes('cross-origin')) {
        setError('Authentication issue due to browser security. Please open the app in a New Tab (top right corner button) to sign in securely.');
      } else {
        setError(err.message || 'Something went wrong with Google Sign-In. Please try again.');
      }
    }
  };

  const handleGithubSignIn = async () => {
    setError('');
    try {
      await signInWithGithub();
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked! Please try opening the app in a new tab using the icon in the top right of this preview.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup closed. Browsers often block popups in this preview iframe. Please open the app in a New Tab (top right corner button) to sign in.');
      } else {
        setError(err.message || 'Something went wrong with GitHub Sign-In. Please try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-green-600/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-green-600/10 border border-green-600/20 text-yellow-500">
            <div className="absolute inset-0 rounded-2xl bg-yellow-500/20 blur-md -z-10"></div>
            <span className="text-3xl font-bold">K</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-100">
          {isSignUp ? 'Create your Keddy AI account' : 'Sign in to Keddy AI'}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Your Ghanaian AI Assistant
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                {error}
              </div>
            )}
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-zinc-950 bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Sign up' : 'Sign in')}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900 text-zinc-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              type="button"
              className="w-full flex justify-center py-2.5 px-4 border border-zinc-700 rounded-xl shadow-sm bg-zinc-800 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Mail className="w-5 h-5 mr-2 text-red-500" />
              {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </button>

            <button
              onClick={handleGithubSignIn}
              type="button"
              className="w-full flex justify-center py-2.5 px-4 border border-zinc-700 rounded-xl shadow-sm bg-zinc-800 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Github className="w-5 h-5 mr-2" />
              {isSignUp ? 'Sign up with GitHub' : 'Sign in with GitHub'}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-900 text-zinc-500">
                  {isSignUp ? 'Already have an account?' : 'New to Keddy AI?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full flex justify-center py-2.5 px-4 border border-zinc-700 rounded-xl shadow-sm bg-zinc-950 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                {isSignUp ? 'Sign in instead' : 'Create an account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
