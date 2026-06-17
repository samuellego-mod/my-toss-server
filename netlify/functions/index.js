// 줄바꿈 문자(\\n)를 실제 개행 문자(\n)로 복원하는 함수
const fixCert = (cert) => (cert ? cert.replace(/\\n/g, '\n') : '');

exports.handler = async (event, context) => {
  // 공통 CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  };

  // 요청 경로 정규화 (끝에 붙은 슬래시 제거 및 소문자화)
  const path = event.path.replace(/\/$/, '');

  // 1. 기본 경로 체크
  if (path === '/.netlify/functions/index' || path === '/.netlify/functions') {
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      body: '서버가 정상적으로 살아있습니다! 뒤에 /toss 를 붙여서 접속해보세요.',
    };
  }

  // 2. 토스 요청 경로 체크
  if (path.endsWith('/toss')) {
    console.log("토스 mTLS 요청 시작...");

    const cert = fixCert(process.env.TOSS_CERT);
    const key = fixCert(process.env.TOSS_KEY);

    // 인증서가 환경 변수에 없는 경우 에러 처리
    if (!cert || !key) {
      console.error("에러: TOSS_CERT 또는 TOSS_KEY 환경변수가 설정되지 않았습니다.");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "서버 내부 인증서 설정 에러 (환경 변수를 확인하세요)" }),
      };
    }

    try {
      // Node.js 최신 환경의 내장 fetch 활용 (상태 관리가 엄격한 mTLS 옵션 지정)
      const response = await fetch('https://apps-in-toss-api.toss.im/v1/user/authorize', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Netlify-Serverless-Function',
        },
        // mTLS용 인증서 주입 방식
        dispatcher: new globalThis.fetch.Dispatcher({
          connect: {
            cert: cert,
            key: key,
            rejectUnauthorized: true, // 보안 검증 활성화
          }
        })
      });

      const responseData = await response.text();
      console.log(`토스 응답 수신 (상태 코드: ${response.statusCode || response.status})`);

      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        body: responseData,
      };

    } catch (error) {
      console.error("토스 API 연결 중 치명적 에러 발생:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "토스 서버 연결 실패",
          message: error.message,
        }),
      };
    }
  }

  // 3. 경로가 맞지 않을 때
  return {
    statusCode: 404,
    headers,
    body: '찾을 수 없는 경로입니다. (Not Found)',
  };
};
