import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth(); // Change isAuthenticated to user
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) { // Check if user exists
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;