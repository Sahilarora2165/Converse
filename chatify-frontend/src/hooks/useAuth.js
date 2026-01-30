import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext'; // Import the named export

const useAuth = () => {
    return useContext(AuthContext);
};

export default useAuth;