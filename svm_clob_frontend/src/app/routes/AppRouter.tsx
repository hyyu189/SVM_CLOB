import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { HomePage } from '../../features/home/pages/HomePage';
import { TradePage } from '../../features/trade/pages/TradePage';
import { PortfolioPage } from '../../features/portfolio/pages/PortfolioPage';

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/trade" element={<TradePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
