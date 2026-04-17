import React from 'react';

const Layout = ({ children, role, onLogout }) => {
  return (
    <div className="layout">
      <header className="navbar">
        <div className="logo">FoodGuard (푸드가드)</div>
        <nav>
          {role === 'owner' && (
            <ul>
              <li>매출 입력</li>
              <li>AI 수요 예측</li>
              <li>식자재 발주</li>
              <li>재고 현황</li>
            </ul>
          )}
          {role === 'admin' && (
            <ul>
              <li>전 가맹점 현황</li>
              <li>폐기율 통계</li>
              <li>발주 승인/관리</li>
            </ul>
          )}
        </nav>
        <button onClick={onLogout}>로그아웃</button>
      </header>
      <main className="content">{children}</main>
      <footer className="footer">
        <p>&copy; 2026 FoodGuard AI Project Team 1</p>
      </footer>
    </div>
  );
};

export default Layout;
