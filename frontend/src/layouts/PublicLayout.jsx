import { Outlet } from 'react-router-dom';
import Navbar from '../components/navigation/Navbar';

export default function PublicLayout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
