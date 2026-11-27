export const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    // 만료된 토큰은 없는 것으로 본다 (로그인 상태로 남아 화면마다 '불러오지 못했습니다'가 뜨던 문제)
    if (payload?.exp && payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
};
