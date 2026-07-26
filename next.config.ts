import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 LAN의 다른 기기에서 개발 서버를 열 때 HMR이 막히지 않도록 허용한다.
  //
  // 여기서 막히면 증상이 엉뚱한 곳에 나타난다. HMR 소켓이 실패하면 페이지가
  // 반복해서 새로고침되고, 편집기가 협업 서버에 붙기도 전에 언마운트되어
  // 상단 바가 "연결 중…"에서 멈춘다.
  //
  // CIDR(192.168.1.0/24)은 파싱되지 않는다. 호스트를 정확히 적어야 한다.
  // 터널이나 리버스 프록시로 여는 도메인도 여기에 넣어야 한다.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.1.64",
    "study.19921005.xyz",
  ],
};

export default nextConfig;
