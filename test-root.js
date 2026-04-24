import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/');
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response body (first 100 chars):', text.substring(0, 100));
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
