import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerAPI } from '../services/api';
import { User, Mail, Lock, ArrowRight, Loader2, Sparkles, CheckCircle } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await registerAPI(formData);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-black selection:bg-indigo-500/30">

            {/* Ambient Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            </div>

            <div className="relative z-10 w-full max-w-md px-6">

                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-white/5 border border-white/10 ring-1 ring-white/5 shadow-2xl backdrop-blur-md">
                        <Sparkles className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-medium tracking-tight text-white mb-2">
                        Create Account
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        Join the network and start chatting securely.
                    </p>
                </div>

                {/* Card */}
                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5 relative overflow-hidden">

                    {/* Top Gradient Line */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                <CheckCircle className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-xl font-medium text-white">Access Granted</h3>
                            <p className="text-zinc-400 text-sm">Redirecting to login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {error && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Username */}
                                <div className="group">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                        </div>
                                        <input
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            required
                                            className="block w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                            placeholder="Username"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="group">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
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
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
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
                                            <span className="font-semibold text-white mr-2">Create Account</span>
                                            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-zinc-500 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;