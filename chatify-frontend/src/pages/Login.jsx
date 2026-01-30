import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { loginAPI } from '../services/api';
import { User, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

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
            const token = response.data.accessToken;

            if (!token) throw new Error();

            login(response.data, token);
            navigate('/chat');
        } catch {
            setError('Access Denied: Invalid Credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center pt-24 bg-black">




            {/* Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#0a0a0a] to-black opacity-80" />
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '60px 60px'
                }}
            />

            {/* Login Container */}
            <div className="relative z-10 w-full max-w-xl px-4 py-20">

                {/* Header */}
                <div className="flex flex-col items-center mb-20 space-y-8">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <ShieldCheck className="w-10 h-10 text-white/90" strokeWidth={1} />
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-4xl font-light tracking-[0.25em]">NEXUS</h2>
                        <p className="text-zinc-500 text-xs uppercase tracking-[0.3em]">
                            Secure Access Terminal
                        </p>
                    </div>
                </div>

                {/* Glass Panel */}
                <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-3xl px-12 py-16 shadow-2xl ring-1 ring-white/5 relative">

                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    {error && (
                        <div className="mb-10 p-4 bg-red-500/10 border-l-2 border-red-500 text-red-200 text-sm">
                            <strong className="mr-2">ERROR:</strong> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-12">

                        {/* Identity */}
                        <div className="space-y-5">
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                                Identity
                            </label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-white transition" />
                                <input
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-base focus:outline-none focus:border-white/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-white/20 transition"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Passcode */}
                        <div className="space-y-5">
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                                Passcode
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-white transition" />
                                <input
                                    type="password"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-base focus:outline-none focus:border-white/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-white/20 transition"
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            disabled={loading}
                            className="group w-full bg-white text-black font-semibold p-4 rounded-xl uppercase tracking-[0.15em] hover:bg-zinc-200 transition flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] mt-10"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Initialize Session
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-14 text-center border-t border-white/5 pt-8">
                        <Link
                            to="/register"
                            className="text-zinc-500 text-xs uppercase tracking-widest hover:text-white transition underline-offset-4 hover:underline"
                        >
                            Register New Pilot
                        </Link>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="absolute bottom-8 w-full text-center">
                <p className="text-zinc-800 text-[10px] uppercase tracking-[0.5em]">
                    System Status: Nominal • V.2.4.0
                </p>
            </div>
        </div>
    );
};

export default Login;
