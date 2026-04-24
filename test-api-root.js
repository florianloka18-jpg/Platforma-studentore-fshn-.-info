import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api');
    console.log('Status:', res.status);
    const contentType = res.headers.get('content-type');
    console.log('Content-Type:', contentType);
    const text = await res.text();
    console.log('Response body (first 100 chars):', text.substring(0, 100));
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
