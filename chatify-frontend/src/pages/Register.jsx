import React from 'react';
import { Link } from 'react-router-dom';

// Note: I am keeping this visual-only for now as your original file had no logic.
// We will add the registration logic in the next steps.

const Register = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white font-sans selection:bg-white selection:text-black">

            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-8 shadow-2xl">

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-semibold tracking-tight">New Entry</h2>
                    <p className="text-zinc-500 text-sm mt-2">Create a profile to access the system.</p>
                </div>

                {/* Placeholder Form Structure - Visual Only */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
                            Identity (Email)
                        </label>
                        <input
                            className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:outline-none focus:border-white transition-colors placeholder-zinc-700"
                            placeholder="name@example.com"
                            type="email"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
                            Set Passcode
                        </label>
                        <input
                            className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:outline-none focus:border-white transition-colors placeholder-zinc-700"
                            type="password"
                            placeholder="••••••••"
                        />
                    </div>

                    <button className="w-full bg-zinc-800 text-zinc-400 font-bold p-3 text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-colors mt-4">
                        Register Pilot
                    </button>
                </div>

                <div className="mt-8 text-center border-t border-zinc-900 pt-6">
                    <span className="text-zinc-600 text-sm">Already authorized? </span>
                    <Link to="/login" className="text-white text-sm hover:underline decoration-zinc-500 underline-offset-4 ml-1">
                        Access Portal
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;