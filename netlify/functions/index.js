const https = require('https');

// 인증서 줄바꿈 처리 함수
const fixCert = (cert) => cert ? cert.replace(/\\n/g, '\n') : '';

const options = {
  cert: fixCert(process.env.TOSS_CERT),
  key: fixCert(process.env.TOSS_KEY),
  rejectUnauthorized: true,
};

// Netlify Functions 규격에 맞춘 핸들러 함수
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  // event.path를 분석하여 라우팅 처리
  // 기본 경로(/.netlify/functions/index) 또는 뒤에 슬래시가 붙은 경우
  if (event.path === '/.netlify/functions/index' || event.path === '/.netlify/functions/index/') {
    return {
      statusCode: 200,
      headers,
      body: '서버가 정상적으로 살아있습니다! 뒤에 /toss 를 붙여서 접속해보세요.'
    };
  }

  // 토스 요청 경로 (/.netlify/functions/index/toss)
  if (event.path.endsWith('/toss')) {
    console.log("토스 요청 시작...");

    return new Promise((resolve) => {
      const tossReq = https.request(
        'https://apps-in-toss-api.toss.im/v1/user/authorize', 
        { method: 'GET', ...options },
        (tossRes) => {
          let data = '';
          tossRes.on('data', (chunk) => (data += chunk));
          tossRes.on('end', () => {
            resolve({
              statusCode: tossRes.statusCode,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: data
            });
          });
        }
      );

      tossReq.on('error', (e) => {
        resolve({
          statusCode: 500,
          headers,
          body: "연결 에러: " + e.message
        });
      });

      tossReq.end();
    });
  }

  // 매칭되는 경로가 없을 때 404 반환
  return {
    statusCode: 404,
    headers,
    body: '찾을 수 없는 경로입니다. (Not Found)'
  };
};
