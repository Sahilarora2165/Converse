import React from 'react';
import { Link } from 'react-router-dom';

const Register = () => {
    return (
        <div className="h-screen flex flex-col items-center justify-center">
            <h2 className="text-2xl mb-4">Register Page</h2>
            <Link to="/login" className="text-blue-500">Back to Login</Link>
        </div>
    );
};

export default Register;