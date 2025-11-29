import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      <Outlet />
    </div>
  );
};

export default Layout;
