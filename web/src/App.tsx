import { Link, Route, Routes } from 'react-router-dom';
import Admin from './pages/Admin';
import Join from './pages/Join';
import Landing from './pages/Landing';
import Play from './pages/Play';
import Screen from './pages/Screen';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">404</p>
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <Link to="/" className="btn-accent">
        처음으로
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/join" element={<Join />} />
      <Route path="/play" element={<Play />} />
      <Route path="/screen/:joinCode" element={<Screen />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
