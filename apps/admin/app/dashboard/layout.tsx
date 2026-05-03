import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import AiChatProvider from '../components/AiChatProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AiChatProvider>
      <div className="admin-layout">
        <Sidebar />
        <div className="admin-main">
          <TopBar />
          <main className="admin-content">
            {children}
          </main>
        </div>
      </div>
    </AiChatProvider>
  );
}
