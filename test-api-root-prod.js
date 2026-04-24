import fetch from 'node-fetch';

async function test() {
  try {
    // We can't change the server's env var from here, but we can see how it behaves.
    const res = await fetch('http://localhost:3000/api');
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response body (first 100 chars):', text.substring(0, 100));
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
