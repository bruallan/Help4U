import https from 'https';

https.get('https://help4u.com.br/wp-content/uploads/2025/07/Help4u-v2-1-scaled.png', (res) => {
  console.log('Logo status code:', res.statusCode);
});
