import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { loginAPI } from '../services/api';
import { API_URL } from '../utils/constants';
import { User, Lock, ArrowRight, Loader2, MessageCircle, AlertCircle } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await loginAPI(email, password);


            login(response.data, response.data.accessToken, response.data.refreshToken);
            navigate('/chat');
        } catch {
            setError('Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-black selection:bg-indigo-500/30">

            {/* Ambient Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            </div>

            <div className="relative z-10 w-full max-w-md px-6">

                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 ring-1 ring-white/5 shadow-2xl backdrop-blur-md">
                        <MessageCircle className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">
                        Converse
                    </h1>
                    <h2 className="text-xl font-medium tracking-tight text-zinc-300 mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        Sign in to continue your conversations.
                    </p>
                </div>

                {/* Card */}
                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5 relative overflow-hidden">

                    {/* Top Gradient Line */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Email */}
                            <div className="group">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="block w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                        placeholder="Email Address"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="group">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="block w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                        placeholder="Password"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative group overflow-hidden rounded-xl p-px"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                            <div className="relative bg-zinc-900 rounded-xl p-4 flex items-center justify-center transition-transform group-hover:scale-[0.99]">
                                {loading ? (
                                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                                ) : (
                                    <>
                                        <span className="font-semibold text-white mr-2">Sign In</span>
                                        <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                    {/* Divider */}
                    <div className="mt-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-zinc-600 text-xs">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Google OAuth Button */}
                    <button
                        onClick={() => window.location.href = `${API_URL}/oauth2/authorization/google`}
                        className="mt-4 w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-white text-sm font-medium">Continue with Google</span>
                    </button>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-zinc-500 text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            Register now
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;