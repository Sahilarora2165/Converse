import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { loginAPI } from '../services/api'; // We made this in Step 1

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth(); // Using the hook from Step 3
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');

            try {
                const response = await loginAPI(email, password);
                console.log("LOGIN RESPONSE:", response.data);

                // FIX: Read 'accessToken' from the response
                const token = response.data.accessToken;
                const userData = response.data;

                if (token) {
                    // We manually pass the token to our Auth Context
                    login(userData, token);
                    navigate('/chat');
                } else {
                    setError("Login succeeded but no token received!");
                }

            } catch (err) {
                console.error("Login Error:", err);
                setError('Invalid Credentials. Please try again.');
            }
        };

    return (
        <div className="h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Welcome Back</h2>

                {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <input
                        className="w-full p-2 border mb-4 rounded"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        className="w-full p-2 border mb-6 rounded"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                        Login
                    </button>
                </form>
                <div className="mt-4 text-center">
                    <Link to="/register" className="text-blue-500 text-sm">Create an account</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;