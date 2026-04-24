import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/health');
    console.log('Health check status:', res.status);
    const contentType = res.headers.get('content-type');
    console.log('Content-Type:', contentType);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Health check failed:', e.message);
  }
}

test();
